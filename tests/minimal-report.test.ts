/**
 * Minimal Report Generation Test
 * Test to isolate the issue with ReportGenerationService
 */

import fs from 'fs';
import path from 'path';

// Mock the environment and logger before importing the service
jest.mock('@/config/environment', () => ({
  env: {
    REPORTS_DIR: './test-reports',
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

describe('Minimal Report Generation', () => {
  let service: ReportGenerationService;

  beforeAll(() => {
    // Ensure test directories exist
    const testReportsDir = './test-reports';
    if (!fs.existsSync(testReportsDir)) {
      fs.mkdirSync(testReportsDir, { recursive: true });
    }
  });

  beforeEach(() => {
    try {
      service = new ReportGenerationService();
    } catch (error) {
      console.error('Failed to create ReportGenerationService:', error);
      throw error;
    }
  });

  it('should create service instance', () => {
    expect(service).toBeDefined();
  });

  it('should generate minimal PDF report', async () => {
    const config: ReportConfig = {
      id: 'minimal-test',
      name: 'Minimal Test Report',
      tags: ['TEST_TAG'],
      timeRange: {
        startTime: new Date('2024-01-01T00:00:00Z'),
        endTime: new Date('2024-01-01T01:00:00Z')
      },
      chartTypes: [],
      template: 'default',
      format: 'pdf'
    };

    const reportData: ReportData = {
      config,
      data: {
        'TEST_TAG': [
          {
            tagName: 'TEST_TAG',
            timestamp: new Date('2024-01-01T00:00:00Z'),
            value: 100,
            quality: 192
          }
        ]
      },
      generatedAt: new Date()
    };

    console.log('Test data prepared, calling generateReport...');
    
    let result;
    try {
      result = await service.generateReport(reportData);
      console.log('generateReport completed, success:', result.success);
    } catch (error) {
      console.error('Exception during report generation:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }
    
    if (!result.success) {
      console.error('Report generation failed:', result.error);
      console.error('Full result:', JSON.stringify(result, null, 2));
      
      // Let's also try to understand what went wrong
      throw new Error(`Report generation failed: ${result.error}`);
    }
    
    expect(result.success).toBe(true);
    expect(result.reportId).toBe('minimal-test');
    
    if (result.buffer) {
      expect(result.buffer.toString('ascii', 0, 4)).toBe('%PDF');
    }
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