import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { env } from '@/config/environment';
import { initializeDatabase, closeDatabase } from '@/config/database';
import { logger } from '@/utils/logger';
import { errorHandler } from '@/middleware/errorHandler';
import { requestLogger } from '@/middleware/requestLogger';

// Create Express application
const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
}));

// Utility middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: env.NODE_ENV,
  });
});

// API routes
import apiRoutes from '@/routes';
app.use('/api', apiRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
  });
});

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  try {
    // Try to initialize database connection (non-blocking for development)
    try {
      await initializeDatabase();
      logger.info('Database connection initialized successfully');
    } catch (error) {
      logger.warn('Database connection failed, continuing without database:', error);
      logger.info('API endpoints will return appropriate errors when database is needed');
    }
    
    // Start HTTP server
    const server = app.listen(env.PORT, () => {
      logger.info(`Server started on port ${env.PORT} in ${env.NODE_ENV} mode`);
      logger.info('Available endpoints:');
      logger.info('  GET  /health - Health check');
      logger.info('  GET  /api - API information');
      logger.info('  GET  /api/health - Detailed health check');
      logger.info('  GET  /api/data/tags - Get available tags');
      logger.info('  GET  /api/data/:tagName - Get time-series data');
      logger.info('  POST /api/data/query - Custom data queries');
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          await closeDatabase();
          logger.info('Database connections closed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}

export { app, startServer };