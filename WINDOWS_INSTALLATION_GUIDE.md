# Windows Installation Guide for Historian Reports

## Table of Contents
1. [System Requirements](#system-requirements)
2. [Installation Methods](#installation-methods)
3. [Manual Installation](#manual-installation)
4. [Automated Installation](#automated-installation)
5. [Windows Service Installation](#windows-service-installation)
6. [Configuration](#configuration)
7. [Starting the Application](#starting-the-application)
8. [Troubleshooting](#troubleshooting)

## System Requirements

### Minimum Requirements
- **OS**: Windows 10, Windows 11, or Windows Server 2016/2019/2022
- **RAM**: 4 GB (8 GB recommended)
- **Disk Space**: 2 GB for application + database storage
- **Network**: Internet connection for initial setup and updates

### Required Software
- **Node.js**: v18.0.0 or higher (LTS recommended)
- **npm**: v8.0.0 or higher (comes with Node.js)
- **SQL Server**: 2016 or higher (for AVEVA Historian database connectivity)

## Installation Methods

There are three ways to install Historian Reports on Windows:

1. **NSIS Installer** (Recommended) - Complete GUI installer with all options
2. **PowerShell Script** - Automated installation with more control
3. **Manual Installation** - Step-by-step installation for advanced users

## Manual Installation

### Step 1: Install Prerequisites

1. Download and install Node.js (v18.0.0 or higher) from https://nodejs.org/
2. Verify installation:
   ```cmd
   node --version
   npm --version
   ```

### Step 2: Obtain Application Files

1. Download the latest release from the releases page
2. Extract to your desired installation directory (e.g., `C:\Program Files\HistorianReports`)

### Step 3: Install Dependencies

1. Open Command Prompt as Administrator
2. Navigate to the installation directory:
   ```cmd
   cd "C:\Program Files\HistorianReports"
   ```
3. Install Node.js dependencies:
   ```cmd
   npm install --production
   ```

### Step 4: Create Configuration

1. Copy the example environment file:
   ```cmd
   copy .env.example .env
   ```
2. Edit `.env` with your database and application settings

### Step 5: Create Required Directories

```cmd
mkdir reports
mkdir logs
mkdir temp
mkdir data
```

## Automated Installation

### Using the NSIS Installer

1. Run the `HistorianReports-X.X.X-Setup.exe` installer as Administrator
2. Follow the installation wizard:
   - Accept the license agreement
   - Choose installation directory
   - Select components to install (application, service, database initialization)
   - Complete the installation

### Using the PowerShell Script

1. Open PowerShell as Administrator
2. Navigate to the application directory
3. Run the installation script:
   ```powershell
   .\Install-HistorianReports.ps1 -InstallPath "C:\Program Files\HistorianReports" -InstallAsService
   ```

## Windows Service Installation

### Prerequisites for Service Installation

- NSSM (Non-Sucking Service Manager) - included in automated installations
- Administrator privileges

### Installing as a Windows Service

1. **Using the NSIS installer**: Select the "Install as Windows Service" option during installation

2. **Using the batch script**:
   - Run `windows-service-install.bat` as Administrator
   - The script will download NSSM if not present and install the service

3. **Manual installation with NSSM**:
   - Download NSSM from https://nssm.cc/download
   - Extract and copy `nssm.exe` to the application directory
   - Run the following command as Administrator:
   ```cmd
   nssm install "HistorianReports" "C:\Program Files\HistorianReports\node.exe" "C:\Program Files\HistorianReports\dist\server.js"
   nssm set "HistorianReports" Description "Historian Reports Application Service"
   nssm set "HistorianReports" Start SERVICE_AUTO_START
   nssm set "HistorianReports" AppDirectory "C:\Program Files\HistorianReports"
   nssm set "HistorianReports" AppParameters "--env-file=C:\Program Files\HistorianReports\.env"
   nssm start "HistorianReports"
   ```

### Managing the Windows Service

- Start: `nssm start HistorianReports`
- Stop: `nssm stop HistorianReports`
- Restart: `nssm restart HistorianReports`
- Remove: `nssm remove HistorianReports`

## Configuration

### Environment Variables

Edit the `.env` file in the installation directory with the following settings:

```
# Database Configuration
DB_HOST=your-sql-server-hostname
DB_PORT=1433
DB_NAME=HistorianDatabase
DB_USER=your-username
DB_PASSWORD=your-password
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=false

# Application Configuration
NODE_ENV=production
PORT=3000
JWT_SECRET=your-secure-random-string-min-32-characters
BCRYPT_ROUNDS=12

# Email Configuration (for report delivery)
SMTP_HOST=your-smtp-server
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@company.com
SMTP_PASSWORD=your-email-password

# Report Configuration
REPORTS_DIR=./reports
TEMP_DIR=./temp
MAX_REPORT_SIZE_MB=50

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5
```

### Validating Configuration

Run the validation script to check your configuration:
```cmd
validate-configuration.bat
```

## Starting the Application

### As a Windows Service (Recommended for Production)

The application will start automatically when the system boots if installed as a service.

### Manually

1. Open Command Prompt or PowerShell
2. Navigate to the installation directory
3. Start the application:
   ```cmd
   node dist\server.js
   ```

### Using PM2 (Alternative)

For process management, you can use PM2:
```cmd
npm install -g pm2
pm2 start dist/server.js --name "HistorianReports"
pm2 startup
pm2 save
```

## Troubleshooting

### Common Issues

#### Port Already in Use
- Check if the port is already in use:
  ```cmd
  netstat -ano | findstr :3000
  ```
- Kill the process using the port:
  ```cmd
  taskkill /PID <PID> /F
  ```
- Or change the port in `.env`:
  ```
  PORT=3001
  ```

#### Database Connection Failed
1. Verify SQL Server is running:
   ```cmd
   sqlcmd -S your-server-name -U your-username -P your-password
   ```
2. Check firewall settings allow port 1433
3. Verify credentials in `.env` file
4. Check SQL Server is configured for TCP/IP connections

#### Application Won't Start
1. Check logs in the `logs` directory
2. Verify all environment variables are set correctly
3. Check Node.js version compatibility:
   ```cmd
   node --version
   ```
4. Try running with more verbose output:
   ```cmd
   node dist/server.js
   ```

#### Service Installation Issues
- Ensure you're running the installation script as Administrator
- Check that NSSM is properly installed
- Verify the application directory path doesn't contain special characters

### Service Management Commands

- View service status: `sc query HistorianReports`
- Start service: `sc start HistorianReports`
- Stop service: `sc stop HistorianReports`
- View service logs: Check the `logs` directory in the application folder

### Log Files Location

- Application logs: `%INSTALL_DIR%\logs\app.log`
- Error logs: `%INSTALL_DIR%\logs\error.log`
- Report logs: `%INSTALL_DIR%\reports\` (contains generated reports)

## Uninstalling

### Via Control Panel
1. Open "Add or Remove Programs"
2. Find "Historian Reports" in the list
3. Click "Uninstall"

### Via Uninstaller
Run the `Uninstall.exe` in the installation directory.

### Manual Removal
1. Stop and remove the Windows service (if installed)
2. Delete the installation directory
3. Remove registry entries (if any were created)

## Updates

To update the application:
1. Stop the application/service
2. Download the new version
3. Replace files in the installation directory
4. Run `npm install` to update dependencies
5. Restart the application/service

## Security Recommendations

1. **Change Default Credentials**
   - Change admin password immediately after first login
   - Use strong passwords for database access

2. **Enable HTTPS**
   - Generate SSL certificate
   - Configure in `.env`:
     ```
     HTTPS_CERT_PATH=./certs/cert.pem
     HTTPS_KEY_PATH=./certs/key.pem
     ```

3. **Secure Environment Variables**
   - Never share `.env` file
   - Use strong passwords (min 32 characters for JWT_SECRET)
   - Restrict file permissions on `.env`

4. **Database Security**
   - Use strong database passwords
   - Enable SQL Server encryption
   - Restrict database user permissions

5. **Regular Backups**
   - Backup database regularly
   - Backup reports directory
   - Backup configuration files

## Support

For support, please check:
- Application logs in the `logs` directory
- Documentation in the `docs` directory
- Contact the development team

---

**Document Version**: 1.0  
**Last Updated**: January 2026  
**Compatible With**: Windows 10, Windows 11, Windows Server 2016/2019/2022