/**
 * Dashboard Version Service
 * Handles dashboard version management, comparison, and rollback functionality
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
    DashboardConfig,
    DashboardVersion,
    VersionChange,
    VersionComparison,
    VersionCleanupPolicy
} from '../types/dashboard';
import { logger } from '../utils/logger';
import { getDatabasePath } from '@/config/environment';

export class DashboardVersionService {
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
                    logger.debug('Auth database attachment note in DashboardVersionService:', err.message);
                }
            }
        } catch (error) {
            logger.error('Failed to initialize DashboardVersionService:', error);
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

    async getNextVersionNumber(dashboardName: string): Promise<number> {
        const row = this.db.prepare(
            'SELECT MAX(version) as max_version FROM dashboard_versions WHERE dashboard_id = ?'
        ).get(dashboardName) as any;
        return row?.max_version ? row.max_version + 1 : 1;
    }

    async getSpecificVersion(dashboardName: string, version: number): Promise<DashboardVersion | null> {
        const row = this.db.prepare(`
            SELECT dv.*, u.username as created_by_name
            FROM dashboard_versions dv
            LEFT JOIN auth.users u ON dv.created_by = u.id
            WHERE dv.dashboard_id = ? AND dv.version = ?
        `).get(dashboardName, version) as any;

        if (!row) return null;

        try {
            return {
                id: row.id,
                dashboardId: row.dashboard_id,
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

    async compareVersions(dashboardName: string, oldVersion: number, newVersion: number): Promise<VersionComparison | null> {
        try {
            const oldVersionData = await this.getSpecificVersion(dashboardName, oldVersion);
            const newVersionData = await this.getSpecificVersion(dashboardName, newVersion);

            if (!oldVersionData || !newVersionData) {
                logger.warn(`Cannot compare versions - one or both versions not found: ${oldVersion}, ${newVersion}`);
                return null;
            }

            return {
                dashboardName: oldVersionData.config.name,
                oldVersion: oldVersionData,
                newVersion: newVersionData,
                changes: this.detectChanges(oldVersionData.config, newVersionData.config)
            };
        } catch (error) {
            logger.error('Error comparing versions:', error);
            return null;
        }
    }

    private detectChanges(oldConfig: DashboardConfig, newConfig: DashboardConfig): VersionChange[] {
        const changes: VersionChange[] = [];
        const fieldsToCompare = ['name', 'description', 'refreshRate'];
        fieldsToCompare.forEach(field => {
            const oldValue = (oldConfig as any)[field];
            const newValue = (newConfig as any)[field];
            if (oldValue !== newValue) changes.push({ field, oldValue, newValue, changeType: 'modified' });
        });

        if (JSON.stringify(oldConfig.widgets) !== JSON.stringify(newConfig.widgets)) {
            changes.push({ field: 'widgets', oldValue: oldConfig.widgets, newValue: newConfig.widgets, changeType: 'modified' });
        }

        const oldTimeRange = oldConfig.timeRange;
        const newTimeRange = newConfig.timeRange;
        if (oldTimeRange.startTime?.getTime() !== newTimeRange.startTime?.getTime() ||
            oldTimeRange.endTime?.getTime() !== newTimeRange.endTime?.getTime() ||
            oldTimeRange.relativeRange !== newTimeRange.relativeRange) {
            changes.push({ field: 'timeRange', oldValue: oldTimeRange, newValue: newTimeRange, changeType: 'modified' });
        }

        return changes;
    }

    async cleanupOldVersions(dashboardName: string, policy?: VersionCleanupPolicy): Promise<number> {
        const cleanupPolicy = policy || this.defaultCleanupPolicy;
        let deletedCount = 0;

        try {
            const versions = this.db.prepare(
                'SELECT version, created_at FROM dashboard_versions WHERE dashboard_id = ? ORDER BY version DESC'
            ).all(dashboardName) as any[];

            if (versions.length <= cleanupPolicy.maxVersionsToKeep) return 0;

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - cleanupPolicy.maxAgeInDays);

            const versionsToDelete = versions.slice(cleanupPolicy.maxVersionsToKeep).filter(v => {
                const createdAt = new Date(v.created_at);
                if (createdAt > cutoffDate) return false;
                if (cleanupPolicy.keepMajorVersions && v.version % 10 === 0) return false;
                return true;
            });

            const deleteStmt = this.db.prepare('DELETE FROM dashboard_versions WHERE dashboard_id = ? AND version = ?');
            for (const v of versionsToDelete) {
                deleteStmt.run(dashboardName, v.version);
                deletedCount++;
            }

            return deletedCount;
        } catch (error) {
            logger.error('Error cleaning up dashboard versions:', error);
            return 0;
        }
    }
}
