@echo off
cd /d "%~dp0"
echo === Workflow Query App - Windows Setup ===
echo.

:: ---------------------------------------------------------------
:: Step 0: Choose PM2 installation option
:: ---------------------------------------------------------------
echo PM2 Installation Options:
echo.
echo   [1] Global install (recommended)
echo       - Installs PM2 system-wide
echo       - App starts automatically on Windows boot
echo       - Run as Administrator required
echo       - Use plain "pm2" commands anywhere
echo.
echo   [2] Local / no global install
echo       - No system-wide install
echo       - App does NOT start automatically on boot
echo       - No Administrator required
echo       - Prefix all PM2 commands with "npx"
echo.
set /p PM2_OPTION="Enter option (1 or 2): "
if "%PM2_OPTION%"=="1" goto option_global
if "%PM2_OPTION%"=="2" goto option_local
echo Invalid option. Please enter 1 or 2.
pause
exit /b 1

:option_global
echo.
echo Option 1 selected: Global PM2 install with startup on boot.
set PM2_GLOBAL=1
goto check_prereqs

:option_local
echo.
echo Option 2 selected: Local PM2 via npx (no startup on boot).
set PM2_GLOBAL=0
goto check_prereqs

:: ---------------------------------------------------------------
:: Step 1: Check prerequisites
:: ---------------------------------------------------------------
:check_prereqs
echo.
echo Checking prerequisites...
if not exist ".env.local" (
    echo ERROR: .env.local not found!
    echo.
    echo Please create a .env.local file in this folder with your database credentials.
    echo Example for a single database:
    echo.
    echo   DB_NAMES=MY_DB
    echo   DB_MY_DB_LABEL=My Database
    echo   DB_MY_DB_SERVER=your-sql-server
    echo   DB_MY_DB_DATABASE=your-database
    echo   DB_MY_DB_USER=your-username
    echo   DB_MY_DB_PASSWORD=your-password
    echo   DB_MY_DB_PORT=1433
    echo.
    echo See README.md for details.
    pause
    exit /b 1
)
echo   .env.local found.
echo.

:: ---------------------------------------------------------------
:: Step 2: Encrypt any plaintext DB_*_PASSWORD entries with DPAPI
:: ---------------------------------------------------------------
echo Checking for plaintext passwords in .env.local...
powershell -NonInteractive -ExecutionPolicy Bypass -Command ^
  "$f='.env.local';" ^
  "$lines=Get-Content $f;" ^
  "$changed=$false;" ^
  "$out=foreach($l in $lines){" ^
  "  if($l -match '^(DB_[^=]+_PASSWORD)=(.+)$' -and $l -notmatch '_ENCRYPTED'){" ^
  "    $key=$matches[1]; $pw=$matches[2];" ^
  "    Add-Type -AssemblyName System.Security;" ^
  "    $b=[System.Text.Encoding]::UTF8.GetBytes($pw);" ^
  "    $e=[System.Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Protect($b,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser));" ^
  "    $changed=$true;" ^
  "    Write-Host ('Encrypted: '+$key);" ^
  "    $key+'_ENCRYPTED='+$e" ^
  "  } else { $l }" ^
  "};" ^
  "if($changed){Set-Content $f $out;Write-Host 'Passwords encrypted and .env.local updated.'}" ^
  "else{Write-Host 'No plaintext passwords found — skipping encryption.'}"
if %errorlevel% neq 0 (echo ERROR: Password check/encryption failed & pause & exit /b 1)
echo.

:: ---------------------------------------------------------------
:: Step 3: Install dependencies
:: ---------------------------------------------------------------
echo Step 3: Installing dependencies...
call npm install
if %errorlevel% neq 0 (echo ERROR: npm install failed & pause & exit /b 1)
echo.

:: ---------------------------------------------------------------
:: Step 4: Build the app
:: ---------------------------------------------------------------
echo Step 4: Building the app...
call npm run build
if %errorlevel% neq 0 (echo ERROR: Build failed & pause & exit /b 1)
echo.

:: ---------------------------------------------------------------
:: Step 5: PM2 setup (global or local)
:: ---------------------------------------------------------------
if "%PM2_GLOBAL%"=="1" goto pm2_global
goto pm2_local

:pm2_global
echo Step 5: Installing PM2 globally...
call npm install -g pm2
if %errorlevel% neq 0 (echo ERROR: PM2 install failed & pause & exit /b 1)

echo.
echo Step 6: Installing PM2 Windows startup manager...
call npm install -g pm2-windows-startup
if %errorlevel% neq 0 (echo ERROR: pm2-windows-startup install failed & pause & exit /b 1)

echo.
echo Step 7: Starting app with PM2...
call pm2 start ecosystem.config.js
if %errorlevel% neq 0 (echo ERROR: PM2 start failed & pause & exit /b 1)

echo.
echo Step 8: Saving PM2 process list...
call pm2 save
if %errorlevel% neq 0 (echo ERROR: PM2 save failed & pause & exit /b 1)

echo.
echo Step 9: Configuring PM2 to start on Windows boot...
call npx pm2-windows-startup install
if %errorlevel% neq 0 (echo ERROR: Startup config failed & pause & exit /b 1)

echo.
echo === Setup complete! ===
echo App is running at http://localhost:3000
echo It will restart automatically if it crashes and start on Windows boot.
echo.
echo Useful PM2 commands:
echo   pm2 status                         - check if app is running
echo   pm2 logs workflow-query-app        - view app logs
echo   pm2 restart workflow-query-app     - restart the app
echo   pm2 stop workflow-query-app        - stop the app
echo.
pause
exit /b 0

:pm2_local
echo Step 5: Starting app with PM2 (local via npx)...
call npx pm2 start ecosystem.config.js
if %errorlevel% neq 0 (echo ERROR: PM2 start failed & pause & exit /b 1)

echo.
echo Step 6: Saving PM2 process list...
call npx pm2 save
if %errorlevel% neq 0 (echo ERROR: PM2 save failed & pause & exit /b 1)

echo.
echo === Setup complete! ===
echo App is running at http://localhost:3000
echo.
echo NOTE: The app will NOT start automatically on Windows boot with this option.
echo       Re-run this script after each reboot, or switch to Option 1 for auto-start.
echo.
echo Useful PM2 commands (prefix with "npx"):
echo   npx pm2 status                         - check if app is running
echo   npx pm2 logs workflow-query-app        - view app logs
echo   npx pm2 restart workflow-query-app     - restart the app
echo   npx pm2 stop workflow-query-app        - stop the app
echo.
pause
exit /b 0
