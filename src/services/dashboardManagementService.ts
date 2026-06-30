/**
 * Dashboard Management Service
 * Handles saving, versioning, and retrieval of dashboard configurations
 */

import Database from 'better-sqlite3';
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
    private db: Database.Database;
    private versionService: DashboardVersionService;

    constructor(database: Database.Database) {
        this.db = database;
        this.versionService = new DashboardVersionService(database);
        this.initializeTables();
    }

    async waitForInitialization(): Promise<void> {
        // Synchronous init — no-op
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

    private initializeTables(): void {
        try {
            // Attach auth database for user lookups
            const authDbPath = getDatabasePath('auth.db');
            try {
                this.db.exec(`ATTACH DATABASE '${authDbPath}' AS auth`);
            } catch (err: any) {
                if (!err.message?.includes('already being used') && !err.message?.includes('database auth is already in use')) {
                    logger.debug('Auth database attachment note (can be ignored if already attached):', err.message);
                }
            }

            this.db.exec(`
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
            `);

            this.db.exec(`
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
            `);

            this.db.exec('CREATE INDEX IF NOT EXISTS idx_dashboards_name ON dashboards(name)');
            this.db.exec('CREATE INDEX IF NOT EXISTS idx_dashboards_created_by ON dashboards(created_by)');
            this.db.exec('CREATE INDEX IF NOT EXISTS idx_dashboard_versions_dashboard_id ON dashboard_versions(dashboard_id)');
            this.db.exec('CREATE INDEX IF NOT EXISTS idx_dashboard_versions_version ON dashboard_versions(dashboard_id, version DESC)');

            logger.info('Dashboard management tables initialized');
        } catch (error) {
            logger.error('Failed to initialize dashboard management tables:', error);
            throw error;
        }
    }

    private validateDashboardConfig(config: DashboardConfig): DashboardValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        if (!config.name || config.name.trim().length === 0) errors.push('Dashboard name is required');
        if (!config.widgets || config.widgets.length === 0) warnings.push('Dashboard has no widgets');
        if (config.name && config.name.length > 100) errors.push('Dashboard name must be 100 characters or less');
        return { isValid: errors.length === 0, errors, warnings };
    }

    private getNextVersionNumber(dashboardName: string): number {
        const row = this.db.prepare(
            'SELECT MAX(version) as max_version FROM dashboards WHERE name = ?'
        ).get(dashboardName) as any;
        return row?.max_version ? row.max_version + 1 : 1;
    }

    private markPreviousVersionsAsOld(dashboardName: string): void {
        this.db.prepare(
            'UPDATE dashboards SET is_latest_version = false, updated_at = CURRENT_TIMESTAMP WHERE name = ? AND is_latest_version = true'
        ).run(dashboardName);
    }

    async saveDashboard(request: SaveDashboardRequest, userId: string): Promise<SaveDashboardResponse> {
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
                return { success: false, dashboardId: '', version: 0, message: `Validation failed: ${validation.errors.join(', ')}` };
            }

            const version = this.getNextVersionNumber(request.name);
            if (version > 1) this.markPreviousVersionsAsOld(request.name);

            const dashboardId = uuidv4();
            const now = new Date().toISOString();
            fullConfig.id = dashboardId;
            fullConfig.version = version;
            fullConfig.createdAt = new Date(now);
            fullConfig.updatedAt = new Date(now);

            this.db.prepare(`
                INSERT INTO dashboards (id, name, description, config, version, is_latest_version, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, true, ?, ?, ?)
            `).run(dashboardId, request.name, request.description, JSON.stringify(fullConfig), version, userId, now, now);

            const versionId = uuidv4();
            this.db.prepare(`
                INSERT INTO dashboard_versions (id, dashboard_id, version, config, change_description, is_active, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, true, ?, ?)
            `).run(versionId, request.name, version, JSON.stringify(fullConfig), request.changeDescription || 'Initial version', userId, now);

            logger.info(`Dashboard saved successfully: ${request.name} v${version} by ${userId}`);
            return { success: true, dashboardId, version, message: `Dashboard "${request.name}" saved successfully as version ${version}` };
        } catch (error) {
            logger.error('Error in saveDashboard:', error);
            return { success: false, dashboardId: '', version: 0, message: `Failed to save dashboard: ${error instanceof Error ? error.message : 'Unknown error'}` };
        }
    }

    async loadDashboard(dashboardId: string): Promise<SavedDashboard | null> {
        const row = this.db.prepare(`
            SELECT d.*, u.username as created_by_name
            FROM dashboards d
            LEFT JOIN auth.users u ON d.created_by = u.id
            WHERE d.id = ? AND d.is_latest_version = true
        `).get(dashboardId) as any;

        if (!row) return null;
        try {
            const config = this.deserializeDates(JSON.parse(row.config));
            return {
                id: row.id, name: row.name, description: row.description || '',
                config, version: row.version,
                createdBy: row.created_by_name || row.created_by,
                createdByUserId: row.created_by,
                createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at),
                isLatestVersion: row.is_latest_version
            };
        } catch (parseError) {
            logger.error('Error parsing dashboard config:', parseError);
            throw parseError;
        }
    }

    async listDashboards(userId?: string): Promise<DashboardListItem[]> {
        let query = `
            SELECT d.*, u.username as created_by_name,
            (SELECT COUNT(*) FROM dashboards d2 WHERE d2.name = d.name) as total_versions
            FROM dashboards d
            LEFT JOIN auth.users u ON d.created_by = u.id
            WHERE d.is_latest_version = true
        `;
        const params: any[] = [];
        if (userId) { query += ' AND d.created_by = ?'; params.push(userId); }
        query += ' ORDER BY d.updated_at DESC';

        const rows = this.db.prepare(query).all(...params) as any[];
        return rows.map(row => ({
            id: row.id, name: row.name, description: row.description || '',
            config: this.deserializeDates(JSON.parse(row.config)),
            version: row.version, createdBy: row.created_by_name || row.created_by,
            createdByUserId: row.created_by,
            createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at),
            isLatestVersion: row.is_latest_version, totalVersions: row.total_versions
        }));
    }

    async deleteDashboard(dashboardId: string, userId: string): Promise<boolean> {
        try {
            const dashboard = await this.loadDashboard(dashboardId);
            if (!dashboard) return false;

            const userRow = this.db.prepare('SELECT role FROM auth.users WHERE id = ?').get(userId) as any;
            const isAdmin = userRow?.role === 'admin';

            if (!isAdmin && dashboard.createdByUserId !== userId) return false;

            this.db.prepare('DELETE FROM dashboards WHERE name = ?').run(dashboard.name);
            this.db.prepare('DELETE FROM dashboard_versions WHERE dashboard_id = ?').run(dashboard.name);
            return true;
        } catch (error) {
            logger.error('Error in deleteDashboard:', error);
            return false;
        }
    }

    async getDashboardVersions(dashboardName: string): Promise<DashboardVersionHistory | null> {
        const rows = this.db.prepare(`
            SELECT dv.*, u.username as created_by_name
            FROM dashboard_versions dv
            LEFT JOIN auth.users u ON dv.created_by = u.id
            WHERE dv.dashboard_id = ?
            ORDER BY dv.version DESC
        `).all(dashboardName) as any[];

        if (rows.length === 0) return null;

        const versions: DashboardVersion[] = rows.map(row => ({
            id: row.id, dashboardId: row.dashboard_id, version: row.version,
            config: this.deserializeDates(JSON.parse(row.config)),
            createdAt: new Date(row.created_at),
            createdBy: row.created_by_name || row.created_by,
            changeDescription: row.change_description, isActive: row.is_active
        }));

        return {
            dashboardId: dashboardName,
            dashboardName: versions[0]?.config.name || dashboardName,
            versions, totalVersions: versions.length
        };
    }

    async createNewVersion(dashboardName: string, config: DashboardConfig, userId: string, changeDescription?: string): Promise<DashboardVersion | null> {
        try {
            const version = this.getNextVersionNumber(dashboardName);
            this.markPreviousVersionsAsOld(dashboardName);

            const dashboardId = uuidv4();
            const versionId = uuidv4();
            const now = new Date().toISOString();

            const fullConfig: DashboardConfig = {
                ...config, id: dashboardId, version, createdBy: userId,
                createdAt: new Date(now), updatedAt: new Date(now)
            };

            this.db.prepare(`
                INSERT INTO dashboards (id, name, description, config, version, is_latest_version, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, true, ?, ?, ?)
            `).run(dashboardId, config.name, config.description, JSON.stringify(fullConfig), version, userId, now, now);

            this.db.prepare(`
                INSERT INTO dashboard_versions (id, dashboard_id, version, config, change_description, is_active, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, true, ?, ?)
            `).run(versionId, dashboardName, version, JSON.stringify(fullConfig), changeDescription || `Version ${version}`, userId, now);

            return {
                id: versionId, dashboardId: dashboardName, version, config: fullConfig,
                createdAt: new Date(now), createdBy: userId,
                changeDescription: changeDescription || `Version ${version}`, isActive: true
            };
        } catch (error) {
            logger.error('Error creating new version:', error);
            return null;
        }
    }
}
