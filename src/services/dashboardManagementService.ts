/**
 * Dashboard Management Service
 * Handles saving, versioning, and retrieval of dashboard configurations
 */

import { Database } from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
    DashboardConfig,
    SavedDashboard,
    DashboardVersion,
    DashboardVersionHistory,
    DashboardListItem,
    SaveDashboardRequest,
    SaveDashboardResponse,
    DashboardValidationResult
} from '../types/dashboard';
import { logger } from '../utils/logger';
import { getDatabasePath } from '@/config/environment';
import { DashboardVersionService } from './dashboardVersionService';
import { authService } from './authService';

export class DashboardManagementService {
    private db: Database;
    private versionService: DashboardVersionService;
    private initPromise: Promise<void> | null = null;

    constructor(database: Database) {
        this.db = database;
        this.versionService = new DashboardVersionService(database);
        this.initPromise = this.initializeTables();
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
     * Initialize database tables for dashboard management
     */
    private async initializeTables(): Promise<void> {
        try {
            // Wait for auth service to be ready before attaching
            await authService.waitForInitialization();

            // Attach auth database for user lookups
            const authDbPath = getDatabasePath('auth.db');
            await new Promise<void>((resolve, reject) => {
                this.db.run(`ATTACH DATABASE '${authDbPath}' AS auth`, (err) => {
                    if (err) {
                        logger.debug('Auth database attachment note (can be ignored if already attached):', err.message);
                        // If it fails because it's already attached, that's fine
                        if (err.message.includes('already being used') || err.message.includes('database auth is already in use')) {
                            resolve();
                            return;
                        }
                    }
                    resolve();
                });
            });

            const createDashboardsTable = `
          CREATE TABLE IF NOT EXISTS dashboards (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            config JSON NOT NULL,
            version INTEGER DEFAULT 1,
            is_latest_version BOOLEAN DEFAULT true,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `;

            const createDashboardVersionsTable = `
          CREATE TABLE IF NOT EXISTS dashboard_versions (
            id TEXT PRIMARY KEY,
            dashboard_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            config JSON NOT NULL,
            change_description TEXT,
            is_active BOOLEAN DEFAULT true,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(dashboard_id, version)
          )
        `;

            const createIndexes = [
                'CREATE INDEX IF NOT EXISTS idx_dashboards_name ON dashboards(name)',
                'CREATE INDEX IF NOT EXISTS idx_dashboards_created_by ON dashboards(created_by)',
                'CREATE INDEX IF NOT EXISTS idx_dashboard_versions_dashboard_id ON dashboard_versions(dashboard_id)',
                'CREATE INDEX IF NOT EXISTS idx_dashboard_versions_version ON dashboard_versions(dashboard_id, version DESC)'
            ];

            await new Promise<void>((resolve, reject) => {
                this.db.serialize(() => {
                    this.db.run(createDashboardsTable, (err) => {
                        if (err) logger.error('Error creating dashboards table:', err);
                    });
                    this.db.run(createDashboardVersionsTable, (err) => {
                        if (err) logger.error('Error creating dashboard_versions table:', err);
                    });
                    createIndexes.forEach(index => {
                        this.db.run(index, (err) => {
                            if (err) logger.error('Error creating index:', err);
                        });
                    });
                    resolve();
                });
            });

            logger.info('Dashboard management tables initialized');
        } catch (error) {
            logger.error('Failed to initialize dashboard management tables:', error);
            throw error;
        }
    }

    /**
     * Validate dashboard configuration before saving
     */
    private validateDashboardConfig(config: DashboardConfig): DashboardValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!config.name || config.name.trim().length === 0) {
            errors.push('Dashboard name is required');
        }

        if (!config.widgets || config.widgets.length === 0) {
            warnings.push('Dashboard has no widgets');
        }

        if (config.name && config.name.length > 100) {
            errors.push('Dashboard name must be 100 characters or less');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Get the next version number for a dashboard name
     */
    private async getNextVersionNumber(dashboardName: string): Promise<number> {
        return new Promise((resolve, reject) => {
            const query = `
        SELECT MAX(version) as max_version 
        FROM dashboards 
        WHERE name = ?
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

    /**
     * Mark previous versions as not latest
     */
    private async markPreviousVersionsAsOld(dashboardName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const query = `
        UPDATE dashboards 
        SET is_latest_version = false, updated_at = CURRENT_TIMESTAMP
        WHERE name = ? AND is_latest_version = true
      `;

            this.db.run(query, [dashboardName], (err) => {
                if (err) {
                    logger.error('Error marking previous versions as old:', err);
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }

    /**
     * Save a dashboard configuration
     */
    async saveDashboard(request: SaveDashboardRequest, userId: string): Promise<SaveDashboardResponse> {
        await this.waitForInitialization();
        try {
            const fullConfig = {
                id: '',
                name: request.name,
                description: request.description,
                widgets: request.config.widgets,
                timeRange: request.config.timeRange,
                refreshRate: request.config.refreshRate || 30,
                createdBy: userId,
                createdAt: new Date(),
                updatedAt: new Date(),
                version: 1
            } as DashboardConfig;

            const validation = this.validateDashboardConfig(fullConfig);
            if (!validation.isValid) {
                return {
                    success: false,
                    dashboardId: '',
                    version: 0,
                    message: `Validation failed: ${validation.errors.join(', ')}`
                };
            }

            const version = await this.getNextVersionNumber(request.name);

            if (version > 1) {
                await this.markPreviousVersionsAsOld(request.name);
            }

            const dashboardId = uuidv4();
            const now = new Date().toISOString();

            fullConfig.id = dashboardId;
            fullConfig.version = version;
            fullConfig.createdAt = new Date(now);
            fullConfig.updatedAt = new Date(now);

            const insertDashboardQuery = `
        INSERT INTO dashboards (
          id, name, description, config, version, 
          is_latest_version, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, true, ?, ?, ?)
      `;

            await new Promise<void>((resolve, reject) => {
                this.db.run(
                    insertDashboardQuery,
                    [dashboardId, request.name, request.description, JSON.stringify(fullConfig), version, userId, now, now],
                    (err) => {
                        if (err) {
                            logger.error('Error saving dashboard:', err);
                            reject(err);
                            return;
                        }
                        resolve();
                    }
                );
            });

            const versionId = uuidv4();
            const insertVersionQuery = `
        INSERT INTO dashboard_versions (
          id, dashboard_id, version, config, change_description, 
          is_active, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, true, ?, ?)
      `;

            await new Promise<void>((resolve, reject) => {
                this.db.run(
                    insertVersionQuery,
                    [versionId, request.name, version, JSON.stringify(fullConfig), request.changeDescription || 'Initial version', userId, now],
                    (err) => {
                        if (err) {
                            logger.error('Error saving dashboard version:', err);
                            reject(err);
                            return;
                        }
                        resolve();
                    }
                );
            });

            logger.info(`Dashboard saved successfully: ${request.name} v${version} by ${userId}`);

            return {
                success: true,
                dashboardId,
                version,
                message: `Dashboard "${request.name}" saved successfully as version ${version}`
            };

        } catch (error) {
            logger.error('Error in saveDashboard:', error);
            return {
                success: false,
                dashboardId: '',
                version: 0,
                message: `Failed to save dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Load a specific dashboard configuration
     */
    async loadDashboard(dashboardId: string): Promise<SavedDashboard | null> {
        await this.waitForInitialization();
        return new Promise((resolve, reject) => {
            const query = `
        SELECT d.*, u.username as created_by_name 
        FROM dashboards d
        LEFT JOIN auth.users u ON d.created_by = u.id
        WHERE d.id = ? AND d.is_latest_version = true
      `;

            this.db.get(query, [dashboardId], (err, row: any) => {
                if (err) {
                    logger.error('Error loading dashboard:', err);
                    reject(err);
                    return;
                }

                if (!row) {
                    resolve(null);
                    return;
                }

                try {
                    const config = this.deserializeDates(JSON.parse(row.config));

                    const savedDashboard: SavedDashboard = {
                        id: row.id,
                        name: row.name,
                        description: row.description || '',
                        config,
                        version: row.version,
                        createdBy: row.created_by_name || row.created_by,
                        createdByUserId: row.created_by,
                        createdAt: new Date(row.created_at),
                        updatedAt: new Date(row.updated_at),
                        isLatestVersion: row.is_latest_version
                    };

                    resolve(savedDashboard);
                } catch (parseError) {
                    logger.error('Error parsing dashboard config:', parseError);
                    reject(parseError);
                }
            });
        });
    }

    /**
     * List all saved dashboards
     */
    async listDashboards(userId?: string): Promise<DashboardListItem[]> {
        await this.waitForInitialization();
        return new Promise((resolve, reject) => {
            let query = `
        SELECT 
          d.*,
          u.username as created_by_name,
          (SELECT COUNT(*) FROM dashboards d2 WHERE d2.name = d.name) as total_versions
        FROM dashboards d 
        LEFT JOIN auth.users u ON d.created_by = u.id
        WHERE d.is_latest_version = true
      `;

            const params: any[] = [];

            if (userId) {
                query += ' AND d.created_by = ?';
                params.push(userId);
            }

            query += ' ORDER BY d.updated_at DESC';

            this.db.all(query, params, (err, rows: any[]) => {
                if (err) {
                    logger.error('Error listing dashboards:', err);
                    reject(err);
                    return;
                }

                const dashboards: DashboardListItem[] = rows.map(row => ({
                    id: row.id,
                    name: row.name,
                    description: row.description || '',
                    config: this.deserializeDates(JSON.parse(row.config)),
                    version: row.version,
                    createdBy: row.created_by_name || row.created_by,
                    createdByUserId: row.created_by,
                    createdAt: new Date(row.created_at),
                    updatedAt: new Date(row.updated_at),
                    isLatestVersion: row.is_latest_version,
                    totalVersions: row.total_versions
                }));

                resolve(dashboards);
            });
        });
    }

    /**
     * Delete a dashboard and all its versions
     */
    async deleteDashboard(dashboardId: string, userId: string): Promise<boolean> {
        await this.waitForInitialization();
        try {
            const dashboard = await this.loadDashboard(dashboardId);
            if (!dashboard) return false;

            // Simple permission check (can be expanded)
            const isAdmin = await new Promise<boolean>((resolve) => {
                this.db.get('SELECT role FROM auth.users WHERE id = ?', [userId], (err, row: any) => {
                    resolve(row?.role === 'admin');
                });
            });

            if (!isAdmin && dashboard.createdByUserId !== userId) {
                return false;
            }

            await new Promise<void>((resolve, reject) => {
                this.db.serialize(() => {
                    this.db.run('DELETE FROM dashboards WHERE name = ?', [dashboard.name]);
                    this.db.run('DELETE FROM dashboard_versions WHERE dashboard_id = ?', [dashboard.name], (err) => {
                        if (err) reject(err); else resolve();
                    });
                });
            });

            return true;
        } catch (error) {
            logger.error('Error in deleteDashboard:', error);
            return false;
        }
    }

    /**
     * Get version history for a dashboard
     */
    async getDashboardVersions(dashboardName: string): Promise<DashboardVersionHistory | null> {
        await this.waitForInitialization();
        return new Promise((resolve, reject) => {
            const query = `
        SELECT dv.*, u.username as created_by_name 
        FROM dashboard_versions dv
        LEFT JOIN auth.users u ON dv.created_by = u.id
        WHERE dv.dashboard_id = ? 
        ORDER BY dv.version DESC
      `;

            this.db.all(query, [dashboardName], (err, rows: any[]) => {
                if (err || rows.length === 0) {
                    resolve(null);
                    return;
                }

                const versions: DashboardVersion[] = rows.map(row => ({
                    id: row.id,
                    dashboardId: row.dashboard_id,
                    version: row.version,
                    config: this.deserializeDates(JSON.parse(row.config)),
                    createdAt: new Date(row.created_at),
                    createdBy: row.created_by_name || row.created_by,
                    changeDescription: row.change_description,
                    isActive: row.is_active
                }));

                resolve({
                    dashboardId: dashboardName,
                    dashboardName: versions[0]?.config.name || dashboardName,
                    versions,
                    totalVersions: versions.length
                });
            });
        });
    }

    /**
     * Create a new version of an existing dashboard
     */
    async createNewVersion(dashboardName: string, config: DashboardConfig, userId: string, changeDescription?: string): Promise<DashboardVersion | null> {
        await this.waitForInitialization();
        try {
            const version = await this.getNextVersionNumber(dashboardName);
            await this.markPreviousVersionsAsOld(dashboardName);

            const dashboardId = uuidv4();
            const versionId = uuidv4();
            const now = new Date().toISOString();

            const fullConfig: DashboardConfig = {
                ...config,
                id: dashboardId,
                version,
                createdBy: userId,
                createdAt: new Date(now),
                updatedAt: new Date(now)
            };

            await new Promise<void>((resolve, reject) => {
                this.db.run(
                    `INSERT INTO dashboards (id, name, description, config, version, is_latest_version, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, true, ?, ?, ?)`,
                    [dashboardId, config.name, config.description, JSON.stringify(fullConfig), version, userId, now, now],
                    (err) => { if (err) reject(err); else resolve(); }
                );
            });

            await new Promise<void>((resolve, reject) => {
                this.db.run(
                    `INSERT INTO dashboard_versions (id, dashboard_id, version, config, change_description, is_active, created_by, created_at) VALUES (?, ?, ?, ?, ?, true, ?, ?)`,
                    [versionId, dashboardName, version, JSON.stringify(fullConfig), changeDescription || `Version ${version}`, userId, now],
                    (err) => { if (err) reject(err); else resolve(); }
                );
            });

            return {
                id: versionId,
                dashboardId: dashboardName,
                version,
                config: fullConfig,
                createdAt: new Date(now),
                createdBy: userId,
                changeDescription: changeDescription || `Version ${version}`,
                isActive: true
            };
        } catch (error) {
            logger.error('Error creating new version:', error);
            return null;
        }
    }
}
