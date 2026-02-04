/**
 * Fingerprint Service
 * Handles browser fingerprint generation, storage, and validation
 * Requirements: User Management System Phase 2 - Task 3
 */

import { Database } from 'sqlite3';
import crypto from 'crypto';
import path from 'path';
import { apiLogger } from '@/utils/logger';
import { encryptionService } from '@/services/encryptionService';
import { getDatabasePath } from '@/config/environment';

export interface FingerprintData {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  hardwareConcurrency: number;
  deviceMemory?: number;
  colorDepth: number;
  pixelRatio: number;
  plugins: string[];
  canvas?: string;
  webgl?: string;
}

export interface FingerprintInfo {
  id: string;
  hash: string;
  firstSeen: Date;
  lastSeen: Date;
  seenCount: number;
}

export class FingerprintService {
  private db!: Database;

  constructor() {
    this.initializeDatabase();
  }

  /**
   * Initialize database connection
   */
  private initializeDatabase(): void {
    const dbPath = getDatabasePath('auth.db');
    this.db = new Database(dbPath, (err) => {
      if (err) {
        apiLogger.error('Failed to open fingerprint database', { error: err });
        throw err;
      }
    });
    apiLogger.info('Fingerprint service initialized');
  }

  /**
   * Generate fingerprint hash from browser data
   * Uses SHA-256 to create a unique hash from the fingerprint data
   */
  generateHash(data: FingerprintData): string {
    try {
      // Create a deterministic string from the fingerprint data
      const fingerprintString = [
        data.userAgent,
        data.screenResolution,
        data.timezone,
        data.language,
        data.platform,
        data.hardwareConcurrency.toString(),
        data.deviceMemory?.toString() || '',
        data.colorDepth.toString(),
        data.pixelRatio.toString(),
        data.plugins.sort().join(','),
        data.canvas || '',
        data.webgl || ''
      ].join('|');

      // Generate SHA-256 hash
      const hash = crypto
        .createHash('sha256')
        .update(fingerprintString)
        .digest('hex');

      apiLogger.debug('Fingerprint hash generated', {
        hashPrefix: hash.substring(0, 12),
        dataPoints: Object.keys(data).length
      });

      return hash;
    } catch (error) {
      apiLogger.error('Failed to generate fingerprint hash', { error });
      throw error;
    }
  }

  /**
   * Store fingerprint in database
   * Encrypts the fingerprint data before storage
   */
  async storeFingerprint(fingerprintHash: string, data: FingerprintData): Promise<void> {
    try {
      // Check if fingerprint already exists
      const existing = await this.getFingerprintInfo(fingerprintHash);

      if (existing) {
        // Update existing fingerprint
        await new Promise<void>((resolve, reject) => {
          this.db.run(
            `UPDATE machine_fingerprints 
             SET last_seen = datetime('now'), seen_count = seen_count + 1 
             WHERE fingerprint_hash = ?`,
            [fingerprintHash],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        apiLogger.debug('Fingerprint updated', {
          hashPrefix: fingerprintHash.substring(0, 12),
          seenCount: existing.seenCount + 1
        });
      } else {
        // Encrypt fingerprint data
        const encryptedData = encryptionService.encrypt(JSON.stringify(data));

        // Insert new fingerprint
        const id = `fp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await new Promise<void>((resolve, reject) => {
          this.db.run(
            `INSERT INTO machine_fingerprints (id, fingerprint_hash, fingerprint_data)
             VALUES (?, ?, ?)`,
            [id, fingerprintHash, JSON.stringify(encryptedData)],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        apiLogger.info('Fingerprint stored', {
          id,
          hashPrefix: fingerprintHash.substring(0, 12)
        });
      }
    } catch (error) {
      apiLogger.error('Failed to store fingerprint', { error, hashPrefix: fingerprintHash.substring(0, 12) });
      throw error;
    }
  }

  /**
   * Validate fingerprint exists in database
   */
  async validateFingerprint(fingerprintHash: string): Promise<boolean> {
    try {
      const info = await this.getFingerprintInfo(fingerprintHash);
      return !!info;
    } catch (error) {
      apiLogger.error('Failed to validate fingerprint', { error, hashPrefix: fingerprintHash.substring(0, 12) });
      return false;
    }
  }

  /**
   * Get fingerprint information
   */
  async getFingerprintInfo(fingerprintHash: string): Promise<FingerprintInfo | null> {
    try {
      return new Promise((resolve, reject) => {
        this.db.get(
          'SELECT * FROM machine_fingerprints WHERE fingerprint_hash = ?',
          [fingerprintHash],
          (err, row: any) => {
            if (err) {
              reject(err);
            } else if (row) {
              resolve({
                id: row.id,
                hash: row.fingerprint_hash,
                firstSeen: new Date(row.first_seen),
                lastSeen: new Date(row.last_seen),
                seenCount: row.seen_count
              });
            } else {
              resolve(null);
            }
          }
        );
      });
    } catch (error) {
      apiLogger.error('Failed to get fingerprint info', { error, hashPrefix: fingerprintHash.substring(0, 12) });
      throw error;
    }
  }

  /**
   * Get fingerprint data (decrypted)
   */
  async getFingerprintData(fingerprintHash: string): Promise<FingerprintData | null> {
    try {
      return new Promise((resolve, reject) => {
        this.db.get(
          'SELECT fingerprint_data FROM machine_fingerprints WHERE fingerprint_hash = ?',
          [fingerprintHash],
          (err, row: any) => {
            if (err) {
              reject(err);
            } else if (row) {
              try {
                // Decrypt fingerprint data
                const encryptedData = JSON.parse(row.fingerprint_data);
                const decryptedString = encryptionService.decrypt(encryptedData);
                const data = JSON.parse(decryptedString);
                resolve(data);
              } catch (decryptError) {
                apiLogger.error('Failed to decrypt fingerprint data', { error: decryptError });
                resolve(null);
              }
            } else {
              resolve(null);
            }
          }
        );
      });
    } catch (error) {
      apiLogger.error('Failed to get fingerprint data', { error, hashPrefix: fingerprintHash.substring(0, 12) });
      throw error;
    }
  }

  /**
   * Delete old fingerprints (cleanup)
   * Removes fingerprints not seen in the specified number of days
   */
  async cleanupOldFingerprints(daysOld: number = 90): Promise<number> {
    try {
      return new Promise((resolve, reject) => {
        this.db.run(
          `DELETE FROM machine_fingerprints 
           WHERE last_seen < datetime('now', '-' || ? || ' days')`,
          [daysOld],
          function (err) {
            if (err) {
              reject(err);
            } else {
              apiLogger.info('Old fingerprints cleaned up', {
                deleted: this.changes,
                daysOld
              });
              resolve(this.changes);
            }
          }
        );
      });
    } catch (error) {
      apiLogger.error('Failed to cleanup old fingerprints', { error, daysOld });
      throw error;
    }
  }

  /**
   * Get statistics about stored fingerprints
   */
  async getStatistics(): Promise<{
    total: number;
    seenToday: number;
    seenThisWeek: number;
    seenThisMonth: number;
  }> {
    try {
      const stats = await new Promise<any>((resolve, reject) => {
        this.db.get(
          `SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN last_seen >= datetime('now', '-1 day') THEN 1 ELSE 0 END) as seenToday,
            SUM(CASE WHEN last_seen >= datetime('now', '-7 days') THEN 1 ELSE 0 END) as seenThisWeek,
            SUM(CASE WHEN last_seen >= datetime('now', '-30 days') THEN 1 ELSE 0 END) as seenThisMonth
           FROM machine_fingerprints`,
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      return {
        total: stats.total || 0,
        seenToday: stats.seenToday || 0,
        seenThisWeek: stats.seenThisWeek || 0,
        seenThisMonth: stats.seenThisMonth || 0
      };
    } catch (error) {
      apiLogger.error('Failed to get fingerprint statistics', { error });
      throw error;
    }
  }

  /**
   * Shutdown the service
   */
  shutdown(): void {
    this.db.close();
    apiLogger.info('Fingerprint service shutdown');
  }
}

// Export singleton instance
export const fingerprintService = new FingerprintService();
