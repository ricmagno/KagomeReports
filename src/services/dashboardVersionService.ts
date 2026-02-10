/**
 * Dashboard Version Service
 * Handles dashboard version management, comparison, and rollback functionality
 */

import { Database } from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
    DashboardConfig,
    DashboardVersion,
    VersionChange,
    VersionComparison,
    VersionCleanupPolicy
} from '../types/dashboard';
import { logger } from '../utils/logger';

export class DashboardVersionService {
    private db: Database;
    private defaultCleanupPolicy: VersionCleanupPolicy = {
        maxVersionsToKeep: 10,
        maxAgeInDays: 90,
        keepMajorVersions: true
    };

    constructor(database: Database) {
        this.db = database;
    }

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

    async getNextVersionNumber(dashboardName: string): Promise<number> {
        return new Promise((resolve, reject) => {
            const query = `
        SELECT MAX(version) as max_version 
        FROM dashboard_versions 
        WHERE dashboard_id = ?
      `;

            this.db.get(query, [dashboardName], (err, row: any) => {
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

    async getSpecificVersion(dashboardName: string, version: number): Promise<DashboardVersion | null> {
        return new Promise((resolve, reject) => {
            const query = `
        SELECT dv.*, u.username as created_by_name 
        FROM dashboard_versions dv
        LEFT JOIN auth.users u ON dv.created_by = u.id
        WHERE dv.dashboard_id = ? AND dv.version = ?
      `;

            this.db.get(query, [dashboardName, version], (err, row: any) => {
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
                    const dashboardVersion: DashboardVersion = {
                        id: row.id,
                        dashboardId: row.dashboard_id,
                        version: row.version,
                        config: this.deserializeDates(JSON.parse(row.config)),
                        createdAt: new Date(row.created_at),
                        createdBy: row.created_by_name || row.created_by,
                        changeDescription: row.change_description,
                        isActive: row.is_active
                    };

                    resolve(dashboardVersion);
                } catch (parseError) {
                    logger.error('Error parsing version config:', parseError);
                    reject(parseError);
                }
            });
        });
    }

    async compareVersions(dashboardName: string, oldVersion: number, newVersion: number): Promise<VersionComparison | null> {
        try {
            const oldVersionData = await this.getSpecificVersion(dashboardName, oldVersion);
            const newVersionData = await this.getSpecificVersion(dashboardName, newVersion);

            if (!oldVersionData || !newVersionData) {
                logger.warn(`Cannot compare versions - one or both versions not found: ${oldVersion}, ${newVersion}`);
                return null;
            }

            const changes = this.detectChanges(oldVersionData.config, newVersionData.config);

            return {
                dashboardName: oldVersionData.config.name,
                oldVersion: oldVersionData,
                newVersion: newVersionData,
                changes
            };
        } catch (error) {
            logger.error('Error comparing versions:', error);
            return null;
        }
    }

    private detectChanges(oldConfig: DashboardConfig, newConfig: DashboardConfig): VersionChange[] {
        const changes: VersionChange[] = [];

        // Compare basic fields
        const fieldsToCompare = ['name', 'description', 'refreshRate'];
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

        // Compare widgets
        if (JSON.stringify(oldConfig.widgets) !== JSON.stringify(newConfig.widgets)) {
            changes.push({
                field: 'widgets',
                oldValue: oldConfig.widgets,
                newValue: newConfig.widgets,
                changeType: 'modified'
            });
        }

        // Compare time range
        const oldTimeRange = oldConfig.timeRange;
        const newTimeRange = newConfig.timeRange;

        if (oldTimeRange.startTime?.getTime() !== newTimeRange.startTime?.getTime() ||
            oldTimeRange.endTime?.getTime() !== newTimeRange.endTime?.getTime() ||
            oldTimeRange.relativeRange !== newTimeRange.relativeRange) {
            changes.push({
                field: 'timeRange',
                oldValue: oldTimeRange,
                newValue: newTimeRange,
                changeType: 'modified'
            });
        }

        return changes;
    }

    async cleanupOldVersions(dashboardName: string, policy?: VersionCleanupPolicy): Promise<number> {
        const cleanupPolicy = policy || this.defaultCleanupPolicy;
        let deletedCount = 0;

        try {
            const query = `
        SELECT version, created_at FROM dashboard_versions 
        WHERE dashboard_id = ? 
        ORDER BY version DESC
      `;

            const versions = await new Promise<any[]>((resolve, reject) => {
                this.db.all(query, [dashboardName], (err, rows) => {
                    if (err) reject(err); else resolve(rows);
                });
            });

            if (versions.length <= cleanupPolicy.maxVersionsToKeep) {
                return 0;
            }

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - cleanupPolicy.maxAgeInDays);

            const versionsToDelete = versions.slice(cleanupPolicy.maxVersionsToKeep).filter(v => {
                const createdAt = new Date(v.created_at);
                if (createdAt > cutoffDate) return false;
                if (cleanupPolicy.keepMajorVersions && v.version % 10 === 0) return false;
                return true;
            });

            for (const v of versionsToDelete) {
                await new Promise<void>((resolve, reject) => {
                    this.db.run(
                        'DELETE FROM dashboard_versions WHERE dashboard_id = ? AND version = ?',
                        [dashboardName, v.version],
                        (err) => { if (err) reject(err); else resolve(); }
                    );
                });
                deletedCount++;
            }

            return deletedCount;
        } catch (error) {
            logger.error('Error cleaning up dashboard versions:', error);
            return 0;
        }
    }
}
