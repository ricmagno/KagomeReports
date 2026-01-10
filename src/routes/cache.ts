/**
 * Cache Management Routes
 * Provides endpoints for cache monitoring, management, and invalidation
 * Requirements: 10.5
 */

import { Router } from 'express';
import { cacheManager } from '@/services/cacheManager';
import { asyncHandler } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * GET /api/cache/stats
 * Get cache statistics and metrics
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await cacheManager.getCacheStats();
  
  logger.info('Cache stats requested', { stats });
  
  res.json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString()
  });
}));

/**
 * GET /api/cache/health
 * Get cache health status
 */
router.get('/health', asyncHandler(async (req, res) => {
  const health = await cacheManager.healthCheck();
  
  res.json({
    success: true,
    data: health,
    timestamp: new Date().toISOString()
  });
}));

/**
 * GET /api/cache/metrics
 * Get comprehensive cache metrics for monitoring
 */
router.get('/metrics', asyncHandler(async (req, res) => {
  const metrics = await cacheManager.getCacheMetrics();
  
  res.json({
    success: true,
    data: metrics,
    timestamp: new Date().toISOString()
  });
}));

/**
 * POST /api/cache/invalidate
 * Invalidate cache entries
 * Body: { type: 'all' | 'tags' | 'timeseries' | 'statistics', tagName?: string }
 */
router.post('/invalidate', asyncHandler(async (req, res) => {
  const { type, tagName } = req.body;
  
  if (!type) {
    res.status(400).json({
      success: false,
      error: 'Cache invalidation type is required',
      validTypes: ['all', 'tags', 'timeseries', 'statistics']
    });
    return;
  }

  switch (type) {
    case 'all':
      await cacheManager.invalidateAllCache();
      logger.info('All cache invalidated');
      break;
      
    case 'tags':
      await cacheManager.invalidateTagCache();
      logger.info('Tag cache invalidated');
      break;
      
    case 'timeseries':
      await cacheManager.invalidateTimeSeriesCache(tagName);
      logger.info(`Time-series cache invalidated${tagName ? ` for tag: ${tagName}` : ''}`);
      break;
      
    case 'statistics':
      await cacheManager.invalidateStatisticsCache(tagName);
      logger.info(`Statistics cache invalidated${tagName ? ` for tag: ${tagName}` : ''}`);
      break;
      
    default:
      res.status(400).json({
        success: false,
        error: 'Invalid cache invalidation type',
        validTypes: ['all', 'tags', 'timeseries', 'statistics']
      });
      return;
  }
  
  res.json({
    success: true,
    message: `Cache invalidated successfully`,
    type,
    tagName: tagName || null,
    timestamp: new Date().toISOString()
  });
}));

/**
 * POST /api/cache/warm
 * Warm cache with frequently accessed data
 */
router.post('/warm', asyncHandler(async (req, res) => {
  logger.info('Cache warming requested');
  
  await cacheManager.warmCache();
  
  res.json({
    success: true,
    message: 'Cache warming completed',
    timestamp: new Date().toISOString()
  });
}));

export default router;