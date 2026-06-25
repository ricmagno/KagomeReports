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
import { TimeRange, DataFilter, HistorianQueryOptions, RetrievalMode, TimeSeriesData } from '@/types/historian';

const router = Router();

// Validation schemas
const timeRangeSchema = z.object({
  startTime: z.string().datetime().transform(str => new Date(str)),
  endTime: z.string().datetime().transform(str => new Date(str)),
  relativeRange: z.enum(['last1h', 'last2h', 'last6h', 'last12h', 'last24h', 'last7d', 'last30d']).optional(),
  timezone: z.string().optional()
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
  mode: z.nativeEnum(RetrievalMode).default(RetrievalMode.Delta),
  retrievalMode: z.string().optional().transform(val => {
    if (!val) return undefined;
    // Map frontend values to backend RetrievalMode enum values
    if (val === 'Delta') return RetrievalMode.Delta;
    if (val === 'Cyclic') return RetrievalMode.Cyclic;
    if (val === 'AVG' || val === 'Average') return RetrievalMode.Average;
    if (val === 'RoundTrip' || val === 'Full') return RetrievalMode.Full;
    if (val === 'BestFit') return RetrievalMode.BestFit;
    if (val === 'Minimum') return RetrievalMode.Minimum;
    if (val === 'Maximum') return RetrievalMode.Maximum;
    if (val === 'Interpolated') return RetrievalMode.Interpolated;
    if (val === 'ValueState') return RetrievalMode.ValueState;
    if (val === 'Live') return RetrievalMode.Live;
    return val as RetrievalMode; // Pass through if it's already a valid enum value
  }),
  interval: z.number().positive().optional(),
  tolerance: z.number().positive().optional(),
  maxPoints: z.preprocess((val) => val === undefined ? undefined : Number(val), z.number().positive().max(1000000000000).optional()),
  limit: z.preprocess((val) => val === undefined ? undefined : Number(val), z.number().positive().max(1000000000000).optional()),
  includeQuality: z.preprocess((val) => val === 'false' ? false : true, z.boolean().default(true)),
  qualityFilter: z.preprocess((val) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch (e) {
        return undefined;
      }
    }
    return val;
  }, z.array(z.number()).optional())
}).transform(data => {
  // If retrievalMode is provided, use it instead of mode
  if (data.retrievalMode !== undefined) {
    return { ...data, mode: data.retrievalMode };
  }
  return data;
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
 * GET /api/data/quality-codes
 * Get human-readable meanings for all Historian quality codes
 */
router.get('/quality-codes', asyncHandler(async (req: Request, res: Response) => {
  const { QUALITY_MEANINGS } = require('@/utils/qualityUtils');
  
  res.json({
    success: true,
    data: QUALITY_MEANINGS
  });
}));

/**
 * GET /api/data/tags/:tagName
 * Get metadata for a specific tag
 */
router.get('/tags/:tagName', asyncHandler(async (req: Request, res: Response) => {
  const { tagName } = req.params;

  if (!tagName) {
    throw createError('Tag name is required', 400);
  }

  apiLogger.info('Retrieving tag info', { tagName });

  const dataRetrievalService = cacheManager.getDataRetrievalService();
  const tagInfo = await dataRetrievalService.getTagInfo(tagName);

  if (!tagInfo) {
    throw createError(`Tag ${tagName} not found`, 404);
  }

  res.json({
    success: true,
    data: tagInfo
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
        relativeRange: timeRangeResult.data.relativeRange,
        timezone: timeRangeResult.data.timezone
      };
      const options: HistorianQueryOptions = {
        ...optionsResult.data,
        maxPoints: optionsResult.data.maxPoints || optionsResult.data.limit
      };

      apiLogger.info('Retrieving time-series data', { tagName, timeRange, options });

      progressTracker?.updateProgress('validation', 10, 'Parameters validated');

      const dataRetrievalService = cacheManager.getDataRetrievalService();
      const statisticalAnalysisService = cacheManager.getStatisticalAnalysisService();
      
      // Step: Intercept Advanced Filters for IS_MAX/IS_MIN optimization
      const advancedFiltersRaw = req.query.advancedFilters;
      let hasIsMaxOrMin = false;
      if (advancedFiltersRaw && typeof advancedFiltersRaw === 'string') {
        try {
          const parsed = JSON.parse(advancedFiltersRaw);
          const hasOperator = (op: string, obj: any): boolean => {
            if (!obj) return false;
            if (obj.comparison && obj.comparison.operator === op) return true;
            if (obj.conditions && Array.isArray(obj.conditions)) {
              return obj.conditions.some((c: any) => hasOperator(op, c));
            }
            return false;
          };
          if (hasOperator('IS_MAX', parsed)) {
            options.orderBy = 'Value DESC, DateTime DESC'; // In case of tie, latest point wins
            options.limit = 1;
            options.maxPoints = 1;
            hasIsMaxOrMin = true;
          } else if (hasOperator('IS_MIN', parsed)) {
            options.orderBy = 'Value ASC, DateTime DESC'; // In case of tie, latest point wins
            options.limit = 1;
            options.maxPoints = 1;
            hasIsMaxOrMin = true;
          }
        } catch (e) {
          apiLogger.warn('Failed to parse advancedFilters for pre-optimization', { error: e });
        }
      }

      const data = await dataRetrievalService.getTimeSeriesData(
        tagName,
        timeRange,
        options,
        progressTracker?.operationId
      );
      
      // Step: Apply Advanced Filters if present
      let filteredData = data;
      if (advancedFiltersRaw && typeof advancedFiltersRaw === 'string' && !hasIsMaxOrMin) {
        try {
          const advancedFilters = JSON.parse(advancedFiltersRaw);
          if (advancedFilters && (advancedFilters.logicalOperator || advancedFilters.comparison)) {
            apiLogger.info('Applying advanced filters to retrieved data', { tagName, filterCount: advancedFilters.conditions?.length });
            
            // Precompute tag limits for IS_MAX and IS_MIN operators
            const tagLimits = new Map<string, { min: number, max: number }>();
            for (const point of data) {
              if (point.value === null || point.value === undefined || isNaN(point.value) || !isFinite(point.value)) {
                continue;
              }
              const limits = tagLimits.get(point.tagName);
              if (!limits) {
                tagLimits.set(point.tagName, { min: point.value, max: point.value });
              } else {
                if (point.value < limits.min) limits.min = point.value;
                if (point.value > limits.max) limits.max = point.value;
              }
            }

            filteredData = data.filter(point => dataFilteringService.evaluateCondition(point, advancedFilters, tagLimits));
            apiLogger.info('Filtering complete', { tagName, originalCount: data.length, filteredCount: filteredData.length });
          }
        } catch (parseError) {
          apiLogger.warn('Failed to parse advancedFilters from query', { error: parseError });
          // Continue with unfiltered data or throw? Let's continue for resilience
        }
      }
      
      // Calculate basic statistics if requested
      const includeStats = req.query.includeStats === 'true';
      let statistics;
      if (includeStats && filteredData.length > 0) {
        progressTracker?.updateProgress('analysis', 90, 'Calculating statistics');
        statistics = await statisticalAnalysisService.calculateStatistics(
          tagName,
          timeRange.startTime,
          timeRange.endTime,
          filteredData
        );
      }

      progressTracker?.completeOperation(`Retrieved ${filteredData.length} data points`);

      res.json({
        success: true,
        data: filteredData,
        count: filteredData.length,
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

  // Execute data query
  const dataRetrievalService = cacheManager.getDataRetrievalService();
  const statisticalAnalysisService = cacheManager.getStatisticalAnalysisService();

  let result;
  if (options && filter.tagNames && filter.tagNames.length > 0) {
    // If specific options (like mode or limit) are provided, use the optimized multi-tag retriever
    const rawDataMap = await dataRetrievalService.getMultipleTimeSeriesData(
      filter.tagNames,
      timeRange,
      options
    );

    // Flatten results to match the expected format (flat array of TimeSeriesData)
    const flattenedData: TimeSeriesData[] = [];
    Object.values(rawDataMap).forEach(tagData => {
      flattenedData.push(...tagData);
    });

    // Sort by timestamp to ensure consistent display in charts
    flattenedData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    result = {
      data: flattenedData,
      totalCount: flattenedData.length,
      hasMore: false
    };
  } else {
    // Default to the standard filtered query
    result = await dataRetrievalService.getFilteredData(
      timeRange,
      filter,
      pagination?.pageSize || 100,
      pagination?.cursor
    );
  }

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

  const dataRetrievalService = cacheManager.getDataRetrievalService();
  const statisticalAnalysisService = cacheManager.getStatisticalAnalysisService();

  // Calculate comprehensive statistics using SQL standard aggregates (AVG, MIN, MAX, STDEV)
  // This fulfills the requirement to use SQL standard approach
  const statistics = await dataRetrievalService.getStatistics(tagName, timeRange);

  // Still fetch data for quality metrics and trend analysis if needed
  // or use the SQL computed ones
  const data = await dataRetrievalService.getTimeSeriesData(tagName, timeRange, { mode: RetrievalMode.Cyclic, maxPoints: 1000 });

  let trend;
  if (data.length >= 2) {
    trend = statisticalAnalysisService.calculateTrendLine(data);
  }

  let anomalies;
  if (data.length >= 3) {
    const threshold = parseFloat(req.query.anomalyThreshold as string) || 2.0;
    anomalies = statisticalAnalysisService.detectAnomalies(data, threshold);
  }

  res.json({
    success: true,
    data: {
      ...statistics,
      trend,
      anomalies: anomalies ? { count: anomalies.length, detected: anomalies } : undefined,
      dataPoints: data.length
    },
    tagName,
    timeRange
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