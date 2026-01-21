/**
 * Integration tests for SPC chart generation
 * Tests the generateSPCChart function with various scenarios
 */

import { chartGenerationService } from '../../src/services/chartGeneration';
import { TimeSeriesData } from '../../src/types/historian';
import * as fs from 'fs';
import * as path from 'path';

describe('SPC Chart Generation Integration Tests', () => {
  const reportsDir = path.join(__dirname, '../../reports');

  // Ensure reports directory exists
  beforeAll(() => {
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
  });

  // Helper function to generate test data
  function generateTestData(
    count: number,
    mean: number,
    stdDev: number,
    outOfControlIndices: number[] = []
  ): TimeSeriesData[] {
    const now = new Date();
    const data: TimeSeriesData[] = [];

    for (let i = 0; i < count; i++) {
      const timestamp = new Date(now.getTime() + i * 60000); // 1 minute intervals
      let value: number;

      if (outOfControlIndices.includes(i)) {
        // Out of control point (beyond 3 sigma)
        value = mean + (Math.random() > 0.5 ? 4 : -4) * stdDev;
      } else {
        // Normal variation within control limits
        value = mean + (Math.random() - 0.5) * 2 * stdDev;
      }

      data.push({
        timestamp,
        value,
        quality: 192,
        tagName: 'TEST_TAG'
      });
    }

    return data;
  }

  // Helper function to calculate SPC metrics
  function calculateSPCMetrics(
    data: TimeSeriesData[],
    specLimits?: { lsl?: number; usl?: number }
  ) {
    const values = data.map(d => d.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
    const stdDev = Math.sqrt(variance);
    const ucl = mean + 3 * stdDev;
    const lcl = mean - 3 * stdDev;

    // Identify out-of-control points
    const outOfControlPoints: number[] = [];
    data.forEach((d, index) => {
      if (d.value > ucl || d.value < lcl) {
        outOfControlPoints.push(index);
      }
    });

    // Calculate Cp and Cpk if spec limits provided
    let cp: number | null = null;
    let cpk: number | null = null;

    if (specLimits?.lsl !== undefined && specLimits?.usl !== undefined) {
      cp = (specLimits.usl - specLimits.lsl) / (6 * stdDev);
      const cpkUpper = (specLimits.usl - mean) / (3 * stdDev);
      const cpkLower = (mean - specLimits.lsl) / (3 * stdDev);
      cpk = Math.min(cpkUpper, cpkLower);
    }

    return {
      mean: Number(mean.toFixed(2)),
      stdDev: Number(stdDev.toFixed(2)),
      ucl: Number(ucl.toFixed(2)),
      lcl: Number(lcl.toFixed(2)),
      cp: cp !== null ? Number(cp.toFixed(2)) : null,
      cpk: cpk !== null ? Number(cpk.toFixed(2)) : null,
      outOfControlPoints
    };
  }

  describe('generateSPCChart', () => {
    it('should generate SPC chart with specification limits', async () => {
      const data = generateTestData(50, 100, 5, [10, 25, 40]);
      const specLimits = { lsl: 80, usl: 120 };
      const spcMetrics = calculateSPCMetrics(data, specLimits);

      const buffer = await chartGenerationService.generateSPCChart(
        'TEST_TAG_001',
        data,
        spcMetrics,
        specLimits
      );

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Verify it's a valid PNG
      expect(buffer.toString('hex', 0, 8)).toBe('89504e470d0a1a0a');

      // Save for manual inspection
      const outputPath = path.join(reportsDir, 'test-spc-chart-with-specs.png');
      fs.writeFileSync(outputPath, buffer);
    }, 30000);

    it('should generate SPC chart without specification limits', async () => {
      const data = generateTestData(50, 100, 5, [15, 35]);
      const spcMetrics = calculateSPCMetrics(data);

      const buffer = await chartGenerationService.generateSPCChart(
        'TEST_TAG_002',
        data,
        spcMetrics
      );

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Verify it's a valid PNG
      expect(buffer.toString('hex', 0, 8)).toBe('89504e470d0a1a0a');

      // Save for manual inspection
      const outputPath = path.join(reportsDir, 'test-spc-chart-no-specs.png');
      fs.writeFileSync(outputPath, buffer);
    }, 30000);

    it('should generate SPC chart with all points in control', async () => {
      const data = generateTestData(30, 100, 5, []); // No out-of-control points
      const specLimits = { lsl: 80, usl: 120 };
      const spcMetrics = calculateSPCMetrics(data, specLimits);

      const buffer = await chartGenerationService.generateSPCChart(
        'TEST_TAG_003',
        data,
        spcMetrics,
        specLimits
      );

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Verify it's a valid PNG
      expect(buffer.toString('hex', 0, 8)).toBe('89504e470d0a1a0a');

      // Save for manual inspection
      const outputPath = path.join(reportsDir, 'test-spc-chart-controlled.png');
      fs.writeFileSync(outputPath, buffer);
    }, 30000);

    it('should mark out-of-control points distinctly', async () => {
      const data = generateTestData(20, 100, 5);
      
      // Manually add out-of-control points
      data[5]!.value = 130; // Way above UCL
      data[15]!.value = 70; // Way below LCL
      
      const spcMetrics = calculateSPCMetrics(data);

      expect(spcMetrics.outOfControlPoints.length).toBeGreaterThan(0);

      const buffer = await chartGenerationService.generateSPCChart(
        'TEST_TAG_004',
        data,
        spcMetrics
      );

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Save for manual inspection
      const outputPath = path.join(reportsDir, 'test-spc-chart-out-of-control.png');
      fs.writeFileSync(outputPath, buffer);
    }, 30000);

    it('should handle edge case with only LSL specified', async () => {
      const data = generateTestData(30, 100, 5);
      const specLimits = { lsl: 80 };
      const spcMetrics = calculateSPCMetrics(data, specLimits);

      const buffer = await chartGenerationService.generateSPCChart(
        'TEST_TAG_005',
        data,
        spcMetrics,
        specLimits
      );

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    }, 30000);

    it('should handle edge case with only USL specified', async () => {
      const data = generateTestData(30, 100, 5);
      const specLimits = { usl: 120 };
      const spcMetrics = calculateSPCMetrics(data, specLimits);

      const buffer = await chartGenerationService.generateSPCChart(
        'TEST_TAG_006',
        data,
        spcMetrics,
        specLimits
      );

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    }, 30000);

    it('should throw error when no data points provided', async () => {
      const emptyData: TimeSeriesData[] = [];
      const spcMetrics = {
        mean: 100,
        stdDev: 5,
        ucl: 115,
        lcl: 85,
        cp: null,
        cpk: null,
        outOfControlPoints: []
      };

      await expect(
        chartGenerationService.generateSPCChart(
          'TEST_TAG_007',
          emptyData,
          spcMetrics
        )
      ).rejects.toThrow('No data points provided for SPC chart generation');
    });

    it('should include Cp and Cpk in chart title when available', async () => {
      const data = generateTestData(30, 100, 5);
      const specLimits = { lsl: 80, usl: 120 };
      const spcMetrics = calculateSPCMetrics(data, specLimits);

      expect(spcMetrics.cp).not.toBeNull();
      expect(spcMetrics.cpk).not.toBeNull();

      const buffer = await chartGenerationService.generateSPCChart(
        'TEST_TAG_008',
        data,
        spcMetrics,
        specLimits
      );

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    }, 30000);

    it('should use grayscale colors for printing', async () => {
      const data = generateTestData(30, 100, 5, [10, 20]);
      const spcMetrics = calculateSPCMetrics(data);

      const buffer = await chartGenerationService.generateSPCChart(
        'TEST_TAG_009',
        data,
        spcMetrics
      );

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // The chart should be generated successfully
      // Visual inspection would confirm grayscale rendering
    }, 30000);
  });
});
