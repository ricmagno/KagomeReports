/**
 * Unit tests for Specification Limits Persistence
 * Tests that specification limits are correctly saved and loaded with report configurations
 */

import { Database } from 'sqlite3';
import { ReportManagementService } from '@/services/reportManagementService';
import { ReportConfig, SaveReportRequest } from '@/types/reports';
import { SpecificationLimits } from '@/types/historian';

describe('Specification Limits Persistence', () => {
  let db: Database;
  let reportService: ReportManagementService;
  const testUserId = 'test-user-123';

  beforeAll(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    reportService = new ReportManagementService(db);
  });

  afterAll((done) => {
    db.close(done);
  });

  describe('Save and Load Round-Trip', () => {
    it('should persist specification limits with both LSL and USL', async () => {
      const specLimits: Record<string, SpecificationLimits> = {
        TAG001: { lsl: 10, usl: 90 },
        TAG002: { lsl: 20, usl: 80 },
      };

      const saveRequest: SaveReportRequest = {
        name: 'Test Report with Spec Limits',
        description: 'Testing specification limits persistence',
        config: {
          tags: ['TAG001', 'TAG002'],
          timeRange: {
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-02T00:00:00Z'),
          },
          chartTypes: ['line'],
          template: 'default',
          specificationLimits: specLimits,
          includeSPCCharts: true,
          includeTrendLines: true,
          includeStatsSummary: true,
        },
      };

      // Save the report
      const saveResponse = await reportService.saveReport(saveRequest, testUserId);
      expect(saveResponse.success).toBe(true);
      expect(saveResponse.reportId).toBeTruthy();

      // Load the report
      const loadedReport = await reportService.loadReport(saveResponse.reportId);
      expect(loadedReport).not.toBeNull();

      // Verify specification limits are preserved
      expect(loadedReport?.config.specificationLimits).toBeDefined();
      expect(loadedReport?.config.specificationLimits?.['TAG001']).toEqual({
        lsl: 10,
        usl: 90,
      });
      expect(loadedReport?.config.specificationLimits?.['TAG002']).toEqual({
        lsl: 20,
        usl: 80,
      });

      // Verify other SPC-related flags
      expect(loadedReport?.config.includeSPCCharts).toBe(true);
      expect(loadedReport?.config.includeTrendLines).toBe(true);
      expect(loadedReport?.config.includeStatsSummary).toBe(true);
    });

    it('should persist specification limits with only LSL', async () => {
      const specLimits: Record<string, SpecificationLimits> = {
        TAG001: { lsl: 10 },
      };

      const saveRequest: SaveReportRequest = {
        name: 'Test Report LSL Only',
        description: 'Testing LSL-only persistence',
        config: {
          tags: ['TAG001'],
          timeRange: {
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-02T00:00:00Z'),
          },
          chartTypes: ['line'],
          template: 'default',
          specificationLimits: specLimits,
        },
      };

      const saveResponse = await reportService.saveReport(saveRequest, testUserId);
      expect(saveResponse.success).toBe(true);

      const loadedReport = await reportService.loadReport(saveResponse.reportId);
      expect(loadedReport?.config.specificationLimits?.['TAG001']).toEqual({
        lsl: 10,
      });
      expect(loadedReport?.config.specificationLimits?.['TAG001']?.usl).toBeUndefined();
    });

    it('should persist specification limits with only USL', async () => {
      const specLimits: Record<string, SpecificationLimits> = {
        TAG001: { usl: 90 },
      };

      const saveRequest: SaveReportRequest = {
        name: 'Test Report USL Only',
        description: 'Testing USL-only persistence',
        config: {
          tags: ['TAG001'],
          timeRange: {
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-02T00:00:00Z'),
          },
          chartTypes: ['line'],
          template: 'default',
          specificationLimits: specLimits,
        },
      };

      const saveResponse = await reportService.saveReport(saveRequest, testUserId);
      expect(saveResponse.success).toBe(true);

      const loadedReport = await reportService.loadReport(saveResponse.reportId);
      expect(loadedReport?.config.specificationLimits?.['TAG001']).toEqual({
        usl: 90,
      });
      expect(loadedReport?.config.specificationLimits?.['TAG001']?.lsl).toBeUndefined();
    });

    it('should handle report without specification limits', async () => {
      const saveRequest: SaveReportRequest = {
        name: 'Test Report No Spec Limits',
        description: 'Testing without specification limits',
        config: {
          tags: ['TAG001'],
          timeRange: {
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-02T00:00:00Z'),
          },
          chartTypes: ['line'],
          template: 'default',
        },
      };

      const saveResponse = await reportService.saveReport(saveRequest, testUserId);
      expect(saveResponse.success).toBe(true);

      const loadedReport = await reportService.loadReport(saveResponse.reportId);
      expect(loadedReport?.config.specificationLimits).toBeUndefined();
    });

    it('should handle partial specification limits (some tags have limits, others do not)', async () => {
      const specLimits: Record<string, SpecificationLimits> = {
        TAG001: { lsl: 10, usl: 90 },
        // TAG002 intentionally has no limits
      };

      const saveRequest: SaveReportRequest = {
        name: 'Test Report Partial Spec Limits',
        description: 'Testing partial specification limits',
        config: {
          tags: ['TAG001', 'TAG002', 'TAG003'],
          timeRange: {
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-02T00:00:00Z'),
          },
          chartTypes: ['line'],
          template: 'default',
          specificationLimits: specLimits,
        },
      };

      const saveResponse = await reportService.saveReport(saveRequest, testUserId);
      expect(saveResponse.success).toBe(true);

      const loadedReport = await reportService.loadReport(saveResponse.reportId);
      expect(loadedReport?.config.specificationLimits?.['TAG001']).toEqual({
        lsl: 10,
        usl: 90,
      });
      expect(loadedReport?.config.specificationLimits?.['TAG002']).toBeUndefined();
      expect(loadedReport?.config.specificationLimits?.['TAG003']).toBeUndefined();
    });

    it('should preserve numeric precision for specification limits', async () => {
      const specLimits: Record<string, SpecificationLimits> = {
        TAG001: { lsl: 10.123456, usl: 90.987654 },
      };

      const saveRequest: SaveReportRequest = {
        name: 'Test Report Precision',
        description: 'Testing numeric precision',
        config: {
          tags: ['TAG001'],
          timeRange: {
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-02T00:00:00Z'),
          },
          chartTypes: ['line'],
          template: 'default',
          specificationLimits: specLimits,
        },
      };

      const saveResponse = await reportService.saveReport(saveRequest, testUserId);
      expect(saveResponse.success).toBe(true);

      const loadedReport = await reportService.loadReport(saveResponse.reportId);
      expect(loadedReport?.config.specificationLimits?.['TAG001']?.lsl).toBe(10.123456);
      expect(loadedReport?.config.specificationLimits?.['TAG001']?.usl).toBe(90.987654);
    });

    it('should handle zero values in specification limits', async () => {
      const specLimits: Record<string, SpecificationLimits> = {
        TAG001: { lsl: 0, usl: 100 },
      };

      const saveRequest: SaveReportRequest = {
        name: 'Test Report Zero LSL',
        description: 'Testing zero values',
        config: {
          tags: ['TAG001'],
          timeRange: {
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-02T00:00:00Z'),
          },
          chartTypes: ['line'],
          template: 'default',
          specificationLimits: specLimits,
        },
      };

      const saveResponse = await reportService.saveReport(saveRequest, testUserId);
      expect(saveResponse.success).toBe(true);

      const loadedReport = await reportService.loadReport(saveResponse.reportId);
      expect(loadedReport?.config.specificationLimits?.['TAG001']?.lsl).toBe(0);
      expect(loadedReport?.config.specificationLimits?.['TAG001']?.usl).toBe(100);
    });

    it('should handle negative values in specification limits', async () => {
      const specLimits: Record<string, SpecificationLimits> = {
        TAG001: { lsl: -50, usl: 50 },
      };

      const saveRequest: SaveReportRequest = {
        name: 'Test Report Negative Values',
        description: 'Testing negative values',
        config: {
          tags: ['TAG001'],
          timeRange: {
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-02T00:00:00Z'),
          },
          chartTypes: ['line'],
          template: 'default',
          specificationLimits: specLimits,
        },
      };

      const saveResponse = await reportService.saveReport(saveRequest, testUserId);
      expect(saveResponse.success).toBe(true);

      const loadedReport = await reportService.loadReport(saveResponse.reportId);
      expect(loadedReport?.config.specificationLimits?.['TAG001']?.lsl).toBe(-50);
      expect(loadedReport?.config.specificationLimits?.['TAG001']?.usl).toBe(50);
    });
  });

  describe('Version History with Specification Limits', () => {
    it('should preserve specification limits across versions', async () => {
      const initialSpecLimits: Record<string, SpecificationLimits> = {
        TAG001: { lsl: 10, usl: 90 },
      };

      const saveRequest: SaveReportRequest = {
        name: 'Versioned Report with Spec Limits',
        description: 'Testing version history',
        config: {
          tags: ['TAG001'],
          timeRange: {
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-02T00:00:00Z'),
          },
          chartTypes: ['line'],
          template: 'default',
          specificationLimits: initialSpecLimits,
        },
      };

      // Save version 1
      const v1Response = await reportService.saveReport(saveRequest, testUserId);
      expect(v1Response.success).toBe(true);
      expect(v1Response.version).toBe(1);

      // Save version 2 with updated spec limits
      const updatedSpecLimits: Record<string, SpecificationLimits> = {
        TAG001: { lsl: 15, usl: 85 },
      };

      const updateRequest: SaveReportRequest = {
        name: 'Versioned Report with Spec Limits',
        description: 'Updated specification limits',
        config: {
          tags: ['TAG001'],
          timeRange: {
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-02T00:00:00Z'),
          },
          chartTypes: ['line'],
          template: 'default',
          specificationLimits: updatedSpecLimits,
        },
        changeDescription: 'Updated spec limits',
      };

      const v2Response = await reportService.saveReport(updateRequest, testUserId);
      expect(v2Response.success).toBe(true);
      expect(v2Response.version).toBe(2);

      // Load latest version (v2)
      const latestReport = await reportService.loadReport(v2Response.reportId);
      expect(latestReport?.config.specificationLimits?.['TAG001']).toEqual({
        lsl: 15,
        usl: 85,
      });

      // Verify version history
      const versionHistory = await reportService.getReportVersions('Versioned Report with Spec Limits');
      expect(versionHistory).not.toBeNull();
      expect(versionHistory?.versions).toHaveLength(2);

      // Check version 1 still has original spec limits
      const v1Config = versionHistory?.versions.find(v => v.version === 1)?.config;
      expect(v1Config?.specificationLimits?.['TAG001']).toEqual({
        lsl: 10,
        usl: 90,
      });

      // Check version 2 has updated spec limits
      const v2Config = versionHistory?.versions.find(v => v.version === 2)?.config;
      expect(v2Config?.specificationLimits?.['TAG001']).toEqual({
        lsl: 15,
        usl: 85,
      });
    });
  });

  describe('List Reports with Specification Limits', () => {
    it('should include specification limits in report list', async () => {
      const specLimits: Record<string, SpecificationLimits> = {
        TAG001: { lsl: 10, usl: 90 },
      };

      const saveRequest: SaveReportRequest = {
        name: 'Listed Report with Spec Limits',
        description: 'Testing list functionality',
        config: {
          tags: ['TAG001'],
          timeRange: {
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-02T00:00:00Z'),
          },
          chartTypes: ['line'],
          template: 'default',
          specificationLimits: specLimits,
        },
      };

      const saveResponse = await reportService.saveReport(saveRequest, testUserId);
      expect(saveResponse.success).toBe(true);

      const reportList = await reportService.listReports(testUserId);
      const savedReport = reportList.find(r => r.id === saveResponse.reportId);

      expect(savedReport).toBeDefined();
      expect(savedReport?.config.specificationLimits?.['TAG001']).toEqual({
        lsl: 10,
        usl: 90,
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty specification limits object', async () => {
      const saveRequest: SaveReportRequest = {
        name: 'Test Report Empty Spec Limits',
        description: 'Testing empty spec limits object',
        config: {
          tags: ['TAG001'],
          timeRange: {
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-02T00:00:00Z'),
          },
          chartTypes: ['line'],
          template: 'default',
          specificationLimits: {},
        },
      };

      const saveResponse = await reportService.saveReport(saveRequest, testUserId);
      expect(saveResponse.success).toBe(true);

      const loadedReport = await reportService.loadReport(saveResponse.reportId);
      expect(loadedReport?.config.specificationLimits).toEqual({});
    });

    it('should handle large number of tags with specification limits', async () => {
      const specLimits: Record<string, SpecificationLimits> = {};
      for (let i = 1; i <= 50; i++) {
        specLimits[`TAG${i.toString().padStart(3, '0')}`] = {
          lsl: i * 10,
          usl: i * 10 + 80,
        };
      }

      const tags = Object.keys(specLimits);

      const saveRequest: SaveReportRequest = {
        name: 'Test Report Many Tags',
        description: 'Testing many tags with spec limits',
        config: {
          tags,
          timeRange: {
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-02T00:00:00Z'),
          },
          chartTypes: ['line'],
          template: 'default',
          specificationLimits: specLimits,
        },
      };

      const saveResponse = await reportService.saveReport(saveRequest, testUserId);
      expect(saveResponse.success).toBe(true);

      const loadedReport = await reportService.loadReport(saveResponse.reportId);
      expect(Object.keys(loadedReport?.config.specificationLimits || {})).toHaveLength(50);
      expect(loadedReport?.config.specificationLimits?.['TAG001']).toEqual({
        lsl: 10,
        usl: 90,
      });
      expect(loadedReport?.config.specificationLimits?.['TAG050']).toEqual({
        lsl: 500,
        usl: 580,
      });
    });
  });
});
