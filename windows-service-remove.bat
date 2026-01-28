@echo off
REM Windows Service Removal Script for Historian Reports
REM This script removes the Historian Reports Windows Service using NSSM

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
    echo Please ensure NSSM is available in the application directory.
    pause
    exit /b 1
)

REM Check if the service exists
sc query "HistorianReports" >nul
if %errorlevel% neq 0 (
    echo Service "HistorianReports" not found.
    echo Nothing to remove.
    pause
    exit /b 0
)

REM Stop the service
echo Stopping the Historian Reports service...
"%APP_DIR%\nssm.exe" stop "HistorianReports"

if %errorlevel% neq 0 (
    echo Warning: Failed to stop the service. It may already be stopped.
)

REM Remove the service
echo Removing the Historian Reports service...
"%APP_DIR%\nssm.exe" remove "HistorianReports" confirm

if %errorlevel% neq 0 (
    echo Failed to remove the service.
    pause
    exit /b 1
)

echo.
echo Historian Reports service has been successfully removed.
echo.
pause