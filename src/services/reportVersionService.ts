/**
 * Report Version Service
 * Handles version management, comparison, and rollback functionality
 */

import { Database } from 'sqlite3';
import { ReportConfig, ReportVersion, ReportVersionHistory } from '../types/reports';
import { logger } from '../utils/logger';
import { getDatabasePath } from '@/config/environment';
import { authService } from './authService';

export interface VersionComparison {
  reportName: string;
  oldVersion: ReportVersion;
  newVersion: ReportVersion;
  changes: VersionChange[];
}

export interface VersionChange {
  field: string;
  oldValue: any;
  newValue: any;
  changeType: 'added' | 'removed' | 'modified';
}

export interface VersionCleanupPolicy {
  maxVersionsToKeep: number;
  maxAgeInDays: number;
  keepMajorVersions: boolean;
}

export class ReportVersionService {
  private db: Database;
  private initPromise: Promise<void> | null = null;
  private defaultCleanupPolicy: VersionCleanupPolicy = {
    maxVersionsToKeep: 10,
    maxAgeInDays: 90,
    keepMajorVersions: true
  };

  constructor(database: Database) {
    this.db = database;
    this.initPromise = this.initialize();
  }

  /**
   * Wait for service initialization to complete
   */
  async waitForInitialization(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Initialize service - ensures auth database is attached
   */
  private async initialize(): Promise<void> {
    try {
      // Wait for auth service to be ready before attaching
      await authService.waitForInitialization();

      // Attach auth database for user lookups
      const authDbPath = getDatabasePath('auth.db');
      await new Promise<void>((resolve) => {
        this.db.run(`ATTACH DATABASE '${authDbPath}' AS auth`, (err) => {
          if (err) {
            // If it's already attached or file is locked, we'll handle it gracefully
            if (err.message.includes('already being used') || err.message.includes('database auth is already in use')) {
              resolve();
              return;
            }
            logger.debug('Auth database attachment note in ReportVersionService:', err.message);
          }
          resolve();
        });
      });
    } catch (error) {
      logger.error('Failed to initialize ReportVersionService:', error);
      // Don't throw, we'll try to proceed
    }
  }

  /**
   * Helper method to deserialize dates in config objects
   */
  private deserializeDates(config: any): any {
    if (config.timeRange) {
      if (config.timeRange.startTime) {
        config.timeRange.startTime = new Date(config.timeRange.startTime);
      }
      if (config.timeRange.endTime) {
        config.timeRange.endTime = new Date(config.timeRange.endTime);
      }
    }
    if (config.createdAt) {
      config.createdAt = new Date(config.createdAt);
    }
    if (config.updatedAt) {
      config.updatedAt = new Date(config.updatedAt);
    }
    return config;
  }

  /**
   * Get the next version number for a report
   */
  async getNextVersionNumber(reportName: string): Promise<number> {
    await this.waitForInitialization();
    return new Promise((resolve, reject) => {
      const query = `
        SELECT MAX(version) as max_version 
        FROM report_versions 
        WHERE report_id = ?
      `;

      this.db.get(query, [reportName], (err, row: any) => {
        if (err) {
          logger.error('Error getting next version number:', err);
          reject(err);
          return;
        }

        const nextVersion = row?.max_version ? row.max_version + 1 : 1;
        resolve(nextVersion);
      });
    });
  }

  /**
   * Archive old version (mark as inactive)
   */
  async archiveOldVersion(reportId: string, version: number): Promise<void> {
    await this.waitForInitialization();
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE report_versions 
        SET is_active = false 
        WHERE report_id = ? AND version = ?
      `;

      this.db.run(query, [reportId, version], (err) => {
        if (err) {
          logger.error('Error archiving old version:', err);
          reject(err);
          return;
        }

        logger.info(`Archived version ${version} of report ${reportId}`);
        resolve();
      });
    });
  }

  /**
   * Restore a specific version (make it active and create new version)
   */
  async restoreVersion(reportId: string, version: number, userId: string): Promise<ReportConfig | null> {
    await this.waitForInitialization();
    try {
      // Get the version to restore
      const versionToRestore = await this.getSpecificVersion(reportId, version);
      if (!versionToRestore) {
        logger.warn(`Version ${version} not found for report ${reportId}`);
        return null;
      }

      // Get next version number
      const nextVersion = await this.getNextVersionNumber(reportId);

      // Create new version based on the restored config
      const restoredConfig: ReportConfig = {
        ...versionToRestore.config,
        version: nextVersion,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Insert as new version
      const insertQuery = `
        INSERT INTO report_versions (
          id, report_id, version, config, change_description, 
          is_active, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, true, ?, ?)
      `;

      const versionId = require('uuid').v4();
      const now = new Date().toISOString();
      const changeDescription = `Restored from version ${version}`;

      await new Promise<void>((resolve, reject) => {
        this.db.run(
          insertQuery,
          [versionId, reportId, nextVersion, JSON.stringify(restoredConfig), changeDescription, userId, now],
          (err) => {
            if (err) {
              logger.error('Error restoring version:', err);
              reject(err);
              return;
            }
            resolve();
          }
        );
      });

      logger.info(`Restored version ${version} as new version ${nextVersion} for report ${reportId}`);
      return restoredConfig;

    } catch (error) {
      logger.error('Error in restoreVersion:', error);
      return null;
    }
  }

  /**
   * Get a specific version of a report
   */
  async getSpecificVersion(reportId: string, version: number): Promise<ReportVersion | null> {
    await this.waitForInitialization();
    return new Promise((resolve, reject) => {
      const query = `
        SELECT rv.*, u.username as created_by_name 
        FROM report_versions rv
        LEFT JOIN auth.users u ON rv.created_by = u.id
        WHERE rv.report_id = ? AND rv.version = ?
      `;

      this.db.get(query, [reportId, version], (err, row: any) => {
        if (err) {
          logger.error('Error getting specific version:', err);
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        try {
          const reportVersion: ReportVersion = {
            id: row.id,
            reportId: row.report_id,
            version: row.version,
            config: this.deserializeDates(JSON.parse(row.config)),
            createdAt: new Date(row.created_at),
            createdBy: row.created_by_name || row.created_by,
            changeDescription: row.change_description,
            isActive: row.is_active
          };

          resolve(reportVersion);
        } catch (parseError) {
          logger.error('Error parsing version config:', parseError);
          reject(parseError);
        }
      });
    });
  }

  /**
   * Compare two versions of a report
   */
  async compareVersions(reportId: string, oldVersion: number, newVersion: number): Promise<VersionComparison | null> {
    await this.waitForInitialization();
    try {
      const oldVersionData = await this.getSpecificVersion(reportId, oldVersion);
      const newVersionData = await this.getSpecificVersion(reportId, newVersion);

      if (!oldVersionData || !newVersionData) {
        logger.warn(`Cannot compare versions - one or both versions not found: ${oldVersion}, ${newVersion}`);
        return null;
      }

      const changes = this.detectChanges(oldVersionData.config, newVersionData.config);

      return {
        reportName: oldVersionData.config.name,
        oldVersion: oldVersionData,
        newVersion: newVersionData,
        changes
      };

    } catch (error) {
      logger.error('Error comparing versions:', error);
      return null;
    }
  }

  /**
   * Detect changes between two report configurations
   */
  private detectChanges(oldConfig: ReportConfig, newConfig: ReportConfig): VersionChange[] {
    const changes: VersionChange[] = [];

    // Compare basic fields
    const fieldsToCompare = ['name', 'description', 'template'];
    fieldsToCompare.forEach(field => {
      const oldValue = (oldConfig as any)[field];
      const newValue = (newConfig as any)[field];

      if (oldValue !== newValue) {
        changes.push({
          field,
          oldValue,
          newValue,
          changeType: 'modified'
        });
      }
    });

    // Compare arrays (tags, chartTypes)
    if (JSON.stringify(oldConfig.tags) !== JSON.stringify(newConfig.tags)) {
      changes.push({
        field: 'tags',
        oldValue: oldConfig.tags,
        newValue: newConfig.tags,
        changeType: 'modified'
      });
    }

    if (JSON.stringify(oldConfig.chartTypes) !== JSON.stringify(newConfig.chartTypes)) {
      changes.push({
        field: 'chartTypes',
        oldValue: oldConfig.chartTypes,
        newValue: newConfig.chartTypes,
        changeType: 'modified'
      });
    }

    // Compare time range
    const oldTimeRange = oldConfig.timeRange;
    const newTimeRange = newConfig.timeRange;

    if (oldTimeRange.startTime.getTime() !== newTimeRange.startTime.getTime() ||
      oldTimeRange.endTime.getTime() !== newTimeRange.endTime.getTime() ||
      oldTimeRange.relativeRange !== newTimeRange.relativeRange) {
      changes.push({
        field: 'timeRange',
        oldValue: oldTimeRange,
        newValue: newTimeRange,
        changeType: 'modified'
      });
    }

    // Compare filters
    if (JSON.stringify(oldConfig.filters) !== JSON.stringify(newConfig.filters)) {
      changes.push({
        field: 'filters',
        oldValue: oldConfig.filters,
        newValue: newConfig.filters,
        changeType: 'modified'
      });
    }

    return changes;
  }

  /**
   * Clean up old versions based on policy
   */
  async cleanupOldVersions(reportId: string, policy?: VersionCleanupPolicy): Promise<number> {
    await this.waitForInitialization();
    let deletedCount = 0;

    try {
      // Get all versions for the report
      const cleanupPolicy = policy || this.defaultCleanupPolicy;
      const versions = await this.getAllVersions(reportId);

      if (versions.length <= cleanupPolicy.maxVersionsToKeep) {
        return 0; // No cleanup needed
      }

      // Sort versions by version number (descending)
      versions.sort((a, b) => b.version - a.version);

      // Keep the latest versions
      const versionsToKeep = versions.slice(0, cleanupPolicy.maxVersionsToKeep);
      const versionsToDelete = versions.slice(cleanupPolicy.maxVersionsToKeep);

      // Apply age-based cleanup
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - cleanupPolicy.maxAgeInDays);

      const finalVersionsToDelete = versionsToDelete.filter(version => {
        // Keep if it's within age limit
        if (version.createdAt > cutoffDate) {
          return false;
        }

        // Keep major versions if policy says so
        if (cleanupPolicy.keepMajorVersions && version.version % 10 === 0) {
          return false;
        }

        return true;
      });

      // Delete the versions
      for (const version of finalVersionsToDelete) {
        await this.deleteVersion(reportId, version.version);
        deletedCount++;
      }

      logger.info(`Cleaned up ${deletedCount} old versions for report ${reportId}`);
      return deletedCount;

    } catch (error) {
      logger.error('Error cleaning up old versions:', error);
      return 0;
    }
  }

  /**
   * Get all versions for a report
   */
  private async getAllVersions(reportId: string): Promise<ReportVersion[]> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT rv.*, u.username as created_by_name 
        FROM report_versions rv
        LEFT JOIN auth.users u ON rv.created_by = u.id
        WHERE rv.report_id = ? 
        ORDER BY rv.version DESC
      `;

      this.db.all(query, [reportId], (err, rows: any[]) => {
        if (err) {
          logger.error('Error getting all versions:', err);
          reject(err);
          return;
        }

        try {
          const versions: ReportVersion[] = rows.map(row => ({
            id: row.id,
            reportId: row.report_id,
            version: row.version,
            config: this.deserializeDates(JSON.parse(row.config)),
            createdAt: new Date(row.created_at),
            createdBy: row.created_by_name || row.created_by,
            changeDescription: row.change_description,
            isActive: row.is_active
          }));

          resolve(versions);
        } catch (parseError) {
          logger.error('Error parsing version configs:', parseError);
          reject(parseError);
        }
      });
    });
  }

  /**
   * Delete a specific version
   */
  private async deleteVersion(reportId: string, version: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = `
        DELETE FROM report_versions 
        WHERE report_id = ? AND version = ?
      `;

      this.db.run(query, [reportId, version], (err) => {
        if (err) {
          logger.error('Error deleting version:', err);
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Get version statistics for a report
   */
  async getVersionStatistics(reportId: string): Promise<{
    totalVersions: number;
    activeVersions: number;
    latestVersion: number;
    oldestVersion: number;
    averageTimeBetweenVersions: number; // in days
  } | null> {
    await this.waitForInitialization();
    try {
      const versions = await this.getAllVersions(reportId);

      if (versions.length === 0) {
        return null;
      }

      const activeVersions = versions.filter(v => v.isActive).length;
      const latestVersion = Math.max(...versions.map(v => v.version));
      const oldestVersion = Math.min(...versions.map(v => v.version));

      // Calculate average time between versions
      let totalTimeDiff = 0;
      for (let i = 1; i < versions.length; i++) {
        const prevVersion = versions[i - 1];
        const currentVersion = versions[i];
        if (prevVersion && currentVersion) {
          const timeDiff = prevVersion.createdAt.getTime() - currentVersion.createdAt.getTime();
          totalTimeDiff += timeDiff;
        }
      }

      const averageTimeBetweenVersions = versions.length > 1
        ? totalTimeDiff / (versions.length - 1) / (1000 * 60 * 60 * 24) // Convert to days
        : 0;

      return {
        totalVersions: versions.length,
        activeVersions,
        latestVersion,
        oldestVersion,
        averageTimeBetweenVersions
      };

    } catch (error) {
      logger.error('Error getting version statistics:', error);
      return null;
    }
  }
}