/**
 * Configuration Update Service
 * Orchestrates configuration updates with validation, persistence, and audit logging
 * Requirements: 4.5, 4.8, 4.9, 5.1, 5.2, 9.1, 9.2, 9.3
 */

import { dbLogger } from '@/utils/logger';
import {
  ConfigurationChange,
  ConfigurationUpdateResponse,
  UpdatedConfiguration,
  ConfigurationValidationError
} from '@/types/configuration';
import { ConfigurationValidationService } from '@/services/configurationValidationService';
import { ConfigurationService } from '@/services/configurationService';
import { EnvFileService } from '@/services/envFileService';
import { AuditLogger } from '@/services/auditLogger';

/**
 * Configuration Update Service
 */
export class ConfigurationUpdateService {
  private envFileService: EnvFileService;
  private auditLogger: AuditLogger;

  constructor(envFilePath: string = '.env') {
    this.envFileService = new EnvFileService(envFilePath);
    this.auditLogger = new AuditLogger();
  }

  /**
   * Update configurations with full validation and atomic behavior
   * Requirements: 4.5, 4.8, 4.9, 5.1, 5.2, 9.1, 9.2, 9.3
   */
  async updateConfigurations(
    changes: ConfigurationChange[],
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ConfigurationUpdateResponse> {
    try {
      dbLogger.info('Configuration update requested', {
        userId,
        changeCount: changes.length
      });

      // Step 1: Validate all changes before making any updates (atomic behavior)
      const validationErrors = this.validateChanges(changes);

      if (validationErrors.length > 0) {
        dbLogger.warn('Configuration validation failed', {
          userId,
          errorCount: validationErrors.length
        });

        return {
          success: false,
          error: 'Validation failed',
          validationErrors
        };
      }

      // Step 2: Prepare updates map
      const updates = new Map<string, string>();
      for (const change of changes) {
        updates.set(change.name, change.newValue);
      }

      // Step 3: Update .env file (with backup)
      const updateResult = this.envFileService.updateConfigurations(updates);

      if (!updateResult.success) {
        dbLogger.error('Failed to update .env file', {
          userId,
          error: updateResult.error
        });

        return {
          success: false,
          error: `Failed to update configuration: ${updateResult.error}`
        };
      }

      // Step 4: Log the configuration changes for audit purposes
      await this.auditLogger.logConfigurationChange(
        userId,
        changes,
        new Date(),
        ipAddress,
        userAgent
      );

      // Step 5: Prepare response with updated configurations
      const updatedConfigurations: UpdatedConfiguration[] = [];

      for (const change of changes) {
        const config = ConfigurationService.getConfiguration(change.name);
        if (config) {
          updatedConfigurations.push({
            name: change.name,
            value: config.value,
            requiresRestart: this.requiresRestart(change.name)
          });
        }
      }

      // Step 6: Cleanup old backups
      this.envFileService.cleanupOldBackups(10);

      dbLogger.info('Configuration update completed successfully', {
        userId,
        updatedCount: changes.length,
        backupPath: updateResult.backupPath
      });

      return {
        success: true,
        message: 'Configuration updated successfully',
        updatedConfigurations,
        ...(updateResult.backupPath && { backupPath: updateResult.backupPath })
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      dbLogger.error('Configuration update failed', error);

      return {
        success: false,
        error: `Configuration update failed: ${errorMessage}`
      };
    }
  }

  /**
   * Validate all configuration changes
   * Requirements: 5.1, 5.2
   */
  private validateChanges(changes: ConfigurationChange[]): ConfigurationValidationError[] {
    const errors: ConfigurationValidationError[] = [];

    for (const change of changes) {
      // Check if configuration exists
      const config = ConfigurationService.getConfiguration(change.name);
      if (!config) {
        errors.push({
          name: change.name,
          error: `Configuration not found: ${change.name}`
        });
        continue;
      }

      // Validate the new value
      const validationResult = ConfigurationValidationService.validateConfigurationValue(
        change.name,
        change.newValue,
        config.dataType
      );

      if (!validationResult.isValid) {
        errors.push({
          name: change.name,
          error: validationResult.error || 'Validation failed'
        });
      }
    }

    return errors;
  }

  /**
   * Check if a configuration change requires application restart
   */
  private requiresRestart(configName: string): boolean {
    // Configurations that require restart
    const requiresRestartConfigs = [
      'NODE_ENV',
      'PORT',
      'JWT_SECRET',
      'BCRYPT_ROUNDS',
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_SECURE',
      'SMTP_USER',
      'SMTP_PASSWORD',
      'REPORTS_DIR',
      'TEMP_DIR',
      'TEMP_DIR',
      'REDIS_HOST',
      'REDIS_PORT',
      'REDIS_PASSWORD',
      'REDIS_DB',
      'LOG_LEVEL',
      'LOG_FILE'
    ];

    return requiresRestartConfigs.includes(configName);
  }

  /**
   * Get the audit logger instance
   */
  getAuditLogger(): AuditLogger {
    return this.auditLogger;
  }

  /**
   * Get the env file service instance
   */
  getEnvFileService(): EnvFileService {
    return this.envFileService;
  }
}
