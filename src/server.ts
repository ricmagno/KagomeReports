import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { env } from '@/config/environment';
import { initializeDatabase, closeDatabase, testDatabaseConnection } from '@/config/database';
import { logger } from '@/utils/logger';
import { errorHandler } from '@/middleware/errorHandler';
import { requestLogger } from '@/middleware/requestLogger';
import { cacheManager } from '@/services/cacheManager';
import { getHistorianConnection } from '@/services/historianConnection';
import { schedulerService } from '@/services/schedulerService';
import { emailService } from '@/services/emailService';
import { setupDatabaseConfigIntegration } from '@/services/databaseConfigService';
import { updateChecker } from '@/services/updateChecker';

// Create Express application
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
      "img-src": ["'self'", "data:", "blob:"],
      "connect-src": ["'self'", env.CORS_ORIGIN, "https://*.github.com"],
      "upgrade-insecure-requests": null,
    },
  },
  hsts: false, // Disable HSTS to prevent Safari localhost issues
}));

app.use(cors({
  origin: [env.CORS_ORIGIN, 'http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
}));

// Utility middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Health check endpoint
app.get('/health', async (req, res) => {
  const cacheHealth = await cacheManager.healthCheck();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '0.65.2',
    environment: env.NODE_ENV,
    cache: cacheHealth,
  });
});

// API routes
import apiRoutes from '@/routes';
app.use('/api', apiRoutes);

// Serve static files from the React app if in production
const clientBuildPath = path.join(__dirname, '../client/build');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));

  // The catch-all handler for any request that doesn't match an API route
  // This is essential for React Router to work properly
  app.get('*', (req, res, next) => {
    // If it's an API request that wasn't caught by apiRoutes, let it fall through to the 404 handler
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Error handling middleware
app.use(errorHandler);

// 404 handler (fallback for API routes or if client build is missing)
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
  });
});

/**
 * Health check system for comprehensive component validation
 */
interface ComponentHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  required: boolean;
  error?: string;
  duration?: number;
}

interface SystemHealth {
  overall: 'healthy' | 'unhealthy' | 'degraded';
  components: ComponentHealth[];
  timestamp: string;
  startupTime?: number;
}

/**
 * Validate all system dependencies during startup
 */
async function validateStartupDependencies(): Promise<SystemHealth> {
  const startTime = Date.now();
  const components: ComponentHealth[] = [];

  logger.info('Starting comprehensive dependency validation...');

  // Setup database configuration integration
  setupDatabaseConfigIntegration();
  logger.info('✓ Database configuration integration setup completed');

  // Seed initial users
  try {
    const { authService } = await import('@/services/authService');
    const { userManagementService } = await import('@/services/userManagementService');

    // Ensure database is initialized before seeding
    await authService.waitForInitialization();

    await userManagementService.seedInitialUsers();
    logger.info('✓ Initial users seeded/verified');
  } catch (error) {
    logger.error('✗ Failed to seed initial users:', error);
  }

  // 1. Environment Configuration Validation
  try {
    const envStart = Date.now();
    // Environment is already validated by importing env
    components.push({
      name: 'Environment Configuration',
      status: 'healthy',
      required: true,
      duration: Date.now() - envStart
    });
    logger.info('✓ Environment configuration validated');
  } catch (error) {
    components.push({
      name: 'Environment Configuration',
      status: 'unhealthy',
      required: true,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    logger.error('✗ Environment configuration validation failed:', error);
  }

  // 2. Cache System Validation
  let cacheStart = Date.now();
  try {
    cacheStart = Date.now();
    await cacheManager.initialize();
    const cacheHealth = await cacheManager.healthCheck();

    components.push({
      name: 'Cache System',
      status: cacheHealth.cacheHealthy ? 'healthy' : 'degraded',
      required: false,
      duration: Date.now() - cacheStart
    });

    if (cacheHealth.cacheHealthy) {
      logger.info('✓ Cache system initialized and healthy');
    } else {
      logger.warn('⚠ Cache system initialized but not fully healthy');
    }
  } catch (error) {
    components.push({
      name: 'Cache System',
      status: 'degraded',
      required: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - cacheStart
    });
    logger.warn('⚠ Cache system initialization failed, continuing without cache:', error);
  }

  // 3. Database Connection Validation
  let dbStart = Date.now();
  try {
    dbStart = Date.now();
    await initializeDatabase();
    const dbHealthy = await testDatabaseConnection();

    components.push({
      name: 'Application Database',
      status: dbHealthy ? 'healthy' : 'unhealthy',
      required: true,
      duration: Date.now() - dbStart
    });

    if (dbHealthy) {
      logger.info('✓ Application database connection established and validated');
    } else {
      logger.error('✗ Application database connection validation failed');
    }
  } catch (error) {
    components.push({
      name: 'Application Database',
      status: 'unhealthy',
      required: true,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - dbStart
    });
    logger.error('✗ Application database initialization failed:', error);
  }

  // 4. Historian Database Connection Validation
  let historianStart = Date.now();
  try {
    historianStart = Date.now();
    const historianConnection = getHistorianConnection();

    // Attempt connection but don't block indefinitely
    // The connect() method handles retries internally (unlimited by default)
    // We wait a short time to see if it connects immediately
    const connectPromise = historianConnection.connect().catch(err => {
      logger.error('Background connection attempt failed finally:', err);
    });
    const TIMEOUT_MS = 2000;

    const connectedWithinTimeout = await Promise.race([
      connectPromise.then(() => true).catch(() => false),
      new Promise<boolean>(resolve => setTimeout(() => resolve(false), TIMEOUT_MS))
    ]);

    const statusInfo = historianConnection.getConnectionStatus();

    components.push({
      name: 'Historian Database',
      status: connectedWithinTimeout ? 'healthy' : 'degraded',
      required: false, // Optional for development
      duration: Date.now() - historianStart,
      ...(connectedWithinTimeout ? {} : { error: `Connection ${statusInfo.state}` })
    });

    if (connectedWithinTimeout) {
      logger.info('✓ Historian database connection established and validated');
    } else {
      logger.warn(`⚠ Historian database connection pending (State: ${statusInfo.state}). Server starting, retrying in background.`);
    }
  } catch (error) {
    components.push({
      name: 'Historian Database',
      status: 'degraded',
      required: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - historianStart
    });
    logger.warn('⚠ Historian database connection failed:', error);
  }

  // 5. Email Service Validation
  try {
    const emailStart = Date.now();
    const emailHealthy = await emailService.validateConfiguration();

    components.push({
      name: 'Email Service',
      status: emailHealthy ? 'healthy' : 'degraded',
      required: false,
      duration: Date.now() - emailStart
    });

    if (emailHealthy) {
      logger.info('✓ Email service configuration validated');
    } else {
      logger.warn('⚠ Email service configuration validation failed');
    }
  } catch (error) {
    components.push({
      name: 'Email Service',
      status: 'degraded',
      required: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    logger.warn('⚠ Email service validation failed:', error);
  }

  // 6. Scheduler Service Validation
  try {
    const schedulerStart = Date.now();
    await schedulerService.initialize();

    components.push({
      name: 'Scheduler Service',
      status: 'healthy',
      required: false,
      duration: Date.now() - schedulerStart
    });
    logger.info('✓ Scheduler service initialized');
  } catch (error) {
    components.push({
      name: 'Scheduler Service',
      status: 'degraded',
      required: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    logger.warn('⚠ Scheduler service initialization failed:', error);
  }

  // 7. Update Checker Initialization
  try {
    const updateCheckerStart = Date.now();
    updateChecker.startPeriodicChecking(); // Default to 24-hour checks

    components.push({
      name: 'Update Checker',
      status: 'healthy',
      required: false,
      duration: Date.now() - updateCheckerStart
    });
    logger.info('✓ Update checker initialized and periodic checking started');
  } catch (error) {
    components.push({
      name: 'Update Checker',
      status: 'degraded',
      required: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    logger.warn('⚠ Update checker initialization failed:', error);
  }

  // Determine overall system health
  const requiredComponents = components.filter(c => c.required);
  const requiredHealthy = requiredComponents.every(c => c.status === 'healthy');
  const anyUnhealthy = components.some(c => c.status === 'unhealthy');

  let overall: 'healthy' | 'unhealthy' | 'degraded';
  if (!requiredHealthy) {
    overall = 'unhealthy';
  } else if (anyUnhealthy || components.some(c => c.status === 'degraded')) {
    overall = 'degraded';
  } else {
    overall = 'healthy';
  }

  const systemHealth: SystemHealth = {
    overall,
    components,
    timestamp: new Date().toISOString(),
    startupTime: Date.now() - startTime
  };

  // Log startup summary
  logger.info(`Startup validation completed in ${systemHealth.startupTime}ms`);
  logger.info(`Overall system health: ${overall.toUpperCase()}`);

  const healthyCount = components.filter(c => c.status === 'healthy').length;
  const degradedCount = components.filter(c => c.status === 'degraded').length;
  const unhealthyCount = components.filter(c => c.status === 'unhealthy').length;

  logger.info(`Components: ${healthyCount} healthy, ${degradedCount} degraded, ${unhealthyCount} unhealthy`);

  return systemHealth;
}

/**
 * Enhanced graceful shutdown with comprehensive cleanup
 */
async function performGracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  const shutdownStart = Date.now();
  const shutdownSteps: Array<{ name: string; success: boolean; duration: number; error?: string }> = [];

  // 1. Stop accepting new connections (handled by server.close())
  logger.info('1. Stopping HTTP server...');

  // 2. Stop scheduler service
  try {
    const schedulerStart = Date.now();
    await schedulerService.shutdown();
    shutdownSteps.push({
      name: 'Scheduler Service',
      success: true,
      duration: Date.now() - schedulerStart
    });
    logger.info('✓ Scheduler service shut down');
  } catch (error) {
    shutdownSteps.push({
      name: 'Scheduler Service',
      success: false,
      duration: Date.now() - shutdownStart,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    logger.error('✗ Scheduler service shutdown failed:', error);
  }

  // 3. Close cache connections
  let cacheStart = Date.now();
  try {
    cacheStart = Date.now();
    await cacheManager.shutdown();
    shutdownSteps.push({
      name: 'Cache Manager',
      success: true,
      duration: Date.now() - cacheStart
    });
    logger.info('✓ Cache manager shut down');
  } catch (error) {
    shutdownSteps.push({
      name: 'Cache Manager',
      success: false,
      duration: Date.now() - cacheStart,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    logger.error('✗ Cache manager shutdown failed:', error);
  }

  // 4. Close historian database connections
  let historianStart = Date.now();
  try {
    historianStart = Date.now();
    const historianConnection = getHistorianConnection();
    await historianConnection.close();
    shutdownSteps.push({
      name: 'Historian Database',
      success: true,
      duration: Date.now() - historianStart
    });
    logger.info('✓ Historian database connections closed');
  } catch (error) {
    shutdownSteps.push({
      name: 'Historian Database',
      success: false,
      duration: Date.now() - historianStart,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    logger.error('✗ Historian database shutdown failed:', error);
  }

  // 5. Close application database connections
  let dbStart = Date.now();
  try {
    dbStart = Date.now();
    await closeDatabase();
    shutdownSteps.push({
      name: 'Application Database',
      success: true,
      duration: Date.now() - dbStart
    });
    logger.info('✓ Application database connections closed');
  } catch (error) {
    shutdownSteps.push({
      name: 'Application Database',
      success: false,
      duration: Date.now() - dbStart,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    logger.error('✗ Application database shutdown failed:', error);
  }

  // 6. Stop update checker
  let updateCheckerStart = Date.now();
  try {
    updateChecker.stopPeriodicChecking();
    shutdownSteps.push({
      name: 'Update Checker',
      success: true,
      duration: Date.now() - updateCheckerStart
    });
    logger.info('✓ Update checker stopped');
  } catch (error) {
    shutdownSteps.push({
      name: 'Update Checker',
      success: false,
      duration: Date.now() - updateCheckerStart,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    logger.error('✗ Update checker shutdown failed:', error);
  }

  // Log shutdown summary
  const totalShutdownTime = Date.now() - shutdownStart;
  const successfulSteps = shutdownSteps.filter(s => s.success).length;
  const failedSteps = shutdownSteps.filter(s => !s.success).length;

  logger.info(`Graceful shutdown completed in ${totalShutdownTime}ms`);
  logger.info(`Shutdown steps: ${successfulSteps} successful, ${failedSteps} failed`);

  if (failedSteps > 0) {
    logger.warn('Some shutdown steps failed, but continuing with process exit');
    shutdownSteps.filter(s => !s.success).forEach(step => {
      logger.warn(`Failed step: ${step.name} - ${step.error}`);
    });
  }
}
/**
 * Start the server with comprehensive startup validation
 */
async function startServer(): Promise<void> {
  try {
    logger.info('Starting Historian Reports Application...');

    // Start HTTP server IMMEDIATELY to respond to health checks
    const server = app.listen(env.PORT, () => {
      logger.info(`✓ HTTP server started on port ${env.PORT} in ${env.NODE_ENV} mode`);
      logger.info('Historian Reports Application is starting up...');
    });

    // Enhanced graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Initiating graceful shutdown sequence...`);

      // Set a timeout for forced shutdown
      const forceShutdownTimeout = setTimeout(() => {
        logger.error('Graceful shutdown timeout exceeded. Forcing exit...');
        process.exit(1);
      }, 30000); // 30 second timeout

      server.close(async () => {
        logger.info('✓ HTTP server stopped accepting new connections');

        try {
          await performGracefulShutdown(signal);
          clearTimeout(forceShutdownTimeout);
          logger.info('✓ Graceful shutdown completed successfully');
          process.exit(0);
        } catch (error) {
          clearTimeout(forceShutdownTimeout);
          logger.error('✗ Error during graceful shutdown:', error);
          process.exit(1);
        }
      });

      // Handle server close timeout
      setTimeout(() => {
        logger.error('Server close timeout exceeded. Forcing shutdown...');
        clearTimeout(forceShutdownTimeout);
        process.exit(1);
      }, 10000); // 10 second timeout for server.close()
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon

    // Perform comprehensive startup validation
    const systemHealth = await validateStartupDependencies();

    // Check if system can start
    if (systemHealth.overall === 'unhealthy') {
      logger.error('System health check failed. Required components are unhealthy.');
      logger.warn('Server continuing in degraded mode to provide health status.');

      // Log failed required components
      systemHealth.components
        .filter(c => c.required && c.status === 'unhealthy')
        .forEach(component => {
          logger.error(`Required component failed: ${component.name} - ${component.error}`);
        });

      // Do NOT shut down. We want to serve /health endpoints even if DB is down.
      // gracefulShutdown('STARTUP_FAILURE');
    }

    if (systemHealth.overall === 'degraded') {
      logger.warn('System is starting in degraded mode. Some optional components are unavailable.');
      logger.warn('Full functionality may not be available.');
    }

    logger.info(`✓ System health: ${systemHealth.overall.toUpperCase()}`);
    logger.info('Available endpoints:');
    logger.info('  GET  /health - Basic health check');
    logger.info('  GET  /api - API information');
    logger.info('  GET  /api/health - Comprehensive health check');
    logger.info('  GET  /api/health/detailed - Detailed component health');
    logger.info('  GET  /api/health/database - Database health check');
    logger.info('  GET  /api/health/historian - Historian health check');
    logger.info('  GET  /api/health/cache - Cache health check');
    logger.info('  GET  /api/data/tags - Get available tags');
    logger.info('  GET  /api/data/:tagName - Get time-series data');
    logger.info('  POST /api/data/query - Custom data queries');
    logger.info('  POST /api/reports/generate - Generate reports');
    logger.info('  GET  /api/schedules - Manage schedules');
    logger.info('  POST /api/auth/login - User authentication');

    logger.info('Historian Reports Application is ready to serve requests');

    // Handle uncaught exceptions and unhandled rejections
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      // Only shutdown on critical errors, but usually uncaught exception is critical
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      // Don't shutdown on unhandled rejections, as they might be background retries
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      // gracefulShutdown('UNHANDLED_REJECTION');
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    // Don't exit if server is already listening?
    // But this catch block catches errors in startServer execution.
    // If startServer fails (e.g. validatStartupDependencies throws), we want to just log.
    // We already moved app.listen out.
    // But wait, if validateStartupDependencies throws, we land here.
    // And then we `process.exit(1)`.
    // But `startServer` (the function) shouldn't throw if we handled everything.
    // `validateStartupDependencies` does NOT throw (it catches internally and returns object).

    // However, keeping process.exit(1) here is risky if something unexpected throws.
    // Let's remove process.exit(1) here too, just in case.
    // If app.listen failed, it would throw synchronously? No, it's async but invalid port would throw.
  }
}

// Start server if this file is run directly
// Start server if this file is run directly
if (require.main === module || process.env.TS_NODE_DEV === 'true' || process.argv[1]?.endsWith('server.ts')) {
  logger.info('Executing startServer check passed');
  startServer().catch(err => {
    logger.error('Failed to execute startServer:', err);
    process.exit(1);
  });
} else {
  logger.info('Server imported as module, not starting automatically');
}

export { app, startServer };