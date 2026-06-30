import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { authService } from './authService';
import {
    AlertList,
    AlertConfig,
    AlertPattern,
    SaveAlertListRequest,
    SaveAlertConfigRequest,
    SaveAlertPatternRequest
} from '../types/alerts';
import { getDatabasePath } from '@/config/environment';

export class AlertManagementService {
    private db: Database.Database;

    constructor() {
        const dbPath = getDatabasePath('alerts.db');
        this.db = new Database(dbPath);
        this.initializeTables();
    }

    async waitForInitialization(): Promise<void> {
        // Synchronous init — no-op
    }

    private initializeTables(): void {
        try {
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS alert_lists (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    members JSON NOT NULL,
                    created_by TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            this.db.exec(`
                CREATE TABLE IF NOT EXISTS alert_patterns (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    pv_suffix TEXT NOT NULL,
                    hh_limit_suffix TEXT NOT NULL,
                    h_limit_suffix TEXT NOT NULL,
                    l_limit_suffix TEXT NOT NULL,
                    ll_limit_suffix TEXT NOT NULL,
                    hh_event_suffix TEXT NOT NULL,
                    h_event_suffix TEXT NOT NULL,
                    l_event_suffix TEXT NOT NULL,
                    ll_event_suffix TEXT NOT NULL,
                    created_by TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            this.db.exec(`
                CREATE TABLE IF NOT EXISTS alert_configs (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    tag_base TEXT NOT NULL,
                    monitor_hh BOOLEAN DEFAULT 0,
                    monitor_h BOOLEAN DEFAULT 0,
                    monitor_l BOOLEAN DEFAULT 0,
                    monitor_ll BOOLEAN DEFAULT 0,
                    alert_list_id TEXT NOT NULL,
                    pattern_id TEXT NOT NULL,
                    is_active BOOLEAN DEFAULT 1,
                    created_by TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(alert_list_id) REFERENCES alert_lists(id),
                    FOREIGN KEY(pattern_id) REFERENCES alert_patterns(id)
                )
            `);

            // Add pattern_id column if missing (migration)
            const columns = this.db.pragma('table_info(alert_configs)') as any[];
            const hasPatternId = columns.some(col => col.name === 'pattern_id');
            if (!hasPatternId) {
                logger.info('Migrating alert_configs: Adding pattern_id column');
                try {
                    this.db.exec('ALTER TABLE alert_configs ADD COLUMN pattern_id TEXT DEFAULT ""');
                } catch (err) {
                    logger.error('Error adding pattern_id to alert_configs:', err);
                }
            }

            // Seed default Analog Alarms pattern if tables are empty
            const row = this.db.prepare('SELECT COUNT(*) as count FROM alert_patterns').get() as any;
            if (row && row.count === 0) {
                logger.info('Seeding default Alert Pattern: Analog Alarms');
                const defaultId = 'system-analog-alarms';
                const now = new Date().toISOString();
                this.db.prepare(`
                    INSERT INTO alert_patterns (
                        id, name, description, pv_suffix, hh_limit_suffix, h_limit_suffix,
                        l_limit_suffix, ll_limit_suffix, hh_event_suffix, h_event_suffix,
                        l_event_suffix, ll_event_suffix, created_by, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    defaultId, 'Analog Alarms', 'Standard ISA analog alarm pattern',
                    'PV', 'HighHigh', 'High', 'Low', 'LowLow', 'HH', 'H', 'L', 'LL',
                    'system', now, now
                );
                this.db.prepare(
                    'UPDATE alert_configs SET pattern_id = ? WHERE pattern_id = "" OR pattern_id IS NULL'
                ).run(defaultId);
            }

            logger.info('Alert management tables initialized');
        } catch (error) {
            logger.error('Failed to initialize alert management tables:', error);
            throw error;
        }
    }

    // --- Alert Lists ---

    async createAlertList(request: SaveAlertListRequest, userId: string): Promise<AlertList> {
        const id = uuidv4();
        const now = new Date();
        this.db.prepare(`
            INSERT INTO alert_lists (id, name, description, members, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, request.name, request.description || '', JSON.stringify(request.members), userId, now.toISOString(), now.toISOString());
        return { id, ...request, createdBy: userId, createdAt: now, updatedAt: now };
    }

    async updateAlertList(id: string, request: SaveAlertListRequest): Promise<AlertList | null> {
        const now = new Date();
        const result = this.db.prepare(`
            UPDATE alert_lists SET name = ?, description = ?, members = ?, updated_at = ? WHERE id = ?
        `).run(request.name, request.description || '', JSON.stringify(request.members), now.toISOString(), id);
        if (result.changes === 0) return null;
        const row = this.db.prepare('SELECT * FROM alert_lists WHERE id = ?').get(id) as any;
        if (!row) return null;
        return {
            id: row.id, name: row.name, description: row.description,
            members: JSON.parse(row.members), createdBy: row.created_by,
            createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at)
        };
    }

    async getAlertLists(): Promise<AlertList[]> {
        const rows = this.db.prepare('SELECT * FROM alert_lists ORDER BY created_at DESC').all() as any[];
        return rows.map(row => ({
            id: row.id, name: row.name, description: row.description,
            members: JSON.parse(row.members), createdBy: row.created_by,
            createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at)
        }));
    }

    async getAlertListById(id: string): Promise<AlertList | null> {
        const row = this.db.prepare('SELECT * FROM alert_lists WHERE id = ?').get(id) as any;
        if (!row) return null;
        return {
            id: row.id, name: row.name, description: row.description,
            members: JSON.parse(row.members), createdBy: row.created_by,
            createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at)
        };
    }

    async deleteAlertList(id: string): Promise<boolean> {
        const result = this.db.prepare('DELETE FROM alert_lists WHERE id = ?').run(id);
        return result.changes > 0;
    }

    // --- Alert Configs ---

    async createAlertConfig(request: SaveAlertConfigRequest, userId: string): Promise<AlertConfig> {
        const id = uuidv4();
        const now = new Date();
        this.db.prepare(`
            INSERT INTO alert_configs (
                id, name, description, tag_base, monitor_hh, monitor_h, monitor_l, monitor_ll,
                alert_list_id, pattern_id, is_active, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, request.name, request.description || '', request.tagBase,
            request.monitorHH ? 1 : 0, request.monitorH ? 1 : 0,
            request.monitorL ? 1 : 0, request.monitorLL ? 1 : 0,
            request.alertListId, request.patternId, request.isActive ? 1 : 0,
            userId, now.toISOString(), now.toISOString()
        );
        return { id, ...request, createdBy: userId, createdAt: now, updatedAt: now };
    }

    async updateAlertConfig(id: string, request: SaveAlertConfigRequest): Promise<AlertConfig | null> {
        const now = new Date();
        const result = this.db.prepare(`
            UPDATE alert_configs
            SET name = ?, description = ?, tag_base = ?, monitor_hh = ?, monitor_h = ?,
                monitor_l = ?, monitor_ll = ?, alert_list_id = ?, pattern_id = ?, is_active = ?, updated_at = ?
            WHERE id = ?
        `).run(
            request.name, request.description || '', request.tagBase,
            request.monitorHH ? 1 : 0, request.monitorH ? 1 : 0,
            request.monitorL ? 1 : 0, request.monitorLL ? 1 : 0,
            request.alertListId, request.patternId, request.isActive ? 1 : 0,
            now.toISOString(), id
        );
        if (result.changes === 0) return null;
        const row = this.db.prepare('SELECT * FROM alert_configs WHERE id = ?').get(id) as any;
        if (!row) return null;
        return this.rowToAlertConfig(row);
    }

    async getAlertConfigs(): Promise<AlertConfig[]> {
        const rows = this.db.prepare('SELECT * FROM alert_configs ORDER BY created_at DESC').all() as any[];
        return rows.map(row => this.rowToAlertConfig(row));
    }

    async getActiveAlertConfigs(): Promise<AlertConfig[]> {
        const rows = this.db.prepare('SELECT * FROM alert_configs WHERE is_active = 1').all() as any[];
        return rows.map(row => this.rowToAlertConfig(row));
    }

    async getAlertConfigById(id: string): Promise<AlertConfig | null> {
        const row = this.db.prepare('SELECT * FROM alert_configs WHERE id = ?').get(id) as any;
        return row ? this.rowToAlertConfig(row) : null;
    }

    async deleteAlertConfig(id: string): Promise<boolean> {
        const result = this.db.prepare('DELETE FROM alert_configs WHERE id = ?').run(id);
        return result.changes > 0;
    }

    // --- Alert Patterns ---

    async createAlertPattern(request: SaveAlertPatternRequest, userId: string): Promise<AlertPattern> {
        const id = uuidv4();
        const now = new Date();
        this.db.prepare(`
            INSERT INTO alert_patterns (
                id, name, description, pv_suffix, hh_limit_suffix, h_limit_suffix,
                l_limit_suffix, ll_limit_suffix, hh_event_suffix, h_event_suffix,
                l_event_suffix, ll_event_suffix, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, request.name, request.description || '',
            request.pvSuffix, request.hhLimitSuffix, request.hLimitSuffix,
            request.lLimitSuffix, request.llLimitSuffix,
            request.hhEventSuffix, request.hEventSuffix,
            request.lEventSuffix, request.llEventSuffix,
            userId, now.toISOString(), now.toISOString()
        );
        return { id, ...request, createdBy: userId, createdAt: now, updatedAt: now };
    }

    async updateAlertPattern(id: string, request: SaveAlertPatternRequest): Promise<AlertPattern | null> {
        const now = new Date();
        const result = this.db.prepare(`
            UPDATE alert_patterns
            SET name = ?, description = ?, pv_suffix = ?, hh_limit_suffix = ?, h_limit_suffix = ?,
                l_limit_suffix = ?, ll_limit_suffix = ?, hh_event_suffix = ?, h_event_suffix = ?,
                l_event_suffix = ?, ll_event_suffix = ?, updated_at = ?
            WHERE id = ?
        `).run(
            request.name, request.description || '',
            request.pvSuffix, request.hhLimitSuffix, request.hLimitSuffix,
            request.lLimitSuffix, request.llLimitSuffix,
            request.hhEventSuffix, request.hEventSuffix,
            request.lEventSuffix, request.llEventSuffix,
            now.toISOString(), id
        );
        if (result.changes === 0) return null;
        const row = this.db.prepare('SELECT * FROM alert_patterns WHERE id = ?').get(id) as any;
        return row ? this.rowToAlertPattern(row) : null;
    }

    async getAlertPatterns(): Promise<AlertPattern[]> {
        const rows = this.db.prepare('SELECT * FROM alert_patterns ORDER BY created_at DESC').all() as any[];
        return rows.map(row => this.rowToAlertPattern(row));
    }

    async getAlertPatternById(id: string): Promise<AlertPattern | null> {
        const row = this.db.prepare('SELECT * FROM alert_patterns WHERE id = ?').get(id) as any;
        return row ? this.rowToAlertPattern(row) : null;
    }

    async deleteAlertPattern(id: string): Promise<boolean> {
        const usageRow = this.db.prepare(
            'SELECT COUNT(*) as count FROM alert_configs WHERE pattern_id = ?'
        ).get(id) as any;
        if (usageRow.count > 0) {
            throw new Error('Cannot delete pattern: It is currently used by one or more alert configurations');
        }
        const result = this.db.prepare('DELETE FROM alert_patterns WHERE id = ?').run(id);
        return result.changes > 0;
    }

    private rowToAlertConfig(row: any): AlertConfig {
        return {
            id: row.id, name: row.name, description: row.description,
            tagBase: row.tag_base,
            monitorHH: Boolean(row.monitor_hh), monitorH: Boolean(row.monitor_h),
            monitorL: Boolean(row.monitor_l), monitorLL: Boolean(row.monitor_ll),
            alertListId: row.alert_list_id, patternId: row.pattern_id,
            isActive: Boolean(row.is_active), createdBy: row.created_by,
            createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at)
        };
    }

    private rowToAlertPattern(row: any): AlertPattern {
        return {
            id: row.id, name: row.name, description: row.description,
            pvSuffix: row.pv_suffix, hhLimitSuffix: row.hh_limit_suffix,
            hLimitSuffix: row.h_limit_suffix, lLimitSuffix: row.l_limit_suffix,
            llLimitSuffix: row.ll_limit_suffix, hhEventSuffix: row.hh_event_suffix,
            hEventSuffix: row.h_event_suffix, lEventSuffix: row.l_event_suffix,
            llEventSuffix: row.ll_event_suffix, createdBy: row.created_by,
            createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at)
        };
    }
}

export const alertManagementService = new AlertManagementService();
