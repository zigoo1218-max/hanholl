@echo off
cd /d "%~dp0"

set LOGFILE=%~dp0server_error.log
echo [%date% %time%] START > %LOGFILE%

:: Check Node.js
where node 1>nul 2>nul
if not %errorlevel%==0 (
    echo [%date% %time%] ERROR: Node.js not found >> %LOGFILE%
    echo.
    echo  Node.js is not installed. Please install from https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Check node_modules
if not exist "node_modules\" (
    echo [%date% %time%] npm install start >> %LOGFILE%
    call npm.cmd install 1>>%LOGFILE% 2>nul
    if not %errorlevel%==0 (
        echo [%date% %time%] npm install FAILED >> %LOGFILE%
        echo  npm install failed. Check server_error.log
        pause
        exit /b 1
    )
    echo [%date% %time%] npm install done >> %LOGFILE%
)

:: Check next binary
if not exist "node_modules\next\dist\bin\next" (
    echo [%date% %time%] ERROR: next binary missing >> %LOGFILE%
    echo  next binary not found. Delete node_modules and retry.
    pause
    exit /b 1
)

:: Check build
if not exist ".next\" (
    echo [%date% %time%] Build start >> %LOGFILE%
    call npm.cmd run build 1>>%LOGFILE% 2>nul
    if not %errorlevel%==0 (
        echo [%date% %time%] Build FAILED >> %LOGFILE%
        echo  Build failed. Check server_error.log
        pause
        exit /b 1
    )
    echo [%date% %time%] Build done >> %LOGFILE%
)

:: Close any existing Exhibition Server windows and stop node processes
echo [%date% %time%] Cleaning existing server instances >> %LOGFILE%
taskkill /F /FI "WINDOWTITLE eq Next.js Exhibition Server" 1>nul 2>nul
taskkill /F /IM node.exe 1>nul 2>nul
ping 127.0.0.1 -n 2 >nul

:: Fallback: Kill port 3000 if still busy
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    echo [%date% %time%] Killing leftover PID %%p >> %LOGFILE%
    taskkill /PID %%p /F 1>nul 2>nul
    ping 127.0.0.1 -n 2 >nul
)

:: Start server
echo [%date% %time%] Starting server >> %LOGFILE%
start "Next.js Exhibition Server" "%~dp0_run_server.bat"

:: Wait up to 30s for port 3000
set COUNT=0
:WAIT
ping 127.0.0.1 -n 3 >nul
set /a COUNT+=2
netstat -ano 2>nul | findstr ":3000 " | findstr "LISTENING" 1>nul
if %errorlevel%==0 goto READY
if %COUNT% lss 30 goto WAIT
echo [%date% %time%] Server timeout >> %LOGFILE%
goto BROWSER

:READY
echo [%date% %time%] Server ready >> %LOGFILE%

:BROWSER
:: Launch Chrome kiosk
set CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe

if exist "%CHROME%" (
    echo [%date% %time%] Launching Chrome kiosk >> %LOGFILE%
    start "" "%CHROME%" --kiosk --incognito http://localhost:3000
) else (
    echo [%date% %time%] No Chrome, using default browser >> %LOGFILE%
    start http://localhost:3000
)

echo.
echo  Server running at http://localhost:3000
echo  Close the "Next.js Exhibition Server" window to stop.
echo.
