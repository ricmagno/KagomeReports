/**
 * Update Scheduler Service
 * Handles graceful update scheduling and notifications
 * Requirements: 10.1, 10.2, 10.3, 10.5, 10.6, 10.7
 */

import { EventEmitter } from 'events';
import { dbLogger } from '@/utils/logger';

const schedulerLogger = dbLogger.child({ service: 'UpdateScheduler' });

/**
 * Update schedule configuration
 */
export interface UpdateScheduleConfig {
  version: string;
  scheduledTime?: Date;
  notifyBefore?: number; // minutes before installation
  autoInstall?: boolean;
  preserveData?: boolean;
}

/**
 * Update schedule event
 */
export interface UpdateScheduleEvent {
  type: 'scheduled' | 'notified' | 'installing' | 'completed' | 'failed' | 'cancelled';
  version: string;
  timestamp: string;
  message?: string;
  error?: string;
}

/**
 * UpdateScheduler manages graceful update scheduling
 */
export class UpdateScheduler extends EventEmitter {
  private schedules: Map<string, UpdateScheduleConfig> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private notificationTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly DEFAULT_NOTIFY_BEFORE = 5; // minutes

  /**
   * Schedule an update for installation
   */
  scheduleUpdate(config: UpdateScheduleConfig): void {
    try {
      const { version, scheduledTime, notifyBefore = this.DEFAULT_NOTIFY_BEFORE } = config;

      // Store schedule
      this.schedules.set(version, config);

      // Calculate delay
      const now = new Date();
      const targetTime = scheduledTime || new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
      const delay = targetTime.getTime() - now.getTime();

      if (delay < 0) {
        throw new Error('Scheduled time is in the past');
      }

      // Set notification timer
      const notificationDelay = Math.max(0, delay - notifyBefore * 60 * 1000);
      if (notificationDelay > 0) {
        const notificationTimer = setTimeout(() => {
          this.notifyUpdate(version);
        }, notificationDelay);
        this.notificationTimers.set(version, notificationTimer);
      }

      // Set installation timer
      const installationTimer = setTimeout(() => {
        this.installScheduledUpdate(version);
      }, delay);
      this.timers.set(version, installationTimer);

      // Emit scheduled event
      this.emit('scheduled', {
        type: 'scheduled',
        version,
        timestamp: new Date().toISOString(),
        message: `Update ${version} scheduled for ${targetTime.toLocaleString()}`
      } as UpdateScheduleEvent);

      schedulerLogger.info('Update scheduled', {
        version,
        scheduledTime: targetTime.toISOString(),
        delay
      });
    } catch (error) {
      schedulerLogger.error('Failed to schedule update', error);
      throw error;
    }
  }

  /**
   * Cancel a scheduled update
   */
  cancelSchedule(version: string): void {
    try {
      // Clear timers
      const timer = this.timers.get(version);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(version);
      }

      const notificationTimer = this.notificationTimers.get(version);
      if (notificationTimer) {
        clearTimeout(notificationTimer);
        this.notificationTimers.delete(version);
      }

      // Remove schedule
      this.schedules.delete(version);

      // Emit cancelled event
      this.emit('cancelled', {
        type: 'cancelled',
        version,
        timestamp: new Date().toISOString(),
        message: `Update ${version} cancelled`
      } as UpdateScheduleEvent);

      schedulerLogger.info('Update schedule cancelled', { version });
    } catch (error) {
      schedulerLogger.error('Failed to cancel schedule', error);
      throw error;
    }
  }

  /**
   * Reschedule an update
   */
  rescheduleUpdate(version: string, newScheduledTime: Date): void {
    try {
      const config = this.schedules.get(version);
      if (!config) {
        throw new Error(`No schedule found for version ${version}`);
      }

      // Cancel existing schedule
      this.cancelSchedule(version);

      // Schedule with new time
      this.scheduleUpdate({
        ...config,
        scheduledTime: newScheduledTime
      });

      schedulerLogger.info('Update rescheduled', {
        version,
        newScheduledTime: newScheduledTime.toISOString()
      });
    } catch (error) {
      schedulerLogger.error('Failed to reschedule update', error);
      throw error;
    }
  }

  /**
   * Get scheduled updates
   */
  getScheduledUpdates(): UpdateScheduleConfig[] {
    return Array.from(this.schedules.values());
  }

  /**
   * Get schedule for specific version
   */
  getSchedule(version: string): UpdateScheduleConfig | undefined {
    return this.schedules.get(version);
  }

  /**
   * Check if update is scheduled
   */
  isScheduled(version: string): boolean {
    return this.schedules.has(version);
  }

  /**
   * Get number of scheduled updates
   */
  getScheduleCount(): number {
    return this.schedules.size;
  }

  /**
   * Clear all schedules
   */
  clearAllSchedules(): void {
    try {
      // Clear all timers
      for (const timer of this.timers.values()) {
        clearTimeout(timer);
      }
      this.timers.clear();

      for (const timer of this.notificationTimers.values()) {
        clearTimeout(timer);
      }
      this.notificationTimers.clear();

      // Clear all schedules
      this.schedules.clear();

      schedulerLogger.info('All update schedules cleared');
    } catch (error) {
      schedulerLogger.error('Failed to clear schedules', error);
      throw error;
    }
  }

  /**
   * Private method to notify about upcoming update
   */
  private notifyUpdate(version: string): void {
    try {
      this.emit('notified', {
        type: 'notified',
        version,
        timestamp: new Date().toISOString(),
        message: `Update ${version} will be installed shortly`
      } as UpdateScheduleEvent);

      schedulerLogger.info('Update notification sent', { version });
    } catch (error) {
      schedulerLogger.error('Failed to send notification', error);
    }
  }

  /**
   * Private method to install scheduled update
   */
  private installScheduledUpdate(version: string): void {
    try {
      const config = this.schedules.get(version);
      if (!config) {
        return;
      }

      this.emit('installing', {
        type: 'installing',
        version,
        timestamp: new Date().toISOString(),
        message: `Installing update ${version}`
      } as UpdateScheduleEvent);

      schedulerLogger.info('Scheduled update installation started', { version });

      // Clean up timers
      this.timers.delete(version);
      this.notificationTimers.delete(version);
    } catch (error) {
      schedulerLogger.error('Failed to install scheduled update', error);
      this.emit('failed', {
        type: 'failed',
        version,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      } as UpdateScheduleEvent);
    }
  }
}

// Export singleton instance
export const updateScheduler = new UpdateScheduler();
