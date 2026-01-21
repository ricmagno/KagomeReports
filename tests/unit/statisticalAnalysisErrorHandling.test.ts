/**
 * Unit tests for Statistical Analysis Service Error Handling
 * Tests graceful degradation and safe calculation methods
 */

import { statisticalAnalysisService } from '../../src/services/statisticalAnalysis';
import { analyticsErrorHandler } from '../../src/utils/analyticsErrorHandler';
import { TimeSeriesData } from '../../src/types/historian';

describe('Statistical Analysis Service - Error Handling', () => {
  beforeEach(() => {
    // Clear any previous errors
    analyticsErrorHandler.clearErrors();
  });

  afterEach(() => {
    // Clean up after each test
    analyticsErrorHandler.clearErrors();
  });

  describe('Safe Trend Line Calculation', () => {
    it('should return null for insufficient data (<3 points)', () => {
      const data: TimeSeriesData[] = [
        { timestamp: new Date('2024-01-01T00:00:00Z'), value: 10, quality: 192, tagName: 'TAG001' },
        { timestamp: new Date('2024-01-01T01:00:00Z'), value: 20, quality: 192, tagName: 'TAG001' }
      ];

      const result = statisticalAnalysisService.safeCalculateTrendLine(data, 'TAG001');

      expect(result).toBeNull();
      expect(analyticsErrorHandler.hasErrors()).toBe(true);
      
      const errors = analyticsErrorHandler.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0]?.type).toBe('insufficient_data');
      expect(errors[0]?.tagName).toBe('TAG001');
    });

    it('should return trend line for valid data', () => {
      const data: TimeSeriesData[] = [
        { timestamp: new Date('2024-01-01T00:00:00Z'), value: 10, quality: 192, tagName: 'TAG001' },
        { timestamp: new Date('2024-01-01T01:00:00Z'), value: 20, quality: 192, tagName: 'TAG001' },
        { timestamp: new Date('2024-01-01T02:00:00Z'), value: 30, quality: 192, tagName: 'TAG001' }
      ];

      const result = statisticalAnalysisService.safeCalculateTrendLine(data, 'TAG001');

      expect(result).not.toBeNull();
      expect(result?.slope).toBeDefined();
      expect(result?.intercept).toBeDefined();
      expect(result?.rSquared).toBeDefined();
      expect(result?.equation).toBeDefined();
      expect(analyticsErrorHandler.hasErrors()).toBe(false);
    });

    it('should handle calculation errors gracefully', () => {
      // Create data that might cause calculation issues
      const data: TimeSeriesData[] = [
        { timestamp: new Date('2024-01-01T00:00:00Z'), value: NaN, quality: 192, tagName: 'TAG001' },
        { timestamp: new Date('2024-01-01T01:00:00Z'), value: NaN, quality: 192, tagName: 'TAG001' },
        { timestamp: new Date('2024-01-01T02:00:00Z'), value: NaN, quality: 192, tagName: 'TAG001' }
      ];

      const result = statisticalAnalysisService.safeCalculateTrendLine(data, 'TAG001');

      expect(result).toBeNull();
      expect(analyticsErrorHandler.hasErrors()).toBe(true);
    });
  });

  describe('Safe SPC Metrics Calculation', () => {
    it('should return null for insufficient data (<2 points)', () => {
      const data: TimeSeriesData[] = [
        { timestamp: new Date('2024-01-01T00:00:00Z'), value: 10, quality: 192, tagName: 'TAG001' }
      ];

      const result = statisticalAnalysisService.safeCalculateSPCMetrics(data, 'TAG001');

      expect(result).toBeNull();
      expect(analyticsErrorHandler.hasErrors()).toBe(true);
      
      const errors = analyticsErrorHandler.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0]?.type).toBe('insufficient_data');
    });

    it('should return null for invalid specification limits (USL <= LSL)', () => {
      const data: TimeSeriesData[] = [
        { timestamp: new Date('2024-01-01T00:00:00Z'), value: 10, quality: 192, tagName: 'TAG001' },
        { timestamp: new Date('2024-01-01T01:00:00Z'), value: 20, quality: 192, tagName: 'TAG001' }
      ];

      const specLimits = { lsl: 100, usl: 50 }; // Invalid: USL < LSL

      const result = statisticalAnalysisService.safeCalculateSPCMetrics(data, 'TAG001', specLimits);

      expect(result).toBeNull();
      // Note: Invalid config errors are logged but not added to error handler
      // to allow report generation to continue gracefully
    });

    it('should return SPC metrics for valid data without spec limits', () => {
      const data: TimeSeriesData[] = [
        { timestamp: new Date('2024-01-01T00:00:00Z'), value: 10, quality: 192, tagName: 'TAG001' },
        { timestamp: new Date('2024-01-01T01:00:00Z'), value: 20, quality: 192, tagName: 'TAG001' },
        { timestamp: new Date('2024-01-01T02:00:00Z'), value: 15, quality: 192, tagName: 'TAG001' }
      ];

      const result = statisticalAnalysisService.safeCalculateSPCMetrics(data, 'TAG001');

      expect(result).not.toBeNull();
      expect(result?.mean).toBeDefined();
      expect(result?.stdDev).toBeDefined();
      expect(result?.ucl).toBeDefined();
      expect(result?.lcl).toBeDefined();
      expect(result?.cp).toBeNull(); // No spec limits provided
      expect(result?.cpk).toBeNull();
      expect(analyticsErrorHandler.hasErrors()).toBe(false);
    });

    it('should return SPC metrics with Cp/Cpk for valid spec limits', () => {
      const data: TimeSeriesData[] = [
        { timestamp: new Date('2024-01-01T00:00:00Z'), value: 10, quality: 192, tagName: 'TAG001' },
        { timestamp: new Date('2024-01-01T01:00:00Z'), value: 20, quality: 192, tagName: 'TAG001' },
        { timestamp: new Date('2024-01-01T02:00:00Z'), value: 15, quality: 192, tagName: 'TAG001' }
      ];

      const specLimits = { lsl: 5, usl: 25 }; // Valid spec limits

      const result = statisticalAnalysisService.safeCalculateSPCMetrics(data, 'TAG001', specLimits);

      expect(result).not.toBeNull();
      expect(result?.cp).not.toBeNull();
      expect(result?.cpk).not.toBeNull();
      expect(analyticsErrorHandler.hasErrors()).toBe(false);
    });
  });

  describe('Safe Statistics Calculation', () => {
    it('should return default values for empty data', () => {
      const data: TimeSeriesData[] = [];

      const result = statisticalAnalysisService.safeCalculateStatistics(data, 'TAG001');

      expect(result).toEqual({
        min: 0,
        max: 0,
        average: 0,
        standardDeviation: 0,
        count: 0,
        dataQuality: 0
      });
      expect(analyticsErrorHandler.hasErrors()).toBe(true);
    });

    it('should return statistics for valid data', () => {
      const data: TimeSeriesData[] = [
        { timestamp: new Date('2024-01-01T00:00:00Z'), value: 10, quality: 192, tagName: 'TAG001' },
        { timestamp: new Date('2024-01-01T01:00:00Z'), value: 20, quality: 192, tagName: 'TAG001' },
        { timestamp: new Date('2024-01-01T02:00:00Z'), value: 30, quality: 192, tagName: 'TAG001' }
      ];

      const result = statisticalAnalysisService.safeCalculateStatistics(data, 'TAG001');

      expect(result.min).toBe(10);
      expect(result.max).toBe(30);
      expect(result.average).toBe(20);
      expect(result.count).toBe(3);
      expect(result.dataQuality).toBe(100); // All good quality
      expect(analyticsErrorHandler.hasErrors()).toBe(false);
    });

    it('should handle calculation errors and return defaults', () => {
      // Create data that might cause issues
      const data: TimeSeriesData[] = [
        { timestamp: new Date('2024-01-01T00:00:00Z'), value: NaN, quality: 0, tagName: 'TAG001' }
      ];

      const result = statisticalAnalysisService.safeCalculateStatistics(data, 'TAG001');

      // Should return default values instead of throwing
      expect(result).toBeDefined();
      expect(analyticsErrorHandler.hasErrors()).toBe(true);
    });
  });

  describe('Error Accumulation', () => {
    it('should accumulate multiple errors from different operations', () => {
      const insufficientData: TimeSeriesData[] = [
        { timestamp: new Date('2024-01-01T00:00:00Z'), value: 10, quality: 192, tagName: 'TAG001' }
      ];

      // Generate multiple errors
      statisticalAnalysisService.safeCalculateTrendLine(insufficientData, 'TAG001');
      statisticalAnalysisService.safeCalculateSPCMetrics(insufficientData, 'TAG001');

      const errors = analyticsErrorHandler.getErrors();
      expect(errors.length).toBeGreaterThanOrEqual(2);

      const summary = analyticsErrorHandler.getErrorSummary();
      expect(summary.total).toBeGreaterThanOrEqual(2);
      expect(summary.byType.insufficient_data).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Error Recovery', () => {
    it('should continue processing after recoverable errors', () => {
      const insufficientData: TimeSeriesData[] = [
        { timestamp: new Date('2024-01-01T00:00:00Z'), value: 10, quality: 192, tagName: 'TAG001' }
      ];

      const validData: TimeSeriesData[] = [
        { timestamp: new Date('2024-01-01T00:00:00Z'), value: 10, quality: 192, tagName: 'TAG002' },
        { timestamp: new Date('2024-01-01T01:00:00Z'), value: 20, quality: 192, tagName: 'TAG002' },
        { timestamp: new Date('2024-01-01T02:00:00Z'), value: 30, quality: 192, tagName: 'TAG002' }
      ];

      // First operation fails
      const result1 = statisticalAnalysisService.safeCalculateTrendLine(insufficientData, 'TAG001');
      expect(result1).toBeNull();

      // Second operation should still succeed
      const result2 = statisticalAnalysisService.safeCalculateTrendLine(validData, 'TAG002');
      expect(result2).not.toBeNull();

      // Should have one error but second operation succeeded
      expect(analyticsErrorHandler.hasErrors()).toBe(true);
      expect(analyticsErrorHandler.getErrors()).toHaveLength(1);
    });
  });
});
