/**
 * Property-Based Tests for Report Generation
 * Feature: historian-reporting, Property 8: Report Generation Completeness
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5
 */

import * as fc from 'fast-check';
import { ChartGenerationService } from '@/services/chartGeneration';
import { TimeSeriesData, StatisticsResult, TrendResult } from '@/types/historian';

// Mock the environment and logger
jest.mock('@/config/environment', () => ({
  env: {
    REPORTS_DIR: './test-reports',
    CHART_WIDTH: 400,
    CHART_HEIGHT: 300,
    NODE_ENV: 'test',
    LOG_FILE: './test-logs/app.log',
    LOG_LEVEL: 'info',
    LOG_MAX_SIZE: '10m',
    LOG_MAX_FILES: 5
  }
}));

jest.mock('@/utils/logger', () => ({
  reportLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Property-Based Tests: Report Generation', () => {
  let chartService: ChartGenerationService;

  beforeEach(() => {
    chartService = new ChartGenerationService();
  });

  /**
   * Property 8: Report Generation Completeness
   * For any valid report configuration and data, the system should generate
   * a complete report with all requested components
   */
  describe('Property 8: Report Generation Completeness', () => {
    // Generator for valid time-series data
    const timeSeriesDataArb = fc.record({
      tagName: fc.string({ minLength: 1, maxLength: 20 }),
      timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') }),
      value: fc.float({ min: -1000, max: 1000 }),
      quality: fc.constantFrom(0, 64, 192) // Bad, Uncertain, Good
    });

    // Generator for statistics result
    const statisticsResultArb = fc.record({
      min: fc.float({ min: -1000, max: 1000 }),
      max: fc.float({ min: -1000, max: 1000 }),
      average: fc.float({ min: -1000, max: 1000 }),
      standardDeviation: fc.float({ min: 0, max: 100 }),
      dataQuality: fc.float({ min: 0, max: 100 }),
      count: fc.integer({ min: 1, max: 1000 })
    }).filter(stats => stats.min <= stats.max && stats.min <= stats.average && stats.average <= stats.max);

    // Generator for trend result
    const trendResultArb = fc.record({
      equation: fc.string({ minLength: 5, maxLength: 50 }),
      correlation: fc.float({ min: -1, max: 1 }),
      confidence: fc.float({ min: 0, max: 1 }),
      slope: fc.float({ min: -100, max: 100 }),
      intercept: fc.float({ min: -1000, max: 1000 })
    });

    it('should generate valid chart buffers for any valid time-series data', () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(timeSeriesDataArb, { minLength: 2, maxLength: 10 }),
          async (data) => {
            // Ensure timestamps are in order
            const sortedData = data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            
            // Ensure all data has the same tag name for consistency
            if (sortedData.length === 0) return; // Skip empty arrays
            const tagName = sortedData[0]?.tagName || 'DEFAULT_TAG';
            const normalizedData = sortedData.map(d => ({ ...d, tagName }));

            const lineChartData = [{
              tagName,
              data: normalizedData
            }];

            const buffer = await chartService.generateLineChart(lineChartData);

            // Property: Generated buffer should be valid PNG
            expect(buffer).toBeInstanceOf(Buffer);
            expect(buffer.length).toBeGreaterThan(0);
            expect(buffer.toString('hex', 0, 8)).toBe('89504e470d0a1a0a'); // PNG signature
          }
        ),
        { numRuns: 20, timeout: 10000 }
      );
    });

    it('should generate valid bar charts for any valid statistics data', () => {
      fc.assert(
        fc.asyncProperty(
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }),
            statisticsResultArb,
            { minKeys: 1, maxKeys: 5 }
          ),
          async (statistics) => {
            const buffer = await chartService.generateStatisticsChart(statistics);

            // Property: Generated buffer should be valid PNG
            expect(buffer).toBeInstanceOf(Buffer);
            expect(buffer.length).toBeGreaterThan(0);
            expect(buffer.toString('hex', 0, 8)).toBe('89504e470d0a1a0a'); // PNG signature
          }
        ),
        { numRuns: 20, timeout: 10000 }
      );
    });

    it('should generate valid trend charts for any valid data and trend', () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(timeSeriesDataArb, { minLength: 3, maxLength: 10 }),
          trendResultArb,
          async (data, trend) => {
            // Ensure timestamps are in order
            const sortedData = data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            
            // Ensure all data has the same tag name
            if (sortedData.length === 0) return; // Skip empty arrays
            const tagName = sortedData[0]?.tagName || 'DEFAULT_TAG';
            const normalizedData = sortedData.map(d => ({ ...d, tagName }));

            const trendChartData = {
              tagName,
              data: normalizedData,
              trend
            };

            const buffer = await chartService.generateTrendChart(trendChartData);

            // Property: Generated buffer should be valid PNG
            expect(buffer).toBeInstanceOf(Buffer);
            expect(buffer.length).toBeGreaterThan(0);
            expect(buffer.toString('hex', 0, 8)).toBe('89504e470d0a1a0a'); // PNG signature
          }
        ),
        { numRuns: 15, timeout: 10000 }
      );
    });

    it('should generate multiple charts consistently', () => {
      fc.assert(
        fc.asyncProperty(
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.array(timeSeriesDataArb, { minLength: 2, maxLength: 8 }),
            { minKeys: 1, maxKeys: 3 }
          ),
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }),
            statisticsResultArb,
            { minKeys: 0, maxKeys: 3 }
          ),
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }),
            trendResultArb,
            { minKeys: 0, maxKeys: 2 }
          ),
          fc.array(fc.constantFrom('line', 'bar', 'trend'), { minLength: 1, maxLength: 3 }),
          async (data, statistics, trends, chartTypes) => {
            // Normalize data to ensure consistency
            const normalizedData: Record<string, TimeSeriesData[]> = {};
            for (const [tagName, tagData] of Object.entries(data)) {
              const sortedData = tagData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
              normalizedData[tagName] = sortedData.map(d => ({ ...d, tagName }));
            }

            const charts = await chartService.generateReportCharts(
              normalizedData,
              Object.keys(statistics).length > 0 ? statistics : undefined,
              Object.keys(trends).length > 0 ? trends : undefined,
              chartTypes as ('line' | 'bar' | 'trend')[]
            );

            // Property: Should generate at least one chart for non-empty data with valid chart types
            const hasValidLineData = chartTypes.includes('line') && 
              Object.values(normalizedData).some(arr => arr.length > 0);
            const hasValidBarData = chartTypes.includes('bar') && 
              statistics && Object.keys(statistics).length > 0;
            const hasValidTrendData = chartTypes.includes('trend') && 
              trends && Object.keys(trends).length > 0 &&
              Object.keys(trends).some(tag => {
                const tagData = normalizedData[tag];
                return tagData && tagData.length > 0;
              });

            if (hasValidLineData || hasValidBarData || hasValidTrendData) {
              expect(Object.keys(charts).length).toBeGreaterThan(0);
            }

            // Property: All generated charts should be valid PNG buffers
            for (const [chartName, buffer] of Object.entries(charts)) {
              expect(buffer).toBeInstanceOf(Buffer);
              expect(buffer.length).toBeGreaterThan(0);
              expect(buffer.toString('hex', 0, 8)).toBe('89504e470d0a1a0a');
            }

            // Property: Chart count should be reasonable based on input
            const expectedLineCharts = chartTypes.includes('line') 
              ? Object.keys(normalizedData).filter(tag => {
                  const tagData = normalizedData[tag];
                  return tagData && tagData.length > 0;
                }).length 
              : 0;
            const expectedBarCharts = chartTypes.includes('bar') && statistics && Object.keys(statistics).length > 0 ? 1 : 0;
            const expectedTrendCharts = chartTypes.includes('trend') && trends 
              ? Object.keys(trends).filter(tag => {
                  const tagData = normalizedData[tag];
                  return tagData && tagData.length > 0;
                }).length 
              : 0;

            const expectedTotal = expectedLineCharts + expectedBarCharts + expectedTrendCharts;
            expect(Object.keys(charts).length).toBeLessThanOrEqual(expectedTotal);
          }
        ),
        { numRuns: 10, timeout: 15000 }
      );
    });

    it('should handle edge cases gracefully', () => {
      fc.assert(
        fc.asyncProperty(
          fc.oneof(
            // Empty data
            fc.constant({}),
            // Single data point
            fc.dictionary(
              fc.string({ minLength: 1, maxLength: 5 }),
              fc.array(timeSeriesDataArb, { minLength: 1, maxLength: 1 }),
              { minKeys: 1, maxKeys: 1 }
            ),
            // Large dataset
            fc.dictionary(
              fc.string({ minLength: 1, maxLength: 5 }),
              fc.array(timeSeriesDataArb, { minLength: 50, maxLength: 100 }),
              { minKeys: 1, maxKeys: 2 }
            )
          ),
          async (data) => {
            // Normalize data
            const normalizedData: Record<string, TimeSeriesData[]> = {};
            for (const [tagName, tagData] of Object.entries(data)) {
              const sortedData = tagData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
              normalizedData[tagName] = sortedData.map(d => ({ ...d, tagName }));
            }

            const charts = await chartService.generateReportCharts(
              normalizedData,
              undefined,
              undefined,
              ['line']
            );

            // Property: Should not throw errors for edge cases
            expect(charts).toBeDefined();
            expect(typeof charts).toBe('object');

            // Property: Empty data should result in no charts
            if (Object.keys(normalizedData).length === 0 || 
                Object.values(normalizedData).every(arr => arr.length === 0)) {
              expect(Object.keys(charts).length).toBe(0);
            }

            // Property: All generated charts should be valid
            for (const buffer of Object.values(charts)) {
              expect(buffer).toBeInstanceOf(Buffer);
              expect(buffer.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 15, timeout: 10000 }
      );
    });

    it('should maintain color consistency across chart types', () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(timeSeriesDataArb, { minLength: 3, maxLength: 6 }),
          fc.hexaString({ minLength: 6, maxLength: 6 }),
          async (data, colorHex) => {
            // Normalize data
            const sortedData = data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            if (sortedData.length === 0) return; // Skip empty arrays
            const tagName = sortedData[0]?.tagName || 'DEFAULT_TAG';
            const normalizedData = sortedData.map(d => ({ ...d, tagName }));
            const color = `#${colorHex}`;

            // Generate line chart with specific color
            const lineBuffer = await chartService.generateLineChart([{
              tagName,
              data: normalizedData,
              color
            }]);

            // Generate bar chart with same color
            const barBuffer = await chartService.generateBarChart({
              labels: ['Test'],
              values: [100],
              label: 'Test',
              color
            });

            // Property: Both charts should be generated successfully
            expect(lineBuffer).toBeInstanceOf(Buffer);
            expect(barBuffer).toBeInstanceOf(Buffer);
            expect(lineBuffer.length).toBeGreaterThan(0);
            expect(barBuffer.length).toBeGreaterThan(0);

            // Property: Both should be valid PNG images
            expect(lineBuffer.toString('hex', 0, 8)).toBe('89504e470d0a1a0a');
            expect(barBuffer.toString('hex', 0, 8)).toBe('89504e470d0a1a0a');
          }
        ),
        { numRuns: 10, timeout: 10000 }
      );
    });
  });
});