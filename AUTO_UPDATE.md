# Auto-Update System

## Overview

The Historian Reports application includes an auto-update system that checks for new releases from GitHub and allows users to download updates through the UI.

## Current Implementation Status

### ✅ Implemented Features

1. **Update Detection**
   - Automatic periodic checking for new releases (every 24 hours)
   - Manual update checks via the "About" section
   - Version comparison using semantic versioning
   - Cache management with force-refresh capability

2. **Update Download**
   - Authenticated GitHub API access
   - Proper handling of redirects (e.g., to AWS S3/Codeload)
   - Progress tracking during download
   - Checksum verification (optional, with graceful fallback)

3. **Backup Creation**
   - Automatic backup of current version before update
   - Backup of critical files: `package.json`, `package-lock.json`, `dist/`, `client/build/`
   - Proper handling of both files and directories
   - Size calculation and validation

4. **Update Staging**
   - Downloaded update saved to `.updates/` directory
   - Update history tracking in SQLite database
   - Success/failure logging

### ⚠️ Manual Steps Required

The current implementation **stages** updates but does not automatically apply them. After a successful update download, users must manually restart the application.

## How to Complete an Update

### For Docker Deployments (Recommended)

1. Click "Install Update" in the About section
2. Wait for the download to complete
3. Pull the latest Docker image:
   ```bash
   docker pull ricmagno/historian-reports:latest
   # or specific version:
   docker pull ricmagno/historian-reports:v0.63.0
   ```
4. Restart the container:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

### For Manual/Development Deployments

1. Click "Install Update" in the About section
2. Wait for the download to complete
3. Stop the application:
   ```bash
   # If using npm
   npm stop
   
   # If using PM2
   pm2 stop historian-reports
   
   # If using systemd
   sudo systemctl stop historian-reports
   ```
4. The update file is located at: `.updates/update-{version}/update.zip`
5. Extract and replace application files (or pull latest code from git)
6. Rebuild if necessary:
   ```bash
   npm run build
   npm run build:client
   ```
7. Restart the application:
   ```bash
   npm start
   # or
   pm2 start historian-reports
   # or
   sudo systemctl start historian-reports
   ```

## Future Enhancements

To implement fully automatic updates, the following features would need to be added:

1. **Archive Extraction**
   - Unzip/untar the downloaded update file
   - Validate extracted contents

2. **File Replacement**
   - Replace application files with extracted versions
   - Handle file permissions

3. **Process Management Integration**
   - Integrate with PM2, systemd, or Docker
   - Trigger automatic restart after file replacement
   - Handle graceful shutdown of active connections

4. **Rollback Mechanism**
   - Automatic rollback on startup failure
   - Health check validation after update
   - Restore from backup if new version fails

5. **Zero-Downtime Updates**
   - Blue-green deployment strategy
   - Load balancer integration
   - Gradual rollout capability

## Configuration

### Environment Variables

- `GITHUB_OWNER`: GitHub repository owner (default: `ricmagno`)
- `GITHUB_REPO`: GitHub repository name (default: `KagomeReports`)
- `GITHUB_TOKEN`: GitHub personal access token (required for private repos and higher rate limits)
- `BACKUP_DIR`: Directory for backups (default: `.backups`)
- `UPDATE_TEMP_DIR`: Directory for staged updates (default: `.updates`)

### Update Check Interval

The default update check interval is 24 hours. This can be modified in `src/server.ts`:

```typescript
updateChecker.startPeriodicChecking(24); // hours
```

## Troubleshooting

### Update Download Fails with 403

- Ensure `GITHUB_TOKEN` is set in your `.env` file
- Verify the token has `repo` scope permissions

### Update Download Fails with Checksum Mismatch

- The system now gracefully handles missing checksums
- If you see this error, it may indicate a corrupted download
- Try the update again

### Backup Creation Fails

- Check disk space in the `.backups` directory
- Ensure the application has write permissions
- Maximum backup size is 500MB by default

### Update Shows Success but Version Doesn't Change

- This is expected behavior - the update is staged but not applied
- Follow the manual restart steps above to complete the update
- Check `.updates/` directory to verify the update file was downloaded

## API Endpoints

- `GET /api/version` - Get current version information
- `GET /api/updates/check` - Check for available updates
- `GET /api/updates/check?force=true` - Force check (bypass cache)
- `GET /api/updates/status` - Get current update status
- `GET /api/updates/history` - Get update history
- `POST /api/updates/install` - Initiate update installation
- `GET /api/updates/install-status` - Get installation progress

## Security Considerations

1. **GitHub Token**: Store securely in environment variables, never commit to version control
2. **Checksum Verification**: While optional, it's recommended to include checksums in releases
3. **Backup Validation**: Always verify backups before attempting updates
4. **Access Control**: Update endpoints should be restricted to admin users only
