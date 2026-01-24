/**
 * Version Management Types (Frontend)
 * Defines interfaces for version tracking and update management
 * These types mirror the backend types for API responses
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
 * Progress information during update installation
 */
export interface UpdateProgress {
  stage: 'downloading' | 'verifying' | 'installing' | 'complete' | 'failed';
  progress: number;  // 0-100
  message: string;
}
