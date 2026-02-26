# Application Auto-Update System Documentation

## Overview

The Historian Reports application includes a comprehensive auto-update system that allows the application to check for, download, and install updates from GitHub releases. The system is designed to be secure, reliable, and non-disruptive to ongoing operations.

## Components

### 1. Version Management (`versionManager.ts`)

The VersionManager service handles application version tracking and build metadata:

- Reads version from `package.json`
- Collects build metadata (date, commit hash, branch)
- Validates versions against Semantic Versioning (SemVer) format
- Provides version comparison functionality

### 2. GitHub Release Integration (`githubReleaseService.ts`)

The GitHubReleaseService integrates with the GitHub Releases API:

- Fetches latest releases from the configured repository
- Parses release information (version, date, changelog)
- Implements caching with 1-hour TTL to minimize API calls
- Performs checksum verification for downloaded updates
- Handles API rate limiting and network errors gracefully

### 3. Update Checking (`updateChecker.ts`)

The UpdateChecker service performs periodic update checks:

- Automatically checks for updates on application startup
- Performs periodic checks every 24 hours during normal operation
- Provides manual update check functionality
- Maintains last check timestamp
- Stores update status for UI display

### 4. Update History (`updateHistoryService.ts`)

The UpdateHistoryService manages persistent storage of update records:

- Stores update records in SQLite database
- Tracks version transitions, status, and error messages
- Maintains chronological order (newest first)
- Limits history to 100 most recent records
- Provides API endpoints for history retrieval

### 5. Update Installation (`updateInstaller.ts`)

The UpdateInstaller service handles the update installation process:

- Downloads updates from GitHub releases
- Verifies checksum integrity before installation
- Creates backups of current version before installation
- Applies updates without interrupting operations
- Reports progress during installation

### 6. Rollback Management (`rollbackManager.ts`)

The RollbackManager service handles rollback operations:

- Restores previous versions when updates fail
- Verifies backup integrity before rollback
- Records rollback operations in update history
- Provides error details for failed updates

## API Endpoints

### Version Endpoints

- `GET /api/version` - Returns current version and build information
- `GET /api/version/validate/:version` - Validates a version string against SemVer format
- `GET /api/version/compare/:v1/:v2` - Compares two versions using SemVer rules

### Update Endpoints

- `GET /api/updates/check` - Checks for available updates
- `GET /api/updates/status` - Returns current update status
- `GET /api/updates/last-check-time` - Returns timestamp of last update check
- `GET /api/updates/history` - Returns update history
- `POST /api/updates/install` - Initiates update installation
- `GET /api/updates/install-status` - Returns current installation status
- `POST /api/updates/rollback` - Initiates rollback to previous version
- `POST /api/updates/cancel` - Cancels current installation

## Frontend Integration

### About Section (`AboutSection.tsx`)

The About section provides a user interface for update management:

- Displays current version and build information
- Shows update status (up-to-date, update available, checking, error)
- Provides "Check for Updates" button
- Provides "Install Update" button when updates are available
- Displays recent update history
- Shows progress during update installation

## Configuration

### Environment Variables

- `GITHUB_OWNER` - GitHub repository owner (default: 'ricmagno')
- `GITHUB_REPO` - GitHub repository name (default: 'historian-reports')
- `GITHUB_TOKEN` - GitHub API token for authenticated requests (optional but recommended)

### Build Metadata

The system reads build metadata from:
1. Environment variables (`BUILD_DATE`, `COMMIT_HASH`, `BRANCH_NAME`)
2. `.build-metadata.json` file in the project root
3. Current time and git information as fallback

## Security Features

- All GitHub API communication uses HTTPS
- Downloaded updates are verified with checksums (SHA-256/SHA-512)
- Backups are created before applying updates
- Automatic rollback on installation failure
- Rate limiting on update check endpoints

## Docker Multi-Architecture Support

The application supports building for multiple architectures:

- AMD64 and ARM64 architectures
- Optimized multi-stage Docker builds
- Health check configuration
- Proper version tagging with semantic versioning

## Startup Process

During application startup:

1. Version information is loaded and cached
2. Update checker begins periodic checks (every 24 hours)
3. Initial update check is performed
4. Update history service is initialized
5. All services are registered for graceful shutdown

## Shutdown Process

During application shutdown:

1. Update checker periodic checks are stopped
2. All services are properly closed
3. Database connections are closed
4. Cache is flushed
5. All resources are released

## Error Handling

The system implements comprehensive error handling:

- Network errors during update checks trigger retry mechanisms
- Checksum verification failures prevent installation of corrupted updates
- Backup creation failures abort update installation
- Installation failures trigger automatic rollback
- All errors are logged for debugging and audit purposes

## Testing

The system includes comprehensive tests:

- Unit tests for individual components
- Property-based tests for correctness properties
- Integration tests for component interactions
- Manual testing for multi-architecture Docker builds

## Maintenance

For ongoing maintenance:

1. Monitor update history for failed installations
2. Review logs for any update-related errors
3. Ensure GitHub token has appropriate permissions
4. Verify Docker builds for new releases
5. Test rollback functionality periodically