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
import progressRoutes from './progress';
import autoUpdateRoutes from './autoUpdate';
import databaseConfigRoutes from './databaseConfig';
import statusRoutes from './status';
import filesystemRoutes from './filesystem';
import usersRoutes from './users';
import autoLoginRoutes from './autoLogin';

const router = Router();

// Mount route modules
router.use('/data', dataRoutes);
router.use('/health', healthRoutes);
router.use('/reports', reportRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/auth', authRoutes);
router.use('/system', systemRoutes);
router.use('/cache', cacheRoutes);
router.use('/progress', progressRoutes);
router.use('/auto-update', autoUpdateRoutes);
router.use('/database', databaseConfigRoutes);
router.use('/status', statusRoutes);
router.use('/filesystem', filesystemRoutes);
router.use('/users', usersRoutes);
router.use('/auth/auto-login', autoLoginRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'Historian Reports API',
    version: '1.0.1',
    description: 'Reporting application for AVEVA Historian',
    endpoints: {
      data: '/api/data',
      health: '/api/health',
      reports: '/api/reports',
      schedules: '/api/schedules',
      auth: '/api/auth',
      system: '/api/system',
      cache: '/api/cache',
      progress: '/api/progress',
      autoUpdate: '/api/auto-update',
      database: '/api/database',
      status: '/api/status',
      filesystem: '/api/filesystem',
      users: '/api/users',
      autoLogin: '/api/auth/auto-login'
    }
  });
});

export default router;