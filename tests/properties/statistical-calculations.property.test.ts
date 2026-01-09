/**
 * Property-Based Tests for Statistical Calculation Correctness
 * Feature: historian-reporting, Property 4: Statistical Calculation Correctness
 * Validates: Requirements 2.4, 3.1, 3.3, 3.4
 */

import fc from 'fast-check';
import { StatisticalAnalysisService } from '@/services/statisticalAnalysis';
import { TimeSeriesData, QualityCode } from '@/types/historian';

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
const validTimeSeriesDataGen = fc.array(
  fc.record({
    timestamp: fc.date({ min: new Date('2023-01-01'), max: new Date('2023-12-31') }),
    value: fc.float({ min: -1000, max: 1000 }).filter(v => isFinite(v) && !isNaN(v)),
    quality: fc.constantFrom(QualityCode.Good, QualityCode.Bad, QualityCode.Uncertain),
    tagName: fc.string({ minLength: 1, maxLength: 20 })
  }),
  { minLength: 1, maxLength: 100 }
);

const nonEmptyTimeSeriesDataGen = validTimeSeriesDataGen.filter(data => data.length > 0);

const trendDataGen = fc.array(
  fc.record({
    timestamp: fc.date({ min: new Date('2023-01-01'), max: new Date('2023-12-31') }),
    value: fc.float({ min: -100, max: 100 }).filter(v => isFinite(v) && !isNaN(v)),
    quality: fc.constant(QualityCode.Good),
    tagName: fc.constant('test-tag')
  }),
  { minLength: 2, maxLength: 50 }
);

describe('Property 4: Statistical Calculation Correctness', () => {
  let statisticalAnalysisService: StatisticalAnalysisService;

  beforeEach(() => {
    statisticalAnalysisService = new StatisticalAnalysisService();
  });

  /**
   * Property: For any dataset, calculated statistics (average, min, max, standard deviation) 
   * should be mathematically correct within acceptable floating-point precision
   */
  test('should calculate basic statistics correctly', () => {
    fc.assert(
      fc.property(nonEmptyTimeSeriesDataGen, (data) => {
        const stats = statisticalAnalysisService.calculateStatistics(data);
        const values = data.map(point => point.value).filter(v => isFinite(v) && !isNaN(v));

        if (values.length === 0) return; // Skip if no valid values

        // Verify min and max
        expect(stats.min).toBe(Math.min(...values));
        expect(stats.max).toBe(Math.max(...values));

        // Verify average
        const expectedAverage = values.reduce((sum, val) => sum + val, 0) / values.length;
        expect(Math.abs(stats.average - expectedAverage)).toBeLessThan(1e-10);

        // Verify count
        expect(stats.count).toBe(values.length);

        // Verify standard deviation
        const variance = values.reduce((sum, val) => sum + Math.pow(val - expectedAverage, 2), 0) / values.length;
        const expectedStdDev = Math.sqrt(variance);
        expect(Math.abs(stats.standardDeviation - expectedStdDev)).toBeLessThan(1e-10);

        // Verify data quality percentage
        const goodQualityCount = data.filter(point => point.quality === QualityCode.Good).length;
        const expectedQuality = (goodQualityCount / data.length) * 100;
        expect(Math.abs(stats.dataQuality - expectedQuality)).toBeLessThan(1e-10);

        // Verify ranges
        expect(stats.min).toBeLessThanOrEqual(stats.max);
        expect(stats.standardDeviation).toBeGreaterThanOrEqual(0);
        expect(stats.dataQuality).toBeGreaterThanOrEqual(0);
        expect(stats.dataQuality).toBeLessThanOrEqual(100);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Trend line calculations should produce mathematically correct linear regression results
   */
  test('should calculate trend lines correctly using linear regression', () => {
    fc.assert(
      fc.property(trendDataGen, (data) => {
        const trend = statisticalAnalysisService.calculateTrendLine(data);
        const validData = data.filter(point => isFinite(point.value) && !isNaN(point.value));

        if (validData.length < 2) return; // Skip if insufficient data

        // Manual calculation for verification
        const n = validData.length;
        const xValues = validData.map((_, index) => index);
        const yValues = validData.map(point => point.value);

        const sumX = xValues.reduce((sum, x) => sum + x, 0);
        const sumY = yValues.reduce((sum, y) => sum + y, 0);
        const sumXY = xValues.reduce((sum, x, i) => sum + (x * yValues[i]!), 0);
        const sumXX = xValues.reduce((sum, x) => sum + (x * x), 0);
        const sumYY = yValues.reduce((sum, y) => sum + (y * y), 0);

        // Calculate expected slope and intercept
        const expectedSlope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const expectedIntercept = (sumY - expectedSlope * sumX) / n;

        // Calculate expected correlation
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
        const expectedCorrelation = denominator === 0 ? 0 : numerator / denominator;
        const expectedConfidence = Math.pow(expectedCorrelation, 2);

        // Verify calculations within floating-point precision
        expect(Math.abs(trend.slope - expectedSlope)).toBeLessThan(1e-10);
        expect(Math.abs(trend.intercept - expectedIntercept)).toBeLessThan(1e-10);
        expect(Math.abs(trend.correlation - expectedCorrelation)).toBeLessThan(1e-10);
        expect(Math.abs(trend.confidence - expectedConfidence)).toBeLessThan(1e-10);

        // Verify correlation bounds
        expect(trend.correlation).toBeGreaterThanOrEqual(-1);
        expect(trend.correlation).toBeLessThanOrEqual(1);

        // Verify confidence bounds
        expect(trend.confidence).toBeGreaterThanOrEqual(0);
        expect(trend.confidence).toBeLessThanOrEqual(1);

        // Verify equation format
        expect(trend.equation).toMatch(/^y = -?\d+\.\d{4}x [+-] \d+\.\d{4}$/);
      }),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Moving averages should be calculated correctly for any window size
   */
  test('should calculate moving averages correctly', () => {
    fc.assert(
      fc.property(
        nonEmptyTimeSeriesDataGen,
        fc.integer({ min: 1, max: 10 }),
        (data, windowSize) => {
          if (windowSize > data.length) return; // Skip if window too large

          const movingAverages = statisticalAnalysisService.calculateMovingAverage(data, windowSize);

          // Verify result length
          const expectedLength = Math.max(0, data.length - windowSize + 1);
          expect(movingAverages.length).toBe(expectedLength);

          // Verify each moving average calculation
          for (let i = 0; i < movingAverages.length; i++) {
            const windowStart = i;
            const windowEnd = i + windowSize;
            const windowData = data.slice(windowStart, windowEnd);
            const validValues = windowData
              .map(point => point.value)
              .filter(v => isFinite(v) && !isNaN(v));

            if (validValues.length > 0) {
              const expectedAverage = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
              expect(Math.abs(movingAverages[i]!.value - expectedAverage)).toBeLessThan(1e-10);
            }

            // Verify timestamp corresponds to the last point in the window
            expect(movingAverages[i]!.timestamp).toEqual(data[windowEnd - 1]!.timestamp);
          }
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Property: Percentage change calculations should be mathematically correct
   */
  test('should calculate percentage changes correctly', () => {
    fc.assert(
      fc.property(
        nonEmptyTimeSeriesDataGen,
        nonEmptyTimeSeriesDataGen,
        (startData, endData) => {
          // Filter out zero values to avoid division by zero
          const filteredStartData = startData.filter(point => 
            isFinite(point.value) && !isNaN(point.value) && point.value !== 0
          );
          const filteredEndData = endData.filter(point => 
            isFinite(point.value) && !isNaN(point.value)
          );

          if (filteredStartData.length === 0 || filteredEndData.length === 0) return;

          const percentageChange = statisticalAnalysisService.calculatePercentageChange(
            filteredStartData, 
            filteredEndData
          );

          // Manual calculation for verification
          const startStats = statisticalAnalysisService.calculateStatistics(filteredStartData);
          const endStats = statisticalAnalysisService.calculateStatistics(filteredEndData);
          const expectedChange = ((endStats.average - startStats.average) / startStats.average) * 100;

          expect(Math.abs(percentageChange - expectedChange)).toBeLessThan(1e-10);

          // Verify reasonable bounds (allowing for large changes in test data)
          expect(isFinite(percentageChange)).toBe(true);
          expect(isNaN(percentageChange)).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Anomaly detection should identify points outside statistical thresholds
   */
  test('should detect anomalies based on statistical deviation', () => {
    fc.assert(
      fc.property(
        nonEmptyTimeSeriesDataGen.filter(data => data.length >= 3),
        fc.float({ min: 0.5, max: 5.0 }),
        (data, threshold) => {
          const anomalies = statisticalAnalysisService.detectAnomalies(data, threshold);
          const stats = statisticalAnalysisService.calculateStatistics(data);

          // Verify each detected anomaly exceeds the threshold
          for (const anomaly of anomalies) {
            const deviation = Math.abs(anomaly.value - stats.average) / stats.standardDeviation;
            expect(deviation).toBeGreaterThan(threshold);

            // Verify anomaly properties
            expect(anomaly.expectedValue).toBe(stats.average);
            expect(anomaly.deviation).toBe(deviation);
            expect(['low', 'medium', 'high']).toContain(anomaly.severity);
            expect(typeof anomaly.description).toBe('string');
            expect(anomaly.description.length).toBeGreaterThan(0);
          }

          // Verify no false negatives (points that should be anomalies but aren't detected)
          for (const point of data) {
            if (isFinite(point.value) && !isNaN(point.value)) {
              const deviation = Math.abs(point.value - stats.average) / stats.standardDeviation;
              const isDetectedAnomaly = anomalies.some(anomaly => 
                anomaly.timestamp.getTime() === point.timestamp.getTime() &&
                anomaly.value === point.value
              );

              if (deviation > threshold) {
                expect(isDetectedAnomaly).toBe(true);
              }
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Data quality calculations should correctly count and categorize quality codes
   */
  test('should calculate data quality metrics correctly', () => {
    fc.assert(
      fc.property(validTimeSeriesDataGen, (data) => {
        const qualityMetrics = statisticalAnalysisService.calculateDataQuality(data);

        // Manual count verification
        let goodCount = 0;
        let badCount = 0;
        let uncertainCount = 0;

        for (const point of data) {
          switch (point.quality) {
            case QualityCode.Good:
              goodCount++;
              break;
            case QualityCode.Bad:
              badCount++;
              break;
            case QualityCode.Uncertain:
              uncertainCount++;
              break;
            default:
              badCount++; // Unknown quality treated as bad
          }
        }

        // Verify counts
        expect(qualityMetrics.totalPoints).toBe(data.length);
        expect(qualityMetrics.goodQuality).toBe(goodCount);
        expect(qualityMetrics.badQuality).toBe(badCount);
        expect(qualityMetrics.uncertainQuality).toBe(uncertainCount);

        // Verify percentage calculation
        const expectedPercentage = data.length > 0 ? (goodCount / data.length) * 100 : 0;
        expect(Math.abs(qualityMetrics.qualityPercentage - expectedPercentage)).toBeLessThan(1e-10);

        // Verify bounds
        expect(qualityMetrics.qualityPercentage).toBeGreaterThanOrEqual(0);
        expect(qualityMetrics.qualityPercentage).toBeLessThanOrEqual(100);
        expect(qualityMetrics.missingDataGaps).toBeGreaterThanOrEqual(0);

        // Verify total consistency
        expect(qualityMetrics.goodQuality + qualityMetrics.badQuality + qualityMetrics.uncertainQuality)
          .toBe(qualityMetrics.totalPoints);
      }),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Statistical functions should handle edge cases gracefully
   */
  test('should handle edge cases and invalid inputs gracefully', () => {
    const edgeCaseGen = fc.oneof(
      // Empty dataset
      fc.constant([]),
      
      // Single data point
      fc.array(
        fc.record({
          timestamp: fc.date(),
          value: fc.float({ min: -100, max: 100 }),
          quality: fc.constant(QualityCode.Good),
          tagName: fc.constant('test')
        }),
        { minLength: 1, maxLength: 1 }
      ),
      
      // Dataset with NaN values
      fc.array(
        fc.record({
          timestamp: fc.date(),
          value: fc.constantFrom(NaN, Infinity, -Infinity, 0),
          quality: fc.constant(QualityCode.Good),
          tagName: fc.constant('test')
        }),
        { minLength: 1, maxLength: 5 }
      )
    );

    fc.assert(
      fc.property(edgeCaseGen, (data) => {
        // Empty datasets should throw appropriate errors
        if (data.length === 0) {
          expect(() => statisticalAnalysisService.calculateStatistics(data)).toThrow();
          expect(() => statisticalAnalysisService.calculateTrendLine(data)).toThrow();
          expect(() => statisticalAnalysisService.detectAnomalies(data)).toThrow();
          return;
        }

        // Single data point should throw for trend analysis
        if (data.length === 1) {
          expect(() => statisticalAnalysisService.calculateTrendLine(data)).toThrow();
          return;
        }

        // Datasets with only invalid values should throw appropriate errors
        const validValues = data.filter(point => isFinite(point.value) && !isNaN(point.value));
        if (validValues.length === 0) {
          expect(() => statisticalAnalysisService.calculateStatistics(data)).toThrow();
          return;
        }

        // Valid datasets should not throw errors
        expect(() => statisticalAnalysisService.calculateStatistics(data)).not.toThrow();
        
        if (validValues.length >= 2) {
          expect(() => statisticalAnalysisService.calculateTrendLine(data)).not.toThrow();
        }
        
        if (validValues.length >= 3) {
          expect(() => statisticalAnalysisService.detectAnomalies(data)).not.toThrow();
        }
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Statistical calculations should be deterministic for identical inputs
   */
  test('should produce identical results for identical inputs', () => {
    fc.assert(
      fc.property(nonEmptyTimeSeriesDataGen, (data) => {
        // Calculate statistics twice
        const stats1 = statisticalAnalysisService.calculateStatistics(data);
        const stats2 = statisticalAnalysisService.calculateStatistics(data);

        // Results should be identical
        expect(stats1.min).toBe(stats2.min);
        expect(stats1.max).toBe(stats2.max);
        expect(stats1.average).toBe(stats2.average);
        expect(stats1.standardDeviation).toBe(stats2.standardDeviation);
        expect(stats1.count).toBe(stats2.count);
        expect(stats1.dataQuality).toBe(stats2.dataQuality);

        // Same for trend analysis if applicable
        if (data.length >= 2) {
          const trend1 = statisticalAnalysisService.calculateTrendLine(data);
          const trend2 = statisticalAnalysisService.calculateTrendLine(data);

          expect(trend1.slope).toBe(trend2.slope);
          expect(trend1.intercept).toBe(trend2.intercept);
          expect(trend1.correlation).toBe(trend2.correlation);
          expect(trend1.confidence).toBe(trend2.confidence);
          expect(trend1.equation).toBe(trend2.equation);
        }
      }),
      { numRuns: 15 }
    );
  });
});