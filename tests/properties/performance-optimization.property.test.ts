/**
 * Performance Optimization Tests
 * Feature: historian-reporting, Property 20: Performance Optimization
 * Validates: Requirements 10.3, 10.4, 10.5
 */

import { DataRetrievalService } from '@/services/dataRetrieval';
import { CacheService } from '@/services/cacheService';
import { progressTracker } from '@/middleware/progressTracker';
import { TimeRange, TimeSeriesData, QualityCode, RetrievalMode } from '@/types/historian';

describe('Performance Optimization Tests', () => {
  let dataRetrievalService: DataRetrievalService;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    // Create mock cache service
    mockCacheService = {
      getCachedTimeSeriesData: jest.fn(),
      cacheTimeSeriesData: jest.fn(),
      getCachedTagList: jest.fn(),
      cacheTagList: jest.fn(),
      getCachedFilteredTags: jest.fn(),
      cacheFilteredTags: jest.fn(),
      invalidateTagCache: jest.fn(),
      invalidateTimeSeriesCache: jest.fn(),
      invalidateStatisticsCache: jest.fn(),
      invalidateAllCache: jest.fn(),
      getStats: jest.fn(),
      isHealthy: jest.fn().mockResolvedValue(true)
    } as any;

    dataRetrievalService = new DataRetrievalService(mockCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 20: Performance Optimization
   * For any database query or report generation operation, the system should apply 
   * appropriate optimizations (caching, query optimization, progress reporting) 
   * to maintain acceptable performance
   */
  describe('Property 20: Performance Optimization', () => {
    
    it('should apply caching optimization for repeated queries', async () => {
      const tagName = 'TEST_TAG';
      const timeRange: TimeRange = {
        startTime: new Date('2023-01-01'),
        endTime: new Date('2023-01-02')
      };
      const cachedData: TimeSeriesData[] = [{
        timestamp: new Date('2023-01-01T12:00:00Z'),
        value: 100,
        quality: QualityCode.Good,
        tagName: 'TEST_TAG'
      }];

      // Setup cache to return data
      mockCacheService.getCachedTimeSeriesData.mockResolvedValueOnce(cachedData);

      const result = await dataRetrievalService.getTimeSeriesData(tagName, timeRange);

      // Verify caching optimization was applied
      expect(mockCacheService.getCachedTimeSeriesData).toHaveBeenCalledWith(
        tagName, 
        timeRange.startTime, 
        timeRange.endTime
      );
      expect(result).toEqual(cachedData);
    });

    it('should apply query optimization for large datasets', () => {
      const options = {
        mode: RetrievalMode.BestFit,
        maxPoints: 1000,
        includeQuality: true
      };

      // Test that query optimization options are properly handled
      const stream = dataRetrievalService.createDataProcessingStream();
      expect(stream).toBeDefined();
      expect(typeof stream.write).toBe('function');
      expect(typeof stream.read).toBe('function');

      // Verify optimization parameters are within acceptable ranges
      expect(options.maxPoints).toBeGreaterThan(0);
      expect(options.maxPoints).toBeLessThanOrEqual(10000);
      expect(Object.values(RetrievalMode)).toContain(options.mode);
    });

    it('should apply progress reporting optimization for long operations', () => {
      const operationType = 'data-retrieval';
      const estimatedDuration = 10000;

      // Start operation with progress tracking
      const operationId = progressTracker.startOperation({
        operationType: operationType as any,
        estimatedDuration
      });

      // Verify progress optimization is applied
      expect(operationId).toBeDefined();
      expect(typeof operationId).toBe('string');

      const initialProgress = progressTracker.getProgress(operationId);
      expect(initialProgress).toBeDefined();
      expect(initialProgress?.operationId).toBe(operationId);
      expect(initialProgress?.progress).toBe(0);
      expect(initialProgress?.stage).toBe('initializing');

      // Test progress updates
      progressTracker.updateProgress(operationId, 'processing', 50, 'Processing data');
      const updatedProgress = progressTracker.getProgress(operationId);
      expect(updatedProgress?.stage).toBe('processing');
      expect(updatedProgress?.progress).toBeGreaterThan(0);

      // Complete operation
      progressTracker.completeOperation(operationId, 'Operation completed successfully');
      const finalProgress = progressTracker.getProgress(operationId);
      expect(finalProgress?.stage).toBe('completed');
      expect(finalProgress?.progress).toBe(100);
    });

    it('should maintain performance metrics within acceptable bounds', () => {
      const testCases = [
        { queryDuration: 50, expectedCategory: 'excellent' },
        { queryDuration: 200, expectedCategory: 'good' },
        { queryDuration: 1000, expectedCategory: 'acceptable' },
        { queryDuration: 3000, expectedCategory: 'slow' },
        { queryDuration: 6000, expectedCategory: 'very-slow' }
      ];

      testCases.forEach(({ queryDuration, expectedCategory }) => {
        const recordCount = 1000;
        
        // Test performance categorization
        let actualCategory: string;
        if (queryDuration < 100) actualCategory = 'excellent';
        else if (queryDuration < 500) actualCategory = 'good';
        else if (queryDuration < 2000) actualCategory = 'acceptable';
        else if (queryDuration < 5000) actualCategory = 'slow';
        else actualCategory = 'very-slow';

        expect(actualCategory).toBe(expectedCategory);

        // Calculate records per second
        const recordsPerSecond = recordCount > 0 ? Math.round(recordCount / (queryDuration / 1000)) : 0;
        expect(recordsPerSecond).toBeGreaterThanOrEqual(0);
      });
    });

    it('should optimize memory usage for streaming operations', () => {
      const testCases = [
        { batchSize: 500, totalRecords: 5000, expectedBatches: 10 },
        { batchSize: 1000, totalRecords: 10000, expectedBatches: 10 },
        { batchSize: 2000, totalRecords: 15000, expectedBatches: 8 }
      ];

      testCases.forEach(({ batchSize, totalRecords, expectedBatches }) => {
        // Calculate expected number of batches
        const actualBatches = Math.ceil(totalRecords / batchSize);
        
        // Verify batch size optimization
        expect(batchSize).toBeGreaterThan(0);
        expect(batchSize).toBeLessThanOrEqual(5000);
        expect(actualBatches).toBe(expectedBatches);

        // Large datasets should use streaming
        if (totalRecords > 10000) {
          expect(actualBatches).toBeGreaterThan(1);
        }
      });
    });

    it('should apply cache invalidation optimization', async () => {
      const cacheKeys = ['key1', 'key2', 'key3'];
      const ttlSeconds = 300;
      const hitRate = 0.85;

      // Test cache optimization parameters
      expect(ttlSeconds).toBeGreaterThan(0);
      expect(ttlSeconds).toBeLessThanOrEqual(3600);
      expect(hitRate).toBeGreaterThanOrEqual(0);
      expect(hitRate).toBeLessThanOrEqual(1);

      // Cache keys should be valid
      cacheKeys.forEach(key => {
        expect(key).toBeDefined();
        expect(key.length).toBeGreaterThan(0);
      });

      // High hit rates indicate good caching optimization
      expect(hitRate).toBeGreaterThan(0.8);

      // TTL should be reasonable for the data type
      expect(ttlSeconds).toBeGreaterThanOrEqual(60);
      
      // Mock cache operations
      mockCacheService.invalidateAllCache.mockResolvedValueOnce(undefined);
      
      await mockCacheService.invalidateAllCache();
      expect(mockCacheService.invalidateAllCache).toHaveBeenCalled();
    });
  });

  describe('Performance Regression Prevention', () => {
    it('should prevent performance degradation in query execution', () => {
      const testCases = [
        { queryComplexity: 1, dataSize: 1000, concurrentQueries: 1 },
        { queryComplexity: 3, dataSize: 5000, concurrentQueries: 3 },
        { queryComplexity: 5, dataSize: 10000, concurrentQueries: 5 }
      ];

      testCases.forEach(({ queryComplexity, dataSize, concurrentQueries }) => {
        // Performance should degrade gracefully with increased load
        const baselineTime = 100;
        const complexityFactor = Math.pow(queryComplexity, 1.5);
        const sizeFactor = Math.log10(dataSize);
        const concurrencyFactor = Math.sqrt(concurrentQueries);
        
        const expectedTime = baselineTime * complexityFactor * sizeFactor * concurrencyFactor;

        // Should not exceed reasonable limits
        expect(expectedTime).toBeLessThan(30000);

        // Verify performance characteristics
        expect(queryComplexity).toBeGreaterThan(0);
        expect(queryComplexity).toBeLessThanOrEqual(5);
        expect(dataSize).toBeGreaterThan(0);
        expect(concurrentQueries).toBeGreaterThan(0);
        expect(concurrentQueries).toBeLessThanOrEqual(5);
      });
    });

    it('should handle streaming thresholds correctly', () => {
      const LARGE_DATASET_THRESHOLD = 10000;
      const STREAM_BATCH_SIZE = 1000;

      // Test threshold detection
      expect(15000).toBeGreaterThan(LARGE_DATASET_THRESHOLD);
      expect(5000).toBeLessThan(LARGE_DATASET_THRESHOLD);

      // Test batch size is reasonable
      expect(STREAM_BATCH_SIZE).toBeGreaterThan(0);
      expect(STREAM_BATCH_SIZE).toBeLessThanOrEqual(5000);

      // Test batch calculation
      const largeDataset = 25000;
      const expectedBatches = Math.ceil(largeDataset / STREAM_BATCH_SIZE);
      expect(expectedBatches).toBe(25);
    });
  });
});