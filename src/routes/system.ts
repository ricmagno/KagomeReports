/**
 * System Control Routes
 * Provides endpoints for system-level operations like restart
 */

import { Router, Request, Response } from 'express';
import { dbLogger } from '@/utils/logger';

const router = Router();
const systemLogger = dbLogger.child({ route: 'system' });

/**
 * POST /api/system/restart
 * Initiates a graceful restart of the application
 * Note: Requires a process manager (PM2, systemd, Docker) to automatically restart
 */
router.post('/restart', async (req: Request, res: Response): Promise<void> => {
  try {
    systemLogger.info('Application restart requested', {
      user: req.body.user || 'unknown',
      timestamp: new Date().toISOString()
    });

    // Send response before restarting
    res.json({
      success: true,
      message: 'Application restart initiated. The server will be back online shortly.',
      estimatedDowntime: '5-10 seconds'
    });

    // Give the response time to be sent
    setTimeout(() => {
      systemLogger.info('Initiating graceful shutdown for restart');

      // Emit SIGTERM to trigger graceful shutdown
      // Process managers will automatically restart the application
      process.kill(process.pid, 'SIGTERM');
    }, 1000);

  } catch (error) {
    systemLogger.error('Failed to initiate restart', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate restart'
    });
  }
});

/**
 * GET /api/system/status
 * Returns basic system status
 */
router.get('/status', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid
    }
  });
});

export default router;