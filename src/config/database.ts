import { ConnectionPool, config as MSSQLConfig } from 'mssql';
import { env } from './environment';
import { logger } from '@/utils/logger';
import { encryptionService } from '@/services/encryptionService';

// Database configuration for AVEVA Historian
export const databaseConfig: MSSQLConfig = {
  server: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  options: {
    // For IP addresses with encryption, we need special handling
    encrypt: env.DB_ENCRYPT && !isIPAddress(env.DB_HOST),
    trustServerCertificate: env.DB_TRUST_SERVER_CERTIFICATE || isIPAddress(env.DB_HOST),
    enableArithAbort: true,
    // Only set cryptoCredentialsDetails for hostnames
    ...(env.DB_ENCRYPT && !isIPAddress(env.DB_HOST) && {
      cryptoCredentialsDetails: {
        minVersion: 'TLSv1.2'
      }
    })
  },
  pool: {
    min: env.DB_POOL_MIN,
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: 30000,
  },
  requestTimeout: env.DB_TIMEOUT_MS,
  connectionTimeout: env.DB_TIMEOUT_MS,
};

/**
 * Check if a string is an IP address
 */
function isIPAddress(host: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4Regex.test(host) || ipv6Regex.test(host);
}

// Global connection pool instance
let pool: ConnectionPool | null = null;

/**
 * Initialize database connection pool
 */
export async function initializeDatabase(): Promise<ConnectionPool> {
  try {
    if (pool) {
      return pool;
    }

    logger.info('Initializing database connection pool...');
    pool = new ConnectionPool(databaseConfig);
    
    // Set up event handlers
    pool.on('connect', () => {
      logger.info('Database connection established');
    });

    pool.on('error', (err) => {
      logger.error('Database pool error:', err);
    });

    await pool.connect();
    logger.info('Database connection pool initialized successfully');
    
    return pool;
  } catch (error) {
    logger.error('Failed to initialize database connection:', error);
    throw error;
  }
}

/**
 * Get the database connection pool
 */
export function getDatabase(): ConnectionPool {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return pool;
}

/**
 * Close database connection pool
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    try {
      await pool.close();
      pool = null;
      logger.info('Database connection pool closed');
    } catch (error) {
      logger.error('Error closing database connection:', error);
      throw error;
    }
  }
}

/**
 * Test database connection
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const db = getDatabase();
    const result = await db.request().query('SELECT 1 as test');
    return result.recordset.length > 0;
  } catch (error) {
    logger.error('Database connection test failed:', error);
    return false;
  }
}