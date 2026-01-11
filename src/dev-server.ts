/**
 * Development server for Historian Reports
 * Runs without requiring AVEVA Historian database connection
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { env } from '@/config/environment';
import { logger } from '@/utils/logger';
import { errorHandler } from '@/middleware/errorHandler';
import { requestLogger } from '@/middleware/requestLogger';

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration
app.use(cors({
  origin: env.CORS_ORIGIN || 'http://localhost:3001',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: env.NODE_ENV,
    mode: 'development'
  });
});

// Mock data endpoints for development
app.get('/api/data/tags', (req, res) => {
  res.json({
    tags: [
      { name: 'Temperature_01', description: 'Reactor Temperature', unit: '°C' },
      { name: 'Pressure_01', description: 'Reactor Pressure', unit: 'bar' },
      { name: 'Flow_01', description: 'Inlet Flow Rate', unit: 'L/min' },
      { name: 'Level_01', description: 'Tank Level', unit: '%' }
    ]
  });
});

app.get('/api/data/time-series', (req, res) => {
  const { tags, startTime, endTime } = req.query;
  
  // Generate mock time series data
  const mockData = [];
  const start = new Date(startTime as string || Date.now() - 24 * 60 * 60 * 1000);
  const end = new Date(endTime as string || Date.now());
  const interval = (end.getTime() - start.getTime()) / 100; // 100 data points
  
  for (let i = 0; i < 100; i++) {
    const timestamp = new Date(start.getTime() + i * interval);
    mockData.push({
      timestamp: timestamp.toISOString(),
      value: Math.random() * 100 + Math.sin(i / 10) * 20,
      quality: 192 // Good quality
    });
  }
  
  res.json({
    data: mockData,
    tags: Array.isArray(tags) ? tags : [tags],
    startTime: start.toISOString(),
    endTime: end.toISOString()
  });
});

app.get('/api/reports', (req, res) => {
  res.json({
    reports: [
      {
        id: '1',
        name: 'Daily Production Report',
        description: 'Daily production metrics and trends',
        createdAt: new Date().toISOString(),
        status: 'completed'
      },
      {
        id: '2',
        name: 'Weekly Quality Report',
        description: 'Weekly quality control metrics',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        status: 'completed'
      }
    ]
  });
});

app.post('/api/reports/generate', (req, res) => {
  const { name, tags, timeRange, reportType } = req.body;
  
  res.json({
    id: Date.now().toString(),
    name: name || 'New Report',
    status: 'generating',
    progress: 0,
    estimatedCompletion: new Date(Date.now() + 30000).toISOString()
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

const PORT = env.PORT || 3000;

async function startDevServer(): Promise<void> {
  try {
    logger.info('Starting Historian Reports Development Server...');
    logger.info('Running in development mode without database dependencies');
    
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Development server running on port ${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/api/health`);
      logger.info(`🎯 API endpoints available at: http://localhost:${PORT}/api`);
      logger.info(`🌐 Frontend should be running at: http://localhost:3001`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('Development server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(() => {
        logger.info('Development server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start development server:', error);
    process.exit(1);
  }
}

// Start the development server
if (require.main === module) {
  startDevServer();
}

export { app, startDevServer };