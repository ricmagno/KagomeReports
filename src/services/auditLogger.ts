/**
 * Audit Logger Service
 * Handles logging of configuration access, sensitive value reveals, and configuration changes
 * Requirements: 7.1, 7.2, 7.3, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { dbLogger } from '@/utils/logger';
import { ConfigurationAuditLog, ConfigurationChange } from '@/types/configuration';
import { ConfigurationService } from '@/services/configurationService';
import { v4 as uuidv4 } from 'uuid';

/**
 * In-memory audit log storage
 * In production, this should be persisted to a database
 */
const auditLogs: ConfigurationAuditLog[] = [];

/**
 * Audit Logger Service
 */
export class AuditLogger {
  /**
   * Log configuration access event
   * Requirements: 7.1, 7.3, 9.5
   */
  async logConfigurationAccess(
    userId: string,
    timestamp: Date,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      const logEntry: ConfigurationAuditLog = {
        id: uuidv4(),
        userId,
        action: 'access',
        timestamp,
        ipAddress,
        userAgent
      };

      auditLogs.push(logEntry);

      dbLogger.info('Configuration access logged', {
        userId,
        action: 'access',
        timestamp: timestamp.toISOString(),
        ipAddress
      });
    } catch (error) {
      dbLogger.error('Error logging configuration access', error);
      // Don't throw - logging failures should not break the application
    }
  }

  /**
   * Log sensitive value reveal event
   * Requirements: 3.5, 7.2
   */
  async logSensitiveValueReveal(
    userId: string,
    configName: string,
    timestamp: Date,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      const logEntry: ConfigurationAuditLog = {
        id: uuidv4(),
        userId,
        action: 'reveal',
        configName,
        timestamp,
        ipAddress,
        userAgent
      };

      auditLogs.push(logEntry);

      dbLogger.info('Sensitive value reveal logged', {
        userId,
        action: 'reveal',
        configName,
        timestamp: timestamp.toISOString(),
        ipAddress
      });
    } catch (error) {
      dbLogger.error('Error logging sensitive value reveal', error);
      // Don't throw - logging failures should not break the application
    }
  }

  /**
   * Log configuration change event
   * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
   */
  async logConfigurationChange(
    userId: string,
    changes: ConfigurationChange[],
    timestamp: Date,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      for (const change of changes) {
        // Mask sensitive values in logs
        const isSensitive = ConfigurationService.isSensitive(change.name);
        const oldValue = isSensitive ? '••••••••' : change.oldValue;
        const newValue = isSensitive ? '••••••••' : change.newValue;

        const logEntry: ConfigurationAuditLog = {
          id: uuidv4(),
          userId,
          action: 'change',
          configName: change.name,
          oldValue,
          newValue,
          timestamp,
          ipAddress,
          userAgent
        };

        auditLogs.push(logEntry);

        dbLogger.info('Configuration change logged', {
          userId,
          action: 'change',
          configName: change.name,
          oldValue: isSensitive ? '••••••••' : change.oldValue,
          newValue: isSensitive ? '••••••••' : change.newValue,
          timestamp: timestamp.toISOString(),
          ipAddress
        });
      }
    } catch (error) {
      dbLogger.error('Error logging configuration change', error);
      // Don't throw - logging failures should not break the application
    }
  }

  /**
   * Get all audit logs (for testing and monitoring)
   */
  getAllLogs(): ConfigurationAuditLog[] {
    return [...auditLogs];
  }

  /**
   * Get audit logs for a specific user
   */
  getLogsForUser(userId: string): ConfigurationAuditLog[] {
    return auditLogs.filter(log => log.userId === userId);
  }

  /**
   * Get audit logs for a specific action
   */
  getLogsByAction(action: 'access' | 'reveal' | 'change'): ConfigurationAuditLog[] {
    return auditLogs.filter(log => log.action === action);
  }

  /**
   * Get audit logs for a specific configuration
   */
  getLogsForConfiguration(configName: string): ConfigurationAuditLog[] {
    return auditLogs.filter(log => log.configName === configName);
  }

  /**
   * Clear all audit logs (for testing)
   */
  clearLogs(): void {
    auditLogs.length = 0;
  }

  /**
   * Get logs within a time range
   */
  getLogsByTimeRange(startTime: Date, endTime: Date): ConfigurationAuditLog[] {
    return auditLogs.filter(
      log => log.timestamp >= startTime && log.timestamp <= endTime
    );
  }
}
