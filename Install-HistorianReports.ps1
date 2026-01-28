# PowerShell Installation Script for Historian Reports
# This script automates the installation of Historian Reports on Windows Server

param(
    [string]$InstallPath = "$env:ProgramFiles\HistorianReports",
    [switch]$InstallAsService = $false,
    [string]$ServiceUser = "",
    [string]$ServicePassword = ""
)

#Requires -RunAsAdministrator

Write-Host "=========================================" -ForegroundColor Green
Write-Host "Historian Reports Installation Script" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

# Check if Node.js is installed
$nodeVersion = try { node --version } catch { $null }
if (-not $nodeVersion) {
    Write-Host "ERROR: Node.js is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install Node.js (v18.0.0 or higher) from https://nodejs.org/" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
} else {
    Write-Host "Found Node.js version: $nodeVersion" -ForegroundColor Green
}

# Check if npm is installed
$npmVersion = try { npm --version } catch { $null }
if (-not $npmVersion) {
    Write-Host "ERROR: npm is not installed or not in PATH." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
} else {
    Write-Host "Found npm version: $npmVersion" -ForegroundColor Green
}

# Create installation directory
Write-Host "Creating installation directory: $InstallPath" -ForegroundColor Yellow
if (!(Test-Path $InstallPath)) {
    New-Item -ItemType Directory -Path $InstallPath -Force
}

# Copy application files
Write-Host "Copying application files..." -ForegroundColor Yellow
$sourcePath = Split-Path -Parent $PSScriptRoot
$distPath = Join-Path $sourcePath "dist"

if (Test-Path $distPath) {
    Copy-Item -Path "$distPath\*" -Destination $InstallPath -Recurse -Force
    Write-Host "Application files copied successfully." -ForegroundColor Green
} else {
    Write-Host "ERROR: Dist folder not found. Please build the application first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Copy package.json and other root files
Copy-Item -Path "$sourcePath\package.json" -Destination $InstallPath -Force
Copy-Item -Path "$sourcePath\.env.example" -Destination $InstallPath -Force

# Create required directories
Write-Host "Creating required directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path (Join-Path $InstallPath "reports") -Force
New-Item -ItemType Directory -Path (Join-Path $InstallPath "logs") -Force
New-Item -ItemType Directory -Path (Join-Path $InstallPath "temp") -Force
New-Item -ItemType Directory -Path (Join-Path $InstallPath "data") -Force

# Install dependencies
Write-Host "Installing Node.js dependencies..." -ForegroundColor Yellow
Set-Location $InstallPath
npm install --production

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install dependencies." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Copy example environment file if it doesn't exist
$envPath = Join-Path $InstallPath ".env"
if (!(Test-Path $envPath)) {
    Copy-Item -Path "$InstallPath\.env.example" -Destination $envPath
    Write-Host "Created .env file from example." -ForegroundColor Green
}

# Install as Windows service if requested
if ($InstallAsService) {
    Write-Host "Installing as Windows Service..." -ForegroundColor Yellow
    
    # Download NSSM if not present
    $nssmPath = Join-Path $InstallPath "nssm.exe"
    if (!(Test-Path $nssmPath)) {
        Write-Host "Downloading NSSM (Non-Sucking Service Manager)..." -ForegroundColor Yellow
        $nssmDownloadUrl = "https://nssm.cc/release/nssm-2.24.zip"
        $nssmZipPath = Join-Path $InstallPath "nssm.zip"
        
        try {
            Invoke-WebRequest -Uri $nssmDownloadUrl -OutFile $nssmZipPath
            Expand-Archive -Path $nssmZipPath -DestinationPath $InstallPath -Force
            Move-Item -Path (Join-Path $InstallPath "nssm-*\nssm.exe") -Destination $InstallPath -Force
            Remove-Item -Path $nssmZipPath
            Remove-Item -Path (Join-Path $InstallPath "nssm-*") -Recurse -Force
            Write-Host "NSSM downloaded and extracted." -ForegroundColor Green
        } catch {
            Write-Host "ERROR: Failed to download NSSM." -ForegroundColor Red
            Write-Host $_.Exception.Message -ForegroundColor Red
            Read-Host "Press Enter to continue without service installation"
            $InstallAsService = $false
        }
    }
    
    if ($InstallAsService) {
        # Install the service
        $serviceName = "HistorianReports"
        $nodePath = (Get-Command node).Path
        
        $result = Start-Process -FilePath $nssmPath -ArgumentList "install `"$serviceName`" `"$nodePath`" `"$InstallPath\server.js`"" -Wait -NoNewWindow -PassThru
        
        if ($result.ExitCode -eq 0) {
            # Configure the service
            Start-Process -FilePath $nssmPath -ArgumentList "set `"$serviceName`" Description `"Historian Reports Application Service`"" -Wait -NoNewWindow
            Start-Process -FilePath $nssmPath -ArgumentList "set `"$serviceName`" Start SERVICE_AUTO_START" -Wait -NoNewWindow
            Start-Process -FilePath $nssmPath -ArgumentList "set `"$serviceName`" AppDirectory `"$InstallPath`"" -Wait -NoNewWindow
            
            # Set service credentials if provided
            if ($ServiceUser -and $ServicePassword) {
                Start-Process -FilePath $nssmPath -ArgumentList "set `"$serviceName`" ObjectName `"$ServiceUser`" `"$ServicePassword`"" -Wait -NoNewWindow
            }
            
            Write-Host "Service installed successfully." -ForegroundColor Green
        } else {
            Write-Host "ERROR: Failed to install service." -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "Installation completed successfully!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Installed to: $InstallPath" -ForegroundColor Green
Write-Host ""
Write-Host "To start the application manually:" -ForegroundColor Yellow
Write-Host "  1. Navigate to $InstallPath" -ForegroundColor Yellow
Write-Host "  2. Run: node server.js" -ForegroundColor Yellow
Write-Host ""
Write-Host "Configuration file: $envPath" -ForegroundColor Yellow
Write-Host "Logs directory: $(Join-Path $InstallPath "logs")" -ForegroundColor Yellow
Write-Host ""

if ($InstallAsService) {
    Write-Host "The application is installed as a Windows Service named 'HistorianReports'" -ForegroundColor Green
    Write-Host "You can manage it via Windows Services (services.msc)" -ForegroundColor Green
} else {
    Write-Host "To install as a Windows Service, run the windows-service-install.bat script as Administrator" -ForegroundColor Cyan
}

Read-Host "Press Enter to exit"