/**
 * Chart Generation Service Tests
 * Tests for chart generation functionality (Task 6.2)
 */

// Mock the environment and logger
jest.mock('@/config/environment', () => ({
  env: {
    CHART_WIDTH: 800,
    CHART_HEIGHT: 400,
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

import { ChartGenerationService, LineChartData, BarChartData, TrendChartData } from '@/services/chartGeneration';
import { TimeSeriesData, StatisticsResult, TrendResult } from '@/types/historian';

describe('ChartGenerationService', () => {
  let service: ChartGenerationService;

  beforeEach(() => {
    service = new ChartGenerationService();
  });

  describe('Line Chart Generation', () => {
    it('should generate a line chart buffer', async () => {
      const testData: TimeSeriesData[] = [
        {
          tagName: 'TEST_TAG',
          timestamp: new Date('2024-01-01T00:00:00Z'),
          value: 100,
          quality: 192
        },
        {
          tagName: 'TEST_TAG',
          timestamp: new Date('2024-01-01T01:00:00Z'),
          value: 105,
          quality: 192
        },
        {
          tagName: 'TEST_TAG',
          timestamp: new Date('2024-01-01T02:00:00Z'),
          value: 95,
          quality: 192
        }
      ];

      const lineChartData: LineChartData[] = [
        {
          tagName: 'TEST_TAG',
          data: testData,
          color: '#3b82f6'
        }
      ];

      const buffer = await service.generateLineChart(lineChartData, {
        title: 'Test Line Chart',
        width: 400,
        height: 300
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      
      // Verify it's a PNG image
      expect(buffer.toString('hex', 0, 8)).toBe('89504e470d0a1a0a'); // PNG signature
    });

    it('should handle multiple datasets', async () => {
      const testData1: TimeSeriesData[] = [
        { tagName: 'TAG1', timestamp: new Date('2024-01-01T00:00:00Z'), value: 100, quality: 192 },
        { tagName: 'TAG1', timestamp: new Date('2024-01-01T01:00:00Z'), value: 105, quality: 192 }
      ];

      const testData2: TimeSeriesData[] = [
        { tagName: 'TAG2', timestamp: new Date('2024-01-01T00:00:00Z'), value: 200, quality: 192 },
        { tagName: 'TAG2', timestamp: new Date('2024-01-01T01:00:00Z'), value: 195, quality: 192 }
      ];

      const lineChartData: LineChartData[] = [
        { tagName: 'TAG1', data: testData1 },
        { tagName: 'TAG2', data: testData2 }
      ];

      const buffer = await service.generateLineChart(lineChartData);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('Bar Chart Generation', () => {
    it('should generate a bar chart buffer', async () => {
      const barChartData: BarChartData = {
        labels: ['Category A', 'Category B', 'Category C'],
        values: [10, 20, 15],
        label: 'Test Data',
        color: '#10b981'
      };

      const buffer = await service.generateBarChart(barChartData, {
        title: 'Test Bar Chart'
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      
      // Verify it's a PNG image
      expect(buffer.toString('hex', 0, 8)).toBe('89504e470d0a1a0a');
    });
  });

  describe('Trend Chart Generation', () => {
    it('should generate a trend chart with regression line', async () => {
      const testData: TimeSeriesData[] = [
        { tagName: 'TREND_TAG', timestamp: new Date('2024-01-01T00:00:00Z'), value: 100, quality: 192 },
        { tagName: 'TREND_TAG', timestamp: new Date('2024-01-01T01:00:00Z'), value: 105, quality: 192 },
        { tagName: 'TREND_TAG', timestamp: new Date('2024-01-01T02:00:00Z'), value: 110, quality: 192 }
      ];

      const trendResult: TrendResult = {
        equation: 'y = 5x + 100',
        correlation: 0.95,
        confidence: 0.90,
        slope: 5,
        intercept: 100
      };

      const trendChartData: TrendChartData = {
        tagName: 'TREND_TAG',
        data: testData,
        trend: trendResult
      };

      const buffer = await service.generateTrendChart(trendChartData);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      
      // Verify it's a PNG image
      expect(buffer.toString('hex', 0, 8)).toBe('89504e470d0a1a0a');
    });
  });

  describe('Statistics Chart Generation', () => {
    it('should generate a statistics summary chart', async () => {
      const statistics: Record<string, StatisticsResult> = {
        'TAG1': {
          min: 95,
          max: 105,
          average: 100,
          standardDeviation: 3.5,
          dataQuality: 95.0,
          count: 10
        },
        'TAG2': {
          min: 190,
          max: 210,
          average: 200,
          standardDeviation: 7.2,
          dataQuality: 98.5,
          count: 15
        }
      };

      const buffer = await service.generateStatisticsChart(statistics);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      
      // Verify it's a PNG image
      expect(buffer.toString('hex', 0, 8)).toBe('89504e470d0a1a0a');
    });
  });

  describe('Report Charts Generation', () => {
    it('should generate multiple charts for a report', async () => {
      const data: Record<string, TimeSeriesData[]> = {
        'TAG1': [
          { tagName: 'TAG1', timestamp: new Date('2024-01-01T00:00:00Z'), value: 100, quality: 192 },
          { tagName: 'TAG1', timestamp: new Date('2024-01-01T01:00:00Z'), value: 105, quality: 192 }
        ],
        'TAG2': [
          { tagName: 'TAG2', timestamp: new Date('2024-01-01T00:00:00Z'), value: 200, quality: 192 },
          { tagName: 'TAG2', timestamp: new Date('2024-01-01T01:00:00Z'), value: 195, quality: 192 }
        ]
      };

      const statistics: Record<string, StatisticsResult> = {
        'TAG1': { min: 100, max: 105, average: 102.5, standardDeviation: 2.5, dataQuality: 100, count: 2 },
        'TAG2': { min: 195, max: 200, average: 197.5, standardDeviation: 2.5, dataQuality: 100, count: 2 }
      };

      const trends: Record<string, TrendResult> = {
        'TAG1': { equation: 'y = 5x + 100', correlation: 1.0, confidence: 1.0, slope: 5, intercept: 100 }
      };

      const charts = await service.generateReportCharts(
        data,
        statistics,
        trends,
        ['line', 'bar', 'trend']
      );

      expect(Object.keys(charts).length).toBeGreaterThan(0);
      
      // Should have line charts for each tag
      expect(charts['TAG1_line']).toBeInstanceOf(Buffer);
      expect(charts['TAG2_line']).toBeInstanceOf(Buffer);
      
      // Should have trend chart for TAG1
      expect(charts['TAG1_trend']).toBeInstanceOf(Buffer);
      
      // Should have statistics summary chart
      expect(charts['statistics_summary']).toBeInstanceOf(Buffer);
      
      // Verify all are valid PNG images
      Object.values(charts).forEach(buffer => {
        expect(buffer.toString('hex', 0, 8)).toBe('89504e470d0a1a0a');
      });
    });

    it('should handle empty data gracefully', async () => {
      const emptyData: Record<string, TimeSeriesData[]> = {
        'EMPTY_TAG': []
      };

      const charts = await service.generateReportCharts(emptyData, undefined, undefined, ['line']);

      // Should not generate charts for empty data
      expect(Object.keys(charts).length).toBe(0);
    });
  });

  describe('Utility Methods', () => {
    it('should add alpha transparency to hex colors', () => {
      const service = new ChartGenerationService();
      
      // Access private method through any cast for testing
      const addAlpha = (service as any).addAlpha.bind(service);
      
      const result = addAlpha('#3b82f6', 0.5);
      expect(result).toBe('rgba(59, 130, 246, 0.5)');
    });

    it('should handle undefined colors', () => {
      const service = new ChartGenerationService();
      
      const addAlpha = (service as any).addAlpha.bind(service);
      
      const result = addAlpha(undefined, 0.5);
      expect(result).toBe('rgba(0, 0, 0, 0.5)');
    });

    it('should return original color for non-hex colors', () => {
      const service = new ChartGenerationService();
      
      const addAlpha = (service as any).addAlpha.bind(service);
      
      const result = addAlpha('blue', 0.5);
      expect(result).toBe('blue');
    });
  });
});