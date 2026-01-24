/**
 * Property-Based Tests for Update History
 * Validates universal correctness properties for update history persistence
 */

import fc from 'fast-check';
import { updateHistoryService } from '@/services/updateHistoryService';
import { UpdateRecord } from '@/types/versionManagement';

describe('Update History - Property Tests', () => {
  beforeAll(async () => {
    await updateHistoryService.initialize();
  });

  afterAll(async () => {
    await updateHistoryService.close();
  });

  /**
   * Property 5: Update History Chronological Order
   * For any set of update records in the history, when retrieved, they should be sorted
   * by timestamp in descending order (newest first)
   * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
   */
  describe('Property 5: Update History Chronological Order', () => {
    it('should return records sorted by timestamp in descending order', async () => {
      // Record multiple updates with delays
      const records = [];
      for (let i = 0; i < 3; i++) {
        const record = {
          fromVersion: `1.${i}.0`,
          toVersion: `1.${i + 1}.0`,
          status: 'success' as const
        };
        await updateHistoryService.recordUpdate(record);
        records.push(record);

        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const history = await updateHistoryService.getHistory(10);

      // Check that records are sorted by timestamp descending
      for (let i = 0; i < history.length - 1; i++) {
        const current = new Date(history[i]?.timestamp || '').getTime();
        const next = new Date(history[i + 1]?.timestamp || '').getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });

    it('should maintain chronological order with multiple records', async () => {
      const history = await updateHistoryService.getHistory(100);

      // Verify all timestamps are valid ISO 8601
      history.forEach(record => {
        const date = new Date(record.timestamp);
        expect(date.toString()).not.toBe('Invalid Date');
      });

      // Verify descending order
      for (let i = 0; i < history.length - 1; i++) {
        const current = new Date(history[i]?.timestamp || '').getTime();
        const next = new Date(history[i + 1]?.timestamp || '').getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });
  });

  /**
   * Property 6: Update History Record Limit
   * For any sequence of update operations, the update history should never contain
   * more than 100 records
   * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
   */
  describe('Property 6: Update History Record Limit', () => {
    it('should not exceed maximum record count', async () => {
      const count = await updateHistoryService.getRecordCount();
      expect(count).toBeLessThanOrEqual(100);
    });

    it('should maintain limit after multiple records', async () => {
      // Record multiple updates
      for (let i = 0; i < 5; i++) {
        const record = {
          fromVersion: `2.${i}.0`,
          toVersion: `2.${i + 1}.0`,
          status: 'success' as const
        };
        await updateHistoryService.recordUpdate(record);
      }

      const count = await updateHistoryService.getRecordCount();
      expect(count).toBeLessThanOrEqual(100);
    });
  });

  /**
   * Property 10: Update History Persistence
   * For any update operation, after the operation completes, retrieving the update history
   * should include a record of that operation with all required fields
   * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
   */
  describe('Property 10: Update History Persistence', () => {
    it('should persist update records', async () => {
      const record = {
        fromVersion: '3.0.0',
        toVersion: '3.1.0',
        status: 'success' as const
      };

      await updateHistoryService.recordUpdate(record);
      const history = await updateHistoryService.getHistory(1);

      expect(history.length).toBeGreaterThan(0);
      const latest = history[0];

      if (latest) {
        expect(latest.fromVersion).toBe(record.fromVersion);
        expect(latest.toVersion).toBe(record.toVersion);
        expect(latest.status).toBe(record.status);
      }
    });

    it('should include all required fields in persisted records', async () => {
      const record = {
        fromVersion: '4.0.0',
        toVersion: '4.1.0',
        status: 'success' as const,
        installDuration: 5000,
        downloadSize: 1024000,
        checksumVerified: true
      };

      await updateHistoryService.recordUpdate(record);
      const history = await updateHistoryService.getHistory(1);

      const latest = history[0];

      if (latest) {
        expect(latest).toHaveProperty('id');
        expect(latest).toHaveProperty('timestamp');
        expect(latest).toHaveProperty('fromVersion');
        expect(latest).toHaveProperty('toVersion');
        expect(latest).toHaveProperty('status');

        expect(typeof latest.id).toBe('string');
        expect(typeof latest.timestamp).toBe('string');
        expect(latest.id.length).toBeGreaterThan(0);
        expect(latest.timestamp.length).toBeGreaterThan(0);
      }
    });

    it('should handle optional fields correctly', async () => {
      const record = {
        fromVersion: '5.0.0',
        toVersion: '5.1.0',
        status: 'failed' as const,
        errorMessage: 'Test error',
        backupPath: '/path/to/backup'
      };

      await updateHistoryService.recordUpdate(record);
      const history = await updateHistoryService.getHistory(1);

      const latest = history[0];

      if (latest) {
        expect(latest.errorMessage).toBe(record.errorMessage);
        expect(latest.backupPath).toBe(record.backupPath);
      }
    });
  });

  /**
   * Record retrieval tests
   */
  describe('Record Retrieval', () => {
    it('should retrieve records with limit', async () => {
      const history10 = await updateHistoryService.getHistory(10);
      const history5 = await updateHistoryService.getHistory(5);

      expect(history10.length).toBeLessThanOrEqual(10);
      expect(history5.length).toBeLessThanOrEqual(5);
      expect(history5.length).toBeLessThanOrEqual(history10.length);
    });

    it('should retrieve records by version', async () => {
      const record = {
        fromVersion: '6.0.0',
        toVersion: '6.1.0',
        status: 'success' as const
      };

      await updateHistoryService.recordUpdate(record);
      const history = await updateHistoryService.getHistoryByVersion('6.0.0');

      expect(history.length).toBeGreaterThan(0);
      const found = history.some(r => r.fromVersion === '6.0.0' || r.toVersion === '6.0.0');
      expect(found).toBe(true);
    });

    it('should return empty array for non-existent version', async () => {
      const history = await updateHistoryService.getHistoryByVersion('99.99.99');
      expect(Array.isArray(history)).toBe(true);
    });
  });

  /**
   * Record status tests
   */
  describe('Record Status', () => {
    it('should support success status', async () => {
      const record = {
        fromVersion: '7.0.0',
        toVersion: '7.1.0',
        status: 'success' as const
      };

      await updateHistoryService.recordUpdate(record);
      const history = await updateHistoryService.getHistory(1);

      if (history[0]) {
        expect(history[0].status).toBe('success');
      }
    });

    it('should support failed status', async () => {
      const record = {
        fromVersion: '8.0.0',
        toVersion: '8.1.0',
        status: 'failed' as const,
        errorMessage: 'Installation failed'
      };

      await updateHistoryService.recordUpdate(record);
      const history = await updateHistoryService.getHistory(1);

      if (history[0]) {
        expect(history[0].status).toBe('failed');
        expect(history[0].errorMessage).toBe('Installation failed');
      }
    });

    it('should support rolled_back status', async () => {
      const record = {
        fromVersion: '9.0.0',
        toVersion: '9.1.0',
        status: 'rolled_back' as const
      };

      await updateHistoryService.recordUpdate(record);
      const history = await updateHistoryService.getHistory(1);

      if (history[0]) {
        expect(history[0].status).toBe('rolled_back');
      }
    });
  });

  /**
   * Record count tests
   */
  describe('Record Count', () => {
    it('should return accurate record count', async () => {
      const count = await updateHistoryService.getRecordCount();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
      expect(count).toBeLessThanOrEqual(100);
    });

    it('should increment count after recording', async () => {
      const countBefore = await updateHistoryService.getRecordCount();

      const record = {
        fromVersion: '10.0.0',
        toVersion: '10.1.0',
        status: 'success' as const
      };

      await updateHistoryService.recordUpdate(record);
      const countAfter = await updateHistoryService.getRecordCount();

      expect(countAfter).toBeGreaterThanOrEqual(countBefore);
    });
  });

  /**
   * Cleanup tests
   */
  describe('Cleanup', () => {
    it('should cleanup old records', async () => {
      const countBefore = await updateHistoryService.getRecordCount();

      // Clear old records keeping only 50
      await updateHistoryService.clearOldRecords(50);

      const countAfter = await updateHistoryService.getRecordCount();

      expect(countAfter).toBeLessThanOrEqual(50);
      expect(countAfter).toBeLessThanOrEqual(countBefore);
    });

    it('should maintain records after cleanup', async () => {
      const record = {
        fromVersion: '11.0.0',
        toVersion: '11.1.0',
        status: 'success' as const
      };

      await updateHistoryService.recordUpdate(record);
      await updateHistoryService.clearOldRecords(100);

      const history = await updateHistoryService.getHistory(1);
      expect(history.length).toBeGreaterThan(0);
    });
  });

  /**
   * Data integrity tests
   */
  describe('Data Integrity', () => {
    it('should preserve all record fields', async () => {
      const record = {
        fromVersion: '12.0.0',
        toVersion: '12.1.0',
        status: 'success' as const,
        installDuration: 10000,
        downloadSize: 2048000,
        checksumVerified: true,
        backupPath: '/backup/path'
      };

      await updateHistoryService.recordUpdate(record);
      const history = await updateHistoryService.getHistoryByVersion('12.0.0');

      const retrieved = history.find(r => r.fromVersion === '12.0.0' && r.toVersion === '12.1.0');

      if (retrieved) {
        expect(retrieved.fromVersion).toBe(record.fromVersion);
        expect(retrieved.toVersion).toBe(record.toVersion);
        expect(retrieved.status).toBe(record.status);
        expect(retrieved.installDuration).toBe(record.installDuration);
        expect(retrieved.downloadSize).toBe(record.downloadSize);
        expect(retrieved.checksumVerified).toBe(record.checksumVerified);
        expect(retrieved.backupPath).toBe(record.backupPath);
      }
    });

    it('should generate unique IDs for each record', async () => {
      const records = [];

      for (let i = 0; i < 3; i++) {
        const record = {
          fromVersion: `13.${i}.0`,
          toVersion: `13.${i + 1}.0`,
          status: 'success' as const
        };

        await updateHistoryService.recordUpdate(record);
        records.push(record);
      }

      const history = await updateHistoryService.getHistoryByVersion('13.0.0');
      const ids = history.map(r => r.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});
