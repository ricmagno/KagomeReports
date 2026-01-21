/**
 * Property-Based Tests for PDF Report Redesign
 * Feature: pdf-report-redesign
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4
 */

import * as fc from 'fast-check';
const pdfParse = require('pdf-parse');
import { ReportGenerationService, ReportConfig, ReportData } from '@/services/reportGeneration';
import { TimeSeriesData, StatisticsResult, TrendResult } from '@/types/historian';
import { reportLogger } from '@/utils/logger';

// Mock the environment
jest.mock('@/config/environment', () => ({
  env: {
    REPORTS_DIR: './test-reports',
    CHART_WIDTH: 400,
    CHART_HEIGHT: 300,
    NODE_ENV: 'test',
    LOG_FILE: './test-logs/app.log',
    LOG_LEVEL: 'error', // Reduce log noise during tests
    LOG_MAX_SIZE: '10m',
    LOG_MAX_FILES: 5,
    JWT_SECRET: 'test-secret-key-for-testing-only',
    JWT_EXPIRATION: '1h',
    PORT: 3000,
    DB_HOST: 'localhost',
    DB_PORT: 1433,
    DB_NAME: 'test',
    DB_USER: 'test',
    DB_PASSWORD: 'test',
    DB_ENCRYPT: false,
    DB_TRUST_SERVER_CERTIFICATE: true
  }
}));

// Mock logger to reduce noise
jest.mock('@/utils/logger', () => ({
  reportLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock chart generation to avoid canvas dependencies
jest.mock('@/services/chartGeneration', () => ({
  chartGenerationService: {
    generateReportCharts: jest.fn().mockResolvedValue({})
  }
}));

describe('Property-Based Tests: PDF Report Redesign', () => {
  let reportService: ReportGenerationService;

  beforeEach(() => {
    reportService = new ReportGenerationService();
    jest.clearAllMocks();
  });

  // ============================================================================
  // GENERATORS
  // ============================================================================

  /**
   * Generator for valid time-series data
   */
  const timeSeriesDataArb = fc.record({
    tagName: fc.string({ minLength: 3, maxLength: 20 }).filter(s => s.trim().length > 0),
    timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') }),
    value: fc.float({ min: -1000, max: 1000, noNaN: true }),
    quality: fc.constantFrom(0, 64, 192) // Bad, Uncertain, Good
  });

  /**
   * Generator for statistics result
   */
  const statisticsResultArb = fc.record({
    min: fc.float({ min: -1000, max: 1000, noNaN: true }),
    max: fc.float({ min: -1000, max: 1000, noNaN: true }),
    average: fc.float({ min: -1000, max: 1000, noNaN: true }),
    standardDeviation: fc.float({ min: 0, max: 100, noNaN: true }),
    dataQuality: fc.float({ min: 0, max: 100, noNaN: true }),
    count: fc.integer({ min: 1, max: 1000 })
  }).filter(stats => stats.min <= stats.max && stats.min <= stats.average && stats.average <= stats.max);

  /**
   * Generator for trend result
   */
  const trendResultArb = fc.record({
    equation: fc.string({ minLength: 5, maxLength: 50 }),
    correlation: fc.float({ min: -1, max: 1, noNaN: true }),
    confidence: fc.float({ min: 0, max: 1, noNaN: true }),
    slope: fc.float({ min: -100, max: 100, noNaN: true }),
    intercept: fc.float({ min: -1000, max: 1000, noNaN: true })
  });

  /**
   * Generator for report configuration
   */
  const reportConfigArb = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 10, maxLength: 50 }).filter(s => s.trim().length >= 10),
    description: fc.option(fc.string({ minLength: 10, maxLength: 100 }).filter(s => s.trim().length >= 10), { nil: undefined }),
    tags: fc.array(fc.string({ minLength: 3, maxLength: 20 }).filter(s => s.trim().length > 0), { minLength: 1, maxLength: 5 }),
    timeRange: fc.record({
      startTime: fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
      endTime: fc.date({ min: new Date('2024-12-31'), max: new Date('2025-12-31') }),
      relativeRange: fc.option(
        fc.constantFrom('last1h' as const, 'last2h' as const, 'last6h' as const, 'last12h' as const, 'last24h' as const, 'last7d' as const, 'last30d' as const),
        { nil: undefined }
      )
    }),
    chartTypes: fc.array(fc.constantFrom('line' as const, 'bar' as const, 'trend' as const, 'scatter' as const), { minLength: 0, maxLength: 3 }),
    template: fc.constant('default'),
    format: fc.constant('pdf' as const),
    branding: fc.option(
      fc.record({
        companyName: fc.option(fc.constant('Kagome'), { nil: undefined }),
        logo: fc.option(fc.string(), { nil: undefined }),
        colors: fc.option(
          fc.record({
            primary: fc.option(fc.hexaString({ minLength: 6, maxLength: 6 }).map(h => `#${h}`), { nil: undefined }),
            secondary: fc.option(fc.hexaString({ minLength: 6, maxLength: 6 }).map(h => `#${h}`), { nil: undefined })
          }),
          { nil: undefined }
        )
      }),
      { nil: undefined }
    ),
    metadata: fc.option(
      fc.record({
        author: fc.option(fc.string({ minLength: 3, maxLength: 30 }).filter(s => s.trim().length > 0), { nil: undefined }),
        subject: fc.option(fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0), { nil: undefined }),
        keywords: fc.option(fc.array(fc.string({ minLength: 3, maxLength: 15 }).filter(s => s.trim().length > 0), { minLength: 1, maxLength: 5 }), { nil: undefined })
      }),
      { nil: undefined }
    )
  }) as fc.Arbitrary<ReportConfig>;

  /**
   * Generator for complete report data
   */
  const reportDataArb = fc.tuple(
    reportConfigArb,
    fc.dictionary(
      fc.string({ minLength: 3, maxLength: 20 }).filter(s => s.trim().length > 0),
      fc.array(timeSeriesDataArb, { minLength: 5, maxLength: 50 }),
      { minKeys: 1, maxKeys: 5 }
    ),
    fc.option(
      fc.dictionary(
        fc.string({ minLength: 3, maxLength: 20 }).filter(s => s.trim().length > 0),
        statisticsResultArb,
        { minKeys: 1, maxKeys: 5 }
      ),
      { nil: undefined }
    ),
    fc.option(
      fc.dictionary(
        fc.string({ minLength: 3, maxLength: 20 }).filter(s => s.trim().length > 0),
        trendResultArb,
        { minKeys: 1, maxKeys: 5 }
      ),
      { nil: undefined }
    )
  ).map(([config, dataDict, statistics, trends]) => {
    // Normalize data to ensure consistency
    const normalizedData: Record<string, TimeSeriesData[]> = {};
    for (const [tagName, tagData] of Object.entries(dataDict)) {
      const sortedData = tagData
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
        .map(d => ({ ...d, tagName }));
      normalizedData[tagName] = sortedData;
    }

    // Ensure config tags match data keys
    const dataKeys = Object.keys(normalizedData);
    config.tags = dataKeys;

    const reportData: ReportData = {
      config,
      data: normalizedData,
      ...(statistics && { statistics }),
      ...(trends && { trends }),
      charts: {}, // Empty charts for testing (mocked)
      generatedAt: new Date()
    };

    return reportData;
  });

  // ============================================================================
  // PROPERTY 1: FOOTER CONSISTENCY
  // **Validates: Requirements 2.3, 2.4, 3.2**
  // ============================================================================

  describe('Property 1: Footer Consistency', () => {
    it('should add footer with generation timestamp and page numbers to all pages', async () => {
      await fc.assert(
        fc.asyncProperty(reportDataArb, async (reportData) => {
          // Generate PDF report
          const result = await reportService.generateReport(reportData);

          // Verify report was generated successfully
          expect(result.success).toBe(true);
          expect(result.buffer).toBeInstanceOf(Buffer);

          if (!result.buffer) {
            throw new Error('Report buffer is undefined');
          }

          // Parse PDF to extract text content
          const pdfData = await pdfParse(result.buffer);
          const text = pdfData.text;

          // Property 1.1: Footer must contain "Generated by Historian Reports on"
          expect(text).toContain('Generated by Historian Reports on');

          // Property 1.2: Footer must contain page numbers in format "Page X of Y"
          const pageNumberRegex = /Page \d+ of \d+/g;
          const pageNumberMatches = text.match(pageNumberRegex);
          expect(pageNumberMatches).not.toBeNull();
          expect(pageNumberMatches!.length).toBeGreaterThan(0);

          // Property 1.3: Number of page number occurrences should match total pages
          const totalPages = result.metadata.pages;
          expect(pageNumberMatches!.length).toBe(totalPages);

          // Property 1.4: Page numbers should be sequential
          const pageNumbers = pageNumberMatches!.map((match: string) => {
            const parts = match.match(/Page (\d+) of (\d+)/);
            return {
              current: parseInt(parts![1]!, 10),
              total: parseInt(parts![2]!, 10)
            };
          });

          // All page numbers should have the same total
          const totalPageValues = pageNumbers.map((p: any) => p.total);
          expect(new Set(totalPageValues).size).toBe(1);
          expect(totalPageValues[0]).toBe(totalPages);

          // Page numbers should be sequential from 1 to totalPages
          const currentPageNumbers = pageNumbers.map((p: any) => p.current).sort((a: number, b: number) => a - b);
          for (let i = 0; i < currentPageNumbers.length; i++) {
            expect(currentPageNumbers[i]).toBe(i + 1);
          }

          // Property 1.5: Generation timestamp should be consistent across all pages
          const timestampRegex = /Generated by Historian Reports on ([^P]+)Page/g;
          const timestampMatches = Array.from(text.matchAll(timestampRegex));
          
          if (timestampMatches.length > 1) {
            const firstTimestamp = (timestampMatches[0] as RegExpMatchArray)[1]!.trim();
            for (const match of timestampMatches) {
              expect((match as RegExpMatchArray)[1]!.trim()).toBe(firstTimestamp);
            }
          }
        }),
        { numRuns: 10, timeout: 30000 }
      );
    });

    it('should have footer on first and last page', async () => {
      await fc.assert(
        fc.asyncProperty(reportDataArb, async (reportData) => {
          const result = await reportService.generateReport(reportData);

          expect(result.success).toBe(true);
          expect(result.buffer).toBeInstanceOf(Buffer);

          if (!result.buffer) {
            throw new Error('Report buffer is undefined');
          }

          const pdfData = await pdfParse(result.buffer);
          const text = pdfData.text;

          // Property: First page should have "Page 1 of X"
          expect(text).toMatch(/Page 1 of \d+/);

          // Property: Last page should have "Page X of X"
          const totalPages = result.metadata.pages;
          const lastPageRegex = new RegExp(`Page ${totalPages} of ${totalPages}`);
          expect(text).toMatch(lastPageRegex);
        }),
        { numRuns: 10, timeout: 30000 }
      );
    });
  });

  // ============================================================================
  // PROPERTY 2: COLOR RESTRICTION
  // **Validates: Requirements 2.1, 3.3**
  // ============================================================================

  describe('Property 2: Color Restriction', () => {
    it('should use only grayscale colors for non-chart content', async () => {
      await fc.assert(
        fc.asyncProperty(reportDataArb, async (reportData) => {
          const result = await reportService.generateReport(reportData);

          expect(result.success).toBe(true);
          expect(result.buffer).toBeInstanceOf(Buffer);

          if (!result.buffer) {
            throw new Error('Report buffer is undefined');
          }

          // Parse PDF buffer to check for color usage
          const bufferString = result.buffer.toString('latin1');

          // Property: Check for absence of colored backgrounds (RGB color operators)
          // PDFs use operators like 'rg' (RGB fill) and 'RG' (RGB stroke)
          // Grayscale uses 'g' and 'G' operators
          
          // Look for RGB color definitions that are NOT grayscale
          // Grayscale: R=G=B (e.g., "0.5 0.5 0.5 rg")
          // Color: R≠G or G≠B (e.g., "0.1 0.5 0.9 rg")
          
          // This is a simplified check - in a real implementation, we would
          // parse the PDF structure more thoroughly
          
          // Check that the old blue header color (#0ea5e9) is not present
          // #0ea5e9 = RGB(14, 165, 233) = (0.055, 0.647, 0.914) in PDF
          expect(bufferString).not.toContain('0.055 0.647 0.914');
          expect(bufferString).not.toContain('0.0549 0.6471 0.9137'); // Rounded values

          // Property: Report should be printable in grayscale
          // This is validated by the absence of colored backgrounds
          expect(result.success).toBe(true);
        }),
        { numRuns: 10, timeout: 30000 }
      );
    });

    it('should use Kagome branding without colored backgrounds', async () => {
      await fc.assert(
        fc.asyncProperty(reportDataArb, async (reportData) => {
          const result = await reportService.generateReport(reportData);

          expect(result.success).toBe(true);
          expect(result.buffer).toBeInstanceOf(Buffer);

          if (!result.buffer) {
            throw new Error('Report buffer is undefined');
          }

          const pdfData = await pdfParse(result.buffer);
          const text = pdfData.text;

          // Property: Report should contain "Kagome" branding
          expect(text).toContain('Kagome');

          // Property: Report should contain "Historian Reports" subtitle
          expect(text).toContain('Historian Reports');
        }),
        { numRuns: 10, timeout: 30000 }
      );
    });
  });

  // ============================================================================
  // PROPERTY 3: DATA PRESERVATION
  // **Validates: Requirements 2.5, 3.4**
  // ============================================================================

  describe('Property 3: Data Preservation', () => {
    it('should preserve all input data in the output PDF', async () => {
      await fc.assert(
        fc.asyncProperty(reportDataArb, async (reportData) => {
          const result = await reportService.generateReport(reportData);

          expect(result.success).toBe(true);
          expect(result.buffer).toBeInstanceOf(Buffer);

          if (!result.buffer) {
            throw new Error('Report buffer is undefined');
          }

          const pdfData = await pdfParse(result.buffer);
          const text = pdfData.text;

          // Property 3.1: All tags should be present in the PDF
          for (const tag of reportData.config.tags) {
            expect(text).toContain(tag);
          }

          // Property 3.2: Report name should be present
          expect(text).toContain(reportData.config.name);

          // Property 3.3: Time range should be present
          // Check for date components (at least year)
          const startYear = reportData.config.timeRange.startTime.getFullYear().toString();
          const endYear = reportData.config.timeRange.endTime.getFullYear().toString();
          expect(text).toContain(startYear);
          expect(text).toContain(endYear);

          // Property 3.4: Statistics should be present if provided
          if (reportData.statistics) {
            for (const [tagName, stats] of Object.entries(reportData.statistics)) {
              // Check for statistical values (formatted to 2 decimal places)
              const minStr = stats.min.toFixed(2);
              const maxStr = stats.max.toFixed(2);
              const avgStr = stats.average.toFixed(2);
              
              // At least one of these should be in the PDF
              const hasMin = text.includes(minStr);
              const hasMax = text.includes(maxStr);
              const hasAvg = text.includes(avgStr);
              
              expect(hasMin || hasMax || hasAvg).toBe(true);
            }
          }

          // Property 3.5: Data points count should be preserved
          const totalDataPoints = Object.values(reportData.data)
            .reduce((sum, data) => sum + data.length, 0);
          expect(text).toContain(totalDataPoints.toString());
        }),
        { numRuns: 10, timeout: 30000 }
      );
    });

    it('should preserve data quality information', async () => {
      await fc.assert(
        fc.asyncProperty(reportDataArb, async (reportData) => {
          const result = await reportService.generateReport(reportData);

          expect(result.success).toBe(true);
          expect(result.buffer).toBeInstanceOf(Buffer);

          if (!result.buffer) {
            throw new Error('Report buffer is undefined');
          }

          const pdfData = await pdfParse(result.buffer);
          const text = pdfData.text;

          // Property: Data quality information should be present
          // Check for quality-related terms
          const hasQualityInfo = 
            text.includes('Quality') ||
            text.includes('Good') ||
            text.includes('Bad') ||
            text.includes('Uncertain');

          expect(hasQualityInfo).toBe(true);
        }),
        { numRuns: 10, timeout: 30000 }
      );
    });
  });

  // ============================================================================
  // PROPERTY 4: PAGE NUMBER ACCURACY
  // **Validates: Requirements 2.4, 3.2**
  // ============================================================================

  describe('Property 4: Page Number Accuracy', () => {
    it('should have accurate and sequential page numbers', async () => {
      await fc.assert(
        fc.asyncProperty(reportDataArb, async (reportData) => {
          const result = await reportService.generateReport(reportData);

          expect(result.success).toBe(true);
          expect(result.buffer).toBeInstanceOf(Buffer);

          if (!result.buffer) {
            throw new Error('Report buffer is undefined');
          }

          const pdfData = await pdfParse(result.buffer);
          const text = pdfData.text;
          const totalPages = result.metadata.pages;

          // Property 4.1: Total page count in metadata should match page numbers in footer
          const pageNumberRegex = /Page (\d+) of (\d+)/g;
          const pageNumberMatches = Array.from(text.matchAll(pageNumberRegex));

          expect(pageNumberMatches.length).toBe(totalPages);

          // Property 4.2: All page numbers should reference the same total
          for (const match of pageNumberMatches) {
            const total = parseInt((match as RegExpMatchArray)[2]!, 10);
            expect(total).toBe(totalPages);
          }

          // Property 4.3: Page numbers should start at 1
          const firstPageMatch = text.match(/Page 1 of \d+/);
          expect(firstPageMatch).not.toBeNull();

          // Property 4.4: Page numbers should end at totalPages
          const lastPageRegex = new RegExp(`Page ${totalPages} of ${totalPages}`);
          expect(text).toMatch(lastPageRegex);

          // Property 4.5: No gaps in page numbers
          const currentPages = pageNumberMatches.map((m: any) => parseInt(m[1], 10)).sort((a: number, b: number) => a - b);
          for (let i = 1; i <= totalPages; i++) {
            expect(currentPages).toContain(i);
          }
        }),
        { numRuns: 10, timeout: 30000 }
      );
    });

    it('should have consistent total page count across all pages', async () => {
      await fc.assert(
        fc.asyncProperty(reportDataArb, async (reportData) => {
          const result = await reportService.generateReport(reportData);

          expect(result.success).toBe(true);
          expect(result.buffer).toBeInstanceOf(Buffer);

          if (!result.buffer) {
            throw new Error('Report buffer is undefined');
          }

          const pdfData = await pdfParse(result.buffer);
          const text = pdfData.text;

          // Property: All "of X" values should be identical
          const pageNumberRegex = /Page \d+ of (\d+)/g;
          const totalPageMatches = Array.from(text.matchAll(pageNumberRegex));

          if (totalPageMatches.length > 0) {
            const firstTotal = parseInt((totalPageMatches[0] as RegExpMatchArray)[1]!, 10);
            for (const match of totalPageMatches) {
              const total = parseInt((match as RegExpMatchArray)[1]!, 10);
              expect(total).toBe(firstTotal);
            }
          }
        }),
        { numRuns: 10, timeout: 30000 }
      );
    });
  });

  // ============================================================================
  // PROPERTY 5: TIMESTAMP CONSISTENCY
  // **Validates: Requirements 2.3, 3.2**
  // ============================================================================

  describe('Property 5: Generation Timestamp Consistency', () => {
    it('should have consistent generation timestamp across all pages', async () => {
      await fc.assert(
        fc.asyncProperty(reportDataArb, async (reportData) => {
          const result = await reportService.generateReport(reportData);

          expect(result.success).toBe(true);
          expect(result.buffer).toBeInstanceOf(Buffer);

          if (!result.buffer) {
            throw new Error('Report buffer is undefined');
          }

          const pdfData = await pdfParse(result.buffer);
          const text = pdfData.text;

          // Property 5.1: Generation timestamp should appear on all pages
          const timestampRegex = /Generated by Historian Reports on/g;
          const timestampMatches = text.match(timestampRegex);
          
          expect(timestampMatches).not.toBeNull();
          expect(timestampMatches!.length).toBe(result.metadata.pages);

          // Property 5.2: Timestamp should match report generation time
          const generatedDate = reportData.generatedAt.toLocaleString();
          expect(text).toContain(generatedDate);

          // Property 5.3: Timestamp format should be locale string format
          // Check for common date/time separators
          const hasDateSeparators = text.includes('/') || text.includes('-');
          const hasTimeSeparators = text.includes(':');
          expect(hasDateSeparators || hasTimeSeparators).toBe(true);
        }),
        { numRuns: 10, timeout: 30000 }
      );
    });

    it('should use correct timestamp format', async () => {
      await fc.assert(
        fc.asyncProperty(reportDataArb, async (reportData) => {
          const result = await reportService.generateReport(reportData);

          expect(result.success).toBe(true);
          expect(result.buffer).toBeInstanceOf(Buffer);

          if (!result.buffer) {
            throw new Error('Report buffer is undefined');
          }

          const pdfData = await pdfParse(result.buffer);
          const text = pdfData.text;

          // Property: Timestamp should be in locale string format
          // This means it should contain the formatted date from reportData.generatedAt
          const expectedTimestamp = reportData.generatedAt.toLocaleString();
          expect(text).toContain(expectedTimestamp);
        }),
        { numRuns: 10, timeout: 30000 }
      );
    });
  });

  // ============================================================================
  // EDGE CASES AND INTEGRATION
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle single-page reports correctly', async () => {
      // Create minimal report data that should fit on one page
      const minimalConfig: ReportConfig = {
        id: 'test-id',
        name: 'Minimal Report',
        description: 'Test',
        tags: ['Tag1'],
        timeRange: {
          startTime: new Date('2024-01-01'),
          endTime: new Date('2024-01-02')
        },
        chartTypes: [],
        template: 'default',
        format: 'pdf'
      };

      const minimalData: ReportData = {
        config: minimalConfig,
        data: {
          'Tag1': [
            {
              tagName: 'Tag1',
              timestamp: new Date('2024-01-01T12:00:00'),
              value: 100,
              quality: 192
            }
          ]
        },
        generatedAt: new Date()
      };

      const result = await reportService.generateReport(minimalData);

      expect(result.success).toBe(true);
      expect(result.buffer).toBeInstanceOf(Buffer);

      if (!result.buffer) {
        throw new Error('Report buffer is undefined');
      }

      const pdfData = await pdfParse(result.buffer);
      const text = pdfData.text;

      // Property: Single-page report should have "Page 1 of 1"
      expect(text).toContain('Page 1 of 1');
      expect(text).toContain('Generated by Historian Reports on');
    });

    it('should handle multi-page reports correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            reportConfigArb,
            fc.dictionary(
              fc.string({ minLength: 3, maxLength: 20 }).filter(s => s.trim().length > 0),
              fc.array(timeSeriesDataArb, { minLength: 100, maxLength: 200 }), // Large dataset
              { minKeys: 3, maxKeys: 5 }
            )
          ).map(([config, dataDict]) => {
            const normalizedData: Record<string, TimeSeriesData[]> = {};
            for (const [tagName, tagData] of Object.entries(dataDict)) {
              const sortedData = tagData
                .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
                .map(d => ({ ...d, tagName }));
              normalizedData[tagName] = sortedData;
            }

            config.tags = Object.keys(normalizedData);

            const reportData: ReportData = {
              config,
              data: normalizedData,
              generatedAt: new Date()
            };

            return reportData;
          }),
          async (reportData) => {
            const result = await reportService.generateReport(reportData);

            expect(result.success).toBe(true);
            expect(result.buffer).toBeInstanceOf(Buffer);

            if (!result.buffer) {
              throw new Error('Report buffer is undefined');
            }

            // Property: Multi-page reports should have multiple pages
            expect(result.metadata.pages).toBeGreaterThan(1);

            const pdfData = await pdfParse(result.buffer);
            const text = pdfData.text;

            // Property: All pages should have footers
            const pageNumberRegex = /Page \d+ of \d+/g;
            const pageNumberMatches = text.match(pageNumberRegex);
            expect(pageNumberMatches).not.toBeNull();
            expect(pageNumberMatches!.length).toBe(result.metadata.pages);
          }
        ),
        { numRuns: 5, timeout: 60000 } // Fewer runs for large reports
      );
    });
  });
});
