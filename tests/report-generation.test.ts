/**
 * Report Generation Service Tests
 * Tests for PDF generation functionality (Task 6.1)
 */

import { ReportGenerationService, ReportConfig, ReportData } from '@/services/reportGeneration';
import { TimeSeriesData, StatisticsResult, TrendResult } from '@/types/historian';
import fs from 'fs';
import path from 'path';

// Mock the environment configuration for testing
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

// Mock the logger to avoid file system issues in tests
jest.mock('@/utils/logger', () => ({
  reportLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('ReportGenerationService', () => {
  let service: ReportGenerationService;
  const testOutputDir = path.join(process.cwd(), 'test-reports');

  beforeAll(() => {
    // Create test output directory
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  beforeEach(() => {
    service = new ReportGenerationService();
  });

  afterAll(() => {
    // Clean up test files
    if (fs.existsSync(testOutputDir)) {
      const files = fs.readdirSync(testOutputDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(testOutputDir, file));
      });
      fs.rmdirSync(testOutputDir);
    }
  });

  describe('PDF Generation', () => {
    it('should generate a basic PDF report successfully', async () => {
      // Create test data
      const config: ReportConfig = {
        id: 'test-report-001',
        name: 'Test Report',
        description: 'A test report for validation',
        tags: ['TAG001', 'TAG002'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z')
        },
        chartTypes: ['line', 'bar'],
        template: 'default',
        format: 'pdf',
        branding: {
          companyName: 'Test Company',
          colors: {
            primary: '#0ea5e9',
            secondary: '#64748b'
          }
        },
        metadata: {
          author: 'Test Author',
          subject: 'Test Subject',
          keywords: ['test', 'report', 'validation']
        }
      };

      const testData: TimeSeriesData[] = [
        {
          tagName: 'TAG001',
          timestamp: new Date('2024-01-01T00:00:00Z'),
          value: 100.5,
          quality: 192
        },
        {
          tagName: 'TAG001',
          timestamp: new Date('2024-01-01T01:00:00Z'),
          value: 102.3,
          quality: 192
        },
        {
          tagName: 'TAG001',
          timestamp: new Date('2024-01-01T02:00:00Z'),
          value: 98.7,
          quality: 192
        }
      ];

      const statistics: Record<string, StatisticsResult> = {
        'TAG001': {
          min: 98.7,
          max: 102.3,
          average: 100.5,
          standardDeviation: 1.8,
          dataQuality: 100.0,
          count: 3
        }
      };

      const trends: Record<string, TrendResult> = {
        'TAG001': {
          equation: 'y = 0.5x + 100',
          correlation: 0.85,
          confidence: 0.92,
          slope: 0.5,
          intercept: 100
        }
      };

      const reportData: ReportData = {
        config,
        data: {
          'TAG001': testData,
          'TAG002': testData.slice(0, 2)
        },
        statistics,
        trends,
        generatedAt: new Date()
      };

      // Generate the report
      const result = await service.generateReport(reportData);

      // Log error if generation failed
      if (!result.success) {
        console.error('Report generation failed:', result.error);
        console.error('Full result:', JSON.stringify(result, null, 2));
      }

      // Validate the result
      expect(result.success).toBe(true);
      expect(result.reportId).toBe('test-report-001');
      expect(result.filePath).toBeDefined();
      expect(result.buffer).toBeDefined();
      expect(result.metadata.format).toBe('pdf');
      expect(result.metadata.pages).toBeGreaterThan(0);
      expect(result.metadata.fileSize).toBeGreaterThan(0);
      expect(result.metadata.generationTime).toBeGreaterThan(0);

      // Verify file was created
      if (result.filePath) {
        expect(fs.existsSync(result.filePath)).toBe(true);
        
        // Verify file size matches metadata
        const stats = fs.statSync(result.filePath);
        expect(stats.size).toBe(result.metadata.fileSize);
      }

      // Verify buffer is valid PDF (starts with PDF header)
      if (result.buffer) {
        const pdfHeader = result.buffer.toString('ascii', 0, 4);
        expect(pdfHeader).toBe('%PDF');
      }
    }, 10000); // 10 second timeout for PDF generation

    it('should handle empty data gracefully', async () => {
      const config: ReportConfig = {
        id: 'test-empty-report',
        name: 'Empty Report',
        tags: ['EMPTY_TAG'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z')
        },
        chartTypes: ['line'],
        template: 'default',
        format: 'pdf'
      };

      const reportData: ReportData = {
        config,
        data: {
          'EMPTY_TAG': []
        },
        generatedAt: new Date()
      };

      const result = await service.generateReport(reportData);

      expect(result.success).toBe(true);
      expect(result.metadata.pages).toBeGreaterThan(0);
    });

    it('should include all required sections in PDF', async () => {
      const config: ReportConfig = {
        id: 'test-complete-report',
        name: 'Complete Test Report',
        description: 'Testing all PDF sections',
        tags: ['TAG001'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z')
        },
        chartTypes: ['line'],
        template: 'default',
        format: 'pdf',
        branding: {
          companyName: 'Test Industries'
        }
      };

      const testData: TimeSeriesData[] = [
        { tagName: 'TAG001', timestamp: new Date('2024-01-01T00:00:00Z'), value: 100, quality: 192 },
        { tagName: 'TAG001', timestamp: new Date('2024-01-01T01:00:00Z'), value: 105, quality: 192 },
        { tagName: 'TAG001', timestamp: new Date('2024-01-01T02:00:00Z'), value: 95, quality: 0 }
      ];

      const statistics: Record<string, StatisticsResult> = {
        'TAG001': {
          min: 95,
          max: 105,
          average: 100,
          standardDeviation: 5,
          dataQuality: 66.7,
          count: 3
        }
      };

      const reportData: ReportData = {
        config,
        data: { 'TAG001': testData },
        statistics,
        generatedAt: new Date()
      };

      const result = await service.generateReport(reportData);

      expect(result.success).toBe(true);
      expect(result.metadata.pages).toBeGreaterThanOrEqual(2); // Should have multiple pages
      
      // Verify buffer contains expected content markers
      if (result.buffer) {
        const pdfContent = result.buffer.toString();
        
        // Check for report title
        expect(pdfContent).toContain('Complete Test Report');
        
        // Check for company branding
        expect(pdfContent).toContain('Test Industries');
        
        // Check for tag name
        expect(pdfContent).toContain('TAG001');
      }
    });

    it('should handle unsupported format gracefully', async () => {
      const config: ReportConfig = {
        id: 'test-unsupported',
        name: 'Unsupported Format Test',
        tags: ['TAG001'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z')
        },
        chartTypes: ['line'],
        template: 'default',
        format: 'docx' // Not yet implemented
      };

      const reportData: ReportData = {
        config,
        data: { 'TAG001': [] },
        generatedAt: new Date()
      };

      const result = await service.generateReport(reportData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('DOCX format not yet implemented');
    });

    it('should validate data quality breakdown calculations', async () => {
      const config: ReportConfig = {
        id: 'test-quality-breakdown',
        name: 'Quality Breakdown Test',
        tags: ['TAG001'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z')
        },
        chartTypes: ['line'],
        template: 'default',
        format: 'pdf'
      };

      // Create data with mixed quality codes
      const testData: TimeSeriesData[] = [
        { tagName: 'TAG001', timestamp: new Date('2024-01-01T00:00:00Z'), value: 100, quality: 192 }, // Good
        { tagName: 'TAG001', timestamp: new Date('2024-01-01T01:00:00Z'), value: 105, quality: 192 }, // Good
        { tagName: 'TAG001', timestamp: new Date('2024-01-01T02:00:00Z'), value: 95, quality: 0 },   // Bad
        { tagName: 'TAG001', timestamp: new Date('2024-01-01T03:00:00Z'), value: 98, quality: 64 },  // Uncertain
        { tagName: 'TAG001', timestamp: new Date('2024-01-01T04:00:00Z'), value: 102, quality: 192 } // Good
      ];

      const reportData: ReportData = {
        config,
        data: { 'TAG001': testData },
        generatedAt: new Date()
      };

      const result = await service.generateReport(reportData);

      expect(result.success).toBe(true);
      
      // The quality breakdown should be calculated correctly:
      // Good: 3/5 = 60%, Bad: 1/5 = 20%, Uncertain: 1/5 = 20%
      if (result.buffer) {
        const pdfContent = result.buffer.toString();
        // These percentages should appear in the PDF content
        expect(pdfContent).toContain('60.0%'); // Good quality percentage
        expect(pdfContent).toContain('20.0%'); // Bad quality percentage
      }
    });
  });

  describe('Template System', () => {
    it('should load and compile default template', async () => {
      const template = await service.loadTemplate('default');
      expect(template).toBeDefined();
      expect(typeof template).toBe('function');
    });

    it('should create default template if none exists', async () => {
      const templateName = 'test-template';
      const template = await service.loadTemplate(templateName);
      
      expect(template).toBeDefined();
      
      // Verify template file was created
      const templatePath = path.join(process.cwd(), 'templates', `${templateName}.hbs`);
      expect(fs.existsSync(templatePath)).toBe(true);
      
      // Clean up
      if (fs.existsSync(templatePath)) {
        fs.unlinkSync(templatePath);
      }
    });
  });
});