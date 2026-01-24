/**
 * Version Management Types
 * Defines interfaces for version tracking, build metadata, and update management
 */

/**
 * Version information including build metadata
 */
export interface VersionInfo {
  version: string;           // e.g., "1.0.0" (SemVer format)
  buildDate: string;         // ISO 8601 format
  commitHash: string;        // Git commit hash
  branchName: string;        // Git branch name
  buildNumber?: number;      // Optional build number
}

/**
 * GitHub release information
 */
export interface GitHubRelease {
  version: string;
  releaseDate: string;
  changelog: string;
  downloadUrl: string;
  checksum: string;
  checksumAlgorithm: 'sha256' | 'sha512';
  prerelease: boolean;
  draft: boolean;
}

/**
 * Result of checking for updates
 */
export interface UpdateCheckResult {
  isUpdateAvailable: boolean;
  currentVersion: string;
  latestVersion?: string;
  changelog?: string;
  lastCheckTime: string;
  error?: string;
}

/**
 * Progress information during update installation
 */
export interface UpdateProgress {
  stage: 'downloading' | 'verifying' | 'installing' | 'complete' | 'failed';
  progress: number;  // 0-100
  message: string;
}

/**
 * Update history record
 */
export interface UpdateRecord {
  id: string;
  timestamp: string;
  fromVersion: string;
  toVersion: string;
  status: 'success' | 'failed' | 'rolled_back';
  errorMessage?: string;
  backupPath?: string;
  installDuration?: number;      // milliseconds
  downloadSize?: number;         // bytes
  checksumVerified?: boolean;
}

/**
 * Version cache entry
 */
export interface VersionCache {
  version: string;
  buildDate: string;
  commitHash: string;
  branchName: string;
  cachedAt: string;
  expiresAt: string;
}

/**
 * Release cache entry
 */
export interface ReleaseCache {
  version: string;
  releaseDate: string;
  changelog: string;
  downloadUrl: string;
  checksum: string;
  checksumAlgorithm: string;
  cachedAt: string;
  expiresAt: string;
}
