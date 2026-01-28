/**
 * Property-Based Tests for Configuration Change Logging
 * Tests that configuration changes are logged with full details and sensitive values are masked
 * 
 * **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**
 */

import fc from 'fast-check';
import { AuditLogger } from '@/services/auditLogger';
import { ConfigurationChange } from '@/types/configuration';
import { ConfigurationService } from '@/services/configurationService';

describe('Configuration Change Logging - Property Tests', () => {
  let auditLogger: AuditLogger;

  beforeEach(() => {
    auditLogger = new AuditLogger();
    auditLogger.clearLogs();
  });

  /**
   * Property 1: Configuration changes are logged with all required fields
   * For any configuration change, a log entry should be created with:
   * - userId
   * - configName
   * - oldValue
   * - newValue
   * - timestamp
   * - action = 'change'
   * 
   * **Validates: Requirements 10.1, 10.2**
   */
  it('Property 1: Configuration changes are logged with all required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          configName: fc.oneof(
            fc.constant('DB_HOST'),
            fc.constant('DB_PORT'),
            fc.constant('DB_PASSWORD'),
            fc.constant('JWT_SECRET'),
            fc.constant('SMTP_PASSWORD')
          ),
          oldValue: fc.string({ maxLength: 100 }),
          newValue: fc.string({ maxLength: 100 })
        }),
        async (data) => {
          const changes: ConfigurationChange[] = [
            { name: data.configName, oldValue: data.oldValue, newValue: data.newValue }
          ];
          const timestamp = new Date();

          await auditLogger.logConfigurationChange(data.userId, changes, timestamp);

          const logs = auditLogger.getAllLogs();
          expect(logs).toHaveLength(1);
          expect(logs[0].userId).toBe(data.userId);
          expect(logs[0].configName).toBe(data.configName);
          expect(logs[0].action).toBe('change');
          expect(logs[0].timestamp).toEqual(timestamp);
          expect(logs[0].oldValue).toBeDefined();
          expect(logs[0].newValue).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Sensitive configuration values are masked in logs
   * For any configuration change where the configuration name matches sensitive patterns,
   * the oldValue and newValue in the log should be masked (••••••••)
   * 
   * **Validates: Requirements 10.3, 10.4, 10.5**
   */
  it('Property 2: Sensitive configuration values are masked in logs', async () => {
    const sensitiveConfigs = ['DB_PASSWORD', 'JWT_SECRET', 'SMTP_PASSWORD', 'REDIS_PASSWORD'];

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          configName: fc.constantFrom(...sensitiveConfigs),
          oldValue: fc.string({ minLength: 1, maxLength: 100 }),
          newValue: fc.string({ minLength: 1, maxLength: 100 })
        }),
        async (data) => {
          const changes: ConfigurationChange[] = [
            { name: data.configName, oldValue: data.oldValue, newValue: data.newValue }
          ];
          const timestamp = new Date();

          await auditLogger.logConfigurationChange(data.userId, changes, timestamp);

          const logs = auditLogger.getAllLogs();
          expect(logs).toHaveLength(1);
          expect(logs[0].oldValue).toBe('••••••••');
          expect(logs[0].newValue).toBe('••••••••');
          // Verify that the actual values are NOT in the log
          expect(logs[0].oldValue).not.toBe(data.oldValue);
          expect(logs[0].newValue).not.toBe(data.newValue);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Non-sensitive configuration values are NOT masked in logs
   * For any configuration change where the configuration name does NOT match sensitive patterns,
   * the oldValue and newValue in the log should be the actual values (not masked)
   * 
   * **Validates: Requirements 10.1, 10.2**
   */
  it('Property 3: Non-sensitive configuration values are NOT masked in logs', async () => {
    const nonSensitiveConfigs = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'NODE_ENV', 'PORT'];

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          configName: fc.constantFrom(...nonSensitiveConfigs),
          oldValue: fc.string({ maxLength: 100 }),
          newValue: fc.string({ maxLength: 100 })
        }),
        async (data) => {
          const changes: ConfigurationChange[] = [
            { name: data.configName, oldValue: data.oldValue, newValue: data.newValue }
          ];
          const timestamp = new Date();

          await auditLogger.logConfigurationChange(data.userId, changes, timestamp);

          const logs = auditLogger.getAllLogs();
          expect(logs).toHaveLength(1);
          expect(logs[0].oldValue).toBe(data.oldValue);
          expect(logs[0].newValue).toBe(data.newValue);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Multiple configuration changes are logged separately
   * For any set of configuration changes, each change should result in a separate log entry
   * 
   * **Validates: Requirements 10.1, 10.2**
   */
  it('Property 4: Multiple configuration changes are logged separately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          changeCount: fc.integer({ min: 1, max: 10 })
        }),
        async (data) => {
          const changes: ConfigurationChange[] = [];
          const configs = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'NODE_ENV', 'PORT'];

          for (let i = 0; i < data.changeCount; i++) {
            changes.push({
              name: configs[i % configs.length],
              oldValue: `old${i}`,
              newValue: `new${i}`
            });
          }

          const timestamp = new Date();
          await auditLogger.logConfigurationChange(data.userId, changes, timestamp);

          const logs = auditLogger.getAllLogs();
          expect(logs).toHaveLength(data.changeCount);

          // Verify each log entry has the correct data
          for (let i = 0; i < data.changeCount; i++) {
            expect(logs[i].userId).toBe(data.userId);
            expect(logs[i].configName).toBe(changes[i].name);
            expect(logs[i].action).toBe('change');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 5: Log entries have unique IDs
   * For any configuration changes logged, each log entry should have a unique ID
   * 
   * **Validates: Requirements 10.1**
   */
  it('Property 5: Log entries have unique IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          changeCount: fc.integer({ min: 2, max: 10 })
        }),
        async (data) => {
          const changes: ConfigurationChange[] = [];
          const configs = ['DB_HOST', 'DB_PORT', 'DB_NAME'];

          for (let i = 0; i < data.changeCount; i++) {
            changes.push({
              name: configs[i % configs.length],
              oldValue: `old${i}`,
              newValue: `new${i}`
            });
          }

          const timestamp = new Date();
          await auditLogger.logConfigurationChange(data.userId, changes, timestamp);

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
   * Property 6: Timestamp is preserved in log entries
   * For any configuration change, the timestamp provided should be preserved in the log entry
   * 
   * **Validates: Requirements 10.1, 10.2**
   */
  it('Property 6: Timestamp is preserved in log entries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          configName: fc.constant('DB_HOST'),
          oldValue: fc.string({ maxLength: 100 }),
          newValue: fc.string({ maxLength: 100 })
        }),
        async (data) => {
          const changes: ConfigurationChange[] = [
            { name: data.configName, oldValue: data.oldValue, newValue: data.newValue }
          ];
          const timestamp = new Date('2024-01-15T10:30:45.123Z');

          await auditLogger.logConfigurationChange(data.userId, changes, timestamp);

          const logs = auditLogger.getAllLogs();
          expect(logs[0].timestamp).toEqual(timestamp);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7: Configuration name is preserved in log entries
   * For any configuration change, the configuration name should be preserved in the log entry
   * 
   * **Validates: Requirements 10.2**
   */
  it('Property 7: Configuration name is preserved in log entries', async () => {
    const allConfigs = [
      'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
      'JWT_SECRET', 'SMTP_PASSWORD', 'REDIS_PASSWORD', 'NODE_ENV', 'PORT'
    ];

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          configName: fc.constantFrom(...allConfigs),
          oldValue: fc.string({ maxLength: 100 }),
          newValue: fc.string({ maxLength: 100 })
        }),
        async (data) => {
          const changes: ConfigurationChange[] = [
            { name: data.configName, oldValue: data.oldValue, newValue: data.newValue }
          ];
          const timestamp = new Date();

          await auditLogger.logConfigurationChange(data.userId, changes, timestamp);

          const logs = auditLogger.getAllLogs();
          expect(logs[0].configName).toBe(data.configName);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8: User ID is preserved in log entries
   * For any configuration change, the user ID should be preserved in the log entry
   * 
   * **Validates: Requirements 10.1**
   */
  it('Property 8: User ID is preserved in log entries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          configName: fc.constant('DB_HOST'),
          oldValue: fc.string({ maxLength: 100 }),
          newValue: fc.string({ maxLength: 100 })
        }),
        async (data) => {
          const changes: ConfigurationChange[] = [
            { name: data.configName, oldValue: data.oldValue, newValue: data.newValue }
          ];
          const timestamp = new Date();

          await auditLogger.logConfigurationChange(data.userId, changes, timestamp);

          const logs = auditLogger.getAllLogs();
          expect(logs[0].userId).toBe(data.userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9: Sensitive pattern matching is consistent
   * For any configuration name, the sensitivity determination should be consistent
   * across multiple calls
   * 
   * **Validates: Requirements 10.3, 10.4**
   */
  it('Property 9: Sensitive pattern matching is consistent', async () => {
    const sensitivePatterns = ['PASSWORD', 'SECRET', 'KEY', 'TOKEN', 'CREDENTIAL', 'APIKEY', 'PRIVATE', 'ENCRYPT'];

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          pattern: fc.constantFrom(...sensitivePatterns),
          suffix: fc.string({ maxLength: 20 })
        }),
        async (data) => {
          const configName = `${data.pattern}_${data.suffix}`;
          const changes: ConfigurationChange[] = [
            { name: configName, oldValue: 'oldvalue', newValue: 'newvalue' }
          ];
          const timestamp = new Date();

          await auditLogger.logConfigurationChange(data.userId, changes, timestamp);

          const logs = auditLogger.getAllLogs();
          // Sensitive values should be masked
          expect(logs[0].oldValue).toBe('••••••••');
          expect(logs[0].newValue).toBe('••••••••');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10: Empty changes array is handled gracefully
   * For an empty changes array, no log entries should be created
   * 
   * **Validates: Requirements 10.1**
   */
  it('Property 10: Empty changes array is handled gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 })
        }),
        async (data) => {
          const changes: ConfigurationChange[] = [];
          const timestamp = new Date();

          await auditLogger.logConfigurationChange(data.userId, changes, timestamp);

          const logs = auditLogger.getAllLogs();
          expect(logs).toHaveLength(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 11: Log entries can be retrieved by action type
   * For any configuration changes logged, they should be retrievable by action type 'change'
   * 
   * **Validates: Requirements 10.1**
   */
  it('Property 11: Log entries can be retrieved by action type', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          changeCount: fc.integer({ min: 1, max: 5 })
        }),
        async (data) => {
          const changes: ConfigurationChange[] = [];
          for (let i = 0; i < data.changeCount; i++) {
            changes.push({
              name: 'DB_HOST',
              oldValue: `old${i}`,
              newValue: `new${i}`
            });
          }

          const timestamp = new Date();
          await auditLogger.logConfigurationChange(data.userId, changes, timestamp);

          const changeLogs = auditLogger.getLogsByAction('change');
          expect(changeLogs).toHaveLength(data.changeCount);
          expect(changeLogs.every(log => log.action === 'change')).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 12: Log entries can be retrieved by configuration name
   * For any configuration changes logged, they should be retrievable by configuration name
   * 
   * **Validates: Requirements 10.2**
   */
  it('Property 12: Log entries can be retrieved by configuration name', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          configName: fc.constant('DB_PASSWORD'),
          changeCount: fc.integer({ min: 1, max: 5 })
        }),
        async (data) => {
          const changes: ConfigurationChange[] = [];
          for (let i = 0; i < data.changeCount; i++) {
            changes.push({
              name: data.configName,
              oldValue: `old${i}`,
              newValue: `new${i}`
            });
          }

          const timestamp = new Date();
          await auditLogger.logConfigurationChange(data.userId, changes, timestamp);

          const configLogs = auditLogger.getLogsForConfiguration(data.configName);
          expect(configLogs).toHaveLength(data.changeCount);
          expect(configLogs.every(log => log.configName === data.configName)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 13: Log entries can be retrieved by user ID
   * For any configuration changes logged, they should be retrievable by user ID
   * 
   * **Validates: Requirements 10.1**
   */
  it('Property 13: Log entries can be retrieved by user ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 100 }),
          changeCount: fc.integer({ min: 1, max: 5 })
        }),
        async (data) => {
          const changes: ConfigurationChange[] = [];
          for (let i = 0; i < data.changeCount; i++) {
            changes.push({
              name: 'DB_HOST',
              oldValue: `old${i}`,
              newValue: `new${i}`
            });
          }

          const timestamp = new Date();
          await auditLogger.logConfigurationChange(data.userId, changes, timestamp);

          const userLogs = auditLogger.getLogsForUser(data.userId);
          expect(userLogs).toHaveLength(data.changeCount);
          expect(userLogs.every(log => log.userId === data.userId)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
});
