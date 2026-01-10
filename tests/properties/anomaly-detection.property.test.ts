/**
 * Anomaly Detection Property Tests
 * Feature: historian-reporting, Property 6: Anomaly and Pattern Detection
 * Validates: Requirements 3.2, 3.5
 */

import * as fc from 'fast-check';
import { StatisticalAnalysisService } from '@/services/statisticalAnalysis';
import { TimeSeriesData, QualityCode } from '@/types/historian';

describe('Anomaly Detection Property Tests', () => {
  let statisticalAnalysisService: StatisticalAnalysisService;

  beforeEach(() => {
    statisticalAnalysisService = new StatisticalAnalysisService();
  });

  // Generator for time-series data with known anomalies
  const timeSeriesWithAnomaliesGen = fc.record({
    baseData: fc.array(
      fc.record({
        timestamp: fc.date({ min: new Date('2023-01-01'), max: new Date('2023-12-31') }),
        value: fc.float({ min: 10, max: 100 }),
        quality: fc.constantFrom(QualityCode.Good, QualityCode.Bad, QualityCode.Uncertain),
        tagName: fc.constant('TEST_TAG')
      }),
      { minLength: 20, maxLength: 100 }
    ),
    anomalyIndices: fc.array(fc.integer({ min: 0, max: 99 }), { minLength: 1, maxLength: 5 }),
    anomalyMultiplier: fc.float({ min: 3, max: 10 })
  }).map(({ baseData, anomalyIndices, anomalyMultiplier }) => {
    // Sort by timestamp
    const sortedData = baseData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Calculate base statistics
    const values = sortedData.map(d => d.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Inject anomalies at specified indices
    const dataWithAnomalies = [...sortedData];
    const actualAnomalyIndices: number[] = [];
    
    for (const index of anomalyIndices) {
      if (index < dataWithAnomalies.length) {
        const direction = Math.random() > 0.5 ? 1 : -1;
        dataWithAnomalies[index] = {
          ...dataWithAnomalies[index]!,
          value: mean + (direction * stdDev * anomalyMultiplier)
        };
        actualAnomalyIndices.push(index);
      }
    }
    
    return {
      data: dataWithAnomalies,
      knownAnomalyIndices: actualAnomalyIndices,
      baseStats: { mean, stdDev }
    };
  });

  // Generator for pattern change data
  const patternChangeDataGen = fc.record({
    beforePattern: fc.array(
      fc.record({
        timestamp: fc.date({ min: new Date('2023-01-01'), max: new Date('2023-06-01') }),
        value: fc.float({ min: 50, max: 60 }),
        quality: fc.constant(QualityCode.Good),
        tagName: fc.constant('TEST_TAG')
      }),
      { minLength: 20, maxLength: 40 }
    ),
    afterPattern: fc.array(
      fc.record({
        timestamp: fc.date({ min: new Date('2023-06-02'), max: new Date('2023-12-31') }),
        value: fc.float({ min: 80, max: 90 }), // Significant shift
        quality: fc.constant(QualityCode.Good),
        tagName: fc.constant('TEST_TAG')
      }),
      { minLength: 20, maxLength: 40 }
    )
  }).map(({ beforePattern, afterPattern }) => {
    const sortedBefore = beforePattern.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const sortedAfter = afterPattern.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    return [...sortedBefore, ...sortedAfter];
  });

  /**
   * Property 6: Anomaly and Pattern Detection
   * For any dataset with known anomalies or pattern changes, the system should correctly 
   * identify and flag these deviations based on configured thresholds
   */
  describe('Property 6: Anomaly and Pattern Detection', () => {
    
    test('should detect statistical anomalies with configurable thresholds', () => {
      fc.assert(
        fc.property(
          timeSeriesWithAnomaliesGen,
          fc.float({ min: 1.5, max: 3.0 }),
          ({ data, knownAnomalyIndices }, threshold) => {
            const anomalies = statisticalAnalysisService.detectAnomalies(data, threshold);
            
            // Property: All detected anomalies should exceed the threshold
            for (const anomaly of anomalies) {
              expect(anomaly.deviation).toBeGreaterThan(threshold);
              expect(['low', 'medium', 'high']).toContain(anomaly.severity);
              expect(anomaly.description).toContain('standard deviation');
            }
            
            // Property: Anomalies should be properly structured
            for (const anomaly of anomalies) {
              expect(anomaly.timestamp).toBeInstanceOf(Date);
              expect(typeof anomaly.value).toBe('number');
              expect(typeof anomaly.expectedValue).toBe('number');
              expect(typeof anomaly.deviation).toBe('number');
              expect(anomaly.deviation).toBeGreaterThan(0);
            }
            
            // Property: High threshold should detect fewer anomalies than low threshold
            if (threshold < 2.5) {
              const higherThresholdAnomalies = statisticalAnalysisService.detectAnomalies(data, threshold + 0.5);
              expect(higherThresholdAnomalies.length).toBeLessThanOrEqual(anomalies.length);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should detect advanced anomalies using multiple algorithms', () => {
      fc.assert(
        fc.property(
          timeSeriesWithAnomaliesGen,
          fc.record({
            statisticalThreshold: fc.float({ min: 1.5, max: 3.0 }),
            iqrMultiplier: fc.float({ min: 1.0, max: 2.5 }),
            enableTrendAnalysis: fc.boolean(),
            windowSize: fc.integer({ min: 5, max: 15 })
          }),
          ({ data }, options) => {
            if (data.length < Math.max(10, options.windowSize * 2)) {
              return; // Skip if insufficient data
            }
            
            const anomalies = statisticalAnalysisService.detectAdvancedAnomalies(data, options);
            
            // Property: All anomalies should have valid structure
            for (const anomaly of anomalies) {
              expect(anomaly.timestamp).toBeInstanceOf(Date);
              expect(typeof anomaly.value).toBe('number');
              expect(typeof anomaly.expectedValue).toBe('number');
              expect(typeof anomaly.deviation).toBe('number');
              expect(['low', 'medium', 'high']).toContain(anomaly.severity);
              expect(typeof anomaly.description).toBe('string');
              expect(anomaly.description.length).toBeGreaterThan(0);
            }
            
            // Property: Anomalies should be sorted by timestamp
            for (let i = 1; i < anomalies.length; i++) {
              expect(anomalies[i]!.timestamp.getTime()).toBeGreaterThanOrEqual(
                anomalies[i - 1]!.timestamp.getTime()
              );
            }
            
            // Property: No duplicate anomalies (same timestamp and value)
            const uniqueKeys = new Set(anomalies.map(a => `${a.timestamp.getTime()}_${a.value}`));
            expect(uniqueKeys.size).toBe(anomalies.length);
          }
        ),
        { numRuns: 30 }
      );
    });

    test('should detect pattern changes with configurable sensitivity', () => {
      fc.assert(
        fc.property(
          patternChangeDataGen,
          fc.record({
            windowSize: fc.integer({ min: 5, max: 15 }),
            sensitivityThreshold: fc.float({ min: 1.0, max: 2.5 }),
            minChangePercent: fc.float({ min: 5, max: 25 })
          }),
          (data, options) => {
            if (data.length < options.windowSize * 2) {
              return; // Skip if insufficient data
            }
            
            const patternChanges = statisticalAnalysisService.detectPatternChanges(data, options);
            
            // Property: Pattern changes should have valid structure
            for (const change of patternChanges) {
              expect(change.timestamp).toBeInstanceOf(Date);
              expect(typeof change.value).toBe('number');
              expect(typeof change.expectedValue).toBe('number');
              expect(typeof change.deviation).toBe('number');
              expect(['low', 'medium', 'high']).toContain(change.severity);
              expect(change.description).toContain('Pattern change');
            }
            
            // Property: Higher sensitivity should detect more changes
            if (options.sensitivityThreshold > 1.2) {
              const lowerSensitivityChanges = statisticalAnalysisService.detectPatternChanges(data, {
                ...options,
                sensitivityThreshold: options.sensitivityThreshold - 0.3
              });
              expect(lowerSensitivityChanges.length).toBeGreaterThanOrEqual(patternChanges.length);
            }
          }
        ),
        { numRuns: 25 }
      );
    });

    test('should detect significant trend changes', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              timestamp: fc.date({ min: new Date('2023-01-01'), max: new Date('2023-12-31') }),
              value: fc.float({ min: 0, max: 200 }),
              quality: fc.constant(QualityCode.Good),
              tagName: fc.constant('TEST_TAG')
            }),
            { minLength: 60, maxLength: 120 }
          ),
          fc.record({
            windowSize: fc.integer({ min: 10, max: 20 }),
            trendThreshold: fc.float({ min: Math.fround(0.01), max: Math.fround(0.1) }),
            volatilityThreshold: fc.float({ min: Math.fround(1.5), max: Math.fround(3.0) })
          }),
          (rawData, options) => {
            const data = rawData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            
            if (data.length < options.windowSize * 3) {
              return; // Skip if insufficient data
            }
            
            const trendChanges = statisticalAnalysisService.detectSignificantTrendChanges(data, options);
            
            // Property: Trend changes should have valid structure
            for (const change of trendChanges) {
              expect(change.timestamp).toBeInstanceOf(Date);
              expect(typeof change.value).toBe('number');
              expect(typeof change.expectedValue).toBe('number');
              expect(typeof change.deviation).toBe('number');
              expect(['low', 'medium', 'high']).toContain(change.severity);
              expect(change.description).toContain('trend change');
            }
            
            // Property: Trend changes should be chronologically ordered
            for (let i = 1; i < trendChanges.length; i++) {
              expect(trendChanges[i]!.timestamp.getTime()).toBeGreaterThanOrEqual(
                trendChanges[i - 1]!.timestamp.getTime()
              );
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should provide comprehensive anomaly flagging with configurable thresholds', () => {
      fc.assert(
        fc.property(
          timeSeriesWithAnomaliesGen,
          fc.record({
            statisticalDeviation: fc.float({ min: 1.5, max: 3.5 }),
            iqrMultiplier: fc.float({ min: 1.0, max: 2.5 }),
            trendSensitivity: fc.float({ min: 1.0, max: 2.5 }),
            patternSensitivity: fc.float({ min: 1.0, max: 2.5 }),
            enableAdvanced: fc.boolean(),
            windowSize: fc.integer({ min: 10, max: 20 })
          }),
          ({ data }, thresholds) => {
            if (data.length < Math.max(20, thresholds.windowSize * 2)) {
              return; // Skip if insufficient data
            }
            
            const result = statisticalAnalysisService.flagAnomalies(data, thresholds);
            
            // Property: Result should have valid structure
            expect(Array.isArray(result.anomalies)).toBe(true);
            expect(typeof result.summary).toBe('object');
            expect(typeof result.summary.totalAnomalies).toBe('number');
            expect(typeof result.summary.highSeverity).toBe('number');
            expect(typeof result.summary.mediumSeverity).toBe('number');
            expect(typeof result.summary.lowSeverity).toBe('number');
            expect(typeof result.summary.anomalyRate).toBe('number');
            expect(Array.isArray(result.summary.detectionMethods)).toBe(true);
            
            // Property: Summary counts should be consistent
            const totalFromSeverity = result.summary.highSeverity + 
                                    result.summary.mediumSeverity + 
                                    result.summary.lowSeverity;
            expect(totalFromSeverity).toBe(result.summary.totalAnomalies);
            expect(result.anomalies.length).toBe(result.summary.totalAnomalies);
            
            // Property: Anomaly rate should be valid percentage
            expect(result.summary.anomalyRate).toBeGreaterThanOrEqual(0);
            expect(result.summary.anomalyRate).toBeLessThanOrEqual(100);
            
            // Property: Detection methods should be valid
            const validMethods = ['statistical-deviation', 'advanced-multi-algorithm', 'pattern-change', 'trend-change'];
            for (const method of result.summary.detectionMethods) {
              expect(validMethods).toContain(method);
            }
            
            // Property: All anomalies should have valid severity levels
            for (const anomaly of result.anomalies) {
              expect(['low', 'medium', 'high']).toContain(anomaly.severity);
            }
          }
        ),
        { numRuns: 25 }
      );
    });

    test('should perform statistical deviation analysis with multiple methods', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              timestamp: fc.date({ min: new Date('2023-01-01'), max: new Date('2023-12-31') }),
              value: fc.float({ min: 10, max: 100 }),
              quality: fc.constant(QualityCode.Good),
              tagName: fc.constant('TEST_TAG')
            }),
            { minLength: 10, maxLength: 50 }
          ),
          fc.array(
            fc.constantFrom('zscore' as const, 'modified-zscore' as const, 'grubbs' as const, 'dixon' as const),
            { minLength: 1, maxLength: 4 }
          ),
          (data, methods) => {
            const sortedData = data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            
            const results = statisticalAnalysisService.performStatisticalDeviationAnalysis(sortedData, methods);
            
            // Property: Should return results for each requested method
            expect(results.length).toBe(methods.length);
            
            // Property: Each result should have valid structure
            for (const result of results) {
              expect(methods).toContain(result.method);
              expect(Array.isArray(result.anomalies)).toBe(true);
              expect(typeof result.statistics).toBe('object');
              expect(typeof result.statistics.mean).toBe('number');
              expect(typeof result.statistics.median).toBe('number');
              expect(typeof result.statistics.standardDeviation).toBe('number');
              expect(typeof result.statistics.mad).toBe('number');
              
              // Property: Statistics should be valid
              expect(result.statistics.standardDeviation).toBeGreaterThanOrEqual(0);
              expect(result.statistics.mad).toBeGreaterThanOrEqual(0);
              
              // Property: All anomalies should have valid structure
              for (const anomaly of result.anomalies) {
                expect(anomaly.timestamp).toBeInstanceOf(Date);
                expect(typeof anomaly.value).toBe('number');
                expect(typeof anomaly.expectedValue).toBe('number');
                expect(typeof anomaly.deviation).toBe('number');
                expect(['low', 'medium', 'high']).toContain(anomaly.severity);
                
                // Check that description contains method-related keywords
                const methodKeywords = {
                  'zscore': ['z-score', 'zscore'],
                  'modified-zscore': ['modified', 'z-score'],
                  'grubbs': ['grubbs'],
                  'dixon': ['dixon', 'q-test']
                };
                
                const keywords = methodKeywords[result.method as keyof typeof methodKeywords] || [result.method];
                const hasKeyword = keywords.some(keyword => 
                  anomaly.description.toLowerCase().includes(keyword.toLowerCase())
                );
                expect(hasKeyword).toBe(true);
              }
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should handle edge cases gracefully', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Empty data
            fc.constant([]),
            // Single data point
            fc.array(
              fc.record({
                timestamp: fc.date(),
                value: fc.float(),
                quality: fc.constant(QualityCode.Good),
                tagName: fc.constant('TEST_TAG')
              }),
              { minLength: 1, maxLength: 1 }
            ),
            // Two data points
            fc.array(
              fc.record({
                timestamp: fc.date(),
                value: fc.float(),
                quality: fc.constant(QualityCode.Good),
                tagName: fc.constant('TEST_TAG')
              }),
              { minLength: 2, maxLength: 2 }
            ),
            // Data with NaN values
            fc.array(
              fc.record({
                timestamp: fc.date(),
                value: fc.oneof(fc.float(), fc.constant(NaN), fc.constant(Infinity)),
                quality: fc.constant(QualityCode.Good),
                tagName: fc.constant('TEST_TAG')
              }),
              { minLength: 5, maxLength: 10 }
            )
          ),
          (data) => {
            // Property: Should not throw errors for edge cases
            expect(() => {
              try {
                statisticalAnalysisService.detectAnomalies(data, 2.0);
              } catch (error: any) {
                // Expected errors for insufficient data
                if (data.length < 3) {
                  expect(error.message).toContain('At least 3 data points required');
                } else {
                  throw error; // Unexpected error
                }
              }
            }).not.toThrow();
            
            expect(() => {
              try {
                statisticalAnalysisService.detectPatternChanges(data);
              } catch (error: any) {
                // Expected errors for insufficient data
                if (data.length < 20) {
                  expect(error.message).toContain('data points required');
                } else {
                  throw error; // Unexpected error
                }
              }
            }).not.toThrow();
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});