/**
 * Auto-Update API Routes
 * Provides endpoints for managing real-time data updates
 */

import { Router, Request, Response } from 'express';
import { autoUpdateService, AutoUpdateConfig } from '@/services/autoUpdateService';
import { asyncHandler } from '@/middleware/errorHandler';
import { validateBody } from '@/middleware/validation';
import { z } from 'zod';
import { dbLogger } from '@/utils/logger';

const router = Router();
const apiLogger = dbLogger.child({ module: 'AutoUpdateAPI' });

// Validation schemas
const startAutoUpdateSchema = z.object({
  sessionId: z.string().min(1).max(100),
  tagNames: z.array(z.string().min(1)).min(1).max(50),
  updateInterval: z.union([z.literal(30), z.literal(60)]),
  maxDataPoints: z.number().int().min(10).max(10000).optional(),
  enableTrendAnalysis: z.boolean().optional().default(false),
  enableAnomalyDetection: z.boolean().optional().default(false),
  anomalyThreshold: z.number().min(0.5).max(10).optional().default(2.5)
});

const sessionIdSchema = z.object({
  sessionId: z.string().min(1)
});

/**
 * Start auto-update session
 * POST /api/auto-update/start
 */
router.post('/start', 
  validateBody(startAutoUpdateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const config: AutoUpdateConfig = {
      ...req.body,
      onDataUpdate: undefined, // Will be handled via SSE or WebSocket
      onError: undefined
    };

    try {
      autoUpdateService.startAutoUpdate(config);
      
      apiLogger.info('Auto-update session started via API', {
        sessionId: config.sessionId,
        tagCount: config.tagNames.length,
        interval: config.updateInterval
      });

      return res.status(201).json({
        success: true,
        message: 'Auto-update session started successfully',
        sessionId: config.sessionId,
        config: {
          tagNames: config.tagNames,
          updateInterval: config.updateInterval,
          maxDataPoints: config.maxDataPoints,
          enableTrendAnalysis: config.enableTrendAnalysis,
          enableAnomalyDetection: config.enableAnomalyDetection
        }
      });
    } catch (error: any) {
      apiLogger.error('Failed to start auto-update session:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to start auto-update session'
      });
    }
  })
);

/**
 * Stop auto-update session
 * POST /api/auto-update/stop
 */
router.post('/stop',
  validateBody(sessionIdSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.body;

    try {
      autoUpdateService.stopAutoUpdate(sessionId);
      
      apiLogger.info('Auto-update session stopped via API', { sessionId });

      return res.json({
        success: true,
        message: 'Auto-update session stopped successfully',
        sessionId
      });
    } catch (error: any) {
      apiLogger.error('Failed to stop auto-update session:', error);
      return res.status(404).json({
        success: false,
        message: error.message || 'Failed to stop auto-update session'
      });
    }
  })
);

/**
 * Get session status
 * GET /api/auto-update/status/:sessionId
 */
router.get('/status/:sessionId',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    const status = autoUpdateService.getSessionStatus(sessionId);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    res.json({
      success: true,
      sessionId,
      status
    });
  })
);

/**
 * Get current data for session
 * GET /api/auto-update/data/:sessionId
 */
router.get('/data/:sessionId',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    const data = autoUpdateService.getCurrentData(sessionId);
    
    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Convert Map to object for JSON serialization
    const dataObject: Record<string, any[]> = {};
    for (const [tagName, timeSeriesData] of data) {
      dataObject[tagName] = timeSeriesData;
    }

    res.json({
      success: true,
      sessionId,
      data: dataObject,
      totalDataPoints: Array.from(data.values()).reduce((total, arr) => total + arr.length, 0)
    });
  })
);

/**
 * List active sessions
 * GET /api/auto-update/sessions
 */
router.get('/sessions',
  asyncHandler(async (req: Request, res: Response) => {
    const activeSessions = autoUpdateService.getActiveSessions();
    const sessionDetails = [];

    for (const sessionId of activeSessions) {
      const status = autoUpdateService.getSessionStatus(sessionId);
      if (status) {
        sessionDetails.push({
          sessionId,
          ...status
        });
      }
    }

    res.json({
      success: true,
      activeSessions: activeSessions.length,
      sessions: sessionDetails
    });
  })
);

/**
 * Get timing statistics
 * GET /api/auto-update/timing-stats
 */
router.get('/timing-stats',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = autoUpdateService.getTimingStatistics();
    
    res.json({
      success: true,
      timingStatistics: stats
    });
  })
);

/**
 * Server-Sent Events endpoint for real-time updates
 * GET /api/auto-update/stream/:sessionId
 */
router.get('/stream/:sessionId',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    // Check if session exists
    const status = autoUpdateService.getSessionStatus(sessionId);
    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({
      type: 'connected',
      sessionId,
      timestamp: new Date().toISOString()
    })}\n\n`);

    // Listen for data updates
    const dataUpdateHandler = (result: any) => {
      if (result.sessionId === sessionId) {
        res.write(`data: ${JSON.stringify({
          type: 'dataUpdate',
          ...result
        })}\n\n`);
      }
    };

    const errorHandler = (error: any) => {
      if (error.sessionId === sessionId) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          sessionId,
          error: error.error.message,
          timestamp: new Date().toISOString()
        })}\n\n`);
      }
    };

    const sessionStoppedHandler = (event: any) => {
      if (event.sessionId === sessionId) {
        res.write(`data: ${JSON.stringify({
          type: 'sessionStopped',
          sessionId,
          updateCount: event.updateCount,
          timestamp: new Date().toISOString()
        })}\n\n`);
        res.end();
      }
    };

    autoUpdateService.on('dataUpdate', dataUpdateHandler);
    autoUpdateService.on('updateError', errorHandler);
    autoUpdateService.on('sessionStopped', sessionStoppedHandler);

    // Clean up on client disconnect
    req.on('close', () => {
      autoUpdateService.removeListener('dataUpdate', dataUpdateHandler);
      autoUpdateService.removeListener('updateError', errorHandler);
      autoUpdateService.removeListener('sessionStopped', sessionStoppedHandler);
      apiLogger.debug('SSE client disconnected', { sessionId });
    });

    // Send heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
    });

    // Note: This function doesn't return a value as it keeps the connection open
  })
);

/**
 * Stop all sessions (admin endpoint)
 * POST /api/auto-update/stop-all
 */
router.post('/stop-all',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const activeSessions = autoUpdateService.getActiveSessions();
      autoUpdateService.stopAllSessions();
      
      apiLogger.info('All auto-update sessions stopped via API', {
        stoppedSessions: activeSessions.length
      });

      res.json({
        success: true,
        message: 'All auto-update sessions stopped successfully',
        stoppedSessions: activeSessions.length
      });
    } catch (error: any) {
      apiLogger.error('Failed to stop all auto-update sessions:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to stop all sessions'
      });
    }
  })
);

export default router;