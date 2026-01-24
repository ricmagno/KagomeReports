/**
 * Rollback Manager Service
 * Handles rollback operations when updates fail
 * Requirements: 4.4, 4.5, 4.7
 */

import fs from 'fs';
import path from 'path';
import { updateHistoryService } from './updateHistoryService';
import { versionManager } from './versionManager';
import { dbLogger } from '@/utils/logger';

const rollbackLogger = dbLogger.child({ service: 'RollbackManager' });

/**
 * RollbackManager handles rollback operations
 */
export class RollbackManager {
  private isRollingBack = false;

  /**
   * Perform rollback to a previous version
   */
  async rollback(backupPath: string): Promise<void> {
    if (this.isRollingBack) {
      throw new Error('Rollback already in progress');
    }

    this.isRollingBack = true;

    try {
      const currentVersion = versionManager.getCurrentVersion().version;

      rollbackLogger.info('Starting rollback', {
        backupPath,
        currentVersion
      });

      // Verify backup exists and is valid
      if (!this.verifyBackup(backupPath)) {
        throw new Error('Backup verification failed: backup is corrupted or invalid');
      }

      // Get backup version from backup path
      const backupVersion = this.extractVersionFromBackupPath(backupPath);

      // Restore files from backup
      await this.restoreFromBackup(backupPath);

      // Record rollback in history
      await updateHistoryService.recordUpdate({
        fromVersion: currentVersion,
        toVersion: backupVersion,
        status: 'rolled_back',
        backupPath
      });

      rollbackLogger.info('Rollback completed successfully', {
        fromVersion: currentVersion,
        toVersion: backupVersion,
        backupPath
      });

      this.isRollingBack = false;
    } catch (error) {
      rollbackLogger.error('Rollback failed', error);
      this.isRollingBack = false;
      throw error;
    }
  }

  /**
   * Verify backup integrity
   */
  verifyBackup(backupPath: string): boolean {
    try {
      // Check if backup directory exists
      if (!fs.existsSync(backupPath)) {
        rollbackLogger.warn('Backup directory does not exist', { backupPath });
        return false;
      }

      // Check if backup is a directory
      const stats = fs.statSync(backupPath);
      if (!stats.isDirectory()) {
        rollbackLogger.warn('Backup path is not a directory', { backupPath });
        return false;
      }

      // Check for required backup files
      const requiredFiles = ['package.json'];
      for (const file of requiredFiles) {
        const filePath = path.join(backupPath, file);
        if (!fs.existsSync(filePath)) {
          rollbackLogger.warn('Required backup file missing', { file, backupPath });
          return false;
        }
      }

      // Verify backup contains valid package.json
      try {
        const packageJsonPath = path.join(backupPath, 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        
        if (!packageJson.version) {
          rollbackLogger.warn('Invalid package.json in backup', { backupPath });
          return false;
        }
      } catch (error) {
        rollbackLogger.warn('Failed to parse package.json in backup', { backupPath, error });
        return false;
      }

      rollbackLogger.debug('Backup verification successful', { backupPath });
      return true;
    } catch (error) {
      rollbackLogger.error('Backup verification error', { backupPath, error });
      return false;
    }
  }

  /**
   * Record rollback operation in history
   */
  async recordRollback(fromVersion: string, toVersion: string): Promise<void> {
    try {
      await updateHistoryService.recordUpdate({
        fromVersion,
        toVersion,
        status: 'rolled_back'
      });

      rollbackLogger.info('Rollback recorded in history', {
        fromVersion,
        toVersion
      });
    } catch (error) {
      rollbackLogger.error('Failed to record rollback', error);
      throw error;
    }
  }

  /**
   * Get rollback status
   */
  isRollbackInProgress(): boolean {
    return this.isRollingBack;
  }

  /**
   * Private method to extract version from backup path
   */
  private extractVersionFromBackupPath(backupPath: string): string {
    try {
      // Backup path format: /path/to/backup-VERSION-TIMESTAMP
      const dirName = path.basename(backupPath);
      const match = dirName.match(/backup-(.+?)-\d{4}-\d{2}-\d{2}/);
      
      if (match && match[1]) {
        return match[1];
      }

      // Fallback: try to read version from package.json in backup
      const packageJsonPath = path.join(backupPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        return packageJson.version || 'unknown';
      }

      return 'unknown';
    } catch (error) {
      rollbackLogger.error('Failed to extract version from backup path', { backupPath, error });
      return 'unknown';
    }
  }

  /**
   * Private method to restore files from backup
   */
  private async restoreFromBackup(backupPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const appDir = process.cwd();
        const filesToRestore = [
          'package.json',
          'package-lock.json',
          'dist',
          'client/build'
        ];

        for (const file of filesToRestore) {
          const backupFilePath = path.join(backupPath, file);
          const appFilePath = path.join(appDir, file);

          if (fs.existsSync(backupFilePath)) {
            // Remove current file/directory
            if (fs.existsSync(appFilePath)) {
              if (fs.statSync(appFilePath).isDirectory()) {
                this.removeRecursive(appFilePath);
              } else {
                fs.unlinkSync(appFilePath);
              }
            }

            // Copy from backup
            if (fs.statSync(backupFilePath).isDirectory()) {
              this.copyRecursive(backupFilePath, appFilePath);
            } else {
              fs.copyFileSync(backupFilePath, appFilePath);
            }

            rollbackLogger.debug('File restored from backup', { file });
          }
        }

        resolve();
      } catch (error) {
        rollbackLogger.error('Failed to restore from backup', error);
        reject(new Error(`Failed to restore from backup: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
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
   * Private method to recursively remove directory
   */
  private removeRecursive(dir: string): void {
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach((file) => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
          this.removeRecursive(filePath);
        } else {
          fs.unlinkSync(filePath);
        }
      });
      fs.rmdirSync(dir);
    }
  }
}

// Export singleton instance
export const rollbackManager = new RollbackManager();
