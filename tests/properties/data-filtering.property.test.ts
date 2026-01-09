/**
 * Property-Based Tests for Data Filtering Consistency
 * Feature: historian-reporting, Property 3: Data Filtering Consistency
 * Validates: Requirements 2.2, 2.5
 */

import fc from 'fast-check';
import { DataFilteringService } from '@/services/dataFiltering';
import { TimeSeriesData, DataFilter, QualityCode } from '@/types/historian';

// Mock logger
jest.mock('@/utils/logger', () => ({
  dbLogger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

// Generators for test data
const qualityCodeGen = fc.constantFrom(
  QualityCode.Good,
  QualityCode.Bad,
  QualityCode.Uncertain
);

const timeSeriesDataGen = fc.array(
  fc.record({
    timestamp: fc.date({ min: new Date('2023-01-01'), max: new Date('2023-01-31') }),
    value: fc.float({ min: -100, max: 100 }),
    quality: qualityCodeGen,
    tagName: fc.string({ minLength: 1, maxLength: 5 })
  }),
  { minLength: 0, maxLength: 10 }
);

const dataFilterGen = fc.record({
  tagNames: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 5 }), { minLength: 1, maxLength: 3 }), { nil: undefined }),
  qualityFilter: fc.option(fc.array(qualityCodeGen, { minLength: 1, maxLength: 2 }), { nil: undefined }),
  valueRange: fc.option(fc.record({
    min: fc.option(fc.float({ min: -50, max: 50 }), { nil: undefined }),
    max: fc.option(fc.float({ min: -50, max: 50 }), { nil: undefined })
  }).filter(range => 
    !range.min || !range.max || range.min < range.max
  ), { nil: undefined }),
  samplingInterval: fc.option(fc.integer({ min: 1, max: 5 }), { nil: undefined })
});

describe('Property 3: Data Filtering Consistency', () => {
  let dataFilteringService: DataFilteringService;

  beforeEach(() => {
    dataFilteringService = new DataFilteringService();
  });

  /**
   * Property: For any combination of filter criteria, 
   * all returned data should satisfy every specified filter condition
   */
  test('should return data that satisfies all filter conditions', () => {
    fc.assert(
      fc.property(
        timeSeriesDataGen,
        dataFilterGen,
        (data, filter) => {
          const filteredData = dataFilteringService.applyFilters(data, filter);

          // Verify tag name filter
          if (filter.tagNames && filter.tagNames.length > 0) {
            for (const point of filteredData) {
              expect(filter.tagNames).toContain(point.tagName);
            }
          }

          // Verify quality filter
          if (filter.qualityFilter && filter.qualityFilter.length > 0) {
            for (const point of filteredData) {
              expect(filter.qualityFilter).toContain(point.quality);
            }
          }

          // Verify value range filter
          if (filter.valueRange) {
            for (const point of filteredData) {
              if (filter.valueRange.min !== undefined) {
                expect(point.value).toBeGreaterThanOrEqual(filter.valueRange.min);
              }
              if (filter.valueRange.max !== undefined) {
                expect(point.value).toBeLessThanOrEqual(filter.valueRange.max);
              }
            }
          }

          expect(filteredData.length).toBeLessThanOrEqual(data.length);
        }
      ),
      { numRuns: 3 }
    );
  });

  /**
   * Property: Quality filtering should correctly categorize data by quality codes
   */
  test('should correctly categorize data by quality codes', () => {
    fc.assert(
      fc.property(
        timeSeriesDataGen,
        fc.array(qualityCodeGen, { minLength: 1, maxLength: 2 }),
        (data, allowedQualities) => {
          const result = dataFilteringService.filterByQuality(data, allowedQualities);

          expect(result.qualityReport.total).toBe(data.length);

          for (const point of result.filteredData) {
            expect(allowedQualities).toContain(point.quality);
          }

          expect(result.filteredData.length).toBeLessThanOrEqual(data.length);
        }
      ),
      { numRuns: 3 }
    );
  });

  /**
   * Property: Filter validation should reject invalid filter configurations
   */
  test('should validate filter parameters correctly', () => {
    const invalidFilterGen = fc.oneof(
      fc.record({
        samplingInterval: fc.constant(0)
      }),
      fc.record({
        tagNames: fc.constant([])
      })
    );

    fc.assert(
      fc.property(invalidFilterGen, (invalidFilter) => {
        expect(() => {
          dataFilteringService.validateFilter(invalidFilter);
        }).toThrow();
      }),
      { numRuns: 2 }
    );
  });

  /**
   * Property: Valid filters should pass validation without errors
   */
  test('should accept valid filter configurations', () => {
    fc.assert(
      fc.property(dataFilterGen, (validFilter) => {
        expect(() => {
          dataFilteringService.validateFilter(validFilter);
        }).not.toThrow();
      }),
      { numRuns: 3 }
    );
  });
});