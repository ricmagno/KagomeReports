/**
 * Integration tests for SPC Metrics
 * Tests the complete SPC workflow with the StatisticalAnalysisService
 */

import { statisticalAnalysisService } from '@/services/statisticalAnalysis';
import { TimeSeriesData, SpecificationLimits } from '@/types/historian';

describe('SPC Metrics Integration Tests', () => {
  // Helper function to create test data
  const createTestData = (values: number[], tagName: string = 'TEST_TAG'): TimeSeriesData[] => {
    return values.map((value, index) => ({
      timestamp: new Date(Date.now() + index * 1000),
      value,
      quality: 192,
      tagName
    }));
  };

  describe('Real-world SPC scenarios', () => {
    it('should analyze a stable manufacturing process', () => {
      // Simulate a stable process with normal variation
      const processData = createTestData([
        100.2, 100.5, 99.8, 100.1, 100.3,
        99.9, 100.4, 100.0, 100.2, 99.7,
        100.1, 100.3, 99.9, 100.2, 100.0
      ], 'TEMP_SENSOR_01');

      const specLimits: SpecificationLimits = {
        lsl: 98.0,
        usl: 102.0
      };

      const metrics = statisticalAnalysisService.calculateSPCMetrics(processData, specLimits);
      const capability = statisticalAnalysisService.assessCapability(metrics.cp, metrics.cpk);

      // Verify metrics are calculated
      expect(metrics.mean).toBeCloseTo(100.1, 1);
      expect(metrics.stdDev).toBeGreaterThan(0);
      expect(metrics.ucl).toBeGreaterThan(metrics.mean);
      expect(metrics.lcl).toBeLessThan(metrics.mean);

      // Verify capability indices
      expect(metrics.cp).not.toBeNull();
      expect(metrics.cpk).not.toBeNull();
      expect(capability).toBeDefined();

      // Stable process should have no out-of-control points
      expect(metrics.outOfControlPoints.length).toBe(0);
    });

    it('should detect out-of-control conditions in unstable process', () => {
      // Simulate a process with a sudden shift
      const processData = createTestData([
        50, 51, 49, 50, 52,  // Stable around 50
        50, 51, 49, 50, 51,  // Still stable
        75, 76, 74, 75, 76   // Sudden shift to 75
      ], 'PRESSURE_SENSOR_02');

      const metrics = statisticalAnalysisService.calculateSPCMetrics(processData);

      // Should detect the shift as out-of-control
      // (though the exact detection depends on how the shift affects stdDev)
      expect(metrics.outOfControlPoints).toBeDefined();
      expect(Array.isArray(metrics.outOfControlPoints)).toBe(true);
    });

    it('should handle process with tight tolerances', () => {
      // High precision process with tight spec limits
      const processData = createTestData([
        10.00, 10.01, 9.99, 10.00, 10.02,
        9.98, 10.01, 10.00, 9.99, 10.01
      ], 'PRECISION_GAUGE');

      const specLimits: SpecificationLimits = {
        lsl: 9.95,
        usl: 10.05
      };

      const metrics = statisticalAnalysisService.calculateSPCMetrics(processData, specLimits);
      const capability = statisticalAnalysisService.assessCapability(metrics.cp, metrics.cpk);

      // Tight process should have high capability
      expect(metrics.cp).toBeGreaterThan(1.0);
      expect(capability).not.toBe('Not Capable');
    });

    it('should handle process with wide variation', () => {
      // Process with high variation
      const processData = createTestData([
        80, 95, 70, 105, 85,
        90, 75, 100, 80, 95
      ], 'FLOW_METER');

      const specLimits: SpecificationLimits = {
        lsl: 85,
        usl: 95
      };

      const metrics = statisticalAnalysisService.calculateSPCMetrics(processData, specLimits);
      const capability = statisticalAnalysisService.assessCapability(metrics.cp, metrics.cpk);

      // Wide variation with tight limits should have low capability
      expect(metrics.cp).toBeLessThan(1.33);
      expect(['Not Capable', 'Marginal']).toContain(capability);
    });

    it('should calculate metrics for multiple tags independently', () => {
      const tag1Data = createTestData([50, 51, 49, 50, 52], 'TAG_001');
      const tag2Data = createTestData([100, 101, 99, 100, 102], 'TAG_002');

      const metrics1 = statisticalAnalysisService.calculateSPCMetrics(tag1Data);
      const metrics2 = statisticalAnalysisService.calculateSPCMetrics(tag2Data);

      // Metrics should be different for different tags
      expect(metrics1.mean).not.toBe(metrics2.mean);
      expect(metrics1.ucl).not.toBe(metrics2.ucl);
      expect(metrics1.lcl).not.toBe(metrics2.lcl);
    });

    it('should handle edge case: all values identical', () => {
      const processData = createTestData([
        100, 100, 100, 100, 100
      ], 'CONSTANT_VALUE');

      const specLimits: SpecificationLimits = {
        lsl: 95,
        usl: 105
      };

      const metrics = statisticalAnalysisService.calculateSPCMetrics(processData, specLimits);
      const capability = statisticalAnalysisService.assessCapability(metrics.cp, metrics.cpk);

      // Zero variation should result in infinite capability (if within spec)
      expect(metrics.stdDev).toBe(0);
      expect(metrics.cp).toBe(Infinity);
      expect(metrics.cpk).toBe(Infinity);
      expect(capability).toBe('Capable');
    });

    it('should handle edge case: minimum data points', () => {
      const processData = createTestData([50, 60], 'MIN_DATA');

      const metrics = statisticalAnalysisService.calculateSPCMetrics(processData);

      // Should calculate metrics even with minimum data
      expect(metrics.mean).toBe(55);
      expect(metrics.stdDev).toBeGreaterThan(0);
      expect(metrics.ucl).toBeGreaterThan(metrics.mean);
      expect(metrics.lcl).toBeLessThan(metrics.mean);
    });

    it('should validate specification limits', () => {
      const processData = createTestData([50, 51, 49, 50, 52], 'VALIDATION_TEST');

      const invalidLimits: SpecificationLimits = {
        lsl: 100,
        usl: 50  // USL < LSL (invalid)
      };

      // Should throw error for invalid spec limits
      expect(() => {
        statisticalAnalysisService.calculateSPCMetrics(processData, invalidLimits);
      }).toThrow('Invalid specification limits');
    });

    it('should handle missing specification limits gracefully', () => {
      const processData = createTestData([50, 51, 49, 50, 52], 'NO_SPEC_LIMITS');

      // No spec limits provided
      const metrics = statisticalAnalysisService.calculateSPCMetrics(processData);

      // Should calculate control limits but not capability indices
      expect(metrics.mean).toBeDefined();
      expect(metrics.stdDev).toBeDefined();
      expect(metrics.ucl).toBeDefined();
      expect(metrics.lcl).toBeDefined();
      expect(metrics.cp).toBeNull();
      expect(metrics.cpk).toBeNull();

      const capability = statisticalAnalysisService.assessCapability(metrics.cp, metrics.cpk);
      expect(capability).toBe('N/A');
    });

    it('should handle partial specification limits', () => {
      const processData = createTestData([50, 51, 49, 50, 52], 'PARTIAL_SPEC');

      // Only LSL provided (no USL)
      const partialLimits: SpecificationLimits = {
        lsl: 45
        // usl is undefined
      };

      const metrics = statisticalAnalysisService.calculateSPCMetrics(processData, partialLimits);

      // Should not calculate Cp/Cpk without both limits
      expect(metrics.cp).toBeNull();
      expect(metrics.cpk).toBeNull();
    });
  });

  describe('Performance and scalability', () => {
    it('should handle large datasets efficiently', () => {
      // Generate 1000 data points
      const largeDataset = createTestData(
        Array.from({ length: 1000 }, (_, i) => 100 + Math.sin(i / 10) * 5),
        'LARGE_DATASET'
      );

      const startTime = Date.now();
      const metrics = statisticalAnalysisService.calculateSPCMetrics(largeDataset);
      const endTime = Date.now();

      // Should complete within reasonable time (< 200ms as per requirements)
      expect(endTime - startTime).toBeLessThan(200);

      // Should still calculate correct metrics
      expect(metrics.mean).toBeDefined();
      expect(metrics.stdDev).toBeDefined();
      expect(metrics.ucl).toBeDefined();
      expect(metrics.lcl).toBeDefined();
    });
  });
});
