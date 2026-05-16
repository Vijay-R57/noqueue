@echo off
:: ============================================================
:: NoQueue Full-Stack Launcher
:: Starts Backend → waits for healthy → starts Print Agent
:: Place this in: b_ZANqG4V0xjf\ (the root workspace folder)
:: ============================================================

setlocal enabledelayedexpansion

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%noqueue-backend"
set "AGENT_DIR=%ROOT%print-agent"
set "LOG_DIR=%ROOT%logs"
set "BACKEND_LOG=%LOG_DIR%\backend.log"
set "AGENT_LOG=%LOG_DIR%\agent.log"
set "BACKEND_URL=http://localhost:8080/api/v1/health"
set "BACKEND_WAIT_SEC=60"

:: ── Create logs directory ────────────────────────────────────
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo ============================================================
echo   NoQueue Local Startup
echo   %date% %time%
echo ============================================================
echo.

:: ── Check Java ───────────────────────────────────────────────
echo [1/4] Checking Java...
java -version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Java not found. Install Java 17+ and add it to PATH.
    pause & exit /b 1
)
echo       Java OK.

:: ── STEP 2: Start Spring Boot Backend ────────────────────────
echo [2/4] Starting Spring Boot backend...
if not exist "%BACKEND_DIR%\gradlew.bat" (
    echo [ERROR] Backend not found at: %BACKEND_DIR%
    pause & exit /b 1
)

start "NoQueue Backend" /MIN cmd /c "cd /d "%BACKEND_DIR%" && .\gradlew.bat bootRun >> "%BACKEND_LOG%" 2>&1"

echo       Backend process started. Waiting for it to be healthy...
echo       (Logs: %BACKEND_LOG%)
echo.

:: ── STEP 3: Wait for backend health ──────────────────────────
echo [3/4] Polling %BACKEND_URL%
set /a elapsed=0

:WAIT_LOOP
timeout /t 3 /nobreak >nul
set /a elapsed+=3

:: Use PowerShell to check the HTTP endpoint
powershell -NoProfile -Command ^
  "try { $r=(Invoke-WebRequest -Uri '%BACKEND_URL%' -TimeoutSec 2 -UseBasicParsing).StatusCode; if($r -eq 200){exit 0} exit 1 } catch { exit 1 }" >nul 2>&1

if %errorlevel% == 0 goto BACKEND_HEALTHY

if %elapsed% GEQ %BACKEND_WAIT_SEC% (
    echo [ERROR] Backend did not become healthy within %BACKEND_WAIT_SEC%s.
    echo         Check logs: %BACKEND_LOG%
    pause & exit /b 1
)

echo       Still waiting... (%elapsed%s elapsed)
goto WAIT_LOOP

:BACKEND_HEALTHY
echo       [OK] Backend is HEALTHY after %elapsed%s!
echo.

:: ── STEP 4: Start Print Agent ─────────────────────────────────
echo [4/4] Starting Print Agent...
if not exist "%AGENT_DIR%\gradlew.bat" (
    echo [WARN] Print agent not found at: %AGENT_DIR% — skipping.
    goto DONE
)

start "NoQueue Agent" /MIN cmd /c "cd /d "%AGENT_DIR%" && .\gradlew.bat run >> "%AGENT_LOG%" 2>&1"

echo       Agent process started.
echo       (Logs: %AGENT_LOG%)
echo.

:DONE
echo ============================================================
echo   NoQueue is starting up!
echo ============================================================
echo.
echo   Backend:   http://localhost:8080
echo   Frontend:  http://localhost:3000  (start separately with: pnpm dev)
echo   Agent Log: %AGENT_LOG%
echo   Backend Log: %BACKEND_LOG%
echo.
echo   Admin heartbeat will be visible in the dashboard in ~10s.
echo.
pause
endlocal
