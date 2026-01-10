/**
 * AVEVA Historian Database Connection Service
 * Handles database connections, authentication, and connection pooling
 */

import { ConnectionPool, Request, IResult } from 'mssql';
import { getDatabase, testDatabaseConnection } from '@/config/database';
import { dbLogger } from '@/utils/logger';
import { createError } from '@/middleware/errorHandler';
import { RetryHandler } from '@/utils/retryHandler';
import { encryptionService } from '@/services/encryptionService';
import { DatabaseConfig, TimeSeriesData, TagInfo, TimeRange, DataFilter, QueryResult, HistorianQueryOptions, RetrievalMode, QualityCode } from '@/types/historian';

export class HistorianConnection {
  private pool: ConnectionPool;
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;
  private maxRetryAttempts: number = 3;
  private retryDelay: number = 1000; // Start with 1 second

  constructor() {
    this.pool = getDatabase();
  }

  /**
   * Connect to AVEVA Historian database with retry logic
   */
  async connect(): Promise<void> {
    return RetryHandler.executeWithRetry(
      async () => {
        if (this.isConnected) {
          return;
        }

        dbLogger.info('Attempting to connect to AVEVA Historian database...');
        
        // Test the connection
        const isHealthy = await testDatabaseConnection();
        if (!isHealthy) {
          throw createError('Database connection test failed', 503);
        }

        this.isConnected = true;
        this.connectionAttempts = 0;
        dbLogger.info('Successfully connected to AVEVA Historian database');
      },
      RetryHandler.createDatabaseRetryOptions({ maxAttempts: 3 }),
      'database-connection'
    ).catch(error => {
      this.isConnected = false;
      dbLogger.error('Database connection failed:', error);
      throw error;
    });
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        this.isConnected = false;
        dbLogger.info('Disconnected from AVEVA Historian database');
      }
    } catch (error) {
      dbLogger.error('Error disconnecting from database:', error);
      throw error;
    }
  }

  /**
   * Execute a SQL query with error handling and logging
   */
  async executeQuery<T = any>(query: string, params?: Record<string, any>): Promise<IResult<T>> {
    return RetryHandler.executeWithRetry(
      async () => {
        if (!this.isConnected) {
          await this.connect();
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
      RetryHandler.createDatabaseRetryOptions({ maxAttempts: 2 }),
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
   * Get database connection status
   */
  getConnectionStatus(): { connected: boolean; attempts: number } {
    return {
      connected: this.isConnected,
      attempts: this.connectionAttempts
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