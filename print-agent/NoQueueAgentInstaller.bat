@echo off
:: ============================================================
:: NoQueue Agent Installer
:: Run this ONCE to set up the agent for auto-start on Windows login
:: Run as Administrator for best results
:: ============================================================

setlocal

set "AGENT_DIR=%~dp0"
set "JAR_NAME=print-agent-all.jar"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_NAME=NoQueueAgent.lnk"
set "LOG_DIR=%AGENT_DIR%logs"
set "TEMP_DIR=%AGENT_DIR%temp"

echo ============================================================
echo   NoQueue Agent Installer
echo ============================================================
echo.

:: ── Step 1: Create directories ───────────────────────────────
echo [1/4] Creating directories...
if not exist "%LOG_DIR%"  mkdir "%LOG_DIR%"
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"
echo       Created: logs\  and  temp\

:: ── Step 2: Check Java ───────────────────────────────────────
echo [2/4] Checking Java...
java -version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Java not found. Please install Java 17+ from https://adoptium.net
    pause
    exit /b 1
)
echo       Java OK.

:: ── Step 3: Check agent JAR ──────────────────────────────────
echo [3/4] Checking agent JAR...
if not exist "%AGENT_DIR%%JAR_NAME%" (
    echo [WARN]  JAR not found yet: %JAR_NAME%
    echo         Build with: gradlew shadowJar
    echo         Then copy build\libs\%JAR_NAME% to: %AGENT_DIR%
    echo         Re-run this installer after building.
    pause
    exit /b 1
)
echo       Found: %JAR_NAME%

:: ── Step 4: Create startup shortcut via PowerShell ───────────
echo [4/4] Registering auto-start shortcut...

set "SHORTCUT_PATH=%STARTUP_FOLDER%\%SHORTCUT_NAME%"
set "TARGET=%AGENT_DIR%%JAR_NAME%"
set "START_BAT=%AGENT_DIR%start-agent.bat"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$WScriptShell = New-Object -ComObject WScript.Shell; " ^
  "$Shortcut = $WScriptShell.CreateShortcut('%SHORTCUT_PATH%'); " ^
  "$Shortcut.TargetPath = '%START_BAT%'; " ^
  "$Shortcut.WorkingDirectory = '%AGENT_DIR%'; " ^
  "$Shortcut.WindowStyle = 7; " ^
  "$Shortcut.Description = 'NoQueue Print Agent'; " ^
  "$Shortcut.Save()"

if exist "%SHORTCUT_PATH%" (
    echo       Shortcut created: %SHORTCUT_PATH%
) else (
    echo [WARN]  Shortcut creation failed. You can add start-agent.bat manually to Startup.
)

echo.
echo ============================================================
echo   Installation Complete!
echo ============================================================
echo.
echo   The NoQueue Agent will now:
echo   - Start automatically when Windows boots
echo   - Run silently in the background
echo   - Log to: %LOG_DIR%\agent.log
echo.
echo   To start the agent NOW without rebooting:
echo   Double-click: start-agent.bat
echo.
echo   To uninstall auto-start:
echo   Delete: %SHORTCUT_PATH%
echo.
pause
endlocal
