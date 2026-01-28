/**
 * Property-Based Tests for Audit Logging
 * Tests that configuration access and sensitive value reveals are logged
 * 
 * **Validates: Requirements 7.1, 7.2, 7.3, 9.5**
 */

import fc from 'fast-check';
import { AuditLogger } from '@/services/auditLogger';

describe('Configuration Audit Logging - Property Tests', () => {
  let auditLogger: AuditLogger;

  beforeEach(() => {
    auditLogger = new AuditLogger();
    auditLogger.clearLogs();
  });

  /**
   * Property 1: Configuration access is logged with user ID and timestamp
   * For any configuration access event, a log entry should be created with userId and timestamp
   * 
   * **Validates: Requirements 7.1**
   */
  it('Property 1: Configuration access is logged with user ID and timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 })
        }),
        async (data) => {
          const timestamp = new Date();
          await auditLogger.logConfigurationAccess(data.userId, timestamp);

          const logs = auditLogger.getAllLogs();
          expect(logs).toHaveLength(1);
          expect(logs[0].userId).toBe(data.userId);
          expect(logs[0].action).toBe('access');
          expect(logs[0].timestamp).toEqual(timestamp);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Sensitive value reveals are logged with configuration name
   * For any sensitive value reveal event, a log entry should be created with configName
   * 
   * **Validates: Requirements 7.2, 7.3**
   */
  it('Property 2: Sensitive value reveals are logged with configuration name', async () => {
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
   * Property 3: Multiple access events are logged separately
   * For any sequence of access events, each should result in a separate log entry
   * 
   * **Validates: Requirements 7.1**
   */
  it('Property 3: Multiple access events are logged separately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          eventCount: fc.integer({ min: 1, max: 10 })
        }),
        async (data) => {
          for (let i = 0; i < data.eventCount; i++) {
            const timestamp = new Date(Date.now() + i * 1000);
            await auditLogger.logConfigurationAccess(data.userId, timestamp);
          }

          const logs = auditLogger.getAllLogs();
          expect(logs).toHaveLength(data.eventCount);
          expect(logs.every(log => log.userId === data.userId)).toBe(true);
          expect(logs.every(log => log.action === 'access')).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 4: Log entries have unique IDs
   * For any logged events, each log entry should have a unique ID
   * 
   * **Validates: Requirements 7.1**
   */
  it('Property 4: Log entries have unique IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          eventCount: fc.integer({ min: 2, max: 10 })
        }),
        async (data) => {
          for (let i = 0; i < data.eventCount; i++) {
            const timestamp = new Date(Date.now() + i * 1000);
            await auditLogger.logConfigurationAccess(data.userId, timestamp);
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
   * Property 5: Timestamps are preserved in log entries
   * For any logged event, the timestamp provided should be preserved in the log entry
   * 
   * **Validates: Requirements 7.1**
   */
  it('Property 5: Timestamps are preserved in log entries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 })
        }),
        async (data) => {
          const timestamp = new Date('2024-01-15T10:30:45.123Z');
          await auditLogger.logConfigurationAccess(data.userId, timestamp);

          const logs = auditLogger.getAllLogs();
          expect(logs[0].timestamp).toEqual(timestamp);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6: Access logs can be retrieved by user ID
   * For any access events logged, they should be retrievable by user ID
   * 
   * **Validates: Requirements 7.1**
   */
  it('Property 6: Access logs can be retrieved by user ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          eventCount: fc.integer({ min: 1, max: 5 })
        }),
        async (data) => {
          for (let i = 0; i < data.eventCount; i++) {
            const timestamp = new Date(Date.now() + i * 1000);
            await auditLogger.logConfigurationAccess(data.userId, timestamp);
          }

          const userLogs = auditLogger.getLogsForUser(data.userId);
          expect(userLogs).toHaveLength(data.eventCount);
          expect(userLogs.every(log => log.userId === data.userId)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 7: Reveal logs can be retrieved by configuration name
   * For any reveal events logged, they should be retrievable by configuration name
   * 
   * **Validates: Requirements 7.2, 7.3**
   */
  it('Property 7: Reveal logs can be retrieved by configuration name', async () => {
    const sensitiveConfigs = ['DB_PASSWORD', 'JWT_SECRET', 'SMTP_PASSWORD'];

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          configName: fc.constantFrom(...sensitiveConfigs),
          eventCount: fc.integer({ min: 1, max: 5 })
        }),
        async (data) => {
          for (let i = 0; i < data.eventCount; i++) {
            const timestamp = new Date(Date.now() + i * 1000);
            await auditLogger.logSensitiveValueReveal(data.userId, data.configName, timestamp);
          }

          const configLogs = auditLogger.getLogsForConfiguration(data.configName);
          expect(configLogs).toHaveLength(data.eventCount);
          expect(configLogs.every(log => log.configName === data.configName)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 8: Access logs can be retrieved by action type
   * For any access events logged, they should be retrievable by action type 'access'
   * 
   * **Validates: Requirements 7.1**
   */
  it('Property 8: Access logs can be retrieved by action type', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          eventCount: fc.integer({ min: 1, max: 5 })
        }),
        async (data) => {
          for (let i = 0; i < data.eventCount; i++) {
            const timestamp = new Date(Date.now() + i * 1000);
            await auditLogger.logConfigurationAccess(data.userId, timestamp);
          }

          const accessLogs = auditLogger.getLogsByAction('access');
          expect(accessLogs.length).toBeGreaterThanOrEqual(data.eventCount);
          expect(accessLogs.every(log => log.action === 'access')).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 9: Reveal logs can be retrieved by action type
   * For any reveal events logged, they should be retrievable by action type 'reveal'
   * 
   * **Validates: Requirements 7.2, 7.3**
   */
  it('Property 9: Reveal logs can be retrieved by action type', async () => {
    const sensitiveConfigs = ['DB_PASSWORD', 'JWT_SECRET'];

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          configName: fc.constantFrom(...sensitiveConfigs),
          eventCount: fc.integer({ min: 1, max: 5 })
        }),
        async (data) => {
          for (let i = 0; i < data.eventCount; i++) {
            const timestamp = new Date(Date.now() + i * 1000);
            await auditLogger.logSensitiveValueReveal(data.userId, data.configName, timestamp);
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
   * Property 10: Logs can be retrieved by time range
   * For any logged events, they should be retrievable by time range
   * 
   * **Validates: Requirements 7.1**
   */
  it('Property 10: Logs can be retrieved by time range', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 })
        }),
        async (data) => {
          const time1 = new Date('2024-01-01T10:00:00Z');
          const time2 = new Date('2024-01-01T12:00:00Z');
          const time3 = new Date('2024-01-01T14:00:00Z');

          await auditLogger.logConfigurationAccess(data.userId, time1);
          await auditLogger.logConfigurationAccess(data.userId, time2);
          await auditLogger.logConfigurationAccess(data.userId, time3);

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
   * Property 11: IP address is preserved when provided
   * For any logged event with IP address, it should be preserved in the log entry
   * 
   * **Validates: Requirements 7.1**
   */
  it('Property 11: IP address is preserved when provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          ipAddress: fc.ipV4()
        }),
        async (data) => {
          const timestamp = new Date();
          await auditLogger.logConfigurationAccess(data.userId, timestamp, data.ipAddress);

          const logs = auditLogger.getAllLogs();
          expect(logs[0].ipAddress).toBe(data.ipAddress);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 12: User agent is preserved when provided
   * For any logged event with user agent, it should be preserved in the log entry
   * 
   * **Validates: Requirements 7.1**
   */
  it('Property 12: User agent is preserved when provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          userAgent: fc.string({ minLength: 1, maxLength: 200 })
        }),
        async (data) => {
          const timestamp = new Date();
          await auditLogger.logConfigurationAccess(data.userId, timestamp, undefined, data.userAgent);

          const logs = auditLogger.getAllLogs();
          expect(logs[0].userAgent).toBe(data.userAgent);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 13: Different users' logs are kept separate
   * For any logs from different users, they should be retrievable separately
   * 
   * **Validates: Requirements 7.1**
   */
  it('Property 13: Different users\' logs are kept separate', async () => {
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
          await auditLogger.logConfigurationAccess(data.userId1, timestamp);
          await auditLogger.logConfigurationAccess(data.userId2, timestamp);

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
   * Property 14: Logs are not lost when clearing
   * For any logs, clearing should remove all logs
   * 
   * **Validates: Requirements 7.1**
   */
  it('Property 14: Logs are cleared when clearLogs is called', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          eventCount: fc.integer({ min: 1, max: 5 })
        }),
        async (data) => {
          for (let i = 0; i < data.eventCount; i++) {
            const timestamp = new Date(Date.now() + i * 1000);
            await auditLogger.logConfigurationAccess(data.userId, timestamp);
          }

          expect(auditLogger.getAllLogs().length).toBeGreaterThan(0);

          auditLogger.clearLogs();

          expect(auditLogger.getAllLogs()).toHaveLength(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 15: Logs are returned as copies
   * For any logs retrieved, they should be copies not references
   * 
   * **Validates: Requirements 7.1**
   */
  it('Property 15: Logs are returned as copies', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 })
        }),
        async (data) => {
          const timestamp = new Date();
          await auditLogger.logConfigurationAccess(data.userId, timestamp);

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
