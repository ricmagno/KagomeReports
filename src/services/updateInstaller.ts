/**
 * Update Installer Service
 * Handles downloading, verifying, and installing application updates
 * Requirements: 4.1, 4.2, 4.3, 4.6
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
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
    if (process.env.IS_DOCKER === 'true') {
      installerLogger.warn('Self-update attempted in Docker environment. Skipping.');
      throw new Error('In-app updates are not supported for Docker installations. Please pull the latest image instead.');
    }
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

      this.notifyProgress('complete', 100, 'Update successfully applied. The application will restart in 5 seconds to complete the process.');

      // Step 6: Schedule restart
      this.scheduleRestart();

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
      if (!checksum) {
        installerLogger.warn('No checksum provided for update, skipping verification');
        return true;
      }

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

  async applyUpdate(updateData: Buffer, version: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const updatePath = path.join(this.UPDATE_TEMP_DIR, `update-${version}`);
        const extractionPath = path.join(updatePath, 'extracted');

        if (!fs.existsSync(updatePath)) {
          fs.mkdirSync(updatePath, { recursive: true });
        }
        if (!fs.existsSync(extractionPath)) {
          fs.mkdirSync(extractionPath, { recursive: true });
        }

        // Write update data to temporary file for reference
        const tempFile = path.join(updatePath, 'update.zip');
        fs.writeFileSync(tempFile, updateData);

        installerLogger.info('Extracting update package...', { version });

        // Use AdmZip to extract the buffer
        const zip = new AdmZip(updateData);
        zip.extractAllTo(extractionPath, true);

        // Find the actual content path inside the extracted folder
        // (GitHub zipballs usually have a wrapper folder)
        let contentPath = extractionPath;
        const entries = fs.readdirSync(extractionPath);
        if (entries.length === 1) {
          const singleEntry = entries[0];
          if (singleEntry && fs.statSync(path.join(extractionPath, singleEntry)).isDirectory()) {
            contentPath = path.join(extractionPath, singleEntry);
          }
        }

        installerLogger.info('Applying update files...', { from: contentPath });

        // Files/folders to exclude from overwritting
        const excludeList = [
          '.env',
          'logs',
          'reports',
          'data',
          'temp',
          '.backups',
          '.updates',
          '.env.backups',
          'node_modules',
          '.git'
        ];

        // Copy files from extracted content to application root
        this.copyRecursiveWithExclude(contentPath, process.cwd(), excludeList);

        installerLogger.info('Update applied successfully to filesystem', { version });
        resolve();
      } catch (error) {
        installerLogger.error('Failed to apply update', error);
        reject(new Error(`Failed to apply update: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
  }

  /**
   * Schedule an application restart
   */
  private scheduleRestart(): void {
    installerLogger.info('Scheduling application restart in 5 seconds...');

    setTimeout(() => {
      installerLogger.info('Restarting application NOW to complete update.');
      // Exit with success code - process manager (Docker/PM2) should restart it
      process.exit(0);
    }, 5000);
  }

  /**
   * Copy directory recursively with exclusions
   */
  private copyRecursiveWithExclude(src: string, dest: string, exclude: string[]): void {
    const srcName = path.basename(src);
    if (exclude.includes(srcName)) {
      return;
    }

    const stats = fs.statSync(src);

    if (stats.isDirectory()) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }

      const files = fs.readdirSync(src);
      for (const file of files) {
        if (exclude.includes(file)) continue;

        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);
        this.copyRecursiveWithExclude(srcPath, destPath, exclude);
      }
    } else {
      const parentDir = path.dirname(dest);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      // Overwrite file
      fs.copyFileSync(src, dest);
    }
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
    const stats = fs.statSync(src);

    if (stats.isDirectory()) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }

      const files = fs.readdirSync(src);
      for (const file of files) {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);
        this.copyRecursive(srcPath, destPath);
      }
    } else {
      const parentDir = path.dirname(dest);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.copyFileSync(src, dest);
    }
  }

  /**
   * Private method to get directory size
   */
  private getDirectorySize(dir: string): number {
    const stats = fs.statSync(dir);

    if (!stats.isDirectory()) {
      return stats.size;
    }

    let size = 0;
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      // Recursively call getDirectorySize, which now handles both files and directories
      size += this.getDirectorySize(filePath);
    }

    return size;
  }
}

// Export singleton instance
export const updateInstaller = new UpdateInstaller();
