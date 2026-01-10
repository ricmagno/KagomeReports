/**
 * Progress Tracking Routes
 * Provides endpoints for monitoring long-running operations
 */

import { Router, Request, Response } from 'express';
import { progressTracker, createProgressSSEHandler } from '@/middleware/progressTracker';
import { asyncHandler } from '@/middleware/errorHandler';
import { apiLogger } from '@/utils/logger';

const router = Router();

/**
 * Get progress for a specific operation
 * GET /api/progress/:operationId
 */
router.get('/:operationId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { operationId } = req.params;
  
  if (!operationId) {
    res.status(400).json({ error: 'Operation ID is required' });
    return;
  }

  const progress = progressTracker.getProgress(operationId);
  
  if (!progress) {
    res.status(404).json({ error: 'Operation not found' });
    return;
  }

  res.json(progress);
}));

/**
 * Get all active operations
 * GET /api/progress
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const activeOperations = progressTracker.getActiveOperations();
  
  res.json({
    activeOperations,
    count: activeOperations.length
  });
}));

/**
 * Server-Sent Events endpoint for real-time progress updates
 * GET /api/progress/:operationId/stream
 */
router.get('/:operationId/stream', createProgressSSEHandler());

/**
 * Cancel an operation (if supported)
 * DELETE /api/progress/:operationId
 */
router.delete('/:operationId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { operationId } = req.params;
  
  if (!operationId) {
    res.status(400).json({ error: 'Operation ID is required' });
    return;
  }

  // For now, we'll just mark it as failed
  // In a full implementation, you'd want to actually cancel the operation
  progressTracker.failOperation(operationId, 'Operation cancelled by user');
  
  apiLogger.info('Operation cancelled', { operationId });
  
  res.json({ message: 'Operation cancelled' });
}));

export default router;