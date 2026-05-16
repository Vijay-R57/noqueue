@echo off
:: ============================================================
:: NoQueue Windows Startup Installer
:: Run ONCE as Administrator to register auto-start on boot
:: ============================================================

setlocal enabledelayedexpansion

set "ROOT=%~dp0"
set "START_SCRIPT=%ROOT%start-noqueue.bat"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\NoQueue.lnk"
set "LOG_DIR=%ROOT%logs"

echo ============================================================
echo   NoQueue Windows Startup Installer
echo   %date% %time%
echo ============================================================
echo.

:: ── Step 1: Verify start script exists ───────────────────────
echo [1/5] Checking start-noqueue.bat...
if not exist "%START_SCRIPT%" (
    echo [ERROR] start-noqueue.bat not found at: %ROOT%
    pause & exit /b 1
)
echo       Found: start-noqueue.bat

:: ── Step 2: Check Java ───────────────────────────────────────
echo [2/5] Checking Java...
java -version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Java 17+ not found. Download from https://adoptium.net
    echo         Install and re-run this installer.
    pause & exit /b 1
)
echo       Java OK.

:: ── Step 3: Create directories ───────────────────────────────
echo [3/5] Creating logs and temp directories...
if not exist "%LOG_DIR%"              mkdir "%LOG_DIR%"
if not exist "%ROOT%print-agent\temp" mkdir "%ROOT%print-agent\temp"
echo       Created.

:: ── Step 4: Register Windows Startup shortcut ────────────────
echo [4/5] Registering Windows startup shortcut...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$s = $ws.CreateShortcut('%SHORTCUT_PATH%'); " ^
  "$s.TargetPath = '%START_SCRIPT%'; " ^
  "$s.WorkingDirectory = '%ROOT%'; " ^
  "$s.WindowStyle = 7; " ^
  "$s.Description = 'NoQueue Auto-Start (Backend + Agent)'; " ^
  "$s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo       Startup shortcut created:
    echo       %SHORTCUT_PATH%
) else (
    echo [WARN]  Could not create shortcut automatically.
    echo         Manually add start-noqueue.bat to:
    echo         %STARTUP_FOLDER%
)

:: ── Step 5: Launch now ────────────────────────────────────────
echo [5/5] Launching NoQueue now...
echo.
start "" "%START_SCRIPT%"

echo.
echo ============================================================
echo   Installation Complete!
echo ============================================================
echo.
echo   NoQueue will start AUTOMATICALLY on every Windows boot.
echo.
echo   Files:
echo     Startup shortcut : %SHORTCUT_PATH%
echo     Logs             : %LOG_DIR%\
echo     Backend log      : %LOG_DIR%\backend.log
echo     Agent log        : %LOG_DIR%\agent.log
echo.
echo   To UNINSTALL auto-start, delete:
echo     %SHORTCUT_PATH%
echo.
echo   To start MANUALLY anytime:
echo     Double-click start-noqueue.bat
echo.
pause
endlocal
