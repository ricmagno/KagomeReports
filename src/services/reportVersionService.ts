/**
 * Report Version Service
 * Handles version management, comparison, and rollback functionality
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { ReportConfig, ReportVersion, ReportVersionHistory } from '../types/reports';
import { logger } from '../utils/logger';
import { getDatabasePath } from '@/config/environment';

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
  private db: Database.Database;
  private defaultCleanupPolicy: VersionCleanupPolicy = {
    maxVersionsToKeep: 10,
    maxAgeInDays: 90,
    keepMajorVersions: true
  };

  constructor(database: Database.Database) {
    this.db = database;
    this.initialize();
  }

  async waitForInitialization(): Promise<void> { }

  private initialize(): void {
    try {
      const authDbPath = getDatabasePath('auth.db');
      try {
        this.db.exec(`ATTACH DATABASE '${authDbPath}' AS auth`);
      } catch (err: any) {
        if (!err.message?.includes('already being used') && !err.message?.includes('database auth is already in use')) {
          logger.debug('Auth database attachment note in ReportVersionService:', err.message);
        }
      }
    } catch (error) {
      logger.error('Failed to initialize ReportVersionService:', error);
    }
  }

  private deserializeDates(config: any): any {
    if (config.timeRange) {
      if (config.timeRange.startTime) config.timeRange.startTime = new Date(config.timeRange.startTime);
      if (config.timeRange.endTime) config.timeRange.endTime = new Date(config.timeRange.endTime);
    }
    if (config.createdAt) config.createdAt = new Date(config.createdAt);
    if (config.updatedAt) config.updatedAt = new Date(config.updatedAt);
    return config;
  }

  async getNextVersionNumber(reportName: string): Promise<number> {
    const row = this.db.prepare(
      'SELECT MAX(version) as max_version FROM report_versions WHERE report_id = ?'
    ).get(reportName) as any;
    return row?.max_version ? row.max_version + 1 : 1;
  }

  async archiveOldVersion(reportId: string, version: number): Promise<void> {
    this.db.prepare(
      'UPDATE report_versions SET is_active = false WHERE report_id = ? AND version = ?'
    ).run(reportId, version);
    logger.info(`Archived version ${version} of report ${reportId}`);
  }

  async restoreVersion(reportId: string, version: number, userId: string): Promise<ReportConfig | null> {
    try {
      const versionToRestore = await this.getSpecificVersion(reportId, version);
      if (!versionToRestore) { logger.warn(`Version ${version} not found for report ${reportId}`); return null; }

      const nextVersion = await this.getNextVersionNumber(reportId);
      const restoredConfig: ReportConfig = { ...versionToRestore.config, version: nextVersion, createdBy: userId, createdAt: new Date(), updatedAt: new Date() };

      const versionId = uuidv4();
      const now = new Date().toISOString();
      const changeDescription = `Restored from version ${version}`;

      this.db.prepare(`
        INSERT INTO report_versions (id, report_id, version, config, change_description, is_active, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, true, ?, ?)
      `).run(versionId, reportId, nextVersion, JSON.stringify(restoredConfig), changeDescription, userId, now);

      logger.info(`Restored version ${version} as new version ${nextVersion} for report ${reportId}`);
      return restoredConfig;
    } catch (error) {
      logger.error('Error in restoreVersion:', error);
      return null;
    }
  }

  async getSpecificVersion(reportId: string, version: number): Promise<ReportVersion | null> {
    const row = this.db.prepare(`
      SELECT rv.*, u.username as created_by_name
      FROM report_versions rv
      LEFT JOIN auth.users u ON rv.created_by = u.id
      WHERE rv.report_id = ? AND rv.version = ?
    `).get(reportId, version) as any;

    if (!row) return null;

    try {
      return {
        id: row.id,
        reportId: row.report_id,
        version: row.version,
        config: this.deserializeDates(JSON.parse(row.config)),
        createdAt: new Date(row.created_at),
        createdBy: row.created_by_name || row.created_by,
        changeDescription: row.change_description,
        isActive: row.is_active
      };
    } catch (parseError) {
      logger.error('Error parsing version config:', parseError);
      throw parseError;
    }
  }

  async compareVersions(reportId: string, oldVersion: number, newVersion: number): Promise<VersionComparison | null> {
    try {
      const oldVersionData = await this.getSpecificVersion(reportId, oldVersion);
      const newVersionData = await this.getSpecificVersion(reportId, newVersion);

      if (!oldVersionData || !newVersionData) {
        logger.warn(`Cannot compare versions - one or both versions not found: ${oldVersion}, ${newVersion}`);
        return null;
      }

      return {
        reportName: oldVersionData.config.name,
        oldVersion: oldVersionData,
        newVersion: newVersionData,
        changes: this.detectChanges(oldVersionData.config, newVersionData.config)
      };
    } catch (error) {
      logger.error('Error comparing versions:', error);
      return null;
    }
  }

  private detectChanges(oldConfig: ReportConfig, newConfig: ReportConfig): VersionChange[] {
    const changes: VersionChange[] = [];
    const fieldsToCompare = ['name', 'description', 'template'];
    fieldsToCompare.forEach(field => {
      const oldValue = (oldConfig as any)[field];
      const newValue = (newConfig as any)[field];
      if (oldValue !== newValue) changes.push({ field, oldValue, newValue, changeType: 'modified' });
    });

    if (JSON.stringify(oldConfig.tags) !== JSON.stringify(newConfig.tags)) {
      changes.push({ field: 'tags', oldValue: oldConfig.tags, newValue: newConfig.tags, changeType: 'modified' });
    }
    if (JSON.stringify(oldConfig.chartTypes) !== JSON.stringify(newConfig.chartTypes)) {
      changes.push({ field: 'chartTypes', oldValue: oldConfig.chartTypes, newValue: newConfig.chartTypes, changeType: 'modified' });
    }

    const oldTimeRange = oldConfig.timeRange;
    const newTimeRange = newConfig.timeRange;
    if (oldTimeRange.startTime.getTime() !== newTimeRange.startTime.getTime() ||
      oldTimeRange.endTime.getTime() !== newTimeRange.endTime.getTime() ||
      oldTimeRange.relativeRange !== newTimeRange.relativeRange) {
      changes.push({ field: 'timeRange', oldValue: oldTimeRange, newValue: newTimeRange, changeType: 'modified' });
    }

    if (JSON.stringify(oldConfig.filters) !== JSON.stringify(newConfig.filters)) {
      changes.push({ field: 'filters', oldValue: oldConfig.filters, newValue: newConfig.filters, changeType: 'modified' });
    }

    return changes;
  }

  async cleanupOldVersions(reportId: string, policy?: VersionCleanupPolicy): Promise<number> {
    let deletedCount = 0;
    try {
      const cleanupPolicy = policy || this.defaultCleanupPolicy;
      const versions = await this.getAllVersions(reportId);

      if (versions.length <= cleanupPolicy.maxVersionsToKeep) return 0;

      versions.sort((a, b) => b.version - a.version);
      const versionsToDelete = versions.slice(cleanupPolicy.maxVersionsToKeep);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - cleanupPolicy.maxAgeInDays);

      const finalVersionsToDelete = versionsToDelete.filter(version => {
        if (version.createdAt > cutoffDate) return false;
        if (cleanupPolicy.keepMajorVersions && version.version % 10 === 0) return false;
        return true;
      });

      for (const version of finalVersionsToDelete) {
        this.deleteVersion(reportId, version.version);
        deletedCount++;
      }

      logger.info(`Cleaned up ${deletedCount} old versions for report ${reportId}`);
      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning up old versions:', error);
      return 0;
    }
  }

  private async getAllVersions(reportId: string): Promise<ReportVersion[]> {
    const rows = this.db.prepare(`
      SELECT rv.*, u.username as created_by_name
      FROM report_versions rv
      LEFT JOIN auth.users u ON rv.created_by = u.id
      WHERE rv.report_id = ?
      ORDER BY rv.version DESC
    `).all(reportId) as any[];

    try {
      return rows.map(row => ({
        id: row.id,
        reportId: row.report_id,
        version: row.version,
        config: this.deserializeDates(JSON.parse(row.config)),
        createdAt: new Date(row.created_at),
        createdBy: row.created_by_name || row.created_by,
        changeDescription: row.change_description,
        isActive: row.is_active
      }));
    } catch (parseError) {
      logger.error('Error parsing version configs:', parseError);
      throw parseError;
    }
  }

  private deleteVersion(reportId: string, version: number): void {
    this.db.prepare('DELETE FROM report_versions WHERE report_id = ? AND version = ?').run(reportId, version);
  }

  async getVersionStatistics(reportId: string): Promise<{
    totalVersions: number;
    activeVersions: number;
    latestVersion: number;
    oldestVersion: number;
    averageTimeBetweenVersions: number;
  } | null> {
    try {
      const versions = await this.getAllVersions(reportId);
      if (versions.length === 0) return null;

      const activeVersions = versions.filter(v => v.isActive).length;
      const latestVersion = Math.max(...versions.map(v => v.version));
      const oldestVersion = Math.min(...versions.map(v => v.version));

      let totalTimeDiff = 0;
      for (let i = 1; i < versions.length; i++) {
        const prevVersion = versions[i - 1];
        const currentVersion = versions[i];
        if (prevVersion && currentVersion) {
          totalTimeDiff += prevVersion.createdAt.getTime() - currentVersion.createdAt.getTime();
        }
      }

      const averageTimeBetweenVersions = versions.length > 1
        ? totalTimeDiff / (versions.length - 1) / (1000 * 60 * 60 * 24)
        : 0;

      return { totalVersions: versions.length, activeVersions, latestVersion, oldestVersion, averageTimeBetweenVersions };
    } catch (error) {
      logger.error('Error getting version statistics:', error);
      return null;
    }
  }
}
