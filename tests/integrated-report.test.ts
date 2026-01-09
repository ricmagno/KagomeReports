/**
 * Integrated Report Generation Test
 * Tests the integration of chart generation with PDF report generation
 */

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

import { ReportGenerationService, ReportConfig, ReportData } from '@/services/reportGeneration';
import { TimeSeriesData, StatisticsResult, TrendResult } from '@/types/historian';
import fs from 'fs';
import path from 'path';

describe('Integrated Report Generation', () => {
  let service: ReportGenerationService;

  beforeAll(() => {
    const testReportsDir = './test-reports';
    if (!fs.existsSync(testReportsDir)) {
      fs.mkdirSync(testReportsDir, { recursive: true });
    }
  });

  beforeEach(() => {
    service = new ReportGenerationService();
  });

  it('should generate PDF report with embedded charts', async () => {
    const config: ReportConfig = {
      id: 'integrated-test-001',
      name: 'Integrated Test Report',
      description: 'A test report with charts and data',
      tags: ['TEMP_01', 'PRESSURE_01'],
      timeRange: {
        startTime: new Date('2024-01-01T00:00:00Z'),
        endTime: new Date('2024-01-01T06:00:00Z')
      },
      chartTypes: ['line', 'bar', 'trend'],
      template: 'default',
      format: 'pdf',
      branding: {
        companyName: 'Test Industries',
        colors: {
          primary: '#0ea5e9',
          secondary: '#64748b'
        }
      }
    };

    const tempData: TimeSeriesData[] = [
      { tagName: 'TEMP_01', timestamp: new Date('2024-01-01T00:00:00Z'), value: 20.5, quality: 192 },
      { tagName: 'TEMP_01', timestamp: new Date('2024-01-01T01:00:00Z'), value: 21.2, quality: 192 },
      { tagName: 'TEMP_01', timestamp: new Date('2024-01-01T02:00:00Z'), value: 22.1, quality: 192 },
      { tagName: 'TEMP_01', timestamp: new Date('2024-01-01T03:00:00Z'), value: 23.0, quality: 192 },
      { tagName: 'TEMP_01', timestamp: new Date('2024-01-01T04:00:00Z'), value: 22.8, quality: 192 },
      { tagName: 'TEMP_01', timestamp: new Date('2024-01-01T05:00:00Z'), value: 21.9, quality: 192 }
    ];

    const pressureData: TimeSeriesData[] = [
      { tagName: 'PRESSURE_01', timestamp: new Date('2024-01-01T00:00:00Z'), value: 1013.2, quality: 192 },
      { tagName: 'PRESSURE_01', timestamp: new Date('2024-01-01T01:00:00Z'), value: 1012.8, quality: 192 },
      { tagName: 'PRESSURE_01', timestamp: new Date('2024-01-01T02:00:00Z'), value: 1012.1, quality: 192 },
      { tagName: 'PRESSURE_01', timestamp: new Date('2024-01-01T03:00:00Z'), value: 1011.9, quality: 192 },
      { tagName: 'PRESSURE_01', timestamp: new Date('2024-01-01T04:00:00Z'), value: 1012.3, quality: 192 },
      { tagName: 'PRESSURE_01', timestamp: new Date('2024-01-01T05:00:00Z'), value: 1013.1, quality: 192 }
    ];

    const statistics: Record<string, StatisticsResult> = {
      'TEMP_01': {
        min: 20.5,
        max: 23.0,
        average: 21.9,
        standardDeviation: 0.9,
        dataQuality: 100.0,
        count: 6
      },
      'PRESSURE_01': {
        min: 1011.9,
        max: 1013.2,
        average: 1012.6,
        standardDeviation: 0.5,
        dataQuality: 100.0,
        count: 6
      }
    };

    const trends: Record<string, TrendResult> = {
      'TEMP_01': {
        equation: 'y = 0.3x + 20.5',
        correlation: 0.85,
        confidence: 0.92,
        slope: 0.3,
        intercept: 20.5
      }
    };

    const reportData: ReportData = {
      config,
      data: {
        'TEMP_01': tempData,
        'PRESSURE_01': pressureData
      },
      statistics,
      trends,
      generatedAt: new Date()
    };

    const result = await service.generateReport(reportData);

    expect(result.success).toBe(true);
    expect(result.reportId).toBe('integrated-test-001');
    expect(result.filePath).toBeDefined();
    expect(result.buffer).toBeDefined();
    expect(result.metadata.format).toBe('pdf');
    expect(result.metadata.pages).toBeGreaterThan(0);
    expect(result.metadata.fileSize).toBeGreaterThan(0);

    // Verify file was created
    if (result.filePath) {
      expect(fs.existsSync(result.filePath)).toBe(true);
      
      // Verify file size matches metadata
      const stats = fs.statSync(result.filePath);
      expect(stats.size).toBe(result.metadata.fileSize);
    }

    // Verify buffer is valid PDF
    if (result.buffer) {
      const pdfHeader = result.buffer.toString('ascii', 0, 4);
      expect(pdfHeader).toBe('%PDF');
    }

    // Verify charts were generated and embedded
    expect(reportData.charts).toBeDefined();
    if (reportData.charts) {
      expect(Object.keys(reportData.charts).length).toBeGreaterThan(0);
      
      // Should have line charts for both tags
      expect(reportData.charts['TEMP_01_line']).toBeDefined();
      expect(reportData.charts['PRESSURE_01_line']).toBeDefined();
      
      // Should have trend chart for TEMP_01
      expect(reportData.charts['TEMP_01_trend']).toBeDefined();
      
      // Should have statistics summary chart
      expect(reportData.charts['statistics_summary']).toBeDefined();
    }
  }, 15000); // 15 second timeout for chart generation

  it('should generate PDF report without charts when chartTypes is empty', async () => {
    const config: ReportConfig = {
      id: 'no-charts-test',
      name: 'Report Without Charts',
      tags: ['TEST_TAG'],
      timeRange: {
        startTime: new Date('2024-01-01T00:00:00Z'),
        endTime: new Date('2024-01-01T01:00:00Z')
      },
      chartTypes: [], // No charts requested
      template: 'default',
      format: 'pdf'
    };

    const reportData: ReportData = {
      config,
      data: {
        'TEST_TAG': [
          { tagName: 'TEST_TAG', timestamp: new Date('2024-01-01T00:00:00Z'), value: 100, quality: 192 }
        ]
      },
      generatedAt: new Date()
    };

    const result = await service.generateReport(reportData);

    expect(result.success).toBe(true);
    expect(result.reportId).toBe('no-charts-test');
    
    // Should not have generated any charts
    expect(reportData.charts).toBeUndefined();
  });

  afterAll(() => {
    // Clean up test files
    const testReportsDir = './test-reports';
    if (fs.existsSync(testReportsDir)) {
      try {
        const files = fs.readdirSync(testReportsDir);
        files.forEach(file => {
          fs.unlinkSync(path.join(testReportsDir, file));
        });
        fs.rmdirSync(testReportsDir);
      } catch (error) {
        console.warn('Failed to clean up test directory:', error);
      }
    }
  });
});