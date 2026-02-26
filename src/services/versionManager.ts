/**
 * Version Manager Service
 * Manages application version and build metadata
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import * as fs from 'fs';
import * as path from 'path';
import { VersionInfo, VersionCache } from '@/types/versionManagement';
import { dbLogger } from '@/utils/logger';

const versionLogger = dbLogger.child({ service: 'VersionManager' });

/**
 * VersionManager handles version tracking and build metadata
 */
export class VersionManager {
  private versionCache: VersionCache | null = null;
  private cacheExpiry: Date | null = null;
  private readonly CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

  /**
   * Get current version and build information
   */
  getCurrentVersion(): VersionInfo {
    // Check cache first
    if (this.versionCache && this.cacheExpiry && new Date() < this.cacheExpiry) {
      versionLogger.debug('Returning cached version info');
      return {
        version: this.versionCache.version,
        buildDate: this.versionCache.buildDate,
        commitHash: this.versionCache.commitHash,
        branchName: this.versionCache.branchName
      };
    }

    // Read fresh version info
    const versionInfo = this.readVersionInfo();

    // Update cache
    this.versionCache = {
      ...versionInfo,
      cachedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.CACHE_DURATION_MS).toISOString()
    };
    this.cacheExpiry = new Date(Date.now() + this.CACHE_DURATION_MS);

    versionLogger.info('Version info loaded', {
      version: versionInfo.version,
      buildDate: versionInfo.buildDate
    });

    return versionInfo;
  }

  /**
   * Validate version string against SemVer format
   * Format: MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
   */
  validateVersion(version: string): boolean {
    const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
    return semverRegex.test(version);
  }

  /**
   * Compare two versions using SemVer rules
   * Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
   */
  compareVersions(v1: string, v2: string): -1 | 0 | 1 {
    if (!this.validateVersion(v1) || !this.validateVersion(v2)) {
      throw new Error(`Invalid version format: ${v1} or ${v2}`);
    }

    // Parse versions
    const parse = (v: string) => {
      const splitByBuild = v.split('+');
      const withoutBuild = splitByBuild[0] || '';
      const parts = withoutBuild.split('-');
      const versionParts = (parts[0] || '').split('.').map(Number);
      const major = versionParts[0] ?? 0;
      const minor = versionParts[1] ?? 0;
      const patch = versionParts[2] ?? 0;
      const prerelease = parts[1] || '';
      return { major, minor, patch, prerelease };
    };

    const parsed1 = parse(v1);
    const parsed2 = parse(v2);

    // Compare major.minor.patch
    if (parsed1.major !== parsed2.major) {
      return parsed1.major > parsed2.major ? 1 : -1;
    }
    if (parsed1.minor !== parsed2.minor) {
      return parsed1.minor > parsed2.minor ? 1 : -1;
    }
    if (parsed1.patch !== parsed2.patch) {
      return parsed1.patch > parsed2.patch ? 1 : -1;
    }

    // Compare prerelease versions
    // Version without prerelease is greater than with prerelease
    if (parsed1.prerelease === '' && parsed2.prerelease !== '') {
      return 1;
    }
    if (parsed1.prerelease !== '' && parsed2.prerelease === '') {
      return -1;
    }
    if (parsed1.prerelease !== '' && parsed2.prerelease !== '') {
      // Compare prerelease strings lexicographically
      return parsed1.prerelease > parsed2.prerelease ? 1 : parsed1.prerelease < parsed2.prerelease ? -1 : 0;
    }

    return 0;
  }

  /**
   * Get version from environment or package.json
   */
  getVersionFromPackageJson(): string {
    // 1. Check for VERSION environment variable (set during Docker build)
    if (process.env.VERSION) {
      // Remove 'v' prefix if present (consistent with SemVer)
      const version = process.env.VERSION.startsWith('v')
        ? process.env.VERSION.substring(1)
        : process.env.VERSION;

      if (this.validateVersion(version)) {
        return version;
      }
    }

    // 2. Fallback to package.json
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const version = packageJson.version;

      if (!this.validateVersion(version)) {
        throw new Error(`Invalid version in package.json: ${version}`);
      }

      return version;
    } catch (error) {
      versionLogger.error('Failed to read version from package.json', error);
      return '0.0.0'; // Ultimate fallback
    }
  }

  /**
   * Read build metadata
   */
  readBuildMetadata(): VersionInfo {
    return this.readVersionInfo();
  }

  /**
   * Clear version cache
   */
  clearCache(): void {
    this.versionCache = null;
    this.cacheExpiry = null;
    versionLogger.debug('Version cache cleared');
  }

  /**
   * Private method to read version info from various sources
   */
  private readVersionInfo(): VersionInfo {
    const version = this.getVersionFromPackageJson();
    const buildDate = this.getBuildDate();
    const commitHash = this.getCommitHash();
    const branchName = this.getBranchName();

    return {
      version,
      buildDate,
      commitHash,
      branchName
    };
  }

  /**
   * Get build date from environment or current time
   */
  private getBuildDate(): string {
    // Check for BUILD_DATE environment variable
    if (process.env.BUILD_DATE) {
      return process.env.BUILD_DATE;
    }

    // Check for build metadata file
    try {
      const buildMetadataPath = path.join(process.cwd(), '.build-metadata.json');
      if (fs.existsSync(buildMetadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(buildMetadataPath, 'utf-8'));
        if (metadata.buildDate) {
          return metadata.buildDate;
        }
      }
    } catch (error) {
      versionLogger.debug('Could not read build metadata file', error);
    }

    // Default to current time
    return new Date().toISOString();
  }

  /**
   * Get commit hash from environment or git
   */
  private getCommitHash(): string {
    // Check for COMMIT_HASH environment variable
    if (process.env.COMMIT_HASH) {
      return process.env.COMMIT_HASH;
    }

    // Check for build metadata file
    try {
      const buildMetadataPath = path.join(process.cwd(), '.build-metadata.json');
      if (fs.existsSync(buildMetadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(buildMetadataPath, 'utf-8'));
        if (metadata.commitHash) {
          return metadata.commitHash;
        }
      }
    } catch (error) {
      versionLogger.debug('Could not read build metadata file', error);
    }

    // Default to unknown
    return 'unknown';
  }

  /**
   * Get branch name from environment or git
   */
  private getBranchName(): string {
    // Check for BRANCH_NAME environment variable
    if (process.env.BRANCH_NAME) {
      return process.env.BRANCH_NAME;
    }

    // Check for build metadata file
    try {
      const buildMetadataPath = path.join(process.cwd(), '.build-metadata.json');
      if (fs.existsSync(buildMetadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(buildMetadataPath, 'utf-8'));
        if (metadata.branchName) {
          return metadata.branchName;
        }
      }
    } catch (error) {
      versionLogger.debug('Could not read build metadata file', error);
    }

    // Default to main
    return 'main';
  }
}

// Export singleton instance
export const versionManager = new VersionManager();
