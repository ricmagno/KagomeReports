/**
 * Database Status API Routes
 * Provides real-time monitoring of AVEVA Historian system tags
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { Router, Request, Response } from 'express';
import { apiLogger } from '@/utils/logger';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { authenticateToken, optionalAuth } from '@/middleware/auth';
import { systemStatusService } from '@/services/systemStatusService';
import { StatusCategory } from '@/types/systemStatus';

const router = Router();

/**
 * GET /api/status/database
 * Get current system status from AVEVA Historian system tags
 * Supports optional category filtering via query parameter
 * 
 * Query Parameters:
 * - category: Filter by category (errors, services, storage, io, performance)
 * - refresh: Force cache refresh (boolean)
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */
router.get('/database', authenticateToken, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { category, refresh } = req.query;

  apiLogger.info('Retrieving database status', { category, refresh });

  try {
    // If refresh is requested, clear cache
    if (refresh === 'true') {
      await systemStatusService.clearCache();
      apiLogger.debug('Cache cleared for status refresh');
    }

    // If category filter is provided, validate and filter
    if (category) {
      const categoryValue = category as string;

      // Validate category
      if (!Object.values(StatusCategory).includes(categoryValue as StatusCategory)) {
        throw createError(
          `Invalid category: ${categoryValue}. Valid categories are: ${Object.values(StatusCategory).join(', ')}`,
          400
        );
      }

      // Get filtered data
      const categoryData = await systemStatusService.getSystemTagsByCategory(
        categoryValue as StatusCategory
      );

      res.json({
        success: true,
        data: categoryData,
        category: categoryValue,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Get all system status data
    const statusData = await systemStatusService.getSystemTagValues();

    // Format response according to API specification
    const response = {
      success: true,
      data: {
        timestamp: statusData.timestamp,
        categories: {
          errors: statusData.errors,
          services: statusData.services,
          storage: statusData.storage,
          io: statusData.io,
          performance: statusData.performance
        }
      },
      serverTime: {
        utc: new Date().toISOString(),
        local: new Date().toLocaleString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        offset: new Date().getTimezoneOffset()
      }
    };

    res.json(response);

  } catch (error) {
    apiLogger.error('Failed to retrieve database status', { error, category });

    // If it's already a formatted error, rethrow it
    if (error instanceof Error && 'statusCode' in error) {
      throw error;
    }

    // Otherwise, create a generic 500 error
    throw createError('Failed to retrieve database status', 500);
  }
}));

/**
 * GET /api/status/database/health
 * Quick health check endpoint for database status monitoring
 * Returns simplified status information
 */
router.get('/database/health', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  apiLogger.info('Database status health check');

  try {
    // Get service status only for quick health check
    const serviceData = await systemStatusService.getSystemTagsByCategory(StatusCategory.Services);

    // Check if any critical services are down
    const criticalServices = ['SysStorage', 'SysRetrieval', 'SysIndexing'];
    const downServices = serviceData.filter(tag =>
      criticalServices.includes(tag.tagName) && tag.value === 0
    );

    const isHealthy = downServices.length === 0;

    res.json({
      success: true,
      healthy: isHealthy,
      status: isHealthy ? 'operational' : 'degraded',
      downServices: downServices.map(s => s.tagName),
      timestamp: new Date().toISOString(),
      serverTime: {
        utc: new Date().toISOString(),
        local: new Date().toLocaleString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        offset: new Date().getTimezoneOffset()
      }
    });

  } catch (error) {
    apiLogger.error('Database health check failed', { error });

    // Return unhealthy status on error
    res.status(503).json({
      success: false,
      healthy: false,
      status: 'unavailable',
      error: 'Failed to check database status',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /api/status/database/export
 * Export system status data in CSV or JSON format
 * Query params:
 *   - format: 'csv' | 'json' (default: 'json')
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */
router.get('/database/export', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const format = (req.query.format as string)?.toLowerCase() || 'json';

  // Validate format
  if (format !== 'csv' && format !== 'json') {
    throw createError('Invalid format. Must be "csv" or "json"', 400);
  }

  apiLogger.info('Exporting system status data', { format, user: (req as any).user?.username });

  try {
    let exportData: string;
    let contentType: string;
    let filename: string;
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    if (format === 'csv') {
      exportData = await systemStatusService.exportStatusDataCSV();
      contentType = 'text/csv';
      filename = `system-status-${timestamp}.csv`;
    } else {
      exportData = await systemStatusService.exportStatusDataJSON();
      contentType = 'application/json';
      filename = `system-status-${timestamp}.json`;
    }

    // Set headers for file download
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exportData);

    apiLogger.info('Successfully exported system status data', { format, filename });

  } catch (error) {
    apiLogger.error('Failed to export system status data:', error);
    throw createError('Failed to export status data', 500);
  }
}));

export default router;
