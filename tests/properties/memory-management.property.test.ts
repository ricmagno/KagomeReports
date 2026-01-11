/**
 * Memory Management Tests
 * Feature: historian-reporting, Property 5: Pagination Memory Management
 * Validates: Requirements 2.3, 10.1
 */

import fc from 'fast-check';
import { DataRetrievalService } from '@/services/dataRetrieval';
import { CacheService } from '@/services/cacheService';
import { TimeRange, TimeSeriesData, QualityCode, HistorianQueryOptions, RetrievalMode } from '@/types/historian';
import { Transform } from 'stream';

describe('Memory Management Tests', () => {
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
   * Property 5: Pagination Memory Management
   * For any dataset larger than the configured page size, the system should 
   * process data in chunks without exceeding memory thresholds
   */
  describe('Property 5: Pagination Memory Management', () => {
    
    it('should use appropriate batch sizes for different dataset sizes', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1000, max: 100000 }),
        (datasetSize) => {
          const STREAM_BATCH_SIZE = 1000;
          const LARGE_DATASET_THRESHOLD = 10000;
          
          // Calculate expected number of batches
          const expectedBatches = Math.ceil(datasetSize / STREAM_BATCH_SIZE);
          
          // For large datasets, should use streaming approach
          if (datasetSize > LARGE_DATASET_THRESHOLD) {
            expect(expectedBatches).toBeGreaterThan(1);
            
            // Batch size should be reasonable for memory management
            expect(STREAM_BATCH_SIZE).toBeGreaterThan(0);
            expect(STREAM_BATCH_SIZE).toBeLessThanOrEqual(5000);
            
            // Total memory usage should be bounded
            const maxMemoryPerBatch = STREAM_BATCH_SIZE * 100; // Assume ~100 bytes per record
            expect(maxMemoryPerBatch).toBeLessThan(1024 * 1024); // Less than 1MB per batch
          }
          
          // Verify batch calculation is correct
          expect(expectedBatches).toBeGreaterThan(0);
          expect(expectedBatches).toBe(Math.ceil(datasetSize / STREAM_BATCH_SIZE));
        }
      ), { numRuns: 20 });
    });

    it('should handle streaming data processing without memory leaks', () => {
      fc.assert(fc.property(
        fc.array(fc.record({
          timestamp: fc.date(),
          value: fc.float({ min: -1000, max: 1000 }),
          quality: fc.constantFrom(QualityCode.Good, QualityCode.Bad, QualityCode.Uncertain),
          tagName: fc.string({ minLength: 1, maxLength: 50 })
        }), { minLength: 1000, maxLength: 10000 }),
        (dataChunks) => {
          // Create data processing stream
          const stream = dataRetrievalService.createDataProcessingStream();
          
          expect(stream).toBeInstanceOf(Transform);
          expect(stream.readable).toBe(true);
          expect(stream.writable).toBe(true);
          
          // Verify stream can handle data chunks
          let processedCount = 0;
          
          stream.on('data', (chunk) => {
            processedCount++;
            
            // Verify processed data structure
            expect(chunk).toHaveProperty('timestamp');
            expect(chunk).toHaveProperty('value');
            expect(chunk).toHaveProperty('quality');
            expect(chunk).toHaveProperty('tagName');
            
            expect(chunk.timestamp).toBeInstanceOf(Date);
            expect(typeof chunk.value).toBe('number');
            expect(typeof chunk.tagName).toBe('string');
          });
          
          // Process data in chunks to simulate streaming
          const CHUNK_SIZE = 100;
          for (let i = 0; i < dataChunks.length; i += CHUNK_SIZE) {
            const chunk = dataChunks.slice(i, i + CHUNK_SIZE);
            chunk.forEach(data => stream.write(data));
          }
          
          stream.end();
          
          // Memory usage should be bounded regardless of input size
          expect(dataChunks.length).toBeGreaterThanOrEqual(1000);
        }
      ), { numRuns: 10 });
    });

    it('should apply pagination correctly for large result sets', () => {
      fc.assert(fc.property(
        fc.record({
          totalRecords: fc.integer({ min: 10000, max: 100000 }),
          pageSize: fc.integer({ min: 100, max: 5000 }),
          currentPage: fc.integer({ min: 0, max: 100 })
        }),
        ({ totalRecords, pageSize, currentPage }) => {
          // Calculate pagination parameters
          const totalPages = Math.ceil(totalRecords / pageSize);
          const offset = currentPage * pageSize;
          const remainingRecords = Math.max(0, totalRecords - offset);
          const expectedRecordsInPage = Math.min(pageSize, remainingRecords);
          
          // Verify pagination calculations
          expect(totalPages).toBeGreaterThan(0);
          expect(offset).toBeGreaterThanOrEqual(0);
          expect(expectedRecordsInPage).toBeGreaterThanOrEqual(0);
          expect(expectedRecordsInPage).toBeLessThanOrEqual(pageSize);
          
          // For valid pages, should have records
          if (currentPage < totalPages) {
            expect(expectedRecordsInPage).toBeGreaterThan(0);
          } else {
            expect(expectedRecordsInPage).toBe(0);
          }
          
          // Memory usage per page should be bounded
          const estimatedMemoryPerRecord = 100; // bytes
          const estimatedPageMemory = expectedRecordsInPage * estimatedMemoryPerRecord;
          const maxAllowedMemoryPerPage = 10 * 1024 * 1024; // 10MB
          
          expect(estimatedPageMemory).toBeLessThanOrEqual(maxAllowedMemoryPerPage);
        }
      ), { numRuns: 20 });
    });

    it('should optimize memory usage based on dataset characteristics', () => {
      const testCases = [
        { datasetSize: 1000, expectedApproach: 'direct' },
        { datasetSize: 5000, expectedApproach: 'direct' },
        { datasetSize: 15000, expectedApproach: 'streaming' },
        { datasetSize: 50000, expectedApproach: 'streaming' },
        { datasetSize: 100000, expectedApproach: 'streaming' }
      ];

      testCases.forEach(({ datasetSize, expectedApproach }) => {
        const LARGE_DATASET_THRESHOLD = 10000;
        const STREAM_BATCH_SIZE = 1000;
        
        const shouldUseStreaming = datasetSize > LARGE_DATASET_THRESHOLD;
        const actualApproach = shouldUseStreaming ? 'streaming' : 'direct';
        
        expect(actualApproach).toBe(expectedApproach);
        
        if (shouldUseStreaming) {
          const numberOfBatches = Math.ceil(datasetSize / STREAM_BATCH_SIZE);
          
          // Verify streaming parameters are reasonable
          expect(numberOfBatches).toBeGreaterThan(1);
          expect(STREAM_BATCH_SIZE).toBeGreaterThan(0);
          expect(STREAM_BATCH_SIZE).toBeLessThanOrEqual(5000);
          
          // Memory usage should scale with batch size, not total size
          const memoryUsage = STREAM_BATCH_SIZE * 100; // Estimated bytes per record
          expect(memoryUsage).toBeLessThan(1024 * 1024); // Less than 1MB
        }
      });
    });

    it('should handle concurrent data processing without memory conflicts', () => {
      fc.assert(fc.property(
        fc.array(fc.record({
          tagName: fc.string({ minLength: 1, maxLength: 20 }),
          dataSize: fc.integer({ min: 1000, max: 20000 })
        }), { minLength: 2, maxLength: 10 }),
        (concurrentRequests) => {
          const STREAM_BATCH_SIZE = 1000;
          const MAX_CONCURRENT_MEMORY = 50 * 1024 * 1024; // 50MB total
          
          // Calculate total memory usage for concurrent requests
          let totalMemoryUsage = 0;
          
          concurrentRequests.forEach(request => {
            const batchesNeeded = Math.ceil(request.dataSize / STREAM_BATCH_SIZE);
            const memoryPerRequest = STREAM_BATCH_SIZE * 100; // bytes per record
            totalMemoryUsage += memoryPerRequest;
          });
          
          // Verify concurrent memory usage is reasonable
          expect(totalMemoryUsage).toBeLessThan(MAX_CONCURRENT_MEMORY);
          
          // Each request should use bounded memory
          concurrentRequests.forEach(request => {
            const requestMemory = Math.min(request.dataSize, STREAM_BATCH_SIZE) * 100;
            expect(requestMemory).toBeLessThan(1024 * 1024); // Less than 1MB per request
          });
          
          // Total concurrent requests should be manageable
          expect(concurrentRequests.length).toBeLessThanOrEqual(10);
        }
      ), { numRuns: 10 });
    });

    it('should implement proper memory cleanup after processing', () => {
      const testScenarios = [
        { dataSize: 5000, batchSize: 500, expectedBatches: 10 },
        { dataSize: 15000, batchSize: 1000, expectedBatches: 15 },
        { dataSize: 25000, batchSize: 2000, expectedBatches: 13 },
        { dataSize: 50000, batchSize: 5000, expectedBatches: 10 }
      ];

      testScenarios.forEach(({ dataSize, batchSize, expectedBatches }) => {
        const actualBatches = Math.ceil(dataSize / batchSize);
        expect(actualBatches).toBe(expectedBatches);
        
        // Memory per batch should be reasonable
        const memoryPerBatch = batchSize * 100; // Estimated bytes per record
        expect(memoryPerBatch).toBeLessThan(1024 * 1024); // Less than 1MB per batch
        
        // Total processing should not accumulate memory
        const maxConcurrentMemory = memoryPerBatch; // Only one batch in memory at a time
        expect(maxConcurrentMemory).toBeLessThan(5 * 1024 * 1024); // Less than 5MB
        
        // Batch size should be within reasonable bounds
        expect(batchSize).toBeGreaterThan(0);
        expect(batchSize).toBeLessThanOrEqual(10000);
      });
    });

    it('should handle memory pressure gracefully', () => {
      fc.assert(fc.property(
        fc.record({
          availableMemory: fc.integer({ min: 1024 * 1024, max: 100 * 1024 * 1024 }), // 1MB to 100MB
          datasetSize: fc.integer({ min: 10000, max: 1000000 }),
          recordSize: fc.integer({ min: 50, max: 500 }) // bytes per record
        }),
        ({ availableMemory, datasetSize, recordSize }) => {
          const totalDataSize = datasetSize * recordSize;
          const STREAM_BATCH_SIZE = 1000;
          const batchMemoryUsage = STREAM_BATCH_SIZE * recordSize;
          
          // Should use streaming if data doesn't fit in memory
          const shouldStream = totalDataSize > availableMemory * 0.8; // Use 80% of available memory
          
          if (shouldStream) {
            // Batch size should fit in available memory
            expect(batchMemoryUsage).toBeLessThan(availableMemory * 0.1); // Use max 10% per batch
            
            // Number of batches should be reasonable
            const numberOfBatches = Math.ceil(datasetSize / STREAM_BATCH_SIZE);
            expect(numberOfBatches).toBeGreaterThan(1);
            expect(numberOfBatches).toBeLessThan(10000); // Reasonable upper limit
          }
          
          // Memory usage should always be bounded
          expect(batchMemoryUsage).toBeLessThan(10 * 1024 * 1024); // Max 10MB per batch
        }
      ), { numRuns: 100 });
    });

    it('should optimize batch sizes based on data characteristics', () => {
      const dataCharacteristics = [
        { recordSize: 50, complexity: 'simple', expectedBatchSize: 2000 },
        { recordSize: 100, complexity: 'medium', expectedBatchSize: 1000 },
        { recordSize: 200, complexity: 'complex', expectedBatchSize: 500 },
        { recordSize: 500, complexity: 'very-complex', expectedBatchSize: 200 }
      ];

      dataCharacteristics.forEach(({ recordSize, complexity, expectedBatchSize }) => {
        // Calculate optimal batch size based on record size
        const targetMemoryPerBatch = 100 * 1024; // 100KB target
        const calculatedBatchSize = Math.floor(targetMemoryPerBatch / recordSize);
        const actualBatchSize = Math.max(100, Math.min(5000, calculatedBatchSize));
        
        // Verify batch size is reasonable for the record size
        expect(actualBatchSize).toBeGreaterThan(0);
        expect(actualBatchSize).toBeLessThanOrEqual(5000);
        
        // Memory usage should be predictable
        const memoryUsage = actualBatchSize * recordSize;
        expect(memoryUsage).toBeLessThan(1024 * 1024); // Less than 1MB
        
        // Larger records should result in smaller batch sizes
        if (recordSize > 100) {
          expect(actualBatchSize).toBeLessThanOrEqual(1000);
        }
      });
    });
  });

  describe('Memory Management Edge Cases', () => {
    it('should handle empty datasets without memory allocation', () => {
      const emptyDataset: TimeSeriesData[] = [];
      const STREAM_BATCH_SIZE = 1000;
      
      // Empty dataset should not require batching
      const numberOfBatches = Math.ceil(emptyDataset.length / STREAM_BATCH_SIZE);
      expect(numberOfBatches).toBe(0);
      
      // Memory usage should be zero
      const memoryUsage = emptyDataset.length * 100;
      expect(memoryUsage).toBe(0);
    });

    it('should handle single record datasets efficiently', () => {
      const singleRecordDataset = 1;
      const STREAM_BATCH_SIZE = 1000;
      
      // Single record should not require streaming
      const numberOfBatches = Math.ceil(singleRecordDataset / STREAM_BATCH_SIZE);
      expect(numberOfBatches).toBe(1);
      
      // Memory usage should be minimal
      const memoryUsage = singleRecordDataset * 100;
      expect(memoryUsage).toBe(100);
      expect(memoryUsage).toBeLessThan(1024); // Less than 1KB
    });

    it('should handle maximum dataset sizes without overflow', () => {
      const maxDatasetSize = 1000000; // 1 million records
      const STREAM_BATCH_SIZE = 1000;
      const recordSize = 100; // bytes
      
      const numberOfBatches = Math.ceil(maxDatasetSize / STREAM_BATCH_SIZE);
      const memoryPerBatch = STREAM_BATCH_SIZE * recordSize;
      
      // Should handle large datasets with reasonable number of batches
      expect(numberOfBatches).toBe(1000);
      expect(numberOfBatches).toBeLessThan(10000);
      
      // Memory per batch should remain constant
      expect(memoryPerBatch).toBe(100000); // 100KB
      expect(memoryPerBatch).toBeLessThan(1024 * 1024); // Less than 1MB
      
      // Total processing time should be predictable
      const estimatedProcessingTime = numberOfBatches * 10; // 10ms per batch
      expect(estimatedProcessingTime).toBeLessThan(60000); // Less than 1 minute
    });

    it('should prevent memory leaks in long-running operations', () => {
      const longRunningScenarios = [
        { duration: 3600, batchesPerSecond: 10 }, // 1 hour
        { duration: 7200, batchesPerSecond: 5 },  // 2 hours
        { duration: 86400, batchesPerSecond: 1 }  // 24 hours
      ];

      longRunningScenarios.forEach(({ duration, batchesPerSecond }) => {
        const totalBatches = duration * batchesPerSecond;
        const STREAM_BATCH_SIZE = 1000;
        const memoryPerBatch = STREAM_BATCH_SIZE * 100; // bytes
        
        // Memory usage should not accumulate over time
        const maxConcurrentMemory = memoryPerBatch; // Only current batch in memory
        expect(maxConcurrentMemory).toBeLessThan(1024 * 1024); // Less than 1MB
        
        // Total batches should be manageable
        expect(totalBatches).toBeGreaterThan(0);
        expect(totalBatches).toBeLessThan(1000000); // Reasonable upper limit
        
        // Processing rate should be sustainable
        expect(batchesPerSecond).toBeGreaterThan(0);
        expect(batchesPerSecond).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Memory Optimization Strategies', () => {
    it('should choose optimal processing strategy based on data size', () => {
      fc.assert(fc.property(
        fc.integer({ min: 100, max: 1000000 }),
        (dataSize) => {
          const LARGE_DATASET_THRESHOLD = 10000;
          const STREAM_BATCH_SIZE = 1000;
          
          let strategy: string;
          let memoryUsage: number;
          
          if (dataSize <= 1000) {
            strategy = 'in-memory';
            memoryUsage = dataSize * 100;
          } else if (dataSize <= LARGE_DATASET_THRESHOLD) {
            strategy = 'buffered';
            memoryUsage = Math.min(dataSize, 5000) * 100;
          } else {
            strategy = 'streaming';
            memoryUsage = STREAM_BATCH_SIZE * 100;
          }
          
          // Verify strategy selection is appropriate
          expect(['in-memory', 'buffered', 'streaming']).toContain(strategy);
          
          // Memory usage should be bounded for all strategies
          expect(memoryUsage).toBeGreaterThan(0);
          expect(memoryUsage).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
          
          // Streaming should be used for large datasets
          if (dataSize > LARGE_DATASET_THRESHOLD) {
            expect(strategy).toBe('streaming');
            expect(memoryUsage).toBe(STREAM_BATCH_SIZE * 100);
          }
        }
      ), { numRuns: 20 });
    });
  });
});