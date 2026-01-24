/**
 * Update Checker Service
 * Periodically checks for new releases and notifies about available updates
 * Requirements: 3.1, 3.2, 3.3, 3.6
 */

import { EventEmitter } from 'events';
import { UpdateCheckResult } from '@/types/versionManagement';
import { versionManager } from './versionManager';
import { githubReleaseService } from './githubReleaseService';
import { dbLogger } from '@/utils/logger';

const updateLogger = dbLogger.child({ service: 'UpdateChecker' });

/**
 * UpdateChecker handles periodic update checking
 */
export class UpdateChecker extends EventEmitter {
  private lastCheckTime: Date | null = null;
  private updateCheckInterval: NodeJS.Timeout | null = null;
  private isChecking = false;
  private readonly DEFAULT_CHECK_INTERVAL_HOURS = 24;
  private readonly MIN_CHECK_INTERVAL_MS = 60 * 1000; // 1 minute minimum
  private currentStatus: UpdateCheckResult | null = null;

  /**
   * Start periodic checking for updates
   */
  startPeriodicChecking(intervalHours: number = this.DEFAULT_CHECK_INTERVAL_HOURS): void {
    if (this.updateCheckInterval) {
      updateLogger.warn('Periodic checking already started');
      return;
    }

    if (intervalHours < 1) {
      throw new Error('Check interval must be at least 1 hour');
    }

    const intervalMs = intervalHours * 60 * 60 * 1000;

    updateLogger.info('Starting periodic update checking', {
      intervalHours,
      intervalMs
    });

    // Perform initial check immediately
    this.checkForUpdates().catch(error => {
      updateLogger.error('Initial update check failed', error);
    });

    // Set up recurring checks
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates().catch(error => {
        updateLogger.error('Periodic update check failed', error);
      });
    }, intervalMs);

    this.emit('checkingStarted', { intervalHours });
  }

  /**
   * Stop periodic checking
   */
  stopPeriodicChecking(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
      updateLogger.info('Periodic update checking stopped');
      this.emit('checkingStopped');
    }
  }

  /**
   * Check for updates manually
   */
  async checkForUpdates(force: boolean = false): Promise<UpdateCheckResult> {
    if (this.isChecking) {
      updateLogger.debug('Update check already in progress');
      return this.currentStatus || this.getDefaultStatus();
    }

    this.isChecking = true;
    const checkStartTime = new Date();

    try {
      updateLogger.info('Checking for updates');
      this.emit('checkingStarted', { manual: true });

      const currentVersion = versionManager.getCurrentVersion();
      const latestRelease = await githubReleaseService.fetchLatestRelease(force);

      if (!latestRelease) {
        const result: UpdateCheckResult = {
          isUpdateAvailable: false,
          currentVersion: currentVersion.version,
          lastCheckTime: checkStartTime.toISOString(),
          error: 'Could not fetch latest release from GitHub'
        };

        this.currentStatus = result;
        this.lastCheckTime = checkStartTime;
        this.emit('checkComplete', result);
        return result;
      }

      // Compare versions
      const comparison = versionManager.compareVersions(
        currentVersion.version,
        latestRelease.version
      );

      const isUpdateAvailable = comparison === -1; // current < latest

      const result: UpdateCheckResult = {
        isUpdateAvailable,
        currentVersion: currentVersion.version,
        latestVersion: latestRelease.version,
        changelog: latestRelease.changelog,
        lastCheckTime: checkStartTime.toISOString()
      };

      this.currentStatus = result;
      this.lastCheckTime = checkStartTime;

      if (isUpdateAvailable) {
        updateLogger.info('Update available', {
          currentVersion: currentVersion.version,
          latestVersion: latestRelease.version
        });
        this.emit('updateAvailable', result);
      } else {
        updateLogger.info('Application is up to date', {
          version: currentVersion.version
        });
        this.emit('upToDate', result);
      }

      this.emit('checkComplete', result);
      return result;
    } catch (error) {
      updateLogger.error('Update check failed', error);

      const result: UpdateCheckResult = {
        isUpdateAvailable: false,
        currentVersion: versionManager.getCurrentVersion().version,
        lastCheckTime: checkStartTime.toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error during update check'
      };

      this.currentStatus = result;
      this.lastCheckTime = checkStartTime;
      this.emit('checkError', result);
      return result;
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Get last check time
   */
  getLastCheckTime(): string | null {
    return this.lastCheckTime ? this.lastCheckTime.toISOString() : null;
  }

  /**
   * Get current update status
   */
  getUpdateStatus(): UpdateCheckResult {
    return this.currentStatus || this.getDefaultStatus();
  }

  /**
   * Check if update is available
   */
  isUpdateAvailable(): boolean {
    return this.currentStatus?.isUpdateAvailable || false;
  }

  /**
   * Get time until next check
   */
  getTimeUntilNextCheck(intervalHours: number = this.DEFAULT_CHECK_INTERVAL_HOURS): number | null {
    if (!this.lastCheckTime) {
      return null;
    }

    const intervalMs = intervalHours * 60 * 60 * 1000;
    const nextCheckTime = new Date(this.lastCheckTime.getTime() + intervalMs);
    const now = new Date();
    const timeUntilNext = nextCheckTime.getTime() - now.getTime();

    return Math.max(0, timeUntilNext);
  }

  /**
   * Private method to get default status
   */
  private getDefaultStatus(): UpdateCheckResult {
    return {
      isUpdateAvailable: false,
      currentVersion: versionManager.getCurrentVersion().version,
      lastCheckTime: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const updateChecker = new UpdateChecker();
