/**
 * Unit tests for Report Data Model Extensions
 * Tests the new data model interfaces for Advanced Chart Analytics
 */

import {
  ReportConfig,
  TagClassification,
  TagAnalytics,
  EnhancedReportData,
} from '@/types/reports';
import {
  SpecificationLimits,
  TimeSeriesData,
  QualityCode,
  TrendLineResult,
  SPCMetrics,
  SPCMetricsSummary,
} from '@/types/historian';

describe('Report Data Model Extensions', () => {
  describe('ReportConfig with Advanced Analytics Fields', () => {
    it('should create a valid ReportConfig with specification limits', () => {
      const config: ReportConfig = {
        name: 'Test Report',
        tags: ['TAG001', 'TAG002'],
        timeRange: {
          startTime: new Date('2024-01-01'),
          endTime: new Date('2024-01-02'),
        },
        chartTypes: ['line'],
        template: 'default',
        specificationLimits: {
          TAG001: { lsl: 10, usl: 90 },
          TAG002: { lsl: 20, usl: 80 },
        },
        includeSPCCharts: true,
        includeTrendLines: true,
        includeStatsSummary: true,
      };

      expect(config.specificationLimits).toBeDefined();
      expect(config.specificationLimits?.['TAG001']?.lsl).toBe(10);
      expect(config.specificationLimits?.['TAG001']?.usl).toBe(90);
      expect(config.includeSPCCharts).toBe(true);
      expect(config.includeTrendLines).toBe(true);
      expect(config.includeStatsSummary).toBe(true);
    });

    it('should create a valid ReportConfig without specification limits', () => {
      const config: ReportConfig = {
        name: 'Test Report',
        tags: ['TAG001'],
        timeRange: {
          startTime: new Date('2024-01-01'),
          endTime: new Date('2024-01-02'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      expect(config.specificationLimits).toBeUndefined();
      expect(config.includeSPCCharts).toBeUndefined();
      expect(config.includeTrendLines).toBeUndefined();
      expect(config.includeStatsSummary).toBeUndefined();
    });

    it('should allow partial specification limits', () => {
      const config: ReportConfig = {
        name: 'Test Report',
        tags: ['TAG001', 'TAG002'],
        timeRange: {
          startTime: new Date('2024-01-01'),
          endTime: new Date('2024-01-02'),
        },
        chartTypes: ['line'],
        template: 'default',
        specificationLimits: {
          TAG001: { lsl: 10, usl: 90 },
          // TAG002 has no limits
        },
      };

      expect(config.specificationLimits?.['TAG001']).toBeDefined();
      expect(config.specificationLimits?.['TAG002']).toBeUndefined();
    });
  });

  describe('TagClassification', () => {
    it('should create a valid analog tag classification', () => {
      const classification: TagClassification = {
        tagName: 'TAG001',
        type: 'analog',
        confidence: 0.95,
      };

      expect(classification.type).toBe('analog');
      expect(classification.confidence).toBeGreaterThan(0);
      expect(classification.confidence).toBeLessThanOrEqual(1);
    });

    it('should create a valid digital tag classification', () => {
      const classification: TagClassification = {
        tagName: 'TAG002',
        type: 'digital',
        confidence: 1.0,
      };

      expect(classification.type).toBe('digital');
      expect(classification.confidence).toBe(1.0);
    });
  });

  describe('TagAnalytics', () => {
    it('should create valid TagAnalytics for analog tag with all metrics', () => {
      const trendLine: TrendLineResult = {
        slope: 2.5,
        intercept: 10.0,
        rSquared: 0.85,
        equation: 'y = 2.50x + 10.00',
      };

      const spcMetrics: SPCMetrics = {
        mean: 50.0,
        stdDev: 5.0,
        ucl: 65.0,
        lcl: 35.0,
        cp: 2.67,
        cpk: 2.33,
        outOfControlPoints: [],
      };

      const analytics: TagAnalytics = {
        tagName: 'TAG001',
        classification: {
          tagName: 'TAG001',
          type: 'analog',
          confidence: 0.95,
        },
        trendLine,
        spcMetrics,
        statistics: {
          min: 40.0,
          max: 60.0,
          mean: 50.0,
          stdDev: 5.0,
        },
      };

      expect(analytics.tagName).toBe('TAG001');
      expect(analytics.classification.type).toBe('analog');
      expect(analytics.trendLine).toBeDefined();
      expect(analytics.spcMetrics).toBeDefined();
      expect(analytics.statistics.mean).toBe(50.0);
    });

    it('should create valid TagAnalytics for digital tag without trend/SPC', () => {
      const analytics: TagAnalytics = {
        tagName: 'TAG002',
        classification: {
          tagName: 'TAG002',
          type: 'digital',
          confidence: 1.0,
        },
        statistics: {
          min: 0,
          max: 1,
          mean: 0.5,
          stdDev: 0.5,
        },
      };

      expect(analytics.tagName).toBe('TAG002');
      expect(analytics.classification.type).toBe('digital');
      expect(analytics.trendLine).toBeUndefined();
      expect(analytics.spcMetrics).toBeUndefined();
    });
  });

  describe('EnhancedReportData', () => {
    it('should create valid EnhancedReportData structure', () => {
      const timeSeriesData: TimeSeriesData[] = [
        {
          timestamp: new Date('2024-01-01T00:00:00Z'),
          value: 50.0,
          quality: QualityCode.Good,
          tagName: 'TAG001',
        },
        {
          timestamp: new Date('2024-01-01T01:00:00Z'),
          value: 52.0,
          quality: QualityCode.Good,
          tagName: 'TAG001',
        },
      ];

      const tagAnalytics: TagAnalytics = {
        tagName: 'TAG001',
        classification: {
          tagName: 'TAG001',
          type: 'analog',
          confidence: 0.95,
        },
        statistics: {
          min: 50.0,
          max: 52.0,
          mean: 51.0,
          stdDev: 1.0,
        },
      };

      const spcSummary: SPCMetricsSummary = {
        tagName: 'TAG001',
        mean: 51.0,
        stdDev: 1.0,
        lsl: 40.0,
        usl: 60.0,
        cp: 3.33,
        cpk: 3.0,
        capability: 'Capable',
      };

      const reportData: EnhancedReportData = {
        configuration: {
          name: 'Test Report',
          tags: ['TAG001'],
          timeRange: {
            startTime: new Date('2024-01-01'),
            endTime: new Date('2024-01-02'),
          },
          chartTypes: ['line'],
          template: 'default',
          specificationLimits: {
            TAG001: { lsl: 40, usl: 60 },
          },
          includeSPCCharts: true,
          includeTrendLines: true,
          includeStatsSummary: true,
        },
        timeSeriesData: {
          TAG001: timeSeriesData,
        },
        tagAnalytics: {
          TAG001: tagAnalytics,
        },
        spcMetricsSummary: [spcSummary],
      };

      expect(reportData.configuration.name).toBe('Test Report');
      expect(reportData.timeSeriesData['TAG001']).toHaveLength(2);
      expect(reportData.tagAnalytics['TAG001']?.tagName).toBe('TAG001');
      expect(reportData.spcMetricsSummary).toHaveLength(1);
      expect(reportData.spcMetricsSummary[0]?.capability).toBe('Capable');
    });

    it('should handle multiple tags in EnhancedReportData', () => {
      const reportData: EnhancedReportData = {
        configuration: {
          name: 'Multi-Tag Report',
          tags: ['TAG001', 'TAG002', 'TAG003'],
          timeRange: {
            startTime: new Date('2024-01-01'),
            endTime: new Date('2024-01-02'),
          },
          chartTypes: ['line'],
          template: 'default',
        },
        timeSeriesData: {
          TAG001: [],
          TAG002: [],
          TAG003: [],
        },
        tagAnalytics: {
          TAG001: {
            tagName: 'TAG001',
            classification: { tagName: 'TAG001', type: 'analog', confidence: 0.95 },
            statistics: { min: 0, max: 100, mean: 50, stdDev: 10 },
          },
          TAG002: {
            tagName: 'TAG002',
            classification: { tagName: 'TAG002', type: 'digital', confidence: 1.0 },
            statistics: { min: 0, max: 1, mean: 0.5, stdDev: 0.5 },
          },
          TAG003: {
            tagName: 'TAG003',
            classification: { tagName: 'TAG003', type: 'analog', confidence: 0.9 },
            statistics: { min: 20, max: 80, mean: 50, stdDev: 15 },
          },
        },
        spcMetricsSummary: [],
      };

      expect(Object.keys(reportData.timeSeriesData)).toHaveLength(3);
      expect(Object.keys(reportData.tagAnalytics)).toHaveLength(3);
      expect(reportData.tagAnalytics['TAG002']?.classification.type).toBe('digital');
    });
  });

  describe('SpecificationLimits', () => {
    it('should create valid specification limits with both LSL and USL', () => {
      const limits: SpecificationLimits = {
        lsl: 10,
        usl: 90,
      };

      expect(limits.lsl).toBe(10);
      expect(limits.usl).toBe(90);
    });

    it('should create specification limits with only LSL', () => {
      const limits: SpecificationLimits = {
        lsl: 10,
      };

      expect(limits.lsl).toBe(10);
      expect(limits.usl).toBeUndefined();
    });

    it('should create specification limits with only USL', () => {
      const limits: SpecificationLimits = {
        usl: 90,
      };

      expect(limits.lsl).toBeUndefined();
      expect(limits.usl).toBe(90);
    });

    it('should create empty specification limits', () => {
      const limits: SpecificationLimits = {};

      expect(limits.lsl).toBeUndefined();
      expect(limits.usl).toBeUndefined();
    });
  });
});
