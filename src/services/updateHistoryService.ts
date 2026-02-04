/**
 * Update History Service
 * Persists and retrieves update history records
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { UpdateRecord } from '@/types/versionManagement';
import { dbLogger } from '@/utils/logger';
import { getDatabasePath } from '@/config/environment';

const historyLogger = dbLogger.child({ service: 'UpdateHistoryService' });

/**
 * UpdateHistoryService manages update history persistence
 */
export class UpdateHistoryService {
  private db: sqlite3.Database | null = null;
  private readonly dbPath = getDatabasePath('update-history.db');
  private readonly MAX_RECORDS = 100;
  private initialized = false;

  /**
   * Initialize the database
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.db = new sqlite3.Database(this.dbPath, (err) => {
          if (err) {
            historyLogger.error('Failed to open database', err);
            reject(err);
            return;
          }

          this.createTables()
            .then(() => {
              this.initialized = true;
              historyLogger.info('Update history database initialized');
              resolve();
            })
            .catch(reject);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Record an update
   */
  async recordUpdate(record: Omit<UpdateRecord, 'id' | 'timestamp'>): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const timestamp = new Date().toISOString();

      const sql = `
        INSERT INTO update_history (
          id, timestamp, fromVersion, toVersion, status, errorMessage, backupPath,
          installDuration, downloadSize, checksumVerified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        id,
        timestamp,
        record.fromVersion,
        record.toVersion,
        record.status,
        record.errorMessage || null,
        record.backupPath || null,
        record.installDuration || null,
        record.downloadSize || null,
        record.checksumVerified ? 1 : 0
      ];

      this.db!.run(sql, params, (err) => {
        if (err) {
          historyLogger.error('Failed to record update', err);
          reject(err);
          return;
        }

        historyLogger.info('Update recorded', {
          id,
          fromVersion: record.fromVersion,
          toVersion: record.toVersion,
          status: record.status
        });

        // Clean up old records if needed
        this.cleanupOldRecords().catch(error => {
          historyLogger.warn('Failed to cleanup old records', error);
        });

        resolve();
      });
    });
  }

  /**
   * Get update history
   */
  async getHistory(limit: number = 50): Promise<UpdateRecord[]> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM update_history
        ORDER BY timestamp DESC
        LIMIT ?
      `;

      this.db!.all(sql, [limit], (err, rows: any[]) => {
        if (err) {
          historyLogger.error('Failed to retrieve history', err);
          reject(err);
          return;
        }

        const records: UpdateRecord[] = (rows || []).map(row => ({
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

        resolve(records);
      });
    });
  }

  /**
   * Get history by version
   */
  async getHistoryByVersion(version: string): Promise<UpdateRecord[]> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM update_history
        WHERE fromVersion = ? OR toVersion = ?
        ORDER BY timestamp DESC
      `;

      this.db!.all(sql, [version, version], (err, rows: any[]) => {
        if (err) {
          historyLogger.error('Failed to retrieve history by version', err);
          reject(err);
          return;
        }

        const records: UpdateRecord[] = (rows || []).map(row => ({
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

        resolve(records);
      });
    });
  }

  /**
   * Clear old records
   */
  async clearOldRecords(keepCount: number = this.MAX_RECORDS): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const sql = `
        DELETE FROM update_history
        WHERE id NOT IN (
          SELECT id FROM update_history
          ORDER BY timestamp DESC
          LIMIT ?
        )
      `;

      this.db!.run(sql, [keepCount], (err) => {
        if (err) {
          historyLogger.error('Failed to clear old records', err);
          reject(err);
          return;
        }

        historyLogger.debug('Old records cleared', { keepCount });
        resolve();
      });
    });
  }

  /**
   * Get total record count
   */
  async getRecordCount(): Promise<number> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const sql = 'SELECT COUNT(*) as count FROM update_history';

      this.db!.get(sql, (err, row: any) => {
        if (err) {
          historyLogger.error('Failed to get record count', err);
          reject(err);
          return;
        }

        resolve(row?.count || 0);
      });
    });
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      this.db.close((err) => {
        if (err) {
          historyLogger.error('Failed to close database', err);
          reject(err);
          return;
        }

        this.db = null;
        this.initialized = false;
        historyLogger.info('Database connection closed');
        resolve();
      });
    });
  }

  /**
   * Private method to ensure database is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Private method to create tables
   */
  private async createTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
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
      `;

      this.db!.exec(sql, (err) => {
        if (err) {
          historyLogger.error('Failed to create tables', err);
          reject(err);
          return;
        }

        historyLogger.debug('Database tables created');
        resolve();
      });
    });
  }

  /**
   * Private method to cleanup old records
   */
  private async cleanupOldRecords(): Promise<void> {
    const count = await this.getRecordCount();
    if (count > this.MAX_RECORDS) {
      await this.clearOldRecords(this.MAX_RECORDS);
    }
  }
}

// Export singleton instance
export const updateHistoryService = new UpdateHistoryService();
