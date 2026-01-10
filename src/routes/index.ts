/**
 * Main API Routes
 * Aggregates all route modules for the Historian Reports API
 */

import { Router } from 'express';
import dataRoutes from './data';
import healthRoutes from './health';
import reportRoutes from './reports';
import scheduleRoutes from './schedules';
import authRoutes from './auth';
import systemRoutes from './system';
import cacheRoutes from './cache';

const router = Router();

// Mount route modules
router.use('/data', dataRoutes);
router.use('/health', healthRoutes);
router.use('/reports', reportRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/auth', authRoutes);
router.use('/system', systemRoutes);
router.use('/cache', cacheRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'Historian Reports API',
    version: '1.0.0',
    description: 'Professional reporting application for AVEVA Historian database',
    endpoints: {
      data: '/api/data',
      health: '/api/health',
      reports: '/api/reports',
      schedules: '/api/schedules',
      auth: '/api/auth',
      system: '/api/system',
      cache: '/api/cache'
    }
  });
});

export default router;