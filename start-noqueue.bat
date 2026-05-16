@echo off
:: ============================================================
:: NoQueue Full-Stack Launcher
:: Starts Backend → waits for healthy → starts Print Agent
:: ============================================================

setlocal enabledelayedexpansion

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%noqueue-backend"
set "AGENT_DIR=%ROOT%print-agent"
set "LOG_DIR=%ROOT%logs"
set "BACKEND_LOG=%LOG_DIR%\backend.log"
set "AGENT_LOG=%LOG_DIR%\agent.log"
set "BACKEND_URL=http://localhost:8080/api/v1/health"
set /a BACKEND_WAIT_SEC=180
set /a elapsed=0

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo ============================================================
echo   NoQueue Local Startup  ^|  %date% %time%
echo ============================================================
echo.

:: ── [1] Java check ───────────────────────────────────────────
echo [1/4] Checking Java...
java -version >nul 2>&1
if errorlevel 1 ( echo [ERROR] Java 17+ not found. & pause & exit /b 1 )
echo       Java OK.

:: ── [2] Backend: skip if already healthy ─────────────────────
echo [2/4] Checking backend...
powershell -NoProfile -NonInteractive -Command ^
  "try{if((Invoke-WebRequest '%BACKEND_URL%' -TimeoutSec 2 -UseBasicParsing).StatusCode -eq 200){exit 0}exit 1}catch{exit 1}" >nul 2>&1

if %errorlevel% == 0 (
    echo       [OK] Backend already healthy. Skipping launch.
    goto BACKEND_HEALTHY
)

:: Check port conflict
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":8080 " ^| findstr "LISTENING"') do (
    echo [WARN] Port 8080 in use by PID %%p.
    echo        Killing it now...
    taskkill /PID %%p /F >nul 2>&1
    ping 127.0.0.1 -n 3 >nul
)

:: Start backend minimized
if not exist "%BACKEND_DIR%\gradlew.bat" (
    echo [ERROR] Backend not found: %BACKEND_DIR%
    pause & exit /b 1
)
start "NoQueue Backend" /MIN cmd /c "cd /d "%BACKEND_DIR%" && gradlew.bat bootRun >> "%BACKEND_LOG%" 2>&1"
echo       Backend launched. Waiting for Spring Boot to start...
echo       (tail logs: %BACKEND_LOG%)
echo.

:: ── [3] Wait loop — uses ping for portable sleep ─────────────
echo [3/4] Polling health endpoint (up to %BACKEND_WAIT_SEC%s)...

:WAIT_LOOP
ping 127.0.0.1 -n 4 >nul
set /a elapsed+=3

powershell -NoProfile -NonInteractive -Command ^
  "try{if((Invoke-WebRequest '%BACKEND_URL%' -TimeoutSec 2 -UseBasicParsing).StatusCode -eq 200){exit 0}exit 1}catch{exit 1}" >nul 2>&1

if %errorlevel% == 0 goto BACKEND_HEALTHY

if %elapsed% GEQ %BACKEND_WAIT_SEC% (
    echo.
    echo [ERROR] Backend not healthy after %BACKEND_WAIT_SEC%s. Last log:
    powershell -NoProfile -NonInteractive -Command "Get-Content '%BACKEND_LOG%' -Tail 15 -ErrorAction SilentlyContinue"
    pause & exit /b 1
)

set /a mod=%elapsed% %% 12
if %mod% == 0 echo       Still waiting... (%elapsed%s ^| compiling Spring Boot)
goto WAIT_LOOP

:BACKEND_HEALTHY
echo       [OK] Backend HEALTHY! (%elapsed%s)
echo.

:: ── [4] Agent: skip if already on 9090 ───────────────────────
echo [4/4] Starting Print Agent...

for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":9090 " ^| findstr "LISTENING"') do (
    echo       [OK] Agent already running on :9090. Skipping.
    goto DONE
)

if not exist "%AGENT_DIR%\gradlew.bat" (
    echo [WARN] Agent not found: %AGENT_DIR% — skipping.
    goto DONE
)

start "NoQueue Agent" /MIN cmd /c "cd /d "%AGENT_DIR%" && gradlew.bat run >> "%AGENT_LOG%" 2>&1"
echo       Agent launched. Heartbeat will appear in dashboard ~10s.
echo       (Logs: %AGENT_LOG%)

:DONE
echo.
echo ============================================================
echo   NoQueue is UP!
echo ============================================================
echo.
echo   Backend  : http://localhost:8080
echo   Health   : http://localhost:8080/api/v1/health
echo   Frontend : http://localhost:3000  (pnpm dev)
echo.
echo   Logs:
echo     %BACKEND_LOG%
echo     %AGENT_LOG%
echo.
pause
endlocal
