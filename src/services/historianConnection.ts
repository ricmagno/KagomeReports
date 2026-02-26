/**
 * AVEVA Historian Database Connection Service
 * Handles database connections, authentication, and connection pooling
 * Now integrates with Database Configuration Management
 */

import { ConnectionPool, Request, IResult } from 'mssql';
import { dbLogger } from '@/utils/logger';
import { createError } from '@/middleware/errorHandler';
import { RetryHandler, RetryOptions } from '@/utils/retryHandler';
import { databaseConfigService } from '@/services/databaseConfigService';

export class HistorianConnection {
  private pool: ConnectionPool | null = null;
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;
  private currentConfigId: string | null = null;
  private connectionPromise: Promise<void> | null = null;

  // New state properties for UI feedback
  private nextRetryTime: Date | null = null;
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'retrying' = 'disconnected';
  private lastError: string | null = null;

  constructor() {
    // Don't initialize pool in constructor - will be created when needed
  }

  /**
   * Connect to AVEVA Historian database with retry logic
   * Uses active database configuration if available, falls back to environment config
   */
  async connect(options: Partial<RetryOptions> = {}): Promise<void> {
    // Return existing connection if valid
    if (this.isConnected && this.pool && this.pool.connected) {
      return;
    }

    // If a connection attempt is already in progress, wait for it
    if (this.connectionPromise) {
      dbLogger.info('Waiting for existing connection attempt to complete...');
      return this.connectionPromise;
    }

    this.connectionState = 'connecting';
    this.nextRetryTime = null;
    this.lastError = null;

    // Create the connection promise
    this.connectionPromise = (async () => {
      try {
        await RetryHandler.executeWithRetry(
          async () => {
            // Re-check if connected during retry loop
            if (this.isConnected && this.pool && this.pool.connected) {
              return;
            }

            dbLogger.info('Attempting to connect to AVEVA Historian database...');

            // Try to get active database configuration first
            const activeConfig = databaseConfigService.getActiveConfiguration();

            if (activeConfig) {
              dbLogger.info('Using active database configuration', {
                configId: activeConfig.id,
                configName: activeConfig.name,
                host: activeConfig.host,
                database: activeConfig.database
              });

              // Use the active configuration's connection pool
              this.pool = await databaseConfigService.getActiveConnectionPool();
              this.currentConfigId = activeConfig.id;
            } else {
              const configCount = databaseConfigService.getConfigurationsCount();

              dbLogger.warn('No active database configuration found.', {
                configCount,
                hint: configCount > 0
                  ? 'There are saved configurations but none are active. Please activate one in the UI.'
                  : 'No configurations saved. Please create one in the Historian configuration tab.'
              });

              // Without an active configuration, we can't connect
              throw createError('No active database configuration found. Historian connection required.', 503);
            }

            this.isConnected = true;
            this.connectionAttempts = 0;
            this.connectionState = 'connected';
            this.nextRetryTime = null;
            this.lastError = null;
            dbLogger.info('Successfully connected to AVEVA Historian database');
          },
          RetryHandler.createDatabaseRetryOptions({
            maxAttempts: Number.MAX_SAFE_INTEGER, // Default to unlimited unless overridden
            baseDelay: 5000, // Reduced from 30s for better responsiveness
            maxDelay: 30000,
            backoffFactor: 2, // Use exponential backoff instead of constant
            logCountdown: true,
            onRetry: (attempt, delay) => {
              this.connectionAttempts = attempt;
              this.connectionState = 'retrying';
              this.nextRetryTime = new Date(Date.now() + delay);
              this.lastError = `Connection failed. Retrying in ${Math.round(delay / 1000)}s...`;
            },
            ...options // Allow overrides (e.g. for startup validation)
          }),
          'database-connection'
        );
      } catch (error: any) {
        this.isConnected = false;
        this.pool = null;
        this.currentConfigId = null;
        this.connectionState = 'disconnected';
        this.nextRetryTime = null;
        this.lastError = error.message;
        dbLogger.error('Database connection failed:', error);
        throw error;
      } finally {
        this.connectionPromise = null;
      }
    })();

    return this.connectionPromise;
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    try {
      if (this.isConnected && this.pool) {
        // Only close the pool if we're using environment config
        // Active config pools are managed by databaseConfigService
        if (!this.currentConfigId) {
          await this.pool.close();
        }
        this.isConnected = false;
        this.pool = null;
        this.currentConfigId = null;
        this.connectionState = 'disconnected';
        dbLogger.info('Disconnected from AVEVA Historian database');
      }
    } catch (error) {
      dbLogger.error('Error disconnecting from database:', error);
      throw error;
    }
  }

  /**
   * Switch to a new database configuration
   * This method is called when the active configuration changes
   */
  async switchConfiguration(newConfigId: string): Promise<void> {
    try {
      dbLogger.info('Switching database configuration', {
        oldConfigId: this.currentConfigId,
        newConfigId
      });

      // Disconnect from current configuration
      if (this.isConnected) {
        await this.disconnect();
      }

      // Reset state
      this.isConnected = false;
      this.pool = null;
      this.currentConfigId = null;
      this.connectionAttempts = 0;

      // Reconnect with new configuration
      await this.connect();

      dbLogger.info('Successfully switched database configuration', {
        newConfigId: this.currentConfigId
      });
    } catch (error) {
      dbLogger.error('Failed to switch database configuration', {
        error,
        newConfigId
      });
      throw error;
    }
  }

  /**
   * Get current configuration ID
   */
  getCurrentConfigId(): string | null {
    return this.currentConfigId;
  }

  /**
   * Check if using active configuration (vs environment config)
   */
  isUsingActiveConfig(): boolean {
    return this.currentConfigId !== null;
  }

  /**
   * Close database connection (alias for disconnect)
   */
  async close(): Promise<void> {
    return this.disconnect();
  }

  /**
   * Execute a SQL query with error handling and logging
   */
  async executeQuery<T = any>(query: string, params?: Record<string, any>): Promise<IResult<T>> {
    return RetryHandler.executeWithRetry(
      async () => {
        // Robust check for connection state
        if (!this.isConnected || !this.pool || !this.pool.connected) {
          dbLogger.info('Database connection lost or not initialized, reconnecting...', {
            isConnected: this.isConnected,
            hasPool: !!this.pool,
            poolConnected: this.pool?.connected
          });

          this.isConnected = false;
          await this.connect();
        }

        if (!this.pool || !this.pool.connected) {
          throw createError('Database connection not available after reconnection attempt', 503);
        }

        dbLogger.debug('Executing query:', { query: this.sanitizeQueryForLogging(query), params });

        const request = this.pool.request();
        // Add parameters if provided
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            request.input(key, value);
          });
        }

        const startTime = Date.now();
        const result = await request.query<T>(query);
        const duration = Date.now() - startTime;

        // Log performance metrics
        this.logQueryPerformance(query, duration, result.recordset.length);

        dbLogger.info('Query executed successfully', {
          duration: `${duration}ms`,
          recordCount: result.recordset.length,
          performanceCategory: this.categorizeQueryPerformance(duration)
        });

        return result;
      },
      RetryHandler.createDatabaseRetryOptions({ maxAttempts: 3 }),
      'database-query'
    ).catch(error => {
      dbLogger.error('Query execution failed:', { query: this.sanitizeQueryForLogging(query), error });

      // Handle specific database errors
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw createError('Database query timeout', 408);
        }
        if (error.message.includes('connection')) {
          this.isConnected = false;
          throw createError('Database connection lost', 503);
        }
      }

      throw createError('Database query failed', 500);
    });
  }

  /**
   * Validate database connection
   */
  async validateConnection(): Promise<boolean> {
    try {
      await this.executeQuery('SELECT 1 as test');
      return true;
    } catch (error) {
      dbLogger.error('Connection validation failed:', error);
      return false;
    }
  }

  /**
   * Get database connection status including retry details
   */
  getConnectionStatus(): {
    connected: boolean;
    attempts: number;
    state: string;
    nextRetry: Date | null;
    lastError: string | null;
  } {
    return {
      connected: this.isConnected,
      attempts: this.connectionAttempts,
      state: this.connectionState,
      nextRetry: this.nextRetryTime,
      lastError: this.lastError
    };
  }

  /**
   * Reset connection attempts counter
   */
  resetConnectionAttempts(): void {
    this.connectionAttempts = 0;
  }

  /**
   * Sanitize query for logging (remove sensitive data)
   */
  private sanitizeQueryForLogging(query: string): string {
    // Remove potential sensitive data from query for logging
    return query.replace(/(@\w+\s*=\s*)'[^']*'/g, "$1'***'");
  }

  /**
   * Log query performance metrics
   */
  private logQueryPerformance(query: string, duration: number, recordCount: number): void {
    const queryType = this.getQueryType(query);
    const performanceMetrics = {
      queryType,
      duration,
      recordCount,
      recordsPerSecond: recordCount > 0 ? Math.round(recordCount / (duration / 1000)) : 0,
      timestamp: new Date().toISOString()
    };

    // Log slow queries for optimization
    if (duration > 5000) { // Queries taking more than 5 seconds
      dbLogger.warn('Slow query detected', {
        ...performanceMetrics,
        query: this.sanitizeQueryForLogging(query)
      });
    }

    // Log performance metrics for analysis
    dbLogger.debug('Query performance metrics', performanceMetrics);
  }

  /**
   * Categorize query performance
   */
  private categorizeQueryPerformance(duration: number): string {
    if (duration < 100) return 'excellent';
    if (duration < 500) return 'good';
    if (duration < 2000) return 'acceptable';
    if (duration < 5000) return 'slow';
    return 'very-slow';
  }

  /**
   * Get query type for performance categorization
   */
  private getQueryType(query: string): string {
    const normalizedQuery = query.trim().toLowerCase();

    if (normalizedQuery.startsWith('select count(')) return 'count';
    if (normalizedQuery.startsWith('select') && normalizedQuery.includes('history')) return 'time-series';
    if (normalizedQuery.startsWith('select') && normalizedQuery.includes('tag')) return 'metadata';
    if (normalizedQuery.startsWith('select')) return 'select';
    if (normalizedQuery.startsWith('insert')) return 'insert';
    if (normalizedQuery.startsWith('update')) return 'update';
    if (normalizedQuery.startsWith('delete')) return 'delete';

    return 'other';
  }
}

// Singleton instance
let historianConnection: HistorianConnection | null = null;

/**
 * Get the singleton historian connection instance
 */
export function getHistorianConnection(): HistorianConnection {
  if (!historianConnection) {
    historianConnection = new HistorianConnection();
  }
  return historianConnection;
}

/**
 * Initialize historian connection
 */
export async function initializeHistorianConnection(): Promise<HistorianConnection> {
  const connection = getHistorianConnection();
  await connection.connect();
  return connection;
}

/**
 * Close historian connection
 */
export async function closeHistorianConnection(): Promise<void> {
  if (historianConnection) {
    await historianConnection.disconnect();
    historianConnection = null;
  }
}