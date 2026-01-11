/**
 * Data Retrieval API Routes
 * Handles time-series data queries, tag information, and filtered data retrieval
 * Requirements: 2.1, 2.2
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { cacheManager } from '@/services/cacheManager';
import { dataFilteringService } from '@/services/dataFiltering';
import { progressMiddleware } from '@/middleware/progressTracker';
import { apiLogger } from '@/utils/logger';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { TimeRange, DataFilter, HistorianQueryOptions, RetrievalMode } from '@/types/historian';

const router = Router();

// Validation schemas
const timeRangeSchema = z.object({
  startTime: z.string().datetime().transform(str => new Date(str)),
  endTime: z.string().datetime().transform(str => new Date(str)),
  relativeRange: z.enum(['last1h', 'last24h', 'last7d', 'last30d']).optional()
});

const dataFilterSchema = z.object({
  tagNames: z.array(z.string()).optional(),
  qualityFilter: z.array(z.number()).optional(),
  valueRange: z.object({
    min: z.number().optional(),
    max: z.number().optional()
  }).optional(),
  samplingInterval: z.number().positive().optional()
});

const queryOptionsSchema = z.object({
  mode: z.nativeEnum(RetrievalMode).default(RetrievalMode.Full),
  interval: z.number().positive().optional(),
  tolerance: z.number().positive().optional(),
  maxPoints: z.number().positive().max(10000).optional(),
  includeQuality: z.boolean().default(true)
});

const paginationSchema = z.object({
  pageSize: z.number().int().min(1).max(1000).default(100),
  cursor: z.string().optional()
});

/**
 * GET /api/data/tags
 * Get available tags with optional filtering
 */
router.get('/tags', asyncHandler(async (req: Request, res: Response) => {
  const { filter } = req.query;

  apiLogger.info('Retrieving tag list', { filter });

  const dataRetrievalService = cacheManager.getDataRetrievalService();
  const tags = await dataRetrievalService.getTagList(filter as string);

  res.json({
    success: true,
    data: tags,
    count: tags.length
  });
}));

/**
 * GET /api/data/:tagName
 * Get time-series data for a specific tag
 */
router.get('/:tagName',
  progressMiddleware({
    operationType: 'data-retrieval',
    estimatedDuration: 10000 // 10 seconds
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { tagName } = req.params;
    const progressTracker = (req as any).progressTracker;

    if (!tagName) {
      progressTracker?.failOperation('Tag name is required');
      throw createError('Tag name is required', 400);
    }

    try {
      // Validate query parameters
      const timeRangeResult = timeRangeSchema.safeParse(req.query);
      if (!timeRangeResult.success) {
        progressTracker?.failOperation('Invalid time range parameters');
        throw createError('Invalid time range parameters', 400);
      }

      const optionsResult = queryOptionsSchema.safeParse(req.query);
      if (!optionsResult.success) {
        progressTracker?.failOperation('Invalid query options');
        throw createError('Invalid query options', 400);
      }

      const timeRange: TimeRange = {
        startTime: timeRangeResult.data.startTime,
        endTime: timeRangeResult.data.endTime,
        relativeRange: timeRangeResult.data.relativeRange
      };
      const options = optionsResult.data;

      apiLogger.info('Retrieving time-series data', { tagName, timeRange, options });

      progressTracker?.updateProgress('validation', 10, 'Parameters validated');

      const dataRetrievalService = cacheManager.getDataRetrievalService();
      const statisticalAnalysisService = cacheManager.getStatisticalAnalysisService();
      const data = await dataRetrievalService.getTimeSeriesData(
        tagName,
        timeRange,
        options,
        progressTracker?.operationId
      );

      // Calculate basic statistics if requested
      const includeStats = req.query.includeStats === 'true';
      let statistics;
      if (includeStats && data.length > 0) {
        progressTracker?.updateProgress('analysis', 90, 'Calculating statistics');
        statistics = await statisticalAnalysisService.calculateStatistics(
          tagName,
          timeRange.startTime,
          timeRange.endTime,
          data
        );
      }

      progressTracker?.completeOperation(`Retrieved ${data.length} data points`);

      res.json({
        success: true,
        data,
        count: data.length,
        tagName,
        timeRange,
        operationId: progressTracker?.operationId,
        ...(statistics && { statistics })
      });
    } catch (error) {
      progressTracker?.failOperation(error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  })
);

/**
 * POST /api/data/query
 * Execute custom data queries with advanced filtering
 */
router.post('/query', asyncHandler(async (req: Request, res: Response) => {
  // Validate request body
  const querySchema = z.object({
    timeRange: timeRangeSchema,
    filter: dataFilterSchema,
    options: queryOptionsSchema.optional(),
    pagination: paginationSchema.optional(),
    includeStatistics: z.boolean().default(false),
    includeQualityReport: z.boolean().default(false)
  });

  const queryResult = querySchema.safeParse(req.body);
  if (!queryResult.success) {
    throw createError('Invalid query parameters', 400);
  }

  const { timeRange, filter, options, pagination, includeStatistics, includeQualityReport } = queryResult.data;

  apiLogger.info('Executing custom data query', { timeRange, filter, options, pagination });

  // Execute filtered data query
  const dataRetrievalService = cacheManager.getDataRetrievalService();
  const statisticalAnalysisService = cacheManager.getStatisticalAnalysisService();
  const result = await dataRetrievalService.getFilteredData(
    timeRange,
    filter,
    pagination?.pageSize || 100,
    pagination?.cursor
  );

  // Apply additional filtering if needed
  let processedData = result.data;
  let qualityReport;

  if (includeQualityReport) {
    const qualityResult = dataFilteringService.filterByQuality(processedData);
    qualityReport = qualityResult.qualityReport;
  }

  // Calculate statistics if requested
  let statistics;
  if (includeStatistics && processedData.length > 0) {
    // Use first tag name for caching key, or generate a hash for multiple tags
    const tagName = filter.tagNames?.[0] || 'filtered-query';
    statistics = await statisticalAnalysisService.calculateStatistics(tagName, timeRange.startTime, timeRange.endTime, processedData);
  }

  res.json({
    success: true,
    data: processedData,
    count: processedData.length,
    totalCount: result.totalCount,
    hasMore: result.hasMore,
    ...(result.nextCursor && { nextCursor: result.nextCursor }),
    timeRange,
    filter,
    ...(statistics && { statistics }),
    ...(qualityReport && { qualityReport })
  });
}));

/**
 * GET /api/data/:tagName/statistics
 * Get statistical analysis for a specific tag
 */
router.get('/:tagName/statistics', asyncHandler(async (req: Request, res: Response) => {
  const { tagName } = req.params;

  if (!tagName) {
    throw createError('Tag name is required', 400);
  }

  // Validate query parameters
  const timeRangeResult = timeRangeSchema.safeParse(req.query);
  if (!timeRangeResult.success) {
    throw createError('Invalid time range parameters', 400);
  }

  const timeRange: TimeRange = {
    startTime: timeRangeResult.data.startTime,
    endTime: timeRangeResult.data.endTime,
    relativeRange: timeRangeResult.data.relativeRange
  };

  apiLogger.info('Calculating statistics for tag', { tagName, timeRange });

  // Get data
  const dataRetrievalService = cacheManager.getDataRetrievalService();
  const statisticalAnalysisService = cacheManager.getStatisticalAnalysisService();
  const data = await dataRetrievalService.getTimeSeriesData(tagName, timeRange);

  if (data.length === 0) {
    throw createError('No data found for the specified tag and time range', 404);
  }

  // Calculate comprehensive statistics
  const basicStats = await statisticalAnalysisService.calculateStatistics(tagName, timeRange.startTime, timeRange.endTime, data);
  const qualityMetrics = statisticalAnalysisService.calculateDataQuality(data);

  // Calculate trend if enough data points
  let trend;
  if (data.length >= 2) {
    trend = statisticalAnalysisService.calculateTrendLine(data);
  }

  // Detect anomalies
  let anomalies;
  if (data.length >= 3) {
    const threshold = parseFloat(req.query.anomalyThreshold as string) || 2.0;
    anomalies = statisticalAnalysisService.detectAnomalies(data, threshold);
  }

  res.json({
    success: true,
    tagName,
    timeRange,
    dataPoints: data.length,
    statistics: basicStats,
    qualityMetrics,
    ...(trend && { trend }),
    ...(anomalies && { anomalies: { count: anomalies.length, detected: anomalies } })
  });
}));

/**
 * POST /api/data/multiple
 * Get time-series data for multiple tags
 */
router.post('/multiple', asyncHandler(async (req: Request, res: Response) => {
  // Validate request body
  const multipleQuerySchema = z.object({
    tagNames: z.array(z.string()).min(1).max(10),
    timeRange: timeRangeSchema,
    options: queryOptionsSchema.optional(),
    includeStatistics: z.boolean().default(false)
  });

  const queryResult = multipleQuerySchema.safeParse(req.body);
  if (!queryResult.success) {
    throw createError('Invalid query parameters', 400);
  }

  const { tagNames, timeRange, options, includeStatistics } = queryResult.data;

  // Create proper TimeRange object
  const properTimeRange: TimeRange = {
    startTime: timeRange.startTime,
    endTime: timeRange.endTime,
    relativeRange: timeRange.relativeRange
  };

  apiLogger.info('Retrieving multiple time-series data', { tagNames, timeRange: properTimeRange });

  // Get data for all tags
  const dataRetrievalService = cacheManager.getDataRetrievalService();
  const statisticalAnalysisService = cacheManager.getStatisticalAnalysisService();
  const results = await dataRetrievalService.getMultipleTimeSeriesData(tagNames, properTimeRange, options);

  // Calculate statistics for each tag if requested
  const response: any = {
    success: true,
    data: results,
    timeRange: properTimeRange,
    requestedTags: tagNames,
    retrievedTags: Object.keys(results)
  };

  if (includeStatistics) {
    const statistics: Record<string, any> = {};
    for (const [tagName, data] of Object.entries(results)) {
      if (data.length > 0) {
        statistics[tagName] = await statisticalAnalysisService.calculateStatistics(tagName, properTimeRange.startTime, properTimeRange.endTime, data);
      }
    }
    response.statistics = statistics;
  }

  res.json(response);
}));

/**
 * GET /api/data/:tagName/trend
 * Get trend analysis for a specific tag
 */
router.get('/:tagName/trend', asyncHandler(async (req: Request, res: Response) => {
  const { tagName } = req.params;

  if (!tagName) {
    throw createError('Tag name is required', 400);
  }

  // Validate query parameters
  const timeRangeResult = timeRangeSchema.safeParse(req.query);
  if (!timeRangeResult.success) {
    throw createError('Invalid time range parameters', 400);
  }

  const timeRange: TimeRange = {
    startTime: timeRangeResult.data.startTime,
    endTime: timeRangeResult.data.endTime,
    relativeRange: timeRangeResult.data.relativeRange
  };
  const windowSize = parseInt(req.query.windowSize as string) || 10;

  apiLogger.info('Calculating trend analysis for tag', { tagName, timeRange, windowSize });

  // Get data
  const dataRetrievalService = cacheManager.getDataRetrievalService();
  const statisticalAnalysisService = cacheManager.getStatisticalAnalysisService();
  const data = await dataRetrievalService.getTimeSeriesData(tagName, timeRange);

  if (data.length < 2) {
    throw createError('Insufficient data points for trend analysis (minimum 2 required)', 400);
  }

  // Calculate trend line
  const trendLine = statisticalAnalysisService.calculateTrendLine(data);

  // Calculate moving average
  const movingAverage = statisticalAnalysisService.calculateMovingAverage(data, windowSize);

  // Detect pattern changes
  let patternChanges;
  if (data.length >= windowSize * 2) {
    patternChanges = statisticalAnalysisService.detectPatternChanges(data, { windowSize });
  }

  res.json({
    success: true,
    tagName,
    timeRange,
    dataPoints: data.length,
    trendLine,
    movingAverage: {
      windowSize,
      data: movingAverage
    },
    ...(patternChanges && {
      patternChanges: {
        count: patternChanges.length,
        detected: patternChanges
      }
    })
  });
}));

export default router;