/**
 * Fingerprint Service
 * Handles browser fingerprint generation, storage, and validation
 * Requirements: User Management System Phase 2 - Task 3
 */

import crypto from 'crypto';
import { apiLogger } from '@/utils/logger';
import { encryptionService } from '@/services/encryptionService';
import { authService } from '@/services/authService';

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
  private get db() {
    return authService.db;
  }

  constructor() {
    apiLogger.info('Fingerprint service initialized');
  }

  generateHash(data: FingerprintData): string {
    try {
      const fingerprintString = [
        data.userAgent, data.screenResolution, data.timezone, data.language,
        data.platform, data.hardwareConcurrency.toString(),
        data.deviceMemory?.toString() || '', data.colorDepth.toString(),
        data.pixelRatio.toString(), data.plugins.sort().join(','),
        data.canvas || '', data.webgl || ''
      ].join('|');

      const hash = crypto.createHash('sha256').update(fingerprintString).digest('hex');
      apiLogger.debug('Fingerprint hash generated', { hashPrefix: hash.substring(0, 12), dataPoints: Object.keys(data).length });
      return hash;
    } catch (error) {
      apiLogger.error('Failed to generate fingerprint hash', { error });
      throw error;
    }
  }

  async storeFingerprint(fingerprintHash: string, data: FingerprintData): Promise<void> {
    try {
      const existing = this.getFingerprintInfoSync(fingerprintHash);

      if (existing) {
        this.db.prepare(
          `UPDATE machine_fingerprints SET last_seen = datetime('now'), seen_count = seen_count + 1 WHERE fingerprint_hash = ?`
        ).run(fingerprintHash);
        apiLogger.debug('Fingerprint updated', { hashPrefix: fingerprintHash.substring(0, 12), seenCount: existing.seenCount + 1 });
      } else {
        const encryptedData = encryptionService.encrypt(JSON.stringify(data));
        const id = `fp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.db.prepare(
          `INSERT INTO machine_fingerprints (id, fingerprint_hash, fingerprint_data) VALUES (?, ?, ?)`
        ).run(id, fingerprintHash, JSON.stringify(encryptedData));
        apiLogger.info('Fingerprint stored', { id, hashPrefix: fingerprintHash.substring(0, 12) });
      }
    } catch (error) {
      apiLogger.error('Failed to store fingerprint', { error, hashPrefix: fingerprintHash.substring(0, 12) });
      throw error;
    }
  }

  async validateFingerprint(fingerprintHash: string): Promise<boolean> {
    return !!this.getFingerprintInfoSync(fingerprintHash);
  }

  async getFingerprintInfo(fingerprintHash: string): Promise<FingerprintInfo | null> {
    return this.getFingerprintInfoSync(fingerprintHash);
  }

  private getFingerprintInfoSync(fingerprintHash: string): FingerprintInfo | null {
    const row = this.db.prepare('SELECT * FROM machine_fingerprints WHERE fingerprint_hash = ?').get(fingerprintHash) as any;
    if (!row) return null;
    return {
      id: row.id,
      hash: row.fingerprint_hash,
      firstSeen: new Date(row.first_seen),
      lastSeen: new Date(row.last_seen),
      seenCount: row.seen_count
    };
  }

  async getFingerprintData(fingerprintHash: string): Promise<FingerprintData | null> {
    try {
      const row = this.db.prepare('SELECT fingerprint_data FROM machine_fingerprints WHERE fingerprint_hash = ?').get(fingerprintHash) as any;
      if (!row) return null;
      try {
        const encryptedData = JSON.parse(row.fingerprint_data);
        return JSON.parse(encryptionService.decrypt(encryptedData));
      } catch (decryptError) {
        apiLogger.error('Failed to decrypt fingerprint data', { error: decryptError });
        return null;
      }
    } catch (error) {
      apiLogger.error('Failed to get fingerprint data', { error, hashPrefix: fingerprintHash.substring(0, 12) });
      throw error;
    }
  }

  async cleanupOldFingerprints(daysOld: number = 90): Promise<number> {
    try {
      const result = this.db.prepare(
        `DELETE FROM machine_fingerprints WHERE last_seen < datetime('now', '-' || ? || ' days')`
      ).run(daysOld);
      const deleted = result.changes;
      apiLogger.info('Old fingerprints cleaned up', { deleted, daysOld });
      return deleted;
    } catch (error) {
      apiLogger.error('Failed to cleanup old fingerprints', { error, daysOld });
      throw error;
    }
  }

  async getStatistics(): Promise<{ total: number; seenToday: number; seenThisWeek: number; seenThisMonth: number }> {
    try {
      const stats = this.db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN last_seen >= datetime('now', '-1 day') THEN 1 ELSE 0 END) as seenToday,
          SUM(CASE WHEN last_seen >= datetime('now', '-7 days') THEN 1 ELSE 0 END) as seenThisWeek,
          SUM(CASE WHEN last_seen >= datetime('now', '-30 days') THEN 1 ELSE 0 END) as seenThisMonth
        FROM machine_fingerprints
      `).get() as any;

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

  shutdown(): void {
    this.db.close();
    apiLogger.info('Fingerprint service shutdown');
  }
}

export const fingerprintService = new FingerprintService();
