/**
 * Update History Service
 * Persists and retrieves update history records
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { UpdateRecord } from '@/types/versionManagement';
import { dbLogger } from '@/utils/logger';
import { getDatabasePath } from '@/config/environment';

const historyLogger = dbLogger.child({ service: 'UpdateHistoryService' });

export class UpdateHistoryService {
  private db: Database.Database | null = null;
  private readonly dbPath = getDatabasePath('update-history.db');
  private readonly MAX_RECORDS = 100;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.db = new Database(this.dbPath);
    this.createTables();
    this.initialized = true;
    historyLogger.info('Update history database initialized');
  }

  async recordUpdate(record: Omit<UpdateRecord, 'id' | 'timestamp'>): Promise<void> {
    await this.ensureInitialized();

    const id = uuidv4();
    const timestamp = new Date().toISOString();

    this.db!.prepare(`
      INSERT INTO update_history (
        id, timestamp, fromVersion, toVersion, status, errorMessage, backupPath,
        installDuration, downloadSize, checksumVerified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, timestamp, record.fromVersion, record.toVersion, record.status,
      record.errorMessage || null, record.backupPath || null,
      record.installDuration || null, record.downloadSize || null,
      record.checksumVerified ? 1 : 0
    );

    historyLogger.info('Update recorded', { id, fromVersion: record.fromVersion, toVersion: record.toVersion, status: record.status });
    this.cleanupOldRecords().catch(error => historyLogger.warn('Failed to cleanup old records', error));
  }

  async getHistory(limit: number = 50): Promise<UpdateRecord[]> {
    await this.ensureInitialized();

    const rows = this.db!.prepare('SELECT * FROM update_history ORDER BY timestamp DESC LIMIT ?').all(limit) as any[];
    return (rows || []).map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      fromVersion: row.fromVersion,
      toVersion: row.toVersion,
      status: row.status,
      errorMessage: row.errorMessage || undefined,
      backupPath: row.backupPath || undefined,
      installDuration: row.installDuration || undefined,
      downloadSize: row.downloadSize || undefined,
      checksumVerified: row.checksumVerified === 1
    }));
  }

  async getHistoryByVersion(version: string): Promise<UpdateRecord[]> {
    await this.ensureInitialized();

    const rows = this.db!.prepare(
      'SELECT * FROM update_history WHERE fromVersion = ? OR toVersion = ? ORDER BY timestamp DESC'
    ).all(version, version) as any[];
    return (rows || []).map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      fromVersion: row.fromVersion,
      toVersion: row.toVersion,
      status: row.status,
      errorMessage: row.errorMessage || undefined,
      backupPath: row.backupPath || undefined,
      installDuration: row.installDuration || undefined,
      downloadSize: row.downloadSize || undefined,
      checksumVerified: row.checksumVerified === 1
    }));
  }

  async clearOldRecords(keepCount: number = this.MAX_RECORDS): Promise<void> {
    await this.ensureInitialized();
    this.db!.prepare(`
      DELETE FROM update_history
      WHERE id NOT IN (SELECT id FROM update_history ORDER BY timestamp DESC LIMIT ?)
    `).run(keepCount);
    historyLogger.debug('Old records cleared', { keepCount });
  }

  async getRecordCount(): Promise<number> {
    await this.ensureInitialized();
    const row = this.db!.prepare('SELECT COUNT(*) as count FROM update_history').get() as any;
    return row?.count || 0;
  }

  async close(): Promise<void> {
    if (!this.db) return;
    this.db.close();
    this.db = null;
    this.initialized = false;
    historyLogger.info('Database connection closed');
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) await this.initialize();
  }

  private createTables(): void {
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS update_history (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        fromVersion TEXT NOT NULL,
        toVersion TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'rolled_back')),
        errorMessage TEXT,
        backupPath TEXT,
        installDuration INTEGER,
        downloadSize INTEGER,
        checksumVerified INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_timestamp ON update_history(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_status ON update_history(status);
      CREATE INDEX IF NOT EXISTS idx_version ON update_history(fromVersion, toVersion);
    `);
    historyLogger.debug('Database tables created');
  }

  private async cleanupOldRecords(): Promise<void> {
    const count = await this.getRecordCount();
    if (count > this.MAX_RECORDS) await this.clearOldRecords(this.MAX_RECORDS);
  }
}

export const updateHistoryService = new UpdateHistoryService();
