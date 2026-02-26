import { Database } from 'sqlite3';
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
    private db: Database;
    private initPromise: Promise<void> | null = null;

    constructor() {
        const dbPath = getDatabasePath('alerts.db');
        this.db = new Database(dbPath);
        this.initPromise = this.initializeTables();
    }

    async waitForInitialization(): Promise<void> {
        if (this.initPromise) {
            await this.initPromise;
        }
    }

    private async initializeTables(): Promise<void> {
        try {
            await authService.waitForInitialization();

            const createAlertListsTable = `
                CREATE TABLE IF NOT EXISTS alert_lists (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    members JSON NOT NULL,
                    created_by TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

            const createAlertPatternsTable = `
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
            `;

            const createAlertConfigsTable = `
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
            `;

            await new Promise<void>((resolve, reject) => {
                this.db.serialize(() => {
                    this.db.run(createAlertListsTable, (err) => {
                        if (err) logger.error('Error creating alert_lists table:', err);
                    });
                    this.db.run(createAlertPatternsTable, (err) => {
                        if (err) logger.error('Error creating alert_patterns table:', err);
                    });
                    this.db.run(createAlertConfigsTable, (err) => {
                        if (err) logger.error('Error creating alert_configs table:', err);
                    });

                    // Add pattern_id to alert_configs if it doesn't exist
                    this.db.all("PRAGMA table_info(alert_configs)", (err, columns: any[]) => {
                        if (err) {
                            logger.error('Error checking alert_configs columns:', err);
                            return;
                        }
                        const hasPatternId = columns.some(col => col.name === 'pattern_id');
                        if (!hasPatternId) {
                            logger.info('Migrating alert_configs: Adding pattern_id column');
                            this.db.run('ALTER TABLE alert_configs ADD COLUMN pattern_id TEXT DEFAULT ""', (err) => {
                                if (err) logger.error('Error adding pattern_id to alert_configs:', err);
                            });
                        }
                    });

                    // Seed default Analog Alarms pattern if tables are empty
                    this.db.get("SELECT COUNT(*) as count FROM alert_patterns", (err, row: any) => {
                        if (!err && row && row.count === 0) {
                            logger.info('Seeding default Alert Pattern: Analog Alarms');
                            const defaultId = 'system-analog-alarms';
                            const now = new Date().toISOString();
                            const insertPattern = `
                                INSERT INTO alert_patterns (
                                    id, name, description, pv_suffix, hh_limit_suffix, h_limit_suffix,
                                    l_limit_suffix, ll_limit_suffix, hh_event_suffix, h_event_suffix,
                                    l_event_suffix, ll_event_suffix, created_by, created_at, updated_at
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `;
                            this.db.run(insertPattern, [
                                defaultId,
                                'Analog Alarms',
                                'Standard ISA analog alarm pattern',
                                'PV', 'HighHigh', 'High', 'Low', 'LowLow', 'HH', 'H', 'L', 'LL',
                                'system', now, now
                            ], (err) => {
                                if (err) logger.error('Error seeding default pattern:', err);
                                else {
                                    // Update existing configs that have no pattern to use this default
                                    this.db.run('UPDATE alert_configs SET pattern_id = ? WHERE pattern_id = "" OR pattern_id IS NULL', [defaultId]);
                                }
                            });
                        }
                    });

                    resolve();
                });
            });

            logger.info('Alert management tables initialized');
        } catch (error) {
            logger.error('Failed to initialize alert management tables:', error);
            throw error;
        }
    }

    // --- Alert Lists ---

    async createAlertList(request: SaveAlertListRequest, userId: string): Promise<AlertList> {
        await this.waitForInitialization();
        const id = uuidv4();
        const now = new Date();

        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO alert_lists (id, name, description, members, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(query, [
                id,
                request.name,
                request.description || '',
                JSON.stringify(request.members),
                userId,
                now.toISOString(),
                now.toISOString()
            ], (err) => {
                if (err) {
                    logger.error('Error creating alert list:', err);
                    return reject(err);
                }
                resolve({
                    id,
                    ...request,
                    createdBy: userId,
                    createdAt: now,
                    updatedAt: now
                });
            });
        });
    }

    async updateAlertList(id: string, request: SaveAlertListRequest): Promise<AlertList | null> {
        await this.waitForInitialization();
        const now = new Date();
        const dbInstance = this.db;

        return new Promise((resolve, reject) => {
            const query = `
                UPDATE alert_lists 
                SET name = ?, description = ?, members = ?, updated_at = ?
                WHERE id = ?
            `;

            dbInstance.run(query, [
                request.name,
                request.description || '',
                JSON.stringify(request.members),
                now.toISOString(),
                id
            ], function (this: { changes: number }, err: any) {
                if (err) {
                    logger.error('Error updating alert list:', err);
                    return reject(err);
                }
                if (this.changes === 0) return resolve(null);

                // Fetch the updated list
                dbInstance.get('SELECT * FROM alert_lists WHERE id = ?', [id], (err: any, row: any) => {
                    if (err || !row) return resolve(null);
                    resolve({
                        id: row.id,
                        name: row.name,
                        description: row.description,
                        members: JSON.parse(row.members),
                        createdBy: row.created_by,
                        createdAt: new Date(row.created_at),
                        updatedAt: new Date(row.updated_at)
                    });
                });
            });
        });
    }

    async getAlertLists(): Promise<AlertList[]> {
        await this.waitForInitialization();
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM alert_lists ORDER BY created_at DESC', (err, rows: any[]) => {
                if (err) {
                    logger.error('Error getting alert lists:', err);
                    return reject(err);
                }
                resolve(rows.map(row => ({
                    id: row.id,
                    name: row.name,
                    description: row.description,
                    members: JSON.parse(row.members),
                    createdBy: row.created_by,
                    createdAt: new Date(row.created_at),
                    updatedAt: new Date(row.updated_at)
                })));
            });
        });
    }

    async getAlertListById(id: string): Promise<AlertList | null> {
        await this.waitForInitialization();
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM alert_lists WHERE id = ?', [id], (err, row: any) => {
                if (err) {
                    logger.error('Error getting alert list by id:', err);
                    return reject(err);
                }
                if (!row) return resolve(null);
                resolve({
                    id: row.id,
                    name: row.name,
                    description: row.description,
                    members: JSON.parse(row.members),
                    createdBy: row.created_by,
                    createdAt: new Date(row.created_at),
                    updatedAt: new Date(row.updated_at)
                });
            });
        });
    }

    async deleteAlertList(id: string): Promise<boolean> {
        await this.waitForInitialization();
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM alert_lists WHERE id = ?', [id], function (err) {
                if (err) {
                    logger.error('Error deleting alert list:', err);
                    return reject(err);
                }
                resolve(this.changes > 0);
            });
        });
    }

    // --- Alert Configs ---

    async createAlertConfig(request: SaveAlertConfigRequest, userId: string): Promise<AlertConfig> {
        await this.waitForInitialization();
        const id = uuidv4();
        const now = new Date();

        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO alert_configs (
                    id, name, description, tag_base, monitor_hh, monitor_h, monitor_l, monitor_ll, 
                    alert_list_id, pattern_id, is_active, created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(query, [
                id,
                request.name,
                request.description || '',
                request.tagBase,
                request.monitorHH ? 1 : 0,
                request.monitorH ? 1 : 0,
                request.monitorL ? 1 : 0,
                request.monitorLL ? 1 : 0,
                request.alertListId,
                request.patternId,
                request.isActive ? 1 : 0,
                userId,
                now.toISOString(),
                now.toISOString()
            ], (err) => {
                if (err) {
                    logger.error('Error creating alert config:', err);
                    return reject(err);
                }
                resolve({
                    id,
                    ...request,
                    createdBy: userId,
                    createdAt: now,
                    updatedAt: now
                });
            });
        });
    }

    async updateAlertConfig(id: string, request: SaveAlertConfigRequest): Promise<AlertConfig | null> {
        await this.waitForInitialization();
        const now = new Date();
        const dbInstance = this.db;

        return new Promise((resolve, reject) => {
            const query = `
                UPDATE alert_configs 
                SET name = ?, description = ?, tag_base = ?, monitor_hh = ?, monitor_h = ?, 
                    monitor_l = ?, monitor_ll = ?, alert_list_id = ?, pattern_id = ?, is_active = ?, updated_at = ?
                WHERE id = ?
            `;

            dbInstance.run(query, [
                request.name,
                request.description || '',
                request.tagBase,
                request.monitorHH ? 1 : 0,
                request.monitorH ? 1 : 0,
                request.monitorL ? 1 : 0,
                request.monitorLL ? 1 : 0,
                request.alertListId,
                request.patternId,
                request.isActive ? 1 : 0,
                now.toISOString(),
                id
            ], function (this: { changes: number }, err: any) {
                if (err) {
                    logger.error('Error updating alert config:', err);
                    return reject(err);
                }
                if (this.changes === 0) return resolve(null);

                dbInstance.get('SELECT * FROM alert_configs WHERE id = ?', [id], (err: any, row: any) => {
                    if (err || !row) return resolve(null);
                    resolve({
                        id: row.id,
                        name: row.name,
                        description: row.description,
                        tagBase: row.tag_base,
                        monitorHH: Boolean(row.monitor_hh),
                        monitorH: Boolean(row.monitor_h),
                        monitorL: Boolean(row.monitor_l),
                        monitorLL: Boolean(row.monitor_ll),
                        alertListId: row.alert_list_id,
                        patternId: row.pattern_id,
                        isActive: Boolean(row.is_active),
                        createdBy: row.created_by,
                        createdAt: new Date(row.created_at),
                        updatedAt: new Date(row.updated_at)
                    });
                });
            });
        });
    }

    async getAlertConfigs(): Promise<AlertConfig[]> {
        await this.waitForInitialization();
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM alert_configs ORDER BY created_at DESC', (err, rows: any[]) => {
                if (err) {
                    logger.error('Error getting alert configs:', err);
                    return reject(err);
                }
                resolve(rows.map(row => ({
                    id: row.id,
                    name: row.name,
                    description: row.description,
                    tagBase: row.tag_base,
                    monitorHH: Boolean(row.monitor_hh),
                    monitorH: Boolean(row.monitor_h),
                    monitorL: Boolean(row.monitor_l),
                    monitorLL: Boolean(row.monitor_ll),
                    alertListId: row.alert_list_id,
                    patternId: row.pattern_id,
                    isActive: Boolean(row.is_active),
                    createdBy: row.created_by,
                    createdAt: new Date(row.created_at),
                    updatedAt: new Date(row.updated_at)
                })));
            });
        });
    }

    async getActiveAlertConfigs(): Promise<AlertConfig[]> {
        await this.waitForInitialization();
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM alert_configs WHERE is_active = 1', (err, rows: any[]) => {
                if (err) {
                    logger.error('Error getting active alert configs:', err);
                    return reject(err);
                }
                resolve(rows.map(row => ({
                    id: row.id,
                    name: row.name,
                    description: row.description,
                    tagBase: row.tag_base,
                    monitorHH: Boolean(row.monitor_hh),
                    monitorH: Boolean(row.monitor_h),
                    monitorL: Boolean(row.monitor_l),
                    monitorLL: Boolean(row.monitor_ll),
                    alertListId: row.alert_list_id,
                    patternId: row.pattern_id,
                    isActive: Boolean(row.is_active),
                    createdBy: row.created_by,
                    createdAt: new Date(row.created_at),
                    updatedAt: new Date(row.updated_at)
                })));
            });
        });
    }

    async getAlertConfigById(id: string): Promise<AlertConfig | null> {
        await this.waitForInitialization();
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM alert_configs WHERE id = ?', [id], (err, row: any) => {
                if (err) {
                    logger.error('Error getting alert config by id:', err);
                    return reject(err);
                }
                if (!row) return resolve(null);
                resolve({
                    id: row.id,
                    name: row.name,
                    description: row.description,
                    tagBase: row.tag_base,
                    monitorHH: Boolean(row.monitor_hh),
                    monitorH: Boolean(row.monitor_h),
                    monitorL: Boolean(row.monitor_l),
                    monitorLL: Boolean(row.monitor_ll),
                    alertListId: row.alert_list_id,
                    patternId: row.pattern_id,
                    isActive: Boolean(row.is_active),
                    createdBy: row.created_by,
                    createdAt: new Date(row.created_at),
                    updatedAt: new Date(row.updated_at)
                });
            });
        });
    }

    async deleteAlertConfig(id: string): Promise<boolean> {
        await this.waitForInitialization();
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM alert_configs WHERE id = ?', [id], function (err) {
                if (err) {
                    logger.error('Error deleting alert config:', err);
                    return reject(err);
                }
                resolve(this.changes > 0);
            });
        });
    }

    // --- Alert Patterns ---

    async createAlertPattern(request: SaveAlertPatternRequest, userId: string): Promise<AlertPattern> {
        await this.waitForInitialization();
        const id = uuidv4();
        const now = new Date();

        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO alert_patterns (
                    id, name, description, pv_suffix, hh_limit_suffix, h_limit_suffix,
                    l_limit_suffix, ll_limit_suffix, hh_event_suffix, h_event_suffix,
                    l_event_suffix, ll_event_suffix, created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(query, [
                id,
                request.name,
                request.description || '',
                request.pvSuffix,
                request.hhLimitSuffix,
                request.hLimitSuffix,
                request.lLimitSuffix,
                request.llLimitSuffix,
                request.hhEventSuffix,
                request.hEventSuffix,
                request.lEventSuffix,
                request.llEventSuffix,
                userId,
                now.toISOString(),
                now.toISOString()
            ], (err) => {
                if (err) {
                    logger.error('Error creating alert pattern:', err);
                    return reject(err);
                }
                resolve({
                    id,
                    ...request,
                    createdBy: userId,
                    createdAt: now,
                    updatedAt: now
                });
            });
        });
    }

    async updateAlertPattern(id: string, request: SaveAlertPatternRequest): Promise<AlertPattern | null> {
        await this.waitForInitialization();
        const now = new Date();
        const dbInstance = this.db;

        return new Promise((resolve, reject) => {
            const query = `
                UPDATE alert_patterns 
                SET name = ?, description = ?, pv_suffix = ?, hh_limit_suffix = ?, h_limit_suffix = ?,
                    l_limit_suffix = ?, ll_limit_suffix = ?, hh_event_suffix = ?, h_event_suffix = ?,
                    l_event_suffix = ?, ll_event_suffix = ?, updated_at = ?
                WHERE id = ?
            `;

            dbInstance.run(query, [
                request.name,
                request.description || '',
                request.pvSuffix,
                request.hhLimitSuffix,
                request.hLimitSuffix,
                request.lLimitSuffix,
                request.llLimitSuffix,
                request.hhEventSuffix,
                request.hEventSuffix,
                request.lEventSuffix,
                request.llEventSuffix,
                now.toISOString(),
                id
            ], function (this: { changes: number }, err: any) {
                if (err) {
                    logger.error('Error updating alert pattern:', err);
                    return reject(err);
                }
                if (this.changes === 0) return resolve(null);

                dbInstance.get('SELECT * FROM alert_patterns WHERE id = ?', [id], (err: any, row: any) => {
                    if (err || !row) return resolve(null);
                    resolve({
                        id: row.id,
                        name: row.name,
                        description: row.description,
                        pvSuffix: row.pv_suffix,
                        hhLimitSuffix: row.hh_limit_suffix,
                        hLimitSuffix: row.h_limit_suffix,
                        lLimitSuffix: row.l_limit_suffix,
                        llLimitSuffix: row.ll_limit_suffix,
                        hhEventSuffix: row.hh_event_suffix,
                        hEventSuffix: row.h_event_suffix,
                        lEventSuffix: row.l_event_suffix,
                        llEventSuffix: row.ll_event_suffix,
                        createdBy: row.created_by,
                        createdAt: new Date(row.created_at),
                        updatedAt: new Date(row.updated_at)
                    });
                });
            });
        });
    }

    async getAlertPatterns(): Promise<AlertPattern[]> {
        await this.waitForInitialization();
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM alert_patterns ORDER BY created_at DESC', (err, rows: any[]) => {
                if (err) {
                    logger.error('Error getting alert patterns:', err);
                    return reject(err);
                }
                resolve(rows.map(row => ({
                    id: row.id,
                    name: row.name,
                    description: row.description,
                    pvSuffix: row.pv_suffix,
                    hhLimitSuffix: row.hh_limit_suffix,
                    hLimitSuffix: row.h_limit_suffix,
                    lLimitSuffix: row.l_limit_suffix,
                    llLimitSuffix: row.ll_limit_suffix,
                    hhEventSuffix: row.hh_event_suffix,
                    hEventSuffix: row.h_event_suffix,
                    lEventSuffix: row.l_event_suffix,
                    llEventSuffix: row.ll_event_suffix,
                    createdBy: row.created_by,
                    createdAt: new Date(row.created_at),
                    updatedAt: new Date(row.updated_at)
                })));
            });
        });
    }

    async getAlertPatternById(id: string): Promise<AlertPattern | null> {
        await this.waitForInitialization();
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM alert_patterns WHERE id = ?', [id], (err, row: any) => {
                if (err) {
                    logger.error('Error getting alert pattern by id:', err);
                    return reject(err);
                }
                if (!row) return resolve(null);
                resolve({
                    id: row.id,
                    name: row.name,
                    description: row.description,
                    pvSuffix: row.pv_suffix,
                    hhLimitSuffix: row.hh_limit_suffix,
                    hLimitSuffix: row.h_limit_suffix,
                    lLimitSuffix: row.l_limit_suffix,
                    llLimitSuffix: row.ll_limit_suffix,
                    hhEventSuffix: row.hh_event_suffix,
                    hEventSuffix: row.h_event_suffix,
                    lEventSuffix: row.l_event_suffix,
                    llEventSuffix: row.ll_event_suffix,
                    createdBy: row.created_by,
                    createdAt: new Date(row.created_at),
                    updatedAt: new Date(row.updated_at)
                });
            });
        });
    }

    async deleteAlertPattern(id: string): Promise<boolean> {
        await this.waitForInitialization();
        return new Promise((resolve, reject) => {
            // Check if pattern is in use
            this.db.get('SELECT COUNT(*) as count FROM alert_configs WHERE pattern_id = ?', [id], (err, row: any) => {
                if (err) {
                    logger.error('Error checking pattern usage:', err);
                    return reject(err);
                }

                if (row.count > 0) {
                    return reject(new Error('Cannot delete pattern: It is currently used by one or more alert configurations'));
                }

                this.db.run('DELETE FROM alert_patterns WHERE id = ?', [id], function (err) {
                    if (err) {
                        logger.error('Error deleting alert pattern:', err);
                        return reject(err);
                    }
                    resolve(this.changes > 0);
                });
            });
        });
    }
}

export const alertManagementService = new AlertManagementService();
