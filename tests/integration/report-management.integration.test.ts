/**
 * Integration Tests for Report Management Workflow
 * Tests the complete workflow from report creation to saving to loading
 */

import { ReportManagementService } from '../../src/services/reportManagementService';
import { ReportVersionService } from '../../src/services/reportVersionService';
import { Database } from 'sqlite3';
import { ReportConfig, SaveReportRequest } from '../../src/types/reports';
import fs from 'fs';
import path from 'path';

describe('Report Management Integration Tests', () => {
  let db: Database;
  let reportManagementService: ReportManagementService;
  let reportVersionService: ReportVersionService;
  const testDbPath = path.join(__dirname, '../../data/test-reports-integration.db');

  beforeAll(() => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Create test database
    db = new Database(testDbPath);
    reportManagementService = new ReportManagementService(db);
    reportVersionService = new ReportVersionService(db);
  });

  afterAll((done) => {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      }
      // Clean up test database
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
      done();
    });
  });

  describe('Complete Report Saving and Loading Workflow', () => {
    it('should save a new report and load it back successfully', async () => {
      const saveRequest: SaveReportRequest = {
        name: 'Integration Test Report',
        description: 'Test report for integration testing',
        config: {
          tags: ['TAG001', 'TAG002'],
          timeRange: {
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-02T00:00:00Z'),
            relativeRange: 'last24h'
          },
          chartTypes: ['line', 'bar'],
          template: 'default',
          format: 'pdf'
        }
      };

      // Save the report
      const saveResult = await reportManagementService.saveReport(saveRequest, 'test-user');
      
      expect(saveResult.success).toBe(true);
      expect(saveResult.reportId).toBeDefined();
      expect(saveResult.version).toBe(1);

      // Load the report back
      const loadedReport = await reportManagementService.loadReport(saveResult.reportId);
      
      expect(loadedReport).toBeDefined();
      expect(loadedReport?.name).toBe(saveRequest.name);
      expect(loadedReport?.description).toBe(saveRequest.description);
      expect(loadedReport?.config.tags).toEqual(saveRequest.config.tags);
      expect(loadedReport?.version).toBe(1);
    });

    it('should create multiple versions of the same report', async () => {
      const reportName = 'Versioned Report';
      
      // Create version 1
      const v1Request: SaveReportRequest = {
        name: reportName,
        description: 'Version 1',
        config: {
          tags: ['TAG001'],
          timeRange: {
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-02T00:00:00Z')
          },
          chartTypes: ['line'],
          template: 'default',
          format: 'pdf'
        }
      };

      const v1Result = await reportManagementService.saveReport(v1Request, 'test-user');
      expect(v1Result.version).toBe(1);

      // Create version 2
      const v2Request: SaveReportRequest = {
        name: reportName,
        description: 'Version 2',
        config: {
          tags: ['TAG001', 'TAG002'],
          timeRange: {
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-03T00:00:00Z')
          },
          chartTypes: ['line', 'bar'],
          template: 'default',
          format: 'pdf'
        }
      };

      const v2Result = await reportManagementService.saveReport(v2Request, 'test-user');
      expect(v2Result.version).toBe(2);

      // Verify version history
      const versionHistory = await reportManagementService.getReportVersions(reportName);
      expect(versionHistory).toBeDefined();
      expect(versionHistory?.totalVersions).toBe(2);
      expect(versionHistory?.versions).toHaveLength(2);
    });

    it('should list all saved reports for a user', async () => {
      // Save multiple reports
      const reports = [
        {
          name: 'Report A',
          description: 'First report',
          config: {
            tags: ['TAG001'],
            timeRange: {
              startTime: new Date('2024-01-01T00:00:00Z'),
              endTime: new Date('2024-01-02T00:00:00Z')
            },
            chartTypes: ['line' as const],
            template: 'default' as const,
            format: 'pdf' as const
          }
        },
        {
          name: 'Report B',
          description: 'Second report',
          config: {
            tags: ['TAG002'],
            timeRange: {
              startTime: new Date('2024-01-01T00:00:00Z'),
              endTime: new Date('2024-01-02T00:00:00Z')
            },
            chartTypes: ['bar' as const],
            template: 'default' as const,
            format: 'pdf' as const
          }
        }
      ];

      for (const report of reports) {
        await reportManagementService.saveReport(report, 'test-user');
      }

      // List reports
      const reportList = await reportManagementService.listReports('test-user');
      
      expect(reportList.length).toBeGreaterThanOrEqual(2);
      expect(reportList.some(r => r.name === 'Report A')).toBe(true);
      expect(reportList.some(r => r.name === 'Report B')).toBe(true);
    });

    it('should delete a report and all its versions', async () => {
      const reportName = 'Report to Delete';
      
      // Create report with multiple versions
      const v1Request: SaveReportRequest = {
        name: reportName,
        description: 'Version 1',
        config: {
          tags: ['TAG001'],
          timeRange: {
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-02T00:00:00Z')
          },
          chartTypes: ['line'],
          template: 'default',
          format: 'pdf'
        }
      };

      await reportManagementService.saveReport(v1Request, 'test-user');
      
      // Create version 2
      const v2Result = await reportManagementService.saveReport(
        { ...v1Request, description: 'Version 2' },
        'test-user'
      );

      // Delete the report using the latest version's ID
      const deleteResult = await reportManagementService.deleteReport(v2Result.reportId, 'test-user');
      expect(deleteResult).toBe(true);

      // Verify report is deleted
      const loadedReport = await reportManagementService.loadReport(v2Result.reportId);
      expect(loadedReport).toBeNull();

      // Verify version history is deleted
      const versionHistory = await reportManagementService.getReportVersions(reportName);
      expect(versionHistory).toBeNull();
    });
  });

  describe('Version Management Workflow', () => {
    it('should track version statistics correctly', async () => {
      const reportName = 'Stats Test Report';
      
      // Create multiple versions
      for (let i = 1; i <= 3; i++) {
        const request: SaveReportRequest = {
          name: reportName,
          description: `Version ${i}`,
          config: {
            tags: [`TAG00${i}`],
            timeRange: {
              startTime: new Date('2024-01-01T00:00:00Z'),
              endTime: new Date('2024-01-02T00:00:00Z')
            },
            chartTypes: ['line'],
            template: 'default',
            format: 'pdf'
          }
        };

        await reportManagementService.saveReport(request, 'test-user');
      }

      // Get version statistics
      const stats = await reportVersionService.getVersionStatistics(reportName);
      
      expect(stats).toBeDefined();
      expect(stats?.totalVersions).toBe(3);
      expect(stats?.latestVersion).toBe(3);
      expect(stats?.oldestVersion).toBe(1);
    });

    it('should create new version from existing report', async () => {
      const reportName = 'Update Test Report';
      
      // Create initial version
      const initialRequest: SaveReportRequest = {
        name: reportName,
        description: 'Initial version',
        config: {
          tags: ['TAG001'],
          timeRange: {
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-02T00:00:00Z')
          },
          chartTypes: ['line'],
          template: 'default',
          format: 'pdf'
        }
      };

      const initialResult = await reportManagementService.saveReport(initialRequest, 'test-user');
      
      // Load and modify
      const loadedReport = await reportManagementService.loadReport(initialResult.reportId);
      expect(loadedReport).toBeDefined();

      // Create new version with modifications
      const updatedConfig: ReportConfig = {
        ...loadedReport!.config,
        tags: ['TAG001', 'TAG002', 'TAG003'],
        description: 'Updated version'
      };

      const newVersion = await reportManagementService.createNewVersion(
        reportName,
        updatedConfig,
        'test-user',
        'Added more tags'
      );

      expect(newVersion).toBeDefined();
      expect(newVersion?.version).toBe(2);
      expect(newVersion?.config.tags).toHaveLength(3);
      expect(newVersion?.changeDescription).toBe('Added more tags');
    });
  });

  describe('Error Handling and Validation', () => {
    it('should reject invalid report configurations', async () => {
      const invalidRequest: SaveReportRequest = {
        name: '', // Invalid: empty name
        description: 'Invalid report',
        config: {
          tags: [], // Invalid: no tags
          timeRange: {
            startTime: new Date('2024-01-02T00:00:00Z'),
            endTime: new Date('2024-01-01T00:00:00Z') // Invalid: end before start
          },
          chartTypes: ['line'],
          template: 'default',
          format: 'pdf'
        }
      };

      const result = await reportManagementService.saveReport(invalidRequest, 'test-user');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Validation failed');
    });

    it('should handle loading non-existent reports gracefully', async () => {
      const nonExistentId = 'non-existent-report-id';
      
      const loadedReport = await reportManagementService.loadReport(nonExistentId);
      
      expect(loadedReport).toBeNull();
    });

    it('should prevent unauthorized deletion', async () => {
      const reportName = 'Protected Report';
      
      // Create report as user1
      const request: SaveReportRequest = {
        name: reportName,
        description: 'Protected report',
        config: {
          tags: ['TAG001'],
          timeRange: {
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-02T00:00:00Z')
          },
          chartTypes: ['line'],
          template: 'default',
          format: 'pdf'
        }
      };

      const saveResult = await reportManagementService.saveReport(request, 'user1');
      
      // Try to delete as user2
      const deleteResult = await reportManagementService.deleteReport(saveResult.reportId, 'user2');
      
      expect(deleteResult).toBe(false);
    });
  });

  describe('Date Handling and Serialization', () => {
    it('should correctly serialize and deserialize dates', async () => {
      const startTime = new Date('2024-01-01T12:30:45Z');
      const endTime = new Date('2024-01-02T18:45:30Z');
      
      const request: SaveReportRequest = {
        name: 'Date Test Report',
        description: 'Testing date serialization',
        config: {
          tags: ['TAG001'],
          timeRange: {
            startTime,
            endTime
          },
          chartTypes: ['line'],
          template: 'default',
          format: 'pdf'
        }
      };

      const saveResult = await reportManagementService.saveReport(request, 'test-user');
      const loadedReport = await reportManagementService.loadReport(saveResult.reportId);
      
      expect(loadedReport).toBeDefined();
      expect(loadedReport?.config.timeRange.startTime).toBeInstanceOf(Date);
      expect(loadedReport?.config.timeRange.endTime).toBeInstanceOf(Date);
      expect(loadedReport?.config.timeRange.startTime.getTime()).toBe(startTime.getTime());
      expect(loadedReport?.config.timeRange.endTime.getTime()).toBe(endTime.getTime());
    });
  });
});
