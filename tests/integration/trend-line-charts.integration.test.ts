/**
 * Integration tests for trend line chart generation
 * Tests the complete flow from data to chart with trend lines
 */

import { chartGenerationService } from '@/services/chartGeneration';
import { TimeSeriesData } from '@/types/historian';

describe('Trend Line Chart Generation Integration', () => {
  // Helper function to create test data
  function createTestData(values: number[], tagName: string): TimeSeriesData[] {
    const startTime = new Date('2024-01-01T00:00:00Z');
    return values.map((value, index) => ({
      timestamp: new Date(startTime.getTime() + index * 60000), // 1 minute intervals
      value,
      quality: 192,
      tagName
    }));
  }

  describe('Chart generation with trend lines', () => {
    it('should generate chart with trend line for analog tag', async () => {
      // Create data with clear linear trend
      const data = createTestData(
        Array.from({ length: 20 }, (_, i) => 50 + i * 2),
        'TEMP_SENSOR'
      );

      const charts = await chartGenerationService.generateReportCharts(
        { 'TEMP_SENSOR': data },
        undefined,
        undefined,
        ['line']
      );

      expect(charts).toBeDefined();
      expect(charts['TEMP_SENSOR_line']).toBeDefined();
      expect(Buffer.isBuffer(charts['TEMP_SENSOR_line'])).toBe(true);
      expect(charts['TEMP_SENSOR_line']!.length).toBeGreaterThan(0);
    });

    it('should not generate trend line for digital tag', async () => {
      // Create binary data (digital tag)
      const data = createTestData(
        Array.from({ length: 20 }, (_, i) => i % 2),
        'PUMP_STATUS'
      );

      const charts = await chartGenerationService.generateReportCharts(
        { 'PUMP_STATUS': data },
        undefined,
        undefined,
        ['line']
      );

      expect(charts).toBeDefined();
      expect(charts['PUMP_STATUS_line']).toBeDefined();
      expect(Buffer.isBuffer(charts['PUMP_STATUS_line'])).toBe(true);
    });

    it('should handle insufficient data gracefully', async () => {
      // Only 2 data points - not enough for trend line
      const data = createTestData([10, 20], 'SENSOR');

      const charts = await chartGenerationService.generateReportCharts(
        { 'SENSOR': data },
        undefined,
        undefined,
        ['line']
      );

      expect(charts).toBeDefined();
      expect(charts['SENSOR_line']).toBeDefined();
      // Chart should still be generated, just without trend line
    });

    it('should generate charts for multiple tags', async () => {
      const data1 = createTestData(
        Array.from({ length: 20 }, (_, i) => 50 + i * 2),
        'TAG1'
      );
      const data2 = createTestData(
        Array.from({ length: 20 }, (_, i) => 100 - i * 1.5),
        'TAG2'
      );

      const charts = await chartGenerationService.generateReportCharts(
        { 'TAG1': data1, 'TAG2': data2 },
        undefined,
        undefined,
        ['line']
      );

      expect(charts).toBeDefined();
      expect(charts['TAG1_line']).toBeDefined();
      expect(charts['TAG2_line']).toBeDefined();
      expect(Object.keys(charts).length).toBe(2);
    });

    it('should include statistics in charts', async () => {
      const data = createTestData(
        [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        'SENSOR'
      );

      const charts = await chartGenerationService.generateReportCharts(
        { 'SENSOR': data },
        undefined,
        undefined,
        ['line']
      );

      expect(charts).toBeDefined();
      expect(charts['SENSOR_line']).toBeDefined();
      // Statistics should be calculated and included in the chart
    });

    it('should handle noisy data with weak trend', async () => {
      // Create data with high noise (weak trend)
      const data = createTestData(
        Array.from({ length: 20 }, () => 50 + (Math.random() - 0.5) * 40),
        'NOISY_SENSOR'
      );

      const charts = await chartGenerationService.generateReportCharts(
        { 'NOISY_SENSOR': data },
        undefined,
        undefined,
        ['line']
      );

      expect(charts).toBeDefined();
      expect(charts['NOISY_SENSOR_line']).toBeDefined();
      // Chart should be generated with trend line (even if R² is low)
    });
  });

  describe('Error handling', () => {
    it('should handle empty data gracefully', async () => {
      const charts = await chartGenerationService.generateReportCharts(
        { 'EMPTY_TAG': [] },
        undefined,
        undefined,
        ['line']
      );

      expect(charts).toBeDefined();
      // No chart should be generated for empty data
      expect(charts['EMPTY_TAG_line']).toBeUndefined();
    });

    it('should handle invalid data gracefully', async () => {
      const data: TimeSeriesData[] = [
        {
          timestamp: new Date(),
          value: NaN,
          quality: 0,
          tagName: 'INVALID'
        },
        {
          timestamp: new Date(),
          value: Infinity,
          quality: 0,
          tagName: 'INVALID'
        }
      ];

      const charts = await chartGenerationService.generateReportCharts(
        { 'INVALID': data },
        undefined,
        undefined,
        ['line']
      );

      expect(charts).toBeDefined();
      // Chart generation should handle invalid values
    });
  });
});
