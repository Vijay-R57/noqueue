@echo off
:: ============================================================
:: NoQueue Print Agent — Startup Launcher
:: Place this in the same folder as the agent .jar file
:: Or add it to Windows Startup for auto-launch on login
:: ============================================================

setlocal

:: ── Configuration ────────────────────────────────────────────
set "AGENT_DIR=%~dp0"
set "JAR_NAME=print-agent-all.jar"
set "LOG_FILE=%AGENT_DIR%logs\agent.log"
set "BACKEND_URL=http://localhost:8080/api/v1"

:: ── Create logs directory ────────────────────────────────────
if not exist "%AGENT_DIR%logs" mkdir "%AGENT_DIR%logs"
if not exist "%AGENT_DIR%temp" mkdir "%AGENT_DIR%temp"

:: ── Check Java is installed ──────────────────────────────────
java -version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Java not found. Please install Java 17+
    pause
    exit /b 1
)

:: ── Check agent jar exists ───────────────────────────────────
if not exist "%AGENT_DIR%%JAR_NAME%" (
    echo [ERROR] Agent JAR not found: %AGENT_DIR%%JAR_NAME%
    echo [INFO]  Build it with: gradlew shadowJar
    pause
    exit /b 1
)

echo [INFO] NoQueue Agent Started
echo [INFO] Backend: %BACKEND_URL%
echo [INFO] Log: %LOG_FILE%

:: ── Launch agent minimized, piping logs to file ──────────────
start "NoQueue Agent" /MIN java ^
    -Dfile.encoding=UTF-8 ^
    -DBACKEND_URL=%BACKEND_URL% ^
    -jar "%AGENT_DIR%%JAR_NAME%" >> "%LOG_FILE%" 2>&1

echo [INFO] Agent launched in background. Check logs at:
echo        %LOG_FILE%
endlocal
