@echo off
REM Windows Service Installation Script for Historian Reports
REM This script installs the Historian Reports application as a Windows Service using NSSM (Non-Sucking Service Manager)

setlocal

REM Define application directory
set APP_DIR=%~dp0
set APP_DIR=%APP_DIR:~0,-1%

REM Check if running as administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo This script must be run as administrator.
    echo Right-click on this script and select "Run as administrator".
    pause
    exit /b 1
)

REM Check if NSSM is available
if not exist "%APP_DIR%\nssm.exe" (
    echo NSSM (Non-Sucking Service Manager) not found.
    echo Downloading NSSM...
    
    REM Create temporary directory for download
    set TEMP_DIR=%APP_DIR%\temp
    if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"
    
    REM Download NSSM (this is a simplified example - in practice, you'd want to use a more robust download mechanism)
    echo Please download NSSM from https://nssm.cc/download
    echo Extract the archive and place nssm.exe in the application directory.
    pause
    exit /b 1
)

REM Install the service
echo Installing Historian Reports as Windows Service...

"%APP_DIR%\nssm.exe" install "HistorianReports" "%APP_DIR%\node.exe" "%APP_DIR%\dist\server.js"

if %errorlevel% neq 0 (
    echo Failed to install the service.
    pause
    exit /b 1
)

REM Configure the service
echo Configuring the service...

"%APP_DIR%\nssm.exe" set "HistorianReports" Description "Historian Reports Application Service"
"%APP_DIR%\nssm.exe" set "HistorianReports" Start SERVICE_AUTO_START
"%APP_DIR%\nssm.exe" set "HistorianReports" AppDirectory "%APP_DIR%"
"%APP_DIR%\nssm.exe" set "HistorianReports" AppParameters "--env-file=%APP_DIR%\.env"

if %errorlevel% neq 0 (
    echo Failed to configure the service.
    pause
    exit /b 1
)

REM Start the service
echo Starting the service...
"%APP_DIR%\nssm.exe" start "HistorianReports"

if %errorlevel% neq 0 (
    echo Failed to start the service.
    echo The installation completed but the service failed to start.
    echo Please check the application logs in %APP_DIR%\logs
    pause
    exit /b 1
)

echo.
echo Historian Reports has been successfully installed as a Windows Service.
echo Service name: HistorianReports
echo Service will start automatically on system boot.
echo.
echo To manage the service, use Windows Services (services.msc) or NSSM commands:
echo   - Start: nssm start HistorianReports
echo   - Stop: nssm stop HistorianReports
echo   - Restart: nssm restart HistorianReports
echo   - Remove: nssm remove HistorianReports
echo.
pause