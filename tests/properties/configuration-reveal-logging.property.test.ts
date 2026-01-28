/**
 * Property-Based Tests for Sensitive Value Reveal Logging
 * Tests that sensitive value reveals are logged with full details
 * 
 * **Validates: Requirements 3.5, 7.2**
 */

import fc from 'fast-check';
import { AuditLogger } from '@/services/auditLogger';

describe('Sensitive Value Reveal Logging - Property Tests', () => {
  let auditLogger: AuditLogger;

  beforeEach(() => {
    auditLogger = new AuditLogger();
    auditLogger.clearLogs();
  });

  /**
   * Property 1: Sensitive value reveals are logged with all required fields
   * For any sensitive value reveal event, a log entry should be created with:
   * - userId
   * - configName
   * - action = 'reveal'
   * - timestamp
   * 
   * **Validates: Requirements 3.5, 7.2**
   */
  it('Property 1: Sensitive value reveals are logged with all required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          configName: fc.oneof(
            fc.constant('DB_PASSWORD'),
            fc.constant('JWT_SECRET'),
            fc.constant('SMTP_PASSWORD'),
            fc.constant('REDIS_PASSWORD')
          )
        }),
        async (data) => {
          const timestamp = new Date();
          await auditLogger.logSensitiveValueReveal(data.userId, data.configName, timestamp);

          const logs = auditLogger.getAllLogs();
          expect(logs).toHaveLength(1);
          expect(logs[0].userId).toBe(data.userId);
          expect(logs[0].configName).toBe(data.configName);
          expect(logs[0].action).toBe('reveal');
          expect(logs[0].timestamp).toEqual(timestamp);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Multiple reveal events are logged separately
   * For any sequence of reveal events, each should result in a separate log entry
   * 
   * **Validates: Requirements 3.5, 7.2**
   */
  it('Property 2: Multiple reveal events are logged separately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          eventCount: fc.integer({ min: 1, max: 10 })
        }),
        async (data) => {
          const configs = ['DB_PASSWORD', 'JWT_SECRET', 'SMTP_PASSWORD'];

          for (let i = 0; i < data.eventCount; i++) {
            const timestamp = new Date(Date.now() + i * 1000);
            const configName = configs[i % configs.length];
            await auditLogger.logSensitiveValueReveal(data.userId, configName, timestamp);
          }

          const logs = auditLogger.getAllLogs();
          expect(logs).toHaveLength(data.eventCount);
          expect(logs.every(log => log.userId === data.userId)).toBe(true);
          expect(logs.every(log => log.action === 'reveal')).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 3: Reveal logs have unique IDs
   * For any reveal events logged, each log entry should have a unique ID
   * 
   * **Validates: Requirements 3.5, 7.2**
   */
  it('Property 3: Reveal logs have unique IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          eventCount: fc.integer({ min: 2, max: 10 })
        }),
        async (data) => {
          for (let i = 0; i < data.eventCount; i++) {
            const timestamp = new Date(Date.now() + i * 1000);
            await auditLogger.logSensitiveValueReveal(data.userId, 'DB_PASSWORD', timestamp);
          }

          const logs = auditLogger.getAllLogs();
          const ids = logs.map(log => log.id);
          const uniqueIds = new Set(ids);

          expect(uniqueIds.size).toBe(ids.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 4: Timestamps are preserved in reveal logs
   * For any reveal event, the timestamp provided should be preserved in the log entry
   * 
   * **Validates: Requirements 3.5, 7.2**
   */
  it('Property 4: Timestamps are preserved in reveal logs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 })
        }),
        async (data) => {
          const timestamp = new Date('2024-01-15T10:30:45.123Z');
          await auditLogger.logSensitiveValueReveal(data.userId, 'DB_PASSWORD', timestamp);

          const logs = auditLogger.getAllLogs();
          expect(logs[0].timestamp).toEqual(timestamp);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Configuration names are preserved in reveal logs
   * For any reveal event, the configuration name should be preserved in the log entry
   * 
   * **Validates: Requirements 3.5, 7.2**
   */
  it('Property 5: Configuration names are preserved in reveal logs', async () => {
    const sensitiveConfigs = ['DB_PASSWORD', 'JWT_SECRET', 'SMTP_PASSWORD', 'REDIS_PASSWORD'];

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          configName: fc.constantFrom(...sensitiveConfigs)
        }),
        async (data) => {
          const timestamp = new Date();
          await auditLogger.logSensitiveValueReveal(data.userId, data.configName, timestamp);

          const logs = auditLogger.getAllLogs();
          expect(logs[0].configName).toBe(data.configName);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6: User IDs are preserved in reveal logs
   * For any reveal event, the user ID should be preserved in the log entry
   * 
   * **Validates: Requirements 3.5, 7.2**
   */
  it('Property 6: User IDs are preserved in reveal logs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 })
        }),
        async (data) => {
          const timestamp = new Date();
          await auditLogger.logSensitiveValueReveal(data.userId, 'DB_PASSWORD', timestamp);

          const logs = auditLogger.getAllLogs();
          expect(logs[0].userId).toBe(data.userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7: Reveal logs can be retrieved by action type
   * For any reveal events logged, they should be retrievable by action type 'reveal'
   * 
   * **Validates: Requirements 3.5, 7.2**
   */
  it('Property 7: Reveal logs can be retrieved by action type', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          eventCount: fc.integer({ min: 1, max: 5 })
        }),
        async (data) => {
          for (let i = 0; i < data.eventCount; i++) {
            const timestamp = new Date(Date.now() + i * 1000);
            await auditLogger.logSensitiveValueReveal(data.userId, 'DB_PASSWORD', timestamp);
          }

          const revealLogs = auditLogger.getLogsByAction('reveal');
          expect(revealLogs.length).toBeGreaterThanOrEqual(data.eventCount);
          expect(revealLogs.every(log => log.action === 'reveal')).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 8: Reveal logs can be retrieved by configuration name
   * For any reveal events logged, they should be retrievable by configuration name
   * 
   * **Validates: Requirements 3.5, 7.2**
   */
  it('Property 8: Reveal logs can be retrieved by configuration name', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          eventCount: fc.integer({ min: 1, max: 5 })
        }),
        async (data) => {
          for (let i = 0; i < data.eventCount; i++) {
            const timestamp = new Date(Date.now() + i * 1000);
            await auditLogger.logSensitiveValueReveal(data.userId, 'DB_PASSWORD', timestamp);
          }

          const configLogs = auditLogger.getLogsForConfiguration('DB_PASSWORD');
          expect(configLogs.length).toBeGreaterThanOrEqual(data.eventCount);
          expect(configLogs.every(log => log.configName === 'DB_PASSWORD')).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 9: Reveal logs can be retrieved by user ID
   * For any reveal events logged, they should be retrievable by user ID
   * 
   * **Validates: Requirements 3.5, 7.2**
   */
  it('Property 9: Reveal logs can be retrieved by user ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          eventCount: fc.integer({ min: 1, max: 5 })
        }),
        async (data) => {
          for (let i = 0; i < data.eventCount; i++) {
            const timestamp = new Date(Date.now() + i * 1000);
            await auditLogger.logSensitiveValueReveal(data.userId, 'DB_PASSWORD', timestamp);
          }

          const userLogs = auditLogger.getLogsForUser(data.userId);
          expect(userLogs.length).toBeGreaterThanOrEqual(data.eventCount);
          expect(userLogs.every(log => log.userId === data.userId)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 10: IP address is preserved when provided
   * For any reveal event with IP address, it should be preserved in the log entry
   * 
   * **Validates: Requirements 3.5, 7.2**
   */
  it('Property 10: IP address is preserved when provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          ipAddress: fc.ipV4()
        }),
        async (data) => {
          const timestamp = new Date();
          await auditLogger.logSensitiveValueReveal(data.userId, 'DB_PASSWORD', timestamp, data.ipAddress);

          const logs = auditLogger.getAllLogs();
          expect(logs[0].ipAddress).toBe(data.ipAddress);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 11: User agent is preserved when provided
   * For any reveal event with user agent, it should be preserved in the log entry
   * 
   * **Validates: Requirements 3.5, 7.2**
   */
  it('Property 11: User agent is preserved when provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          userAgent: fc.string({ minLength: 1, maxLength: 200 })
        }),
        async (data) => {
          const timestamp = new Date();
          await auditLogger.logSensitiveValueReveal(data.userId, 'DB_PASSWORD', timestamp, undefined, data.userAgent);

          const logs = auditLogger.getAllLogs();
          expect(logs[0].userAgent).toBe(data.userAgent);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 12: Different users' reveal logs are kept separate
   * For any reveal logs from different users, they should be retrievable separately
   * 
   * **Validates: Requirements 3.5, 7.2**
   */
  it('Property 12: Different users\' reveal logs are kept separate', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId1: fc.string({ minLength: 1, maxLength: 50 }),
          userId2: fc.string({ minLength: 1, maxLength: 50 })
        }),
        async (data) => {
          // Ensure different user IDs
          fc.pre(data.userId1 !== data.userId2);

          const timestamp = new Date();
          await auditLogger.logSensitiveValueReveal(data.userId1, 'DB_PASSWORD', timestamp);
          await auditLogger.logSensitiveValueReveal(data.userId2, 'JWT_SECRET', timestamp);

          const user1Logs = auditLogger.getLogsForUser(data.userId1);
          const user2Logs = auditLogger.getLogsForUser(data.userId2);

          expect(user1Logs.every(log => log.userId === data.userId1)).toBe(true);
          expect(user2Logs.every(log => log.userId === data.userId2)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 13: Reveal logs can be retrieved by time range
   * For any reveal events logged, they should be retrievable by time range
   * 
   * **Validates: Requirements 3.5, 7.2**
   */
  it('Property 13: Reveal logs can be retrieved by time range', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 })
        }),
        async (data) => {
          const time1 = new Date('2024-01-01T10:00:00Z');
          const time2 = new Date('2024-01-01T12:00:00Z');
          const time3 = new Date('2024-01-01T14:00:00Z');

          await auditLogger.logSensitiveValueReveal(data.userId, 'DB_PASSWORD', time1);
          await auditLogger.logSensitiveValueReveal(data.userId, 'JWT_SECRET', time2);
          await auditLogger.logSensitiveValueReveal(data.userId, 'SMTP_PASSWORD', time3);

          const logs = auditLogger.getLogsByTimeRange(
            new Date('2024-01-01T09:00:00Z'),
            new Date('2024-01-01T13:00:00Z')
          );

          expect(logs.length).toBeGreaterThanOrEqual(2);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 14: Reveal logs do not contain actual sensitive values
   * For any reveal event logged, the log should not contain the actual sensitive value
   * 
   * **Validates: Requirements 3.5, 7.2**
   */
  it('Property 14: Reveal logs do not contain actual sensitive values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 })
        }),
        async (data) => {
          const timestamp = new Date();
          await auditLogger.logSensitiveValueReveal(data.userId, 'DB_PASSWORD', timestamp);

          const logs = auditLogger.getAllLogs();
          // The log should not contain oldValue or newValue for reveal events
          expect(logs[0].oldValue).toBeUndefined();
          expect(logs[0].newValue).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15: Reveal logs are retrievable as copies
   * For any reveal logs retrieved, they should be copies not references
   * 
   * **Validates: Requirements 3.5, 7.2**
   */
  it('Property 15: Reveal logs are retrievable as copies', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 })
        }),
        async (data) => {
          const timestamp = new Date();
          await auditLogger.logSensitiveValueReveal(data.userId, 'DB_PASSWORD', timestamp);

          const logs1 = auditLogger.getAllLogs();
          const logs2 = auditLogger.getAllLogs();

          expect(logs1).not.toBe(logs2);
          expect(logs1).toEqual(logs2);
        }
      ),
      { numRuns: 50 }
    );
  });
});
