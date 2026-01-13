/**
 * Property-Based Tests for Report Saving and Management
 * **Property 27: Report Configuration Saving**
 * **Validates: Requirements 6.1.1, 6.1.2, 6.1.3**
 */

import fc from 'fast-check';
import { Database } from 'sqlite3';
import { ReportManagementService } from '../../src/services/reportManagementService';
import { ReportVersionService } from '../../src/services/reportVersionService';
import { SaveReportRequest } from '../../src/types/reports';
import fs from 'fs';
import path from 'path';

describe('Property 27: Report Configuration Saving', () => {
  let db: Database;
  let reportService: ReportManagementService;
  let versionService: ReportVersionService;
  let testDbPath: string;

  beforeEach(async () => {
    // Create temporary database for testing with unique name
    testDbPath = path.join(__dirname, `test-reports-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.db`);
    db = new Database(testDbPath);
    
    // Initialize database schema
    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        // Create reports table
        db.run(`
          CREATE TABLE IF NOT EXISTS reports (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            config TEXT NOT NULL,
            version INTEGER NOT NULL,
            created_by TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_latest_version BOOLEAN DEFAULT 1,
            is_active BOOLEAN DEFAULT 1
          )
        `);

        // Create report_versions table
        db.run(`
          CREATE TABLE IF NOT EXISTS report_versions (
            id TEXT PRIMARY KEY,
            report_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            config TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT NOT NULL,
            change_description TEXT,
            is_active BOOLEAN DEFAULT 1,
            FOREIGN KEY (report_id) REFERENCES reports (name)
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });

    reportService = new ReportManagementService(db);
    versionService = new ReportVersionService(db);
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      db.close((err) => {
        if (err) console.error('Error closing database:', err);
        resolve();
      });
    });
    
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  // Generators for property-based testing
  const reportNameArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);
  const descriptionArb = fc.string({ maxLength: 500 });
  const tagArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
  const tagsArb = fc.array(tagArb, { minLength: 1, maxLength: 10 });
  
  const relativeRangeArb = fc.oneof(
    fc.constant(undefined),
    fc.constant('last1h' as const),
    fc.constant('last2h' as const),
    fc.constant('last6h' as const),
    fc.constant('last12h' as const),
    fc.constant('last24h' as const),
    fc.constant('last7d' as const),
    fc.constant('last30d' as const)
  );

  const timeRangeArb = fc.record({
    startTime: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') }),
    endTime: fc.date({ min: new Date('2025-01-01'), max: new Date('2030-01-01') }),
    relativeRange: relativeRangeArb
  }).filter(range => range.startTime < range.endTime);

  const chartTypesArb = fc.array(
    fc.oneof(
      fc.constant('line' as const),
      fc.constant('bar' as const),
      fc.constant('trend' as const),
      fc.constant('scatter' as const),
      fc.constant('area' as const)
    ),
    { minLength: 1, maxLength: 5 }
  );

  const templateArb = fc.oneof(
    fc.constant('default' as const),
    fc.constant('executive' as const),
    fc.constant('technical' as const),
    fc.constant('summary' as const)
  );
  const userIdArb = fc.string({ minLength: 1, maxLength: 50 });

  const reportConfigArb = fc.record({
    name: reportNameArb,
    description: descriptionArb,
    tags: tagsArb,
    timeRange: timeRangeArb,
    chartTypes: chartTypesArb,
    template: templateArb
  });

  const saveRequestArb = fc.record({
    name: reportNameArb,
    description: descriptionArb,
    config: reportConfigArb
  }).chain(base => 
    fc.option(fc.string({ maxLength: 200 }), { nil: undefined }).map(changeDescription => 
      changeDescription !== undefined 
        ? { ...base, changeDescription }
        : base
    )
  );

  /**
   * Property: Saving a valid report configuration should always succeed
   * For any valid report configuration, saving it should return success with proper metadata
   */
  test('Property 27.1: Valid report configurations save successfully', async () => {
    await fc.assert(
      fc.asyncProperty(
        saveRequestArb,
        userIdArb,
        async (saveRequest, userId) => {
          // Act: Save the report
          const result = await reportService.saveReport(saveRequest, userId);

          // Assert: Save should succeed
          expect(result.success).toBe(true);
          expect(result.reportId).toBeDefined();
          expect(result.reportId.length).toBeGreaterThan(0);
          expect(result.version).toBeGreaterThan(0); // Version should be positive
          expect(result.message).toContain('saved successfully');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Saving reports with the same name creates incremental versions
   * For any report name, saving multiple configurations should increment version numbers
   */
  test('Property 27.2: Same report name creates incremental versions', async () => {
    await fc.assert(
      fc.asyncProperty(
        reportNameArb,
        fc.array(reportConfigArb, { minLength: 2, maxLength: 5 }),
        userIdArb,
        async (reportName, configs, userId) => {
          const versions: number[] = [];

          // Act: Save multiple versions of the same report
          for (const config of configs) {
            const saveRequest: SaveReportRequest = {
              name: reportName,
              description: `Version ${versions.length + 1}`,
              config: {
                ...config,
                name: reportName,
                description: `Version ${versions.length + 1}`
              }
            };

            const result = await reportService.saveReport(saveRequest, userId);
            
            // Assert: Each save should succeed
            expect(result.success).toBe(true);
            versions.push(result.version);
          }

          // Assert: Versions should be incremental (each version should be previous + 1)
          for (let i = 1; i < versions.length; i++) {
            expect(versions[i]).toBe((versions[i-1] || 0) + 1);
          }

          // Assert: All versions should be unique
          const uniqueVersions = new Set(versions);
          expect(uniqueVersions.size).toBe(versions.length);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Saved reports can be retrieved with identical configuration
   * For any saved report, loading it should return the exact same configuration
   */
  test('Property 27.3: Report round-trip consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        saveRequestArb,
        userIdArb,
        async (saveRequest, userId) => {
          // Act: Save and then load the report
          const saveResult = await reportService.saveReport(saveRequest, userId);
          expect(saveResult.success).toBe(true);

          const loadedReport = await reportService.loadReport(saveResult.reportId);

          // Assert: Loaded report should exist and match saved data
          expect(loadedReport).not.toBeNull();
          expect(loadedReport!.name).toBe(saveRequest.name);
          expect(loadedReport!.description).toBe(saveRequest.description);
          expect(loadedReport!.version).toBe(saveResult.version);
          expect(loadedReport!.createdBy).toBe(userId);

          // Assert: Configuration should match
          const savedConfig = loadedReport!.config;
          expect(savedConfig.tags).toEqual(saveRequest.config.tags);
          expect(savedConfig.chartTypes).toEqual(saveRequest.config.chartTypes);
          expect(savedConfig.template).toBe(saveRequest.config.template);
          
          // Assert: Time range should match (within reasonable precision)
          expect(savedConfig.timeRange.startTime.getTime()).toBe(saveRequest.config.timeRange.startTime.getTime());
          expect(savedConfig.timeRange.endTime.getTime()).toBe(saveRequest.config.timeRange.endTime.getTime());
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Invalid report configurations should be rejected
   * For any invalid report configuration, saving should fail with appropriate error
   */
  test('Property 27.4: Invalid configurations are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        async (userId) => {
          // Test cases for invalid configurations
          const invalidConfigs = [
            // Empty name
            {
              name: '',
              description: 'Valid description',
              config: {
                tags: ['tag1'],
                timeRange: {
                  startTime: new Date('2025-01-01'),
                  endTime: new Date('2025-01-02')
                },
                chartTypes: ['line'],
                template: 'default'
              }
            },
            // No tags
            {
              name: 'Valid Name',
              description: 'Valid description',
              config: {
                tags: [],
                timeRange: {
                  startTime: new Date('2025-01-01'),
                  endTime: new Date('2025-01-02')
                },
                chartTypes: ['line'],
                template: 'default'
              }
            },
            // Invalid time range (start after end)
            {
              name: 'Valid Name',
              description: 'Valid description',
              config: {
                tags: ['tag1'],
                timeRange: {
                  startTime: new Date('2025-01-02'),
                  endTime: new Date('2025-01-01')
                },
                chartTypes: ['line'],
                template: 'default'
              }
            }
          ];

          // Act & Assert: All invalid configs should be rejected
          for (const invalidConfig of invalidConfigs) {
            const result = await reportService.saveReport(invalidConfig as SaveReportRequest, userId);
            expect(result.success).toBe(false);
            expect(result.message).toContain('Validation failed');
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Report listing shows all saved reports for a user
   * For any set of saved reports by a user, listing should return all of them
   */
  test('Property 27.5: Report listing completeness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(saveRequestArb, { minLength: 1, maxLength: 10 }),
        userIdArb,
        async (saveRequests, userId) => {
          const savedReportIds: string[] = [];

          // Act: Save multiple reports
          for (const request of saveRequests) {
            const result = await reportService.saveReport(request, userId);
            expect(result.success).toBe(true);
            savedReportIds.push(result.reportId);
          }

          // Act: List reports for the user
          const reportList = await reportService.listReports(userId);

          // Assert: All saved reports should be in the list
          expect(reportList.length).toBeGreaterThanOrEqual(saveRequests.length);
          
          // Check that all our saved reports are present
          const listedIds = reportList.map(r => r.id);
          for (const savedId of savedReportIds) {
            expect(listedIds).toContain(savedId);
          }

          // Assert: All listed reports should belong to the user
          for (const report of reportList) {
            expect(report.createdBy).toBe(userId);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Report deletion removes all versions
   * For any saved report with multiple versions, deletion should remove all versions
   */
  test('Property 27.6: Report deletion completeness', async () => {
    await fc.assert(
      fc.asyncProperty(
        reportNameArb,
        fc.array(reportConfigArb, { minLength: 2, maxLength: 5 }),
        userIdArb,
        async (reportName, configs, userId) => {
          let lastReportId = '';

          // Act: Save multiple versions
          for (const config of configs) {
            const saveRequest: SaveReportRequest = {
              name: reportName,
              description: 'Test report',
              config: {
                ...config,
                name: reportName,
                description: 'Test report'
              }
            };

            const result = await reportService.saveReport(saveRequest, userId);
            expect(result.success).toBe(true);
            lastReportId = result.reportId;
          }

          // Verify versions exist
          const versionHistory = await reportService.getReportVersions(reportName);
          expect(versionHistory).not.toBeNull();
          expect(versionHistory!.versions.length).toBe(configs.length);

          // Act: Delete the report
          const deleteResult = await reportService.deleteReport(lastReportId, userId);
          expect(deleteResult).toBe(true);

          // Assert: Report should no longer exist
          const loadedReport = await reportService.loadReport(lastReportId);
          expect(loadedReport).toBeNull();

          // Assert: Version history should be empty
          const versionHistoryAfterDelete = await reportService.getReportVersions(reportName);
          expect(versionHistoryAfterDelete).toBeNull();
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Version statistics are accurate
   * For any report with multiple versions, statistics should reflect actual data
   */
  test('Property 27.7: Version statistics accuracy', async () => {
    await fc.assert(
      fc.asyncProperty(
        reportNameArb,
        fc.array(reportConfigArb, { minLength: 1, maxLength: 8 }),
        userIdArb,
        async (reportName, configs, userId) => {
          // Act: Save multiple versions
          for (const config of configs) {
            const saveRequest: SaveReportRequest = {
              name: reportName,
              description: 'Test report',
              config: {
                ...config,
                name: reportName,
                description: 'Test report'
              }
            };

            const result = await reportService.saveReport(saveRequest, userId);
            expect(result.success).toBe(true);
          }

          // Act: Get version statistics
          const stats = await versionService.getVersionStatistics(reportName);

          // Assert: Statistics should be accurate
          expect(stats).not.toBeNull();
          expect(stats!.totalVersions).toBeGreaterThanOrEqual(configs.length);
          expect(stats!.latestVersion).toBeGreaterThanOrEqual(configs.length);
          expect(stats!.oldestVersion).toBeGreaterThan(0);
          expect(stats!.activeVersions).toBeGreaterThanOrEqual(configs.length); // All versions should be active initially
        }
      ),
      { numRuns: 25 }
    );
  });
});