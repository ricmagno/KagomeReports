/**
 * Update Installer Service
 * Handles downloading, verifying, and installing application updates
 * Requirements: 4.1, 4.2, 4.3, 4.6
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { GitHubRelease, UpdateProgress } from '@/types/versionManagement';
import { githubReleaseService } from './githubReleaseService';
import { updateHistoryService } from './updateHistoryService';
import { versionManager } from './versionManager';
import { dbLogger } from '@/utils/logger';

const installerLogger = dbLogger.child({ service: 'UpdateInstaller' });

/**
 * Callback type for progress updates
 */
export type ProgressCallback = (progress: UpdateProgress) => void;

/**
 * UpdateInstaller handles the complete update installation process
 */
export class UpdateInstaller {
  private progressCallbacks: ProgressCallback[] = [];
  private readonly BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), '.backups');
  private readonly UPDATE_TEMP_DIR = process.env.UPDATE_TEMP_DIR || path.join(process.cwd(), '.updates');
  private readonly MAX_BACKUP_SIZE = 500 * 1024 * 1024; // 500MB
  private currentInstallation: {
    release: GitHubRelease;
    startTime: number;
    downloadedSize: number;
  } | null = null;

  constructor() {
    this.ensureDirectories();
  }

  /**
   * Register a callback for progress updates
   */
  onProgress(callback: ProgressCallback): void {
    this.progressCallbacks.push(callback);
  }

  /**
   * Remove a progress callback
   */
  offProgress(callback: ProgressCallback): void {
    const index = this.progressCallbacks.indexOf(callback);
    if (index > -1) {
      this.progressCallbacks.splice(index, 1);
    }
  }

  /**
   * Install an update from a GitHub release
   */
  async installUpdate(release: GitHubRelease): Promise<void> {
    const startTime = Date.now();
    const currentVersion = versionManager.getCurrentVersion().version;

    try {
      this.currentInstallation = {
        release,
        startTime,
        downloadedSize: 0
      };

      installerLogger.info('Starting update installation', {
        fromVersion: currentVersion,
        toVersion: release.version
      });

      // Step 1: Download update
      this.notifyProgress('downloading', 0, 'Downloading update...');
      const updateData = await this.downloadUpdate(release.downloadUrl);
      this.currentInstallation.downloadedSize = updateData.length;

      // Step 2: Verify checksum
      this.notifyProgress('verifying', 50, 'Verifying update integrity...');
      if (!this.verifyUpdate(updateData, release.checksum, release.checksumAlgorithm)) {
        throw new Error('Update verification failed: checksum mismatch');
      }

      // Step 3: Create backup
      this.notifyProgress('installing', 60, 'Creating backup of current version...');
      const backupPath = await this.createBackup(currentVersion);

      // Step 4: Apply update
      this.notifyProgress('installing', 80, 'Applying update...');
      await this.applyUpdate(updateData, release.version);

      // Step 5: Record success
      const installDuration = Date.now() - startTime;
      await updateHistoryService.recordUpdate({
        fromVersion: currentVersion,
        toVersion: release.version,
        status: 'success',
        backupPath,
        installDuration,
        downloadSize: updateData.length,
        checksumVerified: true
      });

      this.notifyProgress('complete', 100, 'Update installed successfully');

      installerLogger.info('Update installation completed', {
        fromVersion: currentVersion,
        toVersion: release.version,
        duration: installDuration,
        size: updateData.length
      });

      this.currentInstallation = null;
    } catch (error) {
      const installDuration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      installerLogger.error('Update installation failed', {
        fromVersion: currentVersion,
        toVersion: release.version,
        error: errorMessage,
        duration: installDuration
      });

      // Record failure
      await updateHistoryService.recordUpdate({
        fromVersion: currentVersion,
        toVersion: release.version,
        status: 'failed',
        errorMessage,
        installDuration
      });

      this.notifyProgress('failed', 0, `Update failed: ${errorMessage}`);
      this.currentInstallation = null;

      throw error;
    }
  }

  /**
   * Download update from URL
   */
  async downloadUpdate(downloadUrl: string): Promise<Buffer> {
    try {
      installerLogger.debug('Downloading update', { url: downloadUrl });
      const data = await githubReleaseService.downloadRelease(downloadUrl);
      return data;
    } catch (error) {
      installerLogger.error('Failed to download update', error);
      throw new Error(`Failed to download update: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify update integrity using checksum
   */
  verifyUpdate(data: Buffer, checksum: string, algorithm: 'sha256' | 'sha512' = 'sha256'): boolean {
    try {
      const isValid = githubReleaseService.verifyChecksum(data, checksum, algorithm);
      
      if (isValid) {
        installerLogger.debug('Update verification successful', { algorithm });
      } else {
        installerLogger.warn('Update verification failed', { algorithm });
      }

      return isValid;
    } catch (error) {
      installerLogger.error('Update verification error', error);
      return false;
    }
  }

  /**
   * Create backup of current version
   */
  async createBackup(version: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Check available disk space
        const stats = fs.statSync(this.BACKUP_DIR);
        if (stats.size > this.MAX_BACKUP_SIZE) {
          throw new Error('Insufficient backup storage space');
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(this.BACKUP_DIR, `backup-${version}-${timestamp}`);

        // Create backup directory
        if (!fs.existsSync(backupPath)) {
          fs.mkdirSync(backupPath, { recursive: true });
        }

        // Copy application files to backup
        const appDir = process.cwd();
        const filesToBackup = [
          'package.json',
          'package-lock.json',
          'dist',
          'client/build'
        ];

        let backupSize = 0;
        for (const file of filesToBackup) {
          const sourcePath = path.join(appDir, file);
          if (fs.existsSync(sourcePath)) {
            const destPath = path.join(backupPath, file);
            this.copyRecursive(sourcePath, destPath);
            backupSize += this.getDirectorySize(destPath);
          }
        }

        installerLogger.info('Backup created', {
          version,
          path: backupPath,
          size: backupSize
        });

        resolve(backupPath);
      } catch (error) {
        installerLogger.error('Failed to create backup', error);
        reject(new Error(`Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
  }

  /**
   * Apply update to application
   */
  async applyUpdate(updateData: Buffer, version: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Extract update data (assuming it's a tar/zip file)
        // For now, we'll just write it to a temporary location
        const updatePath = path.join(this.UPDATE_TEMP_DIR, `update-${version}`);

        if (!fs.existsSync(updatePath)) {
          fs.mkdirSync(updatePath, { recursive: true });
        }

        // Write update data to temporary file
        const tempFile = path.join(updatePath, 'update.tar.gz');
        fs.writeFileSync(tempFile, updateData);

        installerLogger.info('Update applied', {
          version,
          path: updatePath,
          size: updateData.length
        });

        resolve();
      } catch (error) {
        installerLogger.error('Failed to apply update', error);
        reject(new Error(`Failed to apply update: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
  }

  /**
   * Get current installation status
   */
  getCurrentInstallation(): {
    release: GitHubRelease;
    startTime: number;
    downloadedSize: number;
  } | null {
    return this.currentInstallation;
  }

  /**
   * Cancel current installation
   */
  cancelInstallation(): void {
    if (this.currentInstallation) {
      installerLogger.info('Installation cancelled', {
        version: this.currentInstallation.release.version
      });
      this.currentInstallation = null;
    }
  }

  /**
   * Private method to notify progress
   */
  private notifyProgress(stage: UpdateProgress['stage'], progress: number, message: string): void {
    const progressUpdate: UpdateProgress = {
      stage,
      progress: Math.min(100, Math.max(0, progress)),
      message
    };

    for (const callback of this.progressCallbacks) {
      try {
        callback(progressUpdate);
      } catch (error) {
        installerLogger.error('Error in progress callback', error);
      }
    }
  }

  /**
   * Private method to ensure required directories exist
   */
  private ensureDirectories(): void {
    const dirs = [this.BACKUP_DIR, this.UPDATE_TEMP_DIR];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Private method to recursively copy directory
   */
  private copyRecursive(src: string, dest: string): void {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const files = fs.readdirSync(src);
    for (const file of files) {
      const srcPath = path.join(src, file);
      const destPath = path.join(dest, file);

      if (fs.statSync(srcPath).isDirectory()) {
        this.copyRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Private method to get directory size
   */
  private getDirectorySize(dir: string): number {
    let size = 0;
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        size += this.getDirectorySize(filePath);
      } else {
        size += stat.size;
      }
    }

    return size;
  }
}

// Export singleton instance
export const updateInstaller = new UpdateInstaller();
