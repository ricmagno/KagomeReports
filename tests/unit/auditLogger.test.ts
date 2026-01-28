/**
 * Audit Logger Tests
 * Tests for configuration access, sensitive value reveals, and configuration changes
 * Requirements: 7.1, 7.2, 7.3, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { AuditLogger } from '@/services/auditLogger';
import { ConfigurationChange } from '@/types/configuration';

describe('AuditLogger', () => {
  let auditLogger: AuditLogger;

  beforeEach(() => {
    auditLogger = new AuditLogger();
    auditLogger.clearLogs();
  });

  describe('logConfigurationAccess', () => {
    it('should log configuration access with user ID and timestamp', async () => {
      const userId = 'user123';
      const timestamp = new Date('2024-01-01T12:00:00Z');

      await auditLogger.logConfigurationAccess(userId, timestamp);

      const logs = auditLogger.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].userId).toBe(userId);
      expect(logs[0].action).toBe('access');
      expect(logs[0].timestamp).toEqual(timestamp);
    });

    it('should include IP address and user agent when provided', async () => {
      const userId = 'user123';
      const timestamp = new Date();
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';

      await auditLogger.logConfigurationAccess(userId, timestamp, ipAddress, userAgent);

      const logs = auditLogger.getAllLogs();
      expect(logs[0].ipAddress).toBe(ipAddress);
      expect(logs[0].userAgent).toBe(userAgent);
    });

    it('should generate unique log IDs', async () => {
      const userId = 'user123';
      const timestamp = new Date();

      await auditLogger.logConfigurationAccess(userId, timestamp);
      await auditLogger.logConfigurationAccess(userId, timestamp);

      const logs = auditLogger.getAllLogs();
      expect(logs[0].id).not.toBe(logs[1].id);
    });
  });

  describe('logSensitiveValueReveal', () => {
    it('should log sensitive value reveal with configuration name', async () => {
      const userId = 'user123';
      const configName = 'DB_PASSWORD';
      const timestamp = new Date('2024-01-01T12:00:00Z');

      await auditLogger.logSensitiveValueReveal(userId, configName, timestamp);

      const logs = auditLogger.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].userId).toBe(userId);
      expect(logs[0].action).toBe('reveal');
      expect(logs[0].configName).toBe(configName);
      expect(logs[0].timestamp).toEqual(timestamp);
    });

    it('should include IP address and user agent when provided', async () => {
      const userId = 'user123';
      const configName = 'DB_PASSWORD';
      const timestamp = new Date();
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';

      await auditLogger.logSensitiveValueReveal(userId, configName, timestamp, ipAddress, userAgent);

      const logs = auditLogger.getAllLogs();
      expect(logs[0].ipAddress).toBe(ipAddress);
      expect(logs[0].userAgent).toBe(userAgent);
    });
  });

  describe('logConfigurationChange', () => {
    it('should log configuration change with old and new values', async () => {
      const userId = 'user123';
      const changes: ConfigurationChange[] = [
        { name: 'DB_HOST', oldValue: 'localhost', newValue: '192.168.1.100' }
      ];
      const timestamp = new Date('2024-01-01T12:00:00Z');

      await auditLogger.logConfigurationChange(userId, changes, timestamp);

      const logs = auditLogger.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].userId).toBe(userId);
      expect(logs[0].action).toBe('change');
      expect(logs[0].configName).toBe('DB_HOST');
      expect(logs[0].oldValue).toBe('localhost');
      expect(logs[0].newValue).toBe('192.168.1.100');
      expect(logs[0].timestamp).toEqual(timestamp);
    });

    it('should mask sensitive values in logs', async () => {
      const userId = 'user123';
      const changes: ConfigurationChange[] = [
        { name: 'DB_PASSWORD', oldValue: 'oldpass123', newValue: 'newpass456' }
      ];
      const timestamp = new Date();

      await auditLogger.logConfigurationChange(userId, changes, timestamp);

      const logs = auditLogger.getAllLogs();
      expect(logs[0].oldValue).toBe('••••••••');
      expect(logs[0].newValue).toBe('••••••••');
    });

    it('should not mask non-sensitive values in logs', async () => {
      const userId = 'user123';
      const changes: ConfigurationChange[] = [
        { name: 'DB_HOST', oldValue: 'localhost', newValue: '192.168.1.100' }
      ];
      const timestamp = new Date();

      await auditLogger.logConfigurationChange(userId, changes, timestamp);

      const logs = auditLogger.getAllLogs();
      expect(logs[0].oldValue).toBe('localhost');
      expect(logs[0].newValue).toBe('192.168.1.100');
    });

    it('should log multiple configuration changes', async () => {
      const userId = 'user123';
      const changes: ConfigurationChange[] = [
        { name: 'DB_HOST', oldValue: 'localhost', newValue: '192.168.1.100' },
        { name: 'DB_PORT', oldValue: '1433', newValue: '1434' },
        { name: 'DB_PASSWORD', oldValue: 'oldpass', newValue: 'newpass' }
      ];
      const timestamp = new Date();

      await auditLogger.logConfigurationChange(userId, changes, timestamp);

      const logs = auditLogger.getAllLogs();
      expect(logs).toHaveLength(3);
      expect(logs[0].configName).toBe('DB_HOST');
      expect(logs[1].configName).toBe('DB_PORT');
      expect(logs[2].configName).toBe('DB_PASSWORD');
    });

    it('should include IP address and user agent when provided', async () => {
      const userId = 'user123';
      const changes: ConfigurationChange[] = [
        { name: 'DB_HOST', oldValue: 'localhost', newValue: '192.168.1.100' }
      ];
      const timestamp = new Date();
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';

      await auditLogger.logConfigurationChange(userId, changes, timestamp, ipAddress, userAgent);

      const logs = auditLogger.getAllLogs();
      expect(logs[0].ipAddress).toBe(ipAddress);
      expect(logs[0].userAgent).toBe(userAgent);
    });

    it('should handle empty changes array gracefully', async () => {
      const userId = 'user123';
      const changes: ConfigurationChange[] = [];
      const timestamp = new Date();

      await auditLogger.logConfigurationChange(userId, changes, timestamp);

      const logs = auditLogger.getAllLogs();
      expect(logs).toHaveLength(0);
    });
  });

  describe('getLogsForUser', () => {
    it('should retrieve logs for a specific user', async () => {
      const userId1 = 'user123';
      const userId2 = 'user456';
      const timestamp = new Date();

      await auditLogger.logConfigurationAccess(userId1, timestamp);
      await auditLogger.logConfigurationAccess(userId2, timestamp);
      await auditLogger.logConfigurationAccess(userId1, timestamp);

      const logs = auditLogger.getLogsForUser(userId1);
      expect(logs).toHaveLength(2);
      expect(logs.every(log => log.userId === userId1)).toBe(true);
    });

    it('should return empty array for user with no logs', async () => {
      const logs = auditLogger.getLogsForUser('nonexistent');
      expect(logs).toHaveLength(0);
    });
  });

  describe('getLogsByAction', () => {
    it('should retrieve logs by action type', async () => {
      const userId = 'user123';
      const timestamp = new Date();

      await auditLogger.logConfigurationAccess(userId, timestamp);
      await auditLogger.logSensitiveValueReveal(userId, 'DB_PASSWORD', timestamp);
      await auditLogger.logConfigurationChange(userId, [{ name: 'DB_HOST', oldValue: 'a', newValue: 'b' }], timestamp);

      const accessLogs = auditLogger.getLogsByAction('access');
      const revealLogs = auditLogger.getLogsByAction('reveal');
      const changeLogs = auditLogger.getLogsByAction('change');

      expect(accessLogs).toHaveLength(1);
      expect(revealLogs).toHaveLength(1);
      expect(changeLogs).toHaveLength(1);
    });
  });

  describe('getLogsForConfiguration', () => {
    it('should retrieve logs for a specific configuration', async () => {
      const userId = 'user123';
      const timestamp = new Date();

      await auditLogger.logSensitiveValueReveal(userId, 'DB_PASSWORD', timestamp);
      await auditLogger.logConfigurationChange(userId, [{ name: 'DB_PASSWORD', oldValue: 'a', newValue: 'b' }], timestamp);
      await auditLogger.logConfigurationChange(userId, [{ name: 'DB_HOST', oldValue: 'a', newValue: 'b' }], timestamp);

      const logs = auditLogger.getLogsForConfiguration('DB_PASSWORD');
      expect(logs).toHaveLength(2);
      expect(logs.every(log => log.configName === 'DB_PASSWORD')).toBe(true);
    });

    it('should return empty array for configuration with no logs', async () => {
      const logs = auditLogger.getLogsForConfiguration('NONEXISTENT_CONFIG');
      expect(logs).toHaveLength(0);
    });
  });

  describe('getLogsByTimeRange', () => {
    it('should retrieve logs within a time range', async () => {
      const userId = 'user123';
      const time1 = new Date('2024-01-01T10:00:00Z');
      const time2 = new Date('2024-01-01T12:00:00Z');
      const time3 = new Date('2024-01-01T14:00:00Z');

      await auditLogger.logConfigurationAccess(userId, time1);
      await auditLogger.logConfigurationAccess(userId, time2);
      await auditLogger.logConfigurationAccess(userId, time3);

      const logs = auditLogger.getLogsByTimeRange(
        new Date('2024-01-01T09:00:00Z'),
        new Date('2024-01-01T13:00:00Z')
      );

      expect(logs).toHaveLength(2);
    });

    it('should include logs at exact boundary times', async () => {
      const userId = 'user123';
      const startTime = new Date('2024-01-01T10:00:00Z');
      const endTime = new Date('2024-01-01T14:00:00Z');

      await auditLogger.logConfigurationAccess(userId, startTime);
      await auditLogger.logConfigurationAccess(userId, endTime);

      const logs = auditLogger.getLogsByTimeRange(startTime, endTime);
      expect(logs).toHaveLength(2);
    });
  });

  describe('clearLogs', () => {
    it('should clear all logs', async () => {
      const userId = 'user123';
      const timestamp = new Date();

      await auditLogger.logConfigurationAccess(userId, timestamp);
      await auditLogger.logConfigurationAccess(userId, timestamp);

      expect(auditLogger.getAllLogs()).toHaveLength(2);

      auditLogger.clearLogs();

      expect(auditLogger.getAllLogs()).toHaveLength(0);
    });
  });

  describe('getAllLogs', () => {
    it('should return all logs', async () => {
      const userId = 'user123';
      const timestamp = new Date();

      await auditLogger.logConfigurationAccess(userId, timestamp);
      await auditLogger.logSensitiveValueReveal(userId, 'DB_PASSWORD', timestamp);
      await auditLogger.logConfigurationChange(userId, [{ name: 'DB_HOST', oldValue: 'a', newValue: 'b' }], timestamp);

      const logs = auditLogger.getAllLogs();
      expect(logs).toHaveLength(3);
    });

    it('should return a copy of logs array', async () => {
      const userId = 'user123';
      const timestamp = new Date();

      await auditLogger.logConfigurationAccess(userId, timestamp);

      const logs1 = auditLogger.getAllLogs();
      const logs2 = auditLogger.getAllLogs();

      expect(logs1).not.toBe(logs2);
      expect(logs1).toEqual(logs2);
    });
  });

  describe('Sensitive value masking edge cases', () => {
    it('should mask JWT_SECRET configuration changes', async () => {
      const userId = 'user123';
      const changes: ConfigurationChange[] = [
        { name: 'JWT_SECRET', oldValue: 'old-secret-key-32-chars-minimum', newValue: 'new-secret-key-32-chars-minimum' }
      ];
      const timestamp = new Date();

      await auditLogger.logConfigurationChange(userId, changes, timestamp);

      const logs = auditLogger.getAllLogs();
      expect(logs[0].oldValue).toBe('••••••••');
      expect(logs[0].newValue).toBe('••••••••');
    });

    it('should mask SMTP_PASSWORD configuration changes', async () => {
      const userId = 'user123';
      const changes: ConfigurationChange[] = [
        { name: 'SMTP_PASSWORD', oldValue: 'oldpass', newValue: 'newpass' }
      ];
      const timestamp = new Date();

      await auditLogger.logConfigurationChange(userId, changes, timestamp);

      const logs = auditLogger.getAllLogs();
      expect(logs[0].oldValue).toBe('••••••••');
      expect(logs[0].newValue).toBe('••••••••');
    });

    it('should mask REDIS_PASSWORD configuration changes', async () => {
      const userId = 'user123';
      const changes: ConfigurationChange[] = [
        { name: 'REDIS_PASSWORD', oldValue: 'oldpass', newValue: 'newpass' }
      ];
      const timestamp = new Date();

      await auditLogger.logConfigurationChange(userId, changes, timestamp);

      const logs = auditLogger.getAllLogs();
      expect(logs[0].oldValue).toBe('••••••••');
      expect(logs[0].newValue).toBe('••••••••');
    });

    it('should not mask DB_HOST configuration changes', async () => {
      const userId = 'user123';
      const changes: ConfigurationChange[] = [
        { name: 'DB_HOST', oldValue: 'localhost', newValue: '192.168.1.100' }
      ];
      const timestamp = new Date();

      await auditLogger.logConfigurationChange(userId, changes, timestamp);

      const logs = auditLogger.getAllLogs();
      expect(logs[0].oldValue).toBe('localhost');
      expect(logs[0].newValue).toBe('192.168.1.100');
    });

    it('should not mask DB_PORT configuration changes', async () => {
      const userId = 'user123';
      const changes: ConfigurationChange[] = [
        { name: 'DB_PORT', oldValue: '1433', newValue: '1434' }
      ];
      const timestamp = new Date();

      await auditLogger.logConfigurationChange(userId, changes, timestamp);

      const logs = auditLogger.getAllLogs();
      expect(logs[0].oldValue).toBe('1433');
      expect(logs[0].newValue).toBe('1434');
    });
  });

  describe('Error handling', () => {
    it('should not throw when logging fails', async () => {
      const userId = 'user123';
      const timestamp = new Date();

      // This should not throw even if something goes wrong
      await expect(auditLogger.logConfigurationAccess(userId, timestamp)).resolves.not.toThrow();
    });

    it('should handle null or undefined values gracefully', async () => {
      const userId = 'user123';
      const changes: ConfigurationChange[] = [
        { name: 'DB_HOST', oldValue: '', newValue: '' }
      ];
      const timestamp = new Date();

      await expect(auditLogger.logConfigurationChange(userId, changes, timestamp)).resolves.not.toThrow();

      const logs = auditLogger.getAllLogs();
      expect(logs).toHaveLength(1);
    });
  });
});
