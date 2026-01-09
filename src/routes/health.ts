/**
 * Health Check API Routes
 * Provides system health monitoring and status endpoints
 * Requirements: 11.4
 */

import { Router, Request, Response } from 'express';
import { getHistorianConnection } from '@/services/historianConnection';
import { testDatabaseConnection } from '@/config/database';
import { apiLogger } from '@/utils/logger';
import { asyncHandler } from '@/middleware/errorHandler';
import { env } from '@/config/environment';

const router = Router();

/**
 * GET /api/health
 * Basic health check endpoint
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: env.NODE_ENV,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    services: {
      database: 'unknown',
      historian: 'unknown'
    }
  };

  // Test database connection
  try {
    const dbHealthy = await testDatabaseConnection();
    healthStatus.services.database = dbHealthy ? 'healthy' : 'unhealthy';
  } catch (error) {
    healthStatus.services.database = 'unhealthy';
    apiLogger.warn('Database health check failed:', error);
  }

  // Test historian connection
  try {
    const historianConnection = getHistorianConnection();
    const historianHealthy = await historianConnection.validateConnection();
    healthStatus.services.historian = historianHealthy ? 'healthy' : 'unhealthy';
  } catch (error) {
    healthStatus.services.historian = 'unhealthy';
    apiLogger.warn('Historian connection health check failed:', error);
  }

  // Determine overall status
  const allServicesHealthy = Object.values(healthStatus.services).every(status => status === 'healthy');
  if (!allServicesHealthy) {
    healthStatus.status = 'degraded';
  }

  const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(healthStatus);
}));

/**
 * GET /api/health/detailed
 * Detailed health check with component-specific information
 */
router.get('/detailed', asyncHandler(async (req: Request, res: Response) => {
  const detailedHealth = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: env.NODE_ENV,
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      platform: process.platform,
      nodeVersion: process.version
    },
    services: {
      database: {
        status: 'unknown',
        connectionPool: null as any,
        lastCheck: null as string | null
      },
      historian: {
        status: 'unknown',
        connectionStatus: null as any,
        lastCheck: null as string | null
      }
    }
  };

  // Detailed database check
  try {
    const dbHealthy = await testDatabaseConnection();
    detailedHealth.services.database = {
      status: dbHealthy ? 'healthy' : 'unhealthy',
      connectionPool: {
        host: env.DB_HOST,
        port: env.DB_PORT,
        database: env.DB_NAME,
        poolMin: env.DB_POOL_MIN,
        poolMax: env.DB_POOL_MAX,
        timeout: env.DB_TIMEOUT_MS
      },
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    detailedHealth.services.database.status = 'unhealthy';
    detailedHealth.services.database.lastCheck = new Date().toISOString();
    apiLogger.warn('Detailed database health check failed:', error);
  }

  // Detailed historian check
  try {
    const historianConnection = getHistorianConnection();
    const historianHealthy = await historianConnection.validateConnection();
    const connectionStatus = historianConnection.getConnectionStatus();
    
    detailedHealth.services.historian = {
      status: historianHealthy ? 'healthy' : 'unhealthy',
      connectionStatus,
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    detailedHealth.services.historian.status = 'unhealthy';
    detailedHealth.services.historian.lastCheck = new Date().toISOString();
    apiLogger.warn('Detailed historian health check failed:', error);
  }

  // Determine overall status
  const allServicesHealthy = Object.values(detailedHealth.services)
    .every(service => service.status === 'healthy');
  
  if (!allServicesHealthy) {
    detailedHealth.status = 'degraded';
  }

  const statusCode = detailedHealth.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(detailedHealth);
}));

/**
 * GET /api/health/database
 * Database-specific health check
 */
router.get('/database', asyncHandler(async (req: Request, res: Response) => {
  const dbHealth = {
    status: 'unknown',
    timestamp: new Date().toISOString(),
    connection: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      encrypted: env.DB_ENCRYPT
    },
    pool: {
      min: env.DB_POOL_MIN,
      max: env.DB_POOL_MAX,
      timeout: env.DB_TIMEOUT_MS
    },
    test: {
      successful: false,
      duration: 0,
      error: null as string | null
    }
  };

  const startTime = Date.now();
  
  try {
    const isHealthy = await testDatabaseConnection();
    const duration = Date.now() - startTime;
    
    dbHealth.status = isHealthy ? 'healthy' : 'unhealthy';
    dbHealth.test = {
      successful: isHealthy,
      duration,
      error: null
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    dbHealth.status = 'unhealthy';
    dbHealth.test = {
      successful: false,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }

  const statusCode = dbHealth.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(dbHealth);
}));

/**
 * GET /api/health/historian
 * Historian connection-specific health check
 */
router.get('/historian', asyncHandler(async (req: Request, res: Response) => {
  const historianHealth = {
    status: 'unknown',
    timestamp: new Date().toISOString(),
    connection: null as any,
    test: {
      successful: false,
      duration: 0,
      error: null as string | null
    }
  };

  const startTime = Date.now();
  
  try {
    const historianConnection = getHistorianConnection();
    const isHealthy = await historianConnection.validateConnection();
    const connectionStatus = historianConnection.getConnectionStatus();
    const duration = Date.now() - startTime;
    
    historianHealth.status = isHealthy ? 'healthy' : 'unhealthy';
    historianHealth.connection = connectionStatus;
    historianHealth.test = {
      successful: isHealthy,
      duration,
      error: null
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    historianHealth.status = 'unhealthy';
    historianHealth.test = {
      successful: false,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }

  const statusCode = historianHealth.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(historianHealth);
}));

export default router;