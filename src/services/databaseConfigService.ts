/**
 * Database Configuration Management Service
 * Handles CRUD operations for database configurations with encryption
 * Requirements: 9.1, 9.3, 9.7
 */

import { v4 as uuidv4 } from 'uuid';
import { ConnectionPool } from 'mssql';
import {
  DatabaseConfiguration,
  DatabaseConfig,
  ConnectionTestResult,
  DatabaseConfigSummary,
  ValidationResult,
  ValidationError,
  EncryptedConfig
} from '@/types/databaseConfig';
import { encryptionService } from '@/services/encryptionService';
import { apiLogger } from '@/utils/logger';
import { env } from '@/config/environment';
import { createError } from '@/middleware/errorHandler';
import { RetryHandler } from '@/utils/retryHandler';

export class DatabaseConfigService {
  private configurations: Map<string, DatabaseConfiguration> = new Map();
  private activeConfigId: string | null = null;
  private activePool: ConnectionPool | null = null;
  private configChangeListeners: Array<(configId: string) => Promise<void>> = [];

  constructor() {
    this.loadConfigurations();
  }

  /**
   * Register a listener for configuration changes
   */
  onConfigurationChange(listener: (configId: string) => Promise<void>): void {
    this.configChangeListeners.push(listener);
  }

  /**
   * Notify all listeners of configuration change
   */
  private async notifyConfigurationChange(configId: string): Promise<void> {
    for (const listener of this.configChangeListeners) {
      try {
        await listener(configId);
      } catch (error) {
        apiLogger.error('Configuration change listener failed', { error, configId });
      }
    }
  }

  /**
   * Save database configuration with encrypted credentials
   */
  async saveConfiguration(config: DatabaseConfig, userId: string): Promise<string> {
    try {
      // Validate configuration
      const validation = this.validateConfiguration(config);
      if (!validation.isValid) {
        throw createError(`Configuration validation failed: ${validation.errors.map(e => e.message).join(', ')}`, 400);
      }

      // Generate ID if not provided
      const configId = config.id || uuidv4();
      const isUpdate = !!config.id && this.configurations.has(configId);

      // Encrypt password
      const encryptedPassword = encryptionService.encrypt(config.password);

      // Create configuration object
      const dbConfig: DatabaseConfiguration = {
        id: configId,
        name: config.name,
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.username,
        encryptedPassword: JSON.stringify(encryptedPassword),
        encrypt: config.encrypt,
        trustServerCertificate: config.trustServerCertificate,
        connectionTimeout: config.connectionTimeout,
        requestTimeout: config.requestTimeout,
        isActive: false,
        createdBy: userId,
        createdAt: new Date(),
        status: 'untested'
      };

      // Store configuration
      this.configurations.set(configId, dbConfig);

      // Persist to storage (in a real implementation, this would be a database)
      await this.persistConfigurations();

      apiLogger.info('Database configuration saved', {
        configId,
        name: config.name,
        host: config.host,
        database: config.database,
        createdBy: userId,
        isUpdate
      });

      // Enhanced audit logging for configuration changes
      const { authService } = await import('./authService');
      const auditAction = isUpdate ? 'database_config_updated' : 'database_config_created';
      const auditDetails = `${isUpdate ? 'Updated' : 'Created'} database configuration: ${config.name} (${config.host}:${config.port}/${config.database})`;

      try {
        await authService.logAuditEvent(
          userId,
          auditAction,
          'database_configuration',
          auditDetails,
          undefined,
          undefined
        );
      } catch (auditError) {
        apiLogger.error('Failed to log audit event for database configuration change', {
          error: auditError,
          configId,
          userId,
          action: auditAction
        });
      }

      return configId;
    } catch (error) {
      apiLogger.error('Failed to save database configuration', { error, config: encryptionService.sanitizeForLogging(config) });
      throw error;
    }
  }

  /**
   * Load database configuration with decrypted credentials
   */
  async loadConfiguration(configId: string): Promise<DatabaseConfig> {
    try {
      const dbConfig = this.configurations.get(configId);
      if (!dbConfig) {
        throw createError('Configuration not found', 404);
      }

      // Decrypt password
      const encryptedData = JSON.parse(dbConfig.encryptedPassword);
      const decryptedPassword = encryptionService.decrypt(encryptedData);

      const config: DatabaseConfig = {
        id: dbConfig.id,
        name: dbConfig.name,
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        username: dbConfig.username,
        password: decryptedPassword,
        encrypt: dbConfig.encrypt,
        trustServerCertificate: dbConfig.trustServerCertificate,
        connectionTimeout: dbConfig.connectionTimeout,
        requestTimeout: dbConfig.requestTimeout
      };

      apiLogger.info('Database configuration loaded', {
        configId,
        name: dbConfig.name,
        host: dbConfig.host,
        database: dbConfig.database
      });

      return config;
    } catch (error) {
      apiLogger.error('Failed to load database configuration', { error, configId });
      throw error;
    }
  }

  /**
   * Test database connection with detailed error reporting
   */
  async testConnection(config: DatabaseConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();

    try {
      // Validate configuration first
      const validation = this.validateConfiguration(config);
      if (!validation.isValid) {
        return {
          success: false,
          message: `Configuration validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
          error: 'VALIDATION_ERROR',
          testedAt: new Date()
        };
      }

      // Create connection pool for testing
      const testPool = new ConnectionPool({
        server: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        options: {
          // For IP addresses with encryption, we need special handling
          encrypt: config.encrypt && !this.isIPAddress(config.host),
          trustServerCertificate: config.trustServerCertificate || this.isIPAddress(config.host),
          enableArithAbort: true,
          // Only set cryptoCredentialsDetails for hostnames
          ...(config.encrypt && !this.isIPAddress(config.host) && {
            cryptoCredentialsDetails: {
              minVersion: 'TLSv1.2'
            }
          })
        },
        connectionTimeout: Math.min(config.connectionTimeout, 15000), // Max 15 seconds for testing
        requestTimeout: Math.min(config.requestTimeout, 15000),
        pool: {
          min: 1,
          max: 1,
          idleTimeoutMillis: 5000
        }
      });

      // Test connection with retry logic and detailed diagnostics
      const result = await RetryHandler.executeWithRetry(
        async () => {
          apiLogger.info('Testing database connection', {
            host: config.host,
            port: config.port,
            database: config.database,
            username: config.username,
            encrypt: config.encrypt
          });

          await testPool.connect();

          // Test with multiple diagnostic queries
          const request = testPool.request();

          // Get server version and basic info
          const versionResult = await request.query(`
            SELECT 
              @@VERSION as ServerVersion,
              @@SERVERNAME as ServerName,
              DB_NAME() as DatabaseName,
              SYSTEM_USER as SystemUser,
              GETDATE() as CurrentTime,
              @@LANGUAGE as Language,
              @@SPID as ProcessId
          `);

          // Test AVEVA Historian specific tables if they exist
          let historianTablesExist = false;
          try {
            const historianTest = testPool.request();
            const tableCheck = await historianTest.query(`
              SELECT COUNT(*) as TableCount
              FROM INFORMATION_SCHEMA.TABLES 
              WHERE TABLE_NAME IN ('History', 'Tag', 'TagStat')
            `);
            historianTablesExist = tableCheck.recordset[0]?.TableCount > 0;
          } catch (error) {
            // Historian tables don't exist, which is fine for testing
            apiLogger.debug('AVEVA Historian tables not found, continuing with basic connection test');
          }

          await testPool.close();

          const responseTime = Date.now() - startTime;
          const serverInfo = versionResult.recordset[0];
          const serverVersion = this.extractServerVersion(serverInfo?.ServerVersion || 'Unknown');

          const message = historianTablesExist
            ? 'Connection successful - AVEVA Historian database detected'
            : 'Connection successful - Standard SQL Server database';

          apiLogger.info('Database connection test completed successfully', {
            host: config.host,
            database: config.database,
            responseTime,
            serverVersion,
            historianTablesExist
          });

          return {
            success: true,
            message,
            responseTime,
            serverVersion,
            testedAt: new Date()
          };
        },
        RetryHandler.createDatabaseRetryOptions({ maxAttempts: 3 }),
        'database-connection-test'
      );

      // Update configuration status if it exists
      if (config.id) {
        const dbConfig = this.configurations.get(config.id);
        if (dbConfig) {
          dbConfig.status = 'connected';
          dbConfig.lastTested = new Date();
          await this.persistConfigurations();
        }
      }

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update configuration status if it exists
      if (config.id) {
        const dbConfig = this.configurations.get(config.id);
        if (dbConfig) {
          dbConfig.status = 'error';
          dbConfig.lastTested = new Date();
          await this.persistConfigurations();
        }
      }

      apiLogger.error('Database connection test failed', {
        error,
        host: config.host,
        database: config.database,
        responseTime,
        errorType: this.categorizeConnectionError(errorMessage)
      });

      return {
        success: false,
        message: this.getConnectionErrorMessage(errorMessage),
        responseTime,
        error: errorMessage,
        testedAt: new Date()
      };
    }
  }

  /**
   * Delete database configuration
   */
  async deleteConfiguration(configId: string, userId?: string): Promise<void> {
    try {
      const dbConfig = this.configurations.get(configId);
      if (!dbConfig) {
        throw createError('Configuration not found', 404);
      }

      // Cannot delete active configuration
      if (dbConfig.isActive) {
        throw createError('Cannot delete active configuration', 400);
      }

      // Store config details for audit logging before deletion
      const configDetails = {
        name: dbConfig.name,
        host: dbConfig.host,
        database: dbConfig.database
      };

      this.configurations.delete(configId);
      await this.persistConfigurations();

      apiLogger.info('Database configuration deleted', {
        configId,
        name: dbConfig.name,
        host: dbConfig.host,
        database: dbConfig.database,
        deletedBy: userId
      });

      // Enhanced audit logging for configuration deletion
      if (userId) {
        const { authService } = await import('./authService');
        try {
          await authService.logAuditEvent(
            userId,
            'database_config_deleted',
            'database_configuration',
            `Deleted database configuration: ${configDetails.name} (${configDetails.host}/${configDetails.database})`,
            undefined,
            undefined
          );
        } catch (auditError) {
          apiLogger.error('Failed to log audit event for database configuration deletion', {
            error: auditError,
            configId,
            userId
          });
        }
      }
    } catch (error) {
      apiLogger.error('Failed to delete database configuration', { error, configId });
      throw error;
    }
  }

  /**
   * List all database configurations (summary view)
   */
  async listConfigurations(): Promise<DatabaseConfigSummary[]> {
    try {
      const summaries: DatabaseConfigSummary[] = Array.from(this.configurations.values()).map(config => ({
        id: config.id,
        name: config.name,
        host: config.host,
        database: config.database,
        isActive: config.isActive,
        ...(config.lastTested && { lastTested: config.lastTested }),
        status: config.status
      }));

      apiLogger.debug('Listed database configurations', { count: summaries.length });
      return summaries;
    } catch (error) {
      apiLogger.error('Failed to list database configurations', { error });
      throw error;
    }
  }

  /**
   * Get total number of configurations
   */
  getConfigurationsCount(): number {
    return this.configurations.size;
  }


  /**
   * Activate a database configuration
   */
  async activateConfiguration(configId: string, userId?: string): Promise<void> {
    try {
      const dbConfig = this.configurations.get(configId);
      if (!dbConfig) {
        throw createError('Configuration not found', 404);
      }

      // Store previous active config for audit logging
      const previousActiveId = this.activeConfigId;
      const previousActive = previousActiveId ? this.configurations.get(previousActiveId) : null;

      // Deactivate current active configuration
      if (this.activeConfigId) {
        const currentActive = this.configurations.get(this.activeConfigId);
        if (currentActive) {
          currentActive.isActive = false;
        }
      }

      // Close existing connection pool
      if (this.activePool) {
        await this.activePool.close();
        this.activePool = null;
      }

      // Activate new configuration
      dbConfig.isActive = true;
      this.activeConfigId = configId;

      // Test the configuration before activating
      const config = await this.loadConfiguration(configId);
      const testResult = await this.testConnection(config);

      if (!testResult.success) {
        dbConfig.isActive = false;
        this.activeConfigId = null;
        throw createError(`Cannot activate configuration: ${testResult.message}`, 400);
      }

      await this.persistConfigurations();

      // Notify listeners of configuration change
      await this.notifyConfigurationChange(configId);

      apiLogger.info('Database configuration activated', {
        configId,
        name: dbConfig.name,
        host: dbConfig.host,
        database: dbConfig.database,
        activatedBy: userId,
        previousActiveId
      });

      // Enhanced audit logging for configuration activation
      if (userId) {
        const { authService } = await import('./authService');
        try {
          const auditDetails = `Activated database configuration: ${dbConfig.name} (${dbConfig.host}/${dbConfig.database})` +
            (previousActive ? ` - Previous: ${previousActive.name} (${previousActive.host}/${previousActive.database})` : '');

          await authService.logAuditEvent(
            userId,
            'database_config_activated',
            'database_configuration',
            auditDetails,
            undefined,
            undefined
          );
        } catch (auditError) {
          apiLogger.error('Failed to log audit event for database configuration activation', {
            error: auditError,
            configId,
            userId
          });
        }
      }
    } catch (error) {
      apiLogger.error('Failed to activate database configuration', { error, configId });
      throw error;
    }
  }

  /**
   * Get active configuration
   */
  getActiveConfiguration(): DatabaseConfiguration | null {
    if (!this.activeConfigId) {
      return null;
    }
    return this.configurations.get(this.activeConfigId) || null;
  }

  /**
   * Get active connection pool
   */
  async getActiveConnectionPool(): Promise<ConnectionPool> {
    if (!this.activeConfigId) {
      throw createError('No active database configuration', 500);
    }

    if (this.activePool && this.activePool.connected) {
      return this.activePool;
    }

    // If pool exists but not connected, close it just in case
    if (this.activePool) {
      try {
        await this.activePool.close();
      } catch (err) {
        // Ignore close errors
      }
      this.activePool = null;
    }

    const config = await this.loadConfiguration(this.activeConfigId);
    apiLogger.info('Creating new connection pool for active configuration', {
      configId: this.activeConfigId,
      host: config.host,
      database: config.database
    });

    const pool = new ConnectionPool({
      server: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      options: {
        encrypt: config.encrypt && !this.isIPAddress(config.host),
        trustServerCertificate: config.trustServerCertificate || this.isIPAddress(config.host),
        enableArithAbort: true,
        ...(config.encrypt && !this.isIPAddress(config.host) && {
          cryptoCredentialsDetails: {
            minVersion: 'TLSv1.2'
          }
        })
      },
      connectionTimeout: config.connectionTimeout,
      requestTimeout: config.requestTimeout,
      pool: {
        min: env.DB_POOL_MIN,
        max: env.DB_POOL_MAX,
        idleTimeoutMillis: 30000
      }
    });

    try {
      await pool.connect();
      this.activePool = pool;
      return this.activePool;
    } catch (error) {
      apiLogger.error('Failed to connect to active database configuration', {
        error,
        configId: this.activeConfigId
      });
      // Ensure we don't leave a broken pool object
      try {
        await pool.close();
      } catch (e) { }
      throw error;
    }
  }

  /**
   * Validate database configuration
   */
  validateConfiguration(config: DatabaseConfig): ValidationResult {
    const errors: ValidationError[] = [];

    // Required fields
    if (!config.name?.trim()) {
      errors.push({ field: 'name', message: 'Configuration name is required', code: 'REQUIRED' });
    }

    if (!config.host?.trim()) {
      errors.push({ field: 'host', message: 'Host is required', code: 'REQUIRED' });
    }

    if (!config.database?.trim()) {
      errors.push({ field: 'database', message: 'Database name is required', code: 'REQUIRED' });
    }

    if (!config.username?.trim()) {
      errors.push({ field: 'username', message: 'Username is required', code: 'REQUIRED' });
    }

    if (!config.password?.trim()) {
      errors.push({ field: 'password', message: 'Password is required', code: 'REQUIRED' });
    }

    // Port validation
    if (!config.port || config.port < 1 || config.port > 65535) {
      errors.push({ field: 'port', message: 'Port must be between 1 and 65535', code: 'INVALID_RANGE' });
    }

    // Timeout validation
    if (config.connectionTimeout < 1000 || config.connectionTimeout > 300000) {
      errors.push({ field: 'connectionTimeout', message: 'Connection timeout must be between 1000ms and 300000ms', code: 'INVALID_RANGE' });
    }

    if (config.requestTimeout < 1000 || config.requestTimeout > 300000) {
      errors.push({ field: 'requestTimeout', message: 'Request timeout must be between 1000ms and 300000ms', code: 'INVALID_RANGE' });
    }

    // Host format validation (only if host is provided and not empty after trimming)
    if (config.host && config.host.trim() && !this.isValidHostname(config.host.trim())) {
      errors.push({ field: 'host', message: 'Invalid hostname format', code: 'INVALID_FORMAT' });
    }

    // Name uniqueness (excluding current config if updating)
    const existingConfig = Array.from(this.configurations.values()).find(
      c => c.name.toLowerCase() === config.name.toLowerCase() && c.id !== config.id
    );
    if (existingConfig) {
      errors.push({ field: 'name', message: 'Configuration name already exists', code: 'DUPLICATE' });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Encrypt credentials for storage
   */
  async encryptCredentials(config: DatabaseConfig): Promise<EncryptedConfig> {
    const encryptedPassword = encryptionService.encrypt(config.password);

    return {
      id: config.id || uuidv4(),
      name: config.name,
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.username,
      encryptedPassword: JSON.stringify(encryptedPassword),
      encrypt: config.encrypt,
      trustServerCertificate: config.trustServerCertificate,
      connectionTimeout: config.connectionTimeout,
      requestTimeout: config.requestTimeout
    };
  }

  /**
   * Decrypt credentials from storage
   */
  async decryptCredentials(encryptedConfig: EncryptedConfig): Promise<DatabaseConfig> {
    const encryptedData = JSON.parse(encryptedConfig.encryptedPassword);
    const decryptedPassword = encryptionService.decrypt(encryptedData);

    return {
      id: encryptedConfig.id,
      name: encryptedConfig.name,
      host: encryptedConfig.host,
      port: encryptedConfig.port,
      database: encryptedConfig.database,
      username: encryptedConfig.username,
      password: decryptedPassword,
      encrypt: encryptedConfig.encrypt,
      trustServerCertificate: encryptedConfig.trustServerCertificate,
      connectionTimeout: encryptedConfig.connectionTimeout,
      requestTimeout: encryptedConfig.requestTimeout
    };
  }

  /**
   * Load configurations from persistent storage
   */
  private async loadConfigurations(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const configDir = env.DATA_DIR;
      const configFile = path.join(configDir, 'database-configs.json');

      try {
        // Ensure data directory exists
        await fs.mkdir(configDir, { recursive: true });

        // Try to read existing configurations
        const data = await fs.readFile(configFile, 'utf-8');
        const savedConfigs = JSON.parse(data);

        // Load configurations into memory
        this.configurations.clear();
        for (const config of savedConfigs.configurations || []) {
          // Convert date strings back to Date objects
          config.createdAt = new Date(config.createdAt);
          if (config.lastTested) {
            config.lastTested = new Date(config.lastTested);
          }
          this.configurations.set(config.id, config);
        }

        // Restore active configuration ID
        this.activeConfigId = savedConfigs.activeConfigId || null;

        apiLogger.info('Database configurations loaded from storage', {
          count: this.configurations.size,
          activeConfigId: this.activeConfigId
        });

      } catch (error: any) {
        if (error.code === 'ENOENT') {
          // File doesn't exist yet, that's fine
          apiLogger.info('No existing database configurations found, starting fresh');
        } else {
          throw error;
        }
      }
    } catch (error) {
      apiLogger.error('Failed to load database configurations', { error });
    }
  }

  /**
   * Persist configurations to storage
   */
  private async persistConfigurations(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const configDir = env.DATA_DIR;
      const configFile = path.join(configDir, 'database-configs.json');

      // Ensure data directory exists
      await fs.mkdir(configDir, { recursive: true });

      // Convert Map to array for serialization
      const configurations = Array.from(this.configurations.values());

      const dataToSave = {
        configurations,
        activeConfigId: this.activeConfigId,
        lastUpdated: new Date().toISOString()
      };

      await fs.writeFile(configFile, JSON.stringify(dataToSave, null, 2), 'utf-8');

      apiLogger.debug('Database configurations persisted to storage', {
        count: configurations.length,
        activeConfigId: this.activeConfigId
      });
    } catch (error) {
      apiLogger.error('Failed to persist database configurations', { error });
    }
  }

  /**
   * Check if a string is an IP address
   */
  private isIPAddress(host: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(host) || ipv6Regex.test(host);
  }

  /**
   * Validate hostname format
   */
  private isValidHostname(hostname: string): boolean {
    // Trim and check for empty
    const trimmed = hostname.trim();
    if (!trimmed) {
      return false;
    }

    // Check for invalid characters that should never be in a hostname
    if (trimmed.includes(' ') || trimmed.includes('_')) {
      return false;
    }

    // Check for invalid start/end characters
    if (trimmed.startsWith('-') || trimmed.endsWith('-') ||
      trimmed.startsWith('.') || trimmed.endsWith('.')) {
      return false;
    }

    // Check for double dots
    if (trimmed.includes('..')) {
      return false;
    }

    // Special case for localhost
    if (trimmed === 'localhost') {
      return true;
    }

    // Check if it looks like an IP address (4 dot-separated parts, all numeric)
    const parts = trimmed.split('.');
    if (parts.length === 4 && parts.every(part => /^\d+$/.test(part))) {
      // Validate as IP address
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(trimmed)) {
        return false;
      }
      // Additional validation: ensure each octet is <= 255
      const octets = parts.map(Number);
      return octets.every(octet => octet >= 0 && octet <= 255);
    }

    // Validate domain name format
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
    return domainRegex.test(trimmed);
  }

  /**
   * Extract server version from SQL Server version string
   */
  private extractServerVersion(versionString: string): string {
    const match = versionString.match(/Microsoft SQL Server (\d+\.\d+\.\d+)/);
    return match?.[1] || 'Unknown';
  }

  /**
   * Get user-friendly connection error message
   */
  private getConnectionErrorMessage(error: string): string {
    if (error.includes('timeout')) {
      return 'Connection timeout - please check host and port settings';
    }
    if (error.includes('login failed') || error.includes('authentication')) {
      return 'Authentication failed - please check username and password';
    }
    if (error.includes('network') || error.includes('host')) {
      return 'Network error - please check host and port settings';
    }
    if (error.includes('database')) {
      return 'Database not found - please check database name';
    }
    if (error.includes('certificate') || error.includes('SSL') || error.includes('TLS')) {
      return 'SSL/TLS certificate error - check encryption settings';
    }
    if (error.includes('permission') || error.includes('access denied')) {
      return 'Access denied - check user permissions';
    }
    return `Connection failed: ${error}`;
  }

  /**
   * Categorize connection errors for logging and analytics
   */
  private categorizeConnectionError(error: string): string {
    if (error.includes('timeout')) return 'TIMEOUT';
    if (error.includes('login failed') || error.includes('authentication')) return 'AUTH_FAILED';
    if (error.includes('network') || error.includes('host')) return 'NETWORK_ERROR';
    if (error.includes('database')) return 'DATABASE_NOT_FOUND';
    if (error.includes('certificate') || error.includes('SSL') || error.includes('TLS')) return 'SSL_ERROR';
    if (error.includes('permission') || error.includes('access denied')) return 'PERMISSION_DENIED';
    return 'UNKNOWN_ERROR';
  }
}

// Export singleton instance
export const databaseConfigService = new DatabaseConfigService();

/**
 * Setup integration with historian connection service
 * This should be called during application initialization
 */
export function setupDatabaseConfigIntegration(): void {
  // Register historian connection as a listener for configuration changes
  databaseConfigService.onConfigurationChange(async (configId: string) => {
    // Import here to avoid circular dependency
    const { getHistorianConnection } = await import('@/services/historianConnection');
    const connection = getHistorianConnection();

    // Switch to the new configuration
    await connection.switchConfiguration(configId);
  });
}