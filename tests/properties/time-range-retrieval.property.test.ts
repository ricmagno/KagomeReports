/**
 * Property-Based Tests for Time Range Data Retrieval
 * Feature: historian-reporting, Property 2: Time Range Data Retrieval
 * Validates: Requirements 2.1
 */

import fc from 'fast-check';
import { DataRetrievalService } from '@/services/dataRetrieval';
import { TimeRange, TimeSeriesData, QualityCode } from '@/types/historian';

// Mock the historian connection
jest.mock('@/services/historianConnection', () => ({
  getHistorianConnection: jest.fn().mockReturnValue({
    executeQuery: jest.fn()
  })
}));

jest.mock('@/utils/logger', () => ({
  dbLogger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

// Generators for time ranges
const validTimeRangeGen = fc.record({
  startTime: fc.date({ min: new Date('2020-01-01'), max: new Date('2023-11-01') }),
  endTime: fc.date({ min: new Date('2020-01-02'), max: new Date('2023-12-01') })
}).filter(range => {
  if (range.startTime >= range.endTime) return false;
  
  // Ensure the range is less than 1 year
  const maxDuration = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
  const duration = range.endTime.getTime() - range.startTime.getTime();
  return duration < maxDuration;
});

// Generator for tag names
const validTagNameGen = fc.string({ minLength: 1, maxLength: 20 })
  .filter(name => /^[a-zA-Z0-9][a-zA-Z0-9_\-\.]*$/.test(name));

// Generator for time-series data
const timeSeriesDataGen = (timeRange: TimeRange) => 
  fc.array(
    fc.record({
      timestamp: fc.date({ 
        min: timeRange.startTime, 
        max: timeRange.endTime 
      }),
      value: fc.float({ min: -1000, max: 1000 }),
      quality: fc.constantFrom(QualityCode.Good, QualityCode.Bad, QualityCode.Uncertain),
      tagName: validTagNameGen
    }),
    { minLength: 0, maxLength: 100 }
  );

describe('Property 2: Time Range Data Retrieval', () => {
  let dataRetrievalService: DataRetrievalService;
  let mockExecuteQuery: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    dataRetrievalService = new DataRetrievalService();
    const { getHistorianConnection } = require('@/services/historianConnection');
    mockExecuteQuery = getHistorianConnection().executeQuery;
  });

  /**
   * Property: For any specified time range, all returned data points should have 
   * timestamps that fall within the start and end boundaries (inclusive)
   */
  test('should return data points within specified time range boundaries', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTimeRangeGen,
        validTagNameGen,
        async (timeRange, tagName) => {
          // Generate mock data that includes some points outside the range
          const allData = await fc.sample(
            fc.array(
              fc.record({
                timestamp: fc.date({ min: new Date('2019-01-01'), max: new Date('2025-01-01') }),
                value: fc.float({ min: -1000, max: 1000 }),
                quality: fc.constantFrom(QualityCode.Good, QualityCode.Bad, QualityCode.Uncertain),
                tagName: fc.constant(tagName)
              }),
              { minLength: 5, maxLength: 50 }
            ),
            1
          );

          // Filter to only include data within the requested range
          const filteredData = allData[0]!.filter(point => 
            point.timestamp >= timeRange.startTime && 
            point.timestamp <= timeRange.endTime
          );

          // Mock the database response
          mockExecuteQuery.mockResolvedValue({
            recordset: filteredData.map(point => ({
              timestamp: point.timestamp,
              value: point.value,
              quality: point.quality,
              tagName: point.tagName
            }))
          });

          // Execute the service method
          const result = await dataRetrievalService.getTimeSeriesData(tagName, timeRange);

          // Verify all returned points are within the time range
          for (const point of result) {
            expect(point.timestamp.getTime()).toBeGreaterThanOrEqual(timeRange.startTime.getTime());
            expect(point.timestamp.getTime()).toBeLessThanOrEqual(timeRange.endTime.getTime());
          }

          // Verify the query was called with correct parameters
          expect(mockExecuteQuery).toHaveBeenCalledWith(
            expect.stringContaining('WHERE TagName = @tagName'),
            expect.objectContaining({
              tagName,
              startTime: timeRange.startTime,
              endTime: timeRange.endTime
            })
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: For any invalid time range (start >= end), the system should reject the request
   */
  test('should reject invalid time ranges', async () => {
    const invalidTimeRangeGen = fc.oneof(
      // Start time equals end time
      fc.date().map(date => ({
        startTime: date,
        endTime: date
      })),
      
      // Start time after end time
      fc.record({
        startTime: fc.date({ min: new Date('2023-01-01'), max: new Date('2023-12-31') }),
        endTime: fc.date({ min: new Date('2020-01-01'), max: new Date('2022-12-31') })
      })
    );

    await fc.assert(
      fc.asyncProperty(
        invalidTimeRangeGen,
        validTagNameGen,
        async (invalidTimeRange, tagName) => {
          // Should throw an error for invalid time range
          await expect(
            dataRetrievalService.getTimeSeriesData(tagName, invalidTimeRange)
          ).rejects.toThrow(/start time must be before end time|time range/i);

          // Should not call the database
          expect(mockExecuteQuery).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Property: For any time range exceeding maximum duration (1 year), 
   * the system should reject the request
   */
  test('should reject time ranges exceeding maximum duration', async () => {
    const oversizedTimeRangeGen = fc.record({
      startTime: fc.date({ min: new Date('2020-01-01'), max: new Date('2021-01-01') }),
      endTime: fc.date({ min: new Date('2022-01-01'), max: new Date('2025-01-01') })
    });

    await fc.assert(
      fc.asyncProperty(
        oversizedTimeRangeGen,
        validTagNameGen,
        async (oversizedTimeRange, tagName) => {
          const duration = oversizedTimeRange.endTime.getTime() - oversizedTimeRange.startTime.getTime();
          const maxDuration = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds

          if (duration > maxDuration) {
            // Should throw an error for oversized time range
            await expect(
              dataRetrievalService.getTimeSeriesData(tagName, oversizedTimeRange)
            ).rejects.toThrow(/time range cannot exceed 1 year/i);

            // Should not call the database
            expect(mockExecuteQuery).not.toHaveBeenCalled();
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: For any valid tag name and time range, the system should return 
   * properly formatted TimeSeriesData objects
   */
  test('should return properly formatted TimeSeriesData objects', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTimeRangeGen,
        validTagNameGen,
        async (timeRange, tagName) => {
          // Generate mock data within the time range
          const mockData = await fc.sample(timeSeriesDataGen(timeRange), 1);
          
          // Mock the database response
          mockExecuteQuery.mockResolvedValue({
            recordset: mockData[0]!.map(point => ({
              timestamp: point.timestamp,
              value: point.value,
              quality: point.quality,
              tagName: point.tagName
            }))
          });

          // Execute the service method
          const result = await dataRetrievalService.getTimeSeriesData(tagName, timeRange);

          // Verify each returned object has the correct structure
          for (const point of result) {
            expect(point).toHaveProperty('timestamp');
            expect(point).toHaveProperty('value');
            expect(point).toHaveProperty('quality');
            expect(point).toHaveProperty('tagName');

            expect(point.timestamp).toBeInstanceOf(Date);
            expect(typeof point.value).toBe('number');
            expect(typeof point.quality).toBe('number');
            expect(typeof point.tagName).toBe('string');
            expect(point.tagName).toBe(tagName);
          }
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Property: For any empty result set, the system should return an empty array
   */
  test('should handle empty result sets correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTimeRangeGen,
        validTagNameGen,
        async (timeRange, tagName) => {
          // Mock empty database response
          mockExecuteQuery.mockResolvedValue({
            recordset: []
          });

          // Execute the service method
          const result = await dataRetrievalService.getTimeSeriesData(tagName, timeRange);

          // Should return empty array
          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBe(0);

          // Should still call the database with correct parameters
          expect(mockExecuteQuery).toHaveBeenCalledWith(
            expect.stringContaining('WHERE TagName = @tagName'),
            expect.objectContaining({
              tagName,
              startTime: timeRange.startTime,
              endTime: timeRange.endTime
            })
          );
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: For any multiple tag request, all returned data should be properly grouped by tag
   */
  test('should properly group multiple tag data', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTimeRangeGen,
        fc.uniqueArray(validTagNameGen, { minLength: 2, maxLength: 3 }),
        async (timeRange, tagNames) => {
          // Generate mock data for each tag
          const mockDataByTag: Record<string, TimeSeriesData[]> = {};
          
          for (const tagName of tagNames) {
            const tagData = await fc.sample(timeSeriesDataGen(timeRange), 1);
            mockDataByTag[tagName] = tagData[0]!.map(point => ({
              ...point,
              tagName
            }));
          }

          // Mock the service method for multiple tags to always succeed
          const mockGetTimeSeriesData = jest.spyOn(dataRetrievalService, 'getTimeSeriesData');
          mockGetTimeSeriesData.mockImplementation(
            async (tagName: string) => {
              return mockDataByTag[tagName] || [];
            }
          );

          // Execute the multiple tag retrieval
          const result = await dataRetrievalService.getMultipleTimeSeriesData(tagNames, timeRange);

          // Verify all requested tags are present in result
          const resultKeys = Object.keys(result);
          expect(resultKeys.length).toBe(tagNames.length);
          
          for (const tagName of tagNames) {
            expect(resultKeys).toContain(tagName);
            expect(Array.isArray(result[tagName])).toBe(true);
            
            // Verify all data points for this tag have the correct tagName
            for (const point of result[tagName]!) {
              expect(point.tagName).toBe(tagName);
            }
          }

          // Cleanup
          mockGetTimeSeriesData.mockRestore();
        }
      ),
      { numRuns: 5 }
    );
  });
});