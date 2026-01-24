# Design Document: App Packaging and Auto-Updates

## Overview

The App Packaging and Auto-Updates feature provides a comprehensive system for managing application versions, checking for updates from GitHub, installing updates safely with rollback capability, and packaging the application for multiple architectures. The system consists of backend services for version management and update handling, frontend UI components for user interaction, and CI/CD infrastructure for automated builds and releases.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  About Section Component                             │  │
│  │  - Version Display                                   │  │
│  │  - Build Info Display                                │  │
│  │  - Update Status Display                             │  │
│  │  - Check for Updates Button                          │  │
│  │  - Install Update Button                             │  │
│  │  - Update History List                               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Node.js/Express)                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Version Management API                              │  │
│  │  - GET /api/version (current version & build info)   │  │
│  │  - GET /api/updates/check (check for updates)        │  │
│  │  - POST /api/updates/install (install update)        │  │
│  │  - GET /api/updates/history (update history)         │  │
│  │  - POST /api/updates/rollback (rollback update)      │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Core Services                                       │  │
│  │  - VersionManager: Version tracking & validation     │  │
│  │  - GitHubReleaseService: GitHub API integration      │  │
│  │  - UpdateChecker: Periodic update checking           │  │
│  │  - UpdateInstaller: Download & install updates       │  │
│  │  - UpdateHistoryService: Persistence & retrieval     │  │
│  │  - RollbackManager: Rollback operations              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    External Services                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  GitHub Releases API                                 │  │
│  │  - Fetch release information                         │  │
│  │  - Download release artifacts                        │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Local Storage                                       │  │
│  │  - SQLite database for update history                │  │
│  │  - Backup storage for rollback                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```
User Opens About Section
        ↓
Frontend fetches version & update status
        ↓
Backend returns current version & build info
        ↓
Frontend displays version, build date, commit hash
        ↓
User clicks "Check for Updates"
        ↓
UpdateChecker queries GitHub Releases API
        ↓
GitHub returns release information
        ↓
UpdateChecker compares versions using SemVer
        ↓
If new version available:
  - Store update info in database
  - Notify frontend of available update
  - Display new version & changelog in About section
        ↓
User clicks "Install Update"
        ↓
UpdateInstaller:
  1. Creates backup of current version
  2. Downloads new version from GitHub
  3. Verifies checksum
  4. Applies update
  5. Records in update history
        ↓
If update succeeds:
  - Notify user to restart
  - Update history shows success
        ↓
If update fails:
  - RollbackManager restores previous version
  - Update history shows rollback
  - Notify user of failure
```

## Components and Interfaces

### Backend Services

#### VersionManager

Manages application version and build metadata.

```typescript
interface VersionInfo {
  version: string;           // e.g., "1.0.0"
  buildDate: string;         // ISO 8601 format
  commitHash: string;        // Git commit hash
  branchName: string;        // Git branch name
  buildNumber?: number;      // Optional build number
}

interface VersionManager {
  getCurrentVersion(): VersionInfo;
  validateVersion(version: string): boolean;
  compareVersions(v1: string, v2: string): -1 | 0 | 1;
  getVersionFromPackageJson(): string;
  readBuildMetadata(): VersionInfo;
}
```

#### GitHubReleaseService

Integrates with GitHub Releases API to fetch release information.

```typescript
interface GitHubRelease {
  version: string;
  releaseDate: string;
  changelog: string;
  downloadUrl: string;
  checksum: string;
  checksumAlgorithm: 'sha256' | 'sha512';
  prerelease: boolean;
  draft: boolean;
}

interface GitHubReleaseService {
  fetchLatestRelease(): Promise<GitHubRelease | null>;
  fetchReleaseByVersion(version: string): Promise<GitHubRelease | null>;
  parseReleaseNotes(releaseBody: string): string;
  downloadRelease(downloadUrl: string): Promise<Buffer>;
  verifyChecksum(data: Buffer, checksum: string): boolean;
}
```

#### UpdateChecker

Periodically checks for new releases and notifies about available updates.

```typescript
interface UpdateCheckResult {
  isUpdateAvailable: boolean;
  currentVersion: string;
  latestVersion?: string;
  changelog?: string;
  lastCheckTime: string;
  error?: string;
}

interface UpdateChecker {
  startPeriodicChecking(intervalHours?: number): void;
  stopPeriodicChecking(): void;
  checkForUpdates(): Promise<UpdateCheckResult>;
  getLastCheckTime(): string | null;
  getUpdateStatus(): UpdateCheckResult;
}
```

#### UpdateInstaller

Handles downloading, verifying, and installing updates.

```typescript
interface UpdateProgress {
  stage: 'downloading' | 'verifying' | 'installing' | 'complete' | 'failed';
  progress: number;  // 0-100
  message: string;
}

interface UpdateInstaller {
  installUpdate(release: GitHubRelease): Promise<void>;
  downloadUpdate(downloadUrl: string): Promise<Buffer>;
  verifyUpdate(data: Buffer, checksum: string): boolean;
  createBackup(): Promise<string>;  // Returns backup path
  applyUpdate(updateData: Buffer): Promise<void>;
  onProgress(callback: (progress: UpdateProgress) => void): void;
}
```

#### UpdateHistoryService

Persists and retrieves update history records.

```typescript
interface UpdateRecord {
  id: string;
  timestamp: string;
  fromVersion: string;
  toVersion: string;
  status: 'success' | 'failed' | 'rolled_back';
  errorMessage?: string;
  backupPath?: string;
}

interface UpdateHistoryService {
  recordUpdate(record: Omit<UpdateRecord, 'id' | 'timestamp'>): Promise<void>;
  getHistory(limit?: number): Promise<UpdateRecord[]>;
  getHistoryByVersion(version: string): Promise<UpdateRecord[]>;
  clearOldRecords(keepCount?: number): Promise<void>;
}
```

#### RollbackManager

Manages rollback operations when updates fail.

```typescript
interface RollbackManager {
  rollback(backupPath: string): Promise<void>;
  verifyBackup(backupPath: string): boolean;
  recordRollback(fromVersion: string, toVersion: string): Promise<void>;
}
```

### Frontend Components

#### AboutSection Component

Main UI component for displaying version information and update controls.

```typescript
interface AboutSectionProps {
  onUpdateInstalled?: () => void;
  onUpdateFailed?: (error: Error) => void;
}

interface AboutSectionState {
  versionInfo: VersionInfo | null;
  updateStatus: UpdateCheckResult | null;
  updateHistory: UpdateRecord[];
  isCheckingForUpdates: boolean;
  isInstallingUpdate: boolean;
  updateProgress: UpdateProgress | null;
  error: string | null;
}

// Component displays:
// - Current version (e.g., "v1.0.0")
// - Build date and commit hash
// - Update status (up-to-date, update available, checking, error)
// - New version and changelog (if available)
// - "Check for Updates" button
// - "Install Update" button (if available)
// - Last check timestamp
// - Recent update history list
```

#### UpdateHistoryList Component

Displays list of recent updates with status indicators.

```typescript
interface UpdateHistoryListProps {
  records: UpdateRecord[];
  maxRecords?: number;
}

// Displays:
// - Version numbers (from → to)
// - Timestamps
// - Status with color coding (success, failed, rolled_back)
// - Error messages (if applicable)
```

### API Endpoints

#### GET /api/version

Returns current version and build information.

```typescript
// Response
{
  version: "1.0.0",
  buildDate: "2024-01-15T10:30:00Z",
  commitHash: "abc123def456",
  branchName: "main",
  buildNumber: 42
}
```

#### GET /api/updates/check

Checks for available updates.

```typescript
// Response
{
  isUpdateAvailable: true,
  currentVersion: "1.0.0",
  latestVersion: "1.1.0",
  changelog: "## Version 1.1.0\n- New features\n- Bug fixes",
  lastCheckTime: "2024-01-15T10:30:00Z"
}
```

#### POST /api/updates/install

Initiates update installation.

```typescript
// Request
{
  version: "1.1.0"
}

// Response
{
  success: true,
  message: "Update installation started",
  estimatedTime: 300  // seconds
}
```

#### GET /api/updates/history

Retrieves update history.

```typescript
// Response
{
  records: [
    {
      id: "uuid",
      timestamp: "2024-01-15T10:30:00Z",
      fromVersion: "1.0.0",
      toVersion: "1.0.1",
      status: "success"
    }
  ],
  total: 1
}
```

#### POST /api/updates/rollback

Initiates rollback to previous version.

```typescript
// Request
{
  backupPath: "/path/to/backup"
}

// Response
{
  success: true,
  message: "Rollback completed",
  version: "1.0.0"
}
```

## Data Models

### Update History Schema

```typescript
interface UpdateHistoryRecord {
  id: string;                    // UUID
  timestamp: string;             // ISO 8601
  fromVersion: string;           // SemVer
  toVersion: string;             // SemVer
  status: 'success' | 'failed' | 'rolled_back';
  errorMessage?: string;
  backupPath?: string;
  installDuration?: number;      // milliseconds
  downloadSize?: number;         // bytes
  checksumVerified?: boolean;
}
```

### Version Cache Schema

```typescript
interface VersionCache {
  version: string;
  buildDate: string;
  commitHash: string;
  branchName: string;
  cachedAt: string;
  expiresAt: string;
}
```

### Release Cache Schema

```typescript
interface ReleaseCache {
  version: string;
  releaseDate: string;
  changelog: string;
  downloadUrl: string;
  checksum: string;
  checksumAlgorithm: string;
  cachedAt: string;
  expiresAt: string;
}
```

## Docker Packaging

### Multi-Architecture Build Strategy

```dockerfile
# Build command for multi-architecture support
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag historian-reports:1.0.0 \
  --tag historian-reports:latest \
  --push \
  .
```

### Image Tagging Convention

- `historian-reports:1.0.0` - Specific version
- `historian-reports:1.0` - Minor version (latest patch)
- `historian-reports:1` - Major version (latest minor/patch)
- `historian-reports:latest` - Latest release
- `historian-reports:1.0.0-amd64` - Architecture-specific
- `historian-reports:1.0.0-arm64` - Architecture-specific

### Build Optimization

- Multi-stage builds to minimize final image size
- Separate dependency layers for better caching
- Non-root user for security
- Health check configuration
- Minimal runtime dependencies

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          platforms: linux/amd64,linux/arm64
          tags: |
            historian-reports:${{ github.ref_name }}
            historian-reports:latest
          push: true
      - name: Create GitHub Release
        uses: actions/create-release@v1
        with:
          tag_name: ${{ github.ref_name }}
          release_name: Release ${{ github.ref_name }}
          body: ${{ github.event.head_commit.message }}
```

## Error Handling

### Update Failure Scenarios

1. **Network Error**: Retry with exponential backoff, notify user
2. **Checksum Mismatch**: Reject update, log error, notify user
3. **Insufficient Disk Space**: Check before download, notify user
4. **Backup Creation Failure**: Abort update, notify user
5. **Installation Failure**: Rollback to previous version, log error
6. **GitHub API Rate Limit**: Use cached data, retry after delay

### Rollback Scenarios

- Automatic rollback on installation failure
- Manual rollback via API endpoint
- Verification of backup integrity before rollback
- Logging of all rollback operations

## Testing Strategy

### Unit Tests

- Version comparison logic (SemVer)
- Version validation
- Checksum verification
- Update history persistence and retrieval
- Backup creation and verification
- Error handling and recovery

### Property-Based Tests

- Version comparison is transitive and consistent
- Update history maintains chronological order
- Checksum verification is deterministic
- Rollback restores previous version state
- Update status transitions are valid
- Cache expiration works correctly

### Integration Tests

- GitHub API integration with mocked responses
- End-to-end update flow (check → download → install)
- Rollback recovery after failed update
- Update history recording accuracy
- Frontend-backend communication

### Manual Testing

- Multi-architecture Docker build verification
- Update installation on different platforms
- Rollback functionality
- UI responsiveness during updates
- Network error handling

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Version Comparison Transitivity

*For any* three versions v1, v2, v3 following SemVer format, if v1 < v2 and v2 < v3, then v1 < v3.

**Validates: Requirements 1.5, 2.3**

### Property 2: Update Availability Detection

*For any* current version and latest version from GitHub, the system should correctly identify whether an update is available by comparing versions using SemVer rules.

**Validates: Requirements 2.3, 3.1**

### Property 3: GitHub API Caching

*For any* GitHub release query, if the same query is made within 1 hour of the previous query, the system should return cached results without making a new API call.

**Validates: Requirements 2.5**

### Property 4: Checksum Verification Determinism

*For any* downloaded file and its associated checksum, verifying the checksum multiple times should always produce the same result.

**Validates: Requirements 4.2**

### Property 5: Update History Chronological Order

*For any* set of update records in the history, when retrieved, they should be sorted by timestamp in descending order (newest first).

**Validates: Requirements 5.4**

### Property 6: Update History Record Limit

*For any* sequence of update operations, the update history should never contain more than 100 records.

**Validates: Requirements 5.6**

### Property 7: Rollback State Restoration

*For any* successful update followed by a rollback, the application should return to the exact state it was in before the update (version, files, configuration).

**Validates: Requirements 4.5, 10.6**

### Property 8: Update Status Consistency

*For any* update operation, the update status displayed in the UI should accurately reflect the current state of the update process (checking, available, up-to-date, error).

**Validates: Requirements 3.5, 6.3**

### Property 9: Build Metadata Completeness

*For any* application startup, the build metadata should include all required fields: version, build date, commit hash, and branch name.

**Validates: Requirements 1.2, 1.4**

### Property 10: Update History Persistence

*For any* update operation, after the operation completes, retrieving the update history should include a record of that operation with all required fields (version, timestamp, status).

**Validates: Requirements 5.1, 5.2**

### Property 11: Version Format Consistency

*For any* version string returned by the system, it should follow semantic versioning format (MAJOR.MINOR.PATCH).

**Validates: Requirements 1.1, 1.5**

### Property 12: Update Check Timestamp Recording

*For any* update check operation, the system should record the timestamp of the check and make it available for retrieval.

**Validates: Requirements 3.6**

### Property 13: Docker Image Architecture Support

*For any* Docker build operation, the system should successfully build images for both AMD64 and ARM64 architectures.

**Validates: Requirements 7.1, 7.3**

### Property 14: Update Non-Interruption

*For any* active operation in the application, initiating an update should not interrupt that operation until the user explicitly approves the update installation.

**Validates: Requirements 10.1, 10.2**

### Property 15: Update Progress Reporting

*For any* update installation in progress, the system should continuously report progress information with stage and percentage completion.

**Validates: Requirements 10.5**

## Security Considerations

1. **Checksum Verification**: All downloaded updates must be verified using cryptographic checksums (SHA-256 or SHA-512)
2. **HTTPS Only**: All communication with GitHub API must use HTTPS
3. **Backup Security**: Backups should be stored securely with appropriate file permissions
4. **Rollback Verification**: Verify backup integrity before performing rollback
5. **Audit Logging**: All update operations must be logged for audit purposes
6. **Rate Limiting**: Implement rate limiting on update check endpoints
7. **Version Validation**: Validate all version strings against SemVer format

## Performance Considerations

1. **Caching**: Cache GitHub release information for 1 hour to minimize API calls
2. **Async Operations**: All update operations should be asynchronous to prevent UI blocking
3. **Lazy Loading**: Load update history only when needed
4. **Database Indexing**: Index update history by timestamp for efficient retrieval
5. **Compression**: Compress update artifacts for faster downloads
6. **Parallel Builds**: Use Docker buildx for parallel multi-architecture builds

## Deployment Considerations

1. **Version Tagging**: Use semantic versioning for all releases
2. **Release Notes**: Generate comprehensive release notes for each version
3. **Backward Compatibility**: Maintain backward compatibility across versions
4. **Database Migrations**: Handle database schema changes during updates
5. **Configuration Preservation**: Preserve user configuration during updates
6. **Health Checks**: Verify application health after updates

