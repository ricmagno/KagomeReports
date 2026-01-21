/**
 * Unit tests for Advanced Trend Line Calculation
 * Tests the calculateAdvancedTrendLine and formatTrendEquation methods
 */

import { StatisticalAnalysisService } from '@/services/statisticalAnalysis';
import { TimeSeriesData } from '@/types/historian';

describe('Advanced Trend Line Calculation', () => {
  let service: StatisticalAnalysisService;

  beforeEach(() => {
    service = new StatisticalAnalysisService();
  });

  describe('calculateAdvancedTrendLine', () => {
    it('should calculate correct trend line for known linear data', () => {
      // Create data following y = 2x + 5
      const baseTime = new Date('2024-01-01T00:00:00Z').getTime();
      const data: TimeSeriesData[] = [
        { timestamp: new Date(baseTime), value: 5, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 1000), value: 7, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 2000), value: 9, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 3000), value: 11, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 4000), value: 13, quality: 192, tagName: 'TEST' }
      ];

      const result = service.calculateAdvancedTrendLine(data);

      // Should have slope = 2 and intercept = 5
      expect(result.slope).toBeCloseTo(2, 1);
      expect(result.intercept).toBeCloseTo(5, 1);
      expect(result.rSquared).toBeCloseTo(1.0, 2); // Perfect fit
      expect(result.equation).toMatch(/y = 2\.00x \+ 5\.00/);
    });

    it('should handle horizontal line (slope = 0)', () => {
      const baseTime = new Date('2024-01-01T00:00:00Z').getTime();
      const data: TimeSeriesData[] = [
        { timestamp: new Date(baseTime), value: 10, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 1000), value: 10, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 2000), value: 10, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 3000), value: 10, quality: 192, tagName: 'TEST' }
      ];

      const result = service.calculateAdvancedTrendLine(data);

      expect(result.slope).toBe(0);
      expect(result.intercept).toBe(10);
      expect(result.rSquared).toBe(1.0); // Perfect fit for horizontal line
      expect(result.equation).toBe('y = 0.00x + 10.00');
    });

    it('should handle negative slope', () => {
      // Create data following y = -1.5x + 20
      const baseTime = new Date('2024-01-01T00:00:00Z').getTime();
      const data: TimeSeriesData[] = [
        { timestamp: new Date(baseTime), value: 20, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 1000), value: 18.5, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 2000), value: 17, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 3000), value: 15.5, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 4000), value: 14, quality: 192, tagName: 'TEST' }
      ];

      const result = service.calculateAdvancedTrendLine(data);

      expect(result.slope).toBeCloseTo(-1.5, 1);
      expect(result.intercept).toBeCloseTo(20, 1);
      expect(result.rSquared).toBeCloseTo(1.0, 2);
      expect(result.equation).toMatch(/y = -1\.50x \+ 20\.00/);
    });

    it('should handle negative intercept', () => {
      // Create data following y = 1x - 5
      const baseTime = new Date('2024-01-01T00:00:00Z').getTime();
      const data: TimeSeriesData[] = [
        { timestamp: new Date(baseTime), value: -5, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 1000), value: -4, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 2000), value: -3, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 3000), value: -2, quality: 192, tagName: 'TEST' }
      ];

      const result = service.calculateAdvancedTrendLine(data);

      expect(result.slope).toBeCloseTo(1, 1);
      expect(result.intercept).toBeCloseTo(-5, 1);
      expect(result.equation).toMatch(/y = 1\.00x - 5\.00/);
    });

    it('should calculate R² correctly for imperfect fit', () => {
      const baseTime = new Date('2024-01-01T00:00:00Z').getTime();
      const data: TimeSeriesData[] = [
        { timestamp: new Date(baseTime), value: 5, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 1000), value: 7.5, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 2000), value: 8, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 3000), value: 11.5, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 4000), value: 12, quality: 192, tagName: 'TEST' }
      ];

      const result = service.calculateAdvancedTrendLine(data);

      // Should have good but not perfect R²
      expect(result.rSquared).toBeGreaterThan(0.8);
      expect(result.rSquared).toBeLessThan(1.0);
      expect(result.rSquared.toString()).toMatch(/^\d\.\d{3}$/); // 3 decimal places
    });

    it('should throw error for insufficient data (<3 points)', () => {
      const baseTime = new Date('2024-01-01T00:00:00Z').getTime();
      const data: TimeSeriesData[] = [
        { timestamp: new Date(baseTime), value: 5, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 1000), value: 7, quality: 192, tagName: 'TEST' }
      ];

      expect(() => service.calculateAdvancedTrendLine(data)).toThrow(
        'Insufficient data for trend calculation'
      );
    });

    it('should throw error for empty dataset', () => {
      const data: TimeSeriesData[] = [];

      expect(() => service.calculateAdvancedTrendLine(data)).toThrow(
        'Insufficient data for trend calculation'
      );
    });

    it('should filter out invalid values and still calculate if enough valid points remain', () => {
      const baseTime = new Date('2024-01-01T00:00:00Z').getTime();
      const data: TimeSeriesData[] = [
        { timestamp: new Date(baseTime), value: 5, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 1000), value: NaN, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 2000), value: 9, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 3000), value: Infinity, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 4000), value: 13, quality: 192, tagName: 'TEST' }
      ];

      const result = service.calculateAdvancedTrendLine(data);

      // Should calculate based on 3 valid points
      expect(result.slope).toBeGreaterThan(0);
      expect(result.rSquared).toBeGreaterThan(0);
    });

    it('should throw error if too many invalid values (<3 valid points)', () => {
      const baseTime = new Date('2024-01-01T00:00:00Z').getTime();
      const data: TimeSeriesData[] = [
        { timestamp: new Date(baseTime), value: 5, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 1000), value: NaN, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 2000), value: 9, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 3000), value: Infinity, quality: 192, tagName: 'TEST' }
      ];

      expect(() => service.calculateAdvancedTrendLine(data)).toThrow(
        'Insufficient valid data for trend calculation'
      );
    });

    it('should round slope and intercept to 2 decimal places', () => {
      const baseTime = new Date('2024-01-01T00:00:00Z').getTime();
      const data: TimeSeriesData[] = [
        { timestamp: new Date(baseTime), value: 5.123456, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 1000), value: 7.234567, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 2000), value: 9.345678, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 3000), value: 11.456789, quality: 192, tagName: 'TEST' }
      ];

      const result = service.calculateAdvancedTrendLine(data);

      // Check that values are rounded to 2 decimal places
      expect(result.slope.toString()).toMatch(/^\-?\d+\.\d{2}$/);
      expect(result.intercept.toString()).toMatch(/^\-?\d+\.\d{2}$/);
    });

    it('should round R² to 3 decimal places', () => {
      const baseTime = new Date('2024-01-01T00:00:00Z').getTime();
      const data: TimeSeriesData[] = [
        { timestamp: new Date(baseTime), value: 5, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 1000), value: 7.1, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 2000), value: 8.9, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 3000), value: 11.2, quality: 192, tagName: 'TEST' }
      ];

      const result = service.calculateAdvancedTrendLine(data);

      // Check that R² is rounded to 3 decimal places
      expect(result.rSquared.toString()).toMatch(/^\d\.\d{3}$/);
    });

    it('should ensure R² is within [0, 1] range', () => {
      const baseTime = new Date('2024-01-01T00:00:00Z').getTime();
      const data: TimeSeriesData[] = [
        { timestamp: new Date(baseTime), value: 5, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 1000), value: 7, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 2000), value: 9, quality: 192, tagName: 'TEST' },
        { timestamp: new Date(baseTime + 3000), value: 11, quality: 192, tagName: 'TEST' }
      ];

      const result = service.calculateAdvancedTrendLine(data);

      expect(result.rSquared).toBeGreaterThanOrEqual(0);
      expect(result.rSquared).toBeLessThanOrEqual(1);
    });
  });

  describe('formatTrendEquation', () => {
    it('should format equation with positive intercept', () => {
      const equation = service.formatTrendEquation(2.5, 10.3);
      expect(equation).toBe('y = 2.50x + 10.30');
    });

    it('should format equation with negative intercept', () => {
      const equation = service.formatTrendEquation(1.5, -5.7);
      expect(equation).toBe('y = 1.50x - 5.70');
    });

    it('should format equation with zero slope', () => {
      const equation = service.formatTrendEquation(0, 15.0);
      expect(equation).toBe('y = 0.00x + 15.00');
    });

    it('should format equation with negative slope', () => {
      const equation = service.formatTrendEquation(-3.2, 8.5);
      expect(equation).toBe('y = -3.20x + 8.50');
    });

    it('should format equation with zero intercept', () => {
      const equation = service.formatTrendEquation(2.0, 0);
      expect(equation).toBe('y = 2.00x + 0.00');
    });

    it('should round values to 2 decimal places', () => {
      const equation = service.formatTrendEquation(2.123456, 10.987654);
      expect(equation).toBe('y = 2.12x + 10.99');
    });

    it('should handle very small values', () => {
      const equation = service.formatTrendEquation(0.001, -0.002);
      expect(equation).toBe('y = 0.00x - 0.00');
    });

    it('should handle large values', () => {
      const equation = service.formatTrendEquation(1234.56, -9876.54);
      expect(equation).toBe('y = 1234.56x - 9876.54');
    });
  });
});
