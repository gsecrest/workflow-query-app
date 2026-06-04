@echo off
cd /d "%~dp0"
echo === Workflow Query App - Uninstall ===
echo.

:: ---------------------------------------------------------------
:: Step 0: Determine which PM2 option was used
:: ---------------------------------------------------------------
echo Which PM2 option did you use during setup?
echo.
echo   [1] Global install (pm2 commands without npx)
echo   [2] Local via npx (npx pm2 commands)
echo.
set /p PM2_OPTION="Enter option (1 or 2): "
if "%PM2_OPTION%"=="1" goto option_global
if "%PM2_OPTION%"=="2" goto option_local
echo Invalid option. Please enter 1 or 2.
pause
exit /b 1

:: ---------------------------------------------------------------
:: Option 1: Global PM2 uninstall
:: ---------------------------------------------------------------
:option_global
echo.
echo Step 1: Stopping and removing PM2 process...
call pm2 delete workflow-query-app
if %errorlevel% neq 0 echo WARNING: Could not delete PM2 process. It may not be running.

echo.
echo Step 2: Removing Windows startup entry...
call npx pm2-windows-startup uninstall
if %errorlevel% neq 0 echo WARNING: Could not remove startup entry. It may not have been configured.

echo.
echo Step 3: Saving empty PM2 process list...
call pm2 save
if %errorlevel% neq 0 echo WARNING: pm2 save failed.

echo.
set /p REMOVE_PM2="Uninstall PM2 and pm2-windows-startup globally? (y/n): "
if /i "%REMOVE_PM2%"=="y" (
    echo Uninstalling PM2 globally...
    call npm uninstall -g pm2 pm2-windows-startup
    if %errorlevel% neq 0 echo WARNING: Global uninstall failed.
)
goto remove_folder

:: ---------------------------------------------------------------
:: Option 2: Local npx uninstall
:: ---------------------------------------------------------------
:option_local
echo.
echo Step 1: Stopping and removing PM2 process...
call npx pm2 delete workflow-query-app
if %errorlevel% neq 0 echo WARNING: Could not delete PM2 process. It may not be running.

echo.
echo Step 2: Saving empty PM2 process list...
call npx pm2 save
if %errorlevel% neq 0 echo WARNING: pm2 save failed.

echo.
echo No startup entry was created with Option 2 — nothing further to remove.
goto remove_folder

:: ---------------------------------------------------------------
:: Offer to delete the app folder
:: ---------------------------------------------------------------
:remove_folder
echo.
echo === PM2 cleanup complete ===
echo.
echo The app folder still exists at:
echo   %~dp0
echo.
echo WARNING: Deleting this folder will also remove your .env.local file
echo          which contains your database credentials.
echo.
set /p DELETE_FOLDER="Delete the app folder? (y/n): "
if /i "%DELETE_FOLDER%"=="y" (
    echo Deleting app folder...
    cd /d "%TEMP%"
    rd /s /q "%~dp0"
    echo App folder deleted.
) else (
    echo App folder kept. You can delete it manually when ready.
)

echo.
echo === Uninstall complete ===
echo.
pause
