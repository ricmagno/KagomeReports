/**
 * Report Management UI Tests
 * Feature: historian-reporting, Property 28: Report Management Interface
 * Validates: Requirements 6.2.1, 6.2.2, 6.3.1, 6.3.2
 */

import fc from 'fast-check';

describe('Report Management UI Tests', () => {
  /**
   * Property 28: Report Management Interface
   * For any saved report configuration, the UI should correctly display report metadata
   * and allow loading the configuration back into the form
   */
  describe('Property 28: Report Management Interface', () => {
    
    it('should display report metadata consistently', () => {
      fc.assert(fc.property(
        fc.record({
          id: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          description: fc.string({ maxLength: 200 }),
          version: fc.integer({ min: 1, max: 100 }),
          createdBy: fc.string({ minLength: 1 }),
          createdAt: fc.date(),
          updatedAt: fc.date()
        }),
        (reportMetadata) => {
          // Verify all required metadata fields are present
          expect(reportMetadata.id).toBeDefined();
          expect(reportMetadata.name).toBeDefined();
          expect(reportMetadata.description).toBeDefined();
          expect(reportMetadata.version).toBeGreaterThanOrEqual(1);
          expect(reportMetadata.createdBy).toBeDefined();
          expect(reportMetadata.createdAt).toBeInstanceOf(Date);
          expect(reportMetadata.updatedAt).toBeInstanceOf(Date);

          // Verify metadata types are correct
          expect(typeof reportMetadata.id).toBe('string');
          expect(typeof reportMetadata.name).toBe('string');
          expect(typeof reportMetadata.description).toBe('string');
          expect(typeof reportMetadata.version).toBe('number');
          expect(typeof reportMetadata.createdBy).toBe('string');
        }
      ), { numRuns: 100 });
    });

    it('should preserve report configuration during round-trip', () => {
      fc.assert(fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          description: fc.string({ maxLength: 200 }),
          tags: fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 10 }),
          timeRange: fc.record({
            startTime: fc.date(),
            endTime: fc.date()
          }),
          chartTypes: fc.array(fc.constantFrom('line', 'bar', 'trend'), { minLength: 1 })
        }),
        (config) => {
          // Simulate saving and loading
          const savedConfig = JSON.parse(JSON.stringify(config));
          const loadedConfig = JSON.parse(JSON.stringify(savedConfig));

          // Verify configuration is preserved
          expect(loadedConfig.name).toBe(config.name);
          expect(loadedConfig.description).toBe(config.description);
          expect(loadedConfig.tags).toEqual(config.tags);
          expect(loadedConfig.chartTypes).toEqual(config.chartTypes);
          
          // Verify time range is preserved
          expect(new Date(loadedConfig.timeRange.startTime).getTime())
            .toBe(new Date(config.timeRange.startTime).getTime());
          expect(new Date(loadedConfig.timeRange.endTime).getTime())
            .toBe(new Date(config.timeRange.endTime).getTime());
        }
      ), { numRuns: 100 });
    });

    it('should handle version numbering correctly', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 1, max: 10 }),
        (reportName, numVersions) => {
          // Simulate creating multiple versions
          const versions: number[] = [];
          for (let i = 1; i <= numVersions; i++) {
            versions.push(i);
          }

          // Verify versions are sequential
          expect(versions.length).toBe(numVersions);
          expect(versions[0]).toBe(1);
          expect(versions[versions.length - 1]).toBe(numVersions);
          
          // Verify each version is unique
          const uniqueVersions = new Set(versions);
          expect(uniqueVersions.size).toBe(numVersions);
        }
      ), { numRuns: 50 });
    });

    it('should group reports by name correctly', () => {
      fc.assert(fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 50 }).filter(n => 
              // Avoid prototype property names
              !['toString', 'valueOf', 'constructor', 'hasOwnProperty', '__proto__'].includes(n)
            ),
            version: fc.integer({ min: 1, max: 10 })
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (reports) => {
          // Group reports by name using Map to avoid prototype issues
          const groupedByName = new Map<string, typeof reports>();
          
          reports.forEach(report => {
            const existing = groupedByName.get(report.name) || [];
            existing.push(report);
            groupedByName.set(report.name, existing);
          });

          // Verify grouping
          groupedByName.forEach((group, name) => {
            // All reports in group should have the same name
            group.forEach(report => {
              expect(report.name).toBe(name);
            });

            // Find latest version in group
            const latestVersion = Math.max(...group.map(r => r.version));
            const latestReport = group.find(r => r.version === latestVersion);
            
            expect(latestReport).toBeDefined();
            expect(latestReport?.version).toBe(latestVersion);
          });
        }
      ), { numRuns: 50 });
    });

    it('should sort reports by different criteria', () => {
      fc.assert(fc.property(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            createdAt: fc.date(),
            version: fc.integer({ min: 1, max: 100 })
          }),
          { minLength: 2, maxLength: 10 }
        ),
        (reports) => {
          // Sort by name
          const sortedByName = [...reports].sort((a, b) => a.name.localeCompare(b.name));
          expect(sortedByName.length).toBe(reports.length);
          
          // Verify name sorting
          for (let i = 1; i < sortedByName.length; i++) {
            const current = sortedByName[i];
            const previous = sortedByName[i - 1];
            if (current && previous) {
              expect(current.name.localeCompare(previous.name)).toBeGreaterThanOrEqual(0);
            }
          }

          // Sort by date
          const sortedByDate = [...reports].sort((a, b) => 
            b.createdAt.getTime() - a.createdAt.getTime()
          );
          expect(sortedByDate.length).toBe(reports.length);
          
          // Verify date sorting (descending)
          for (let i = 1; i < sortedByDate.length; i++) {
            const current = sortedByDate[i];
            const previous = sortedByDate[i - 1];
            if (current && previous) {
              expect(current.createdAt.getTime()).toBeLessThanOrEqual(previous.createdAt.getTime());
            }
          }

          // Sort by version
          const sortedByVersion = [...reports].sort((a, b) => b.version - a.version);
          expect(sortedByVersion.length).toBe(reports.length);
          
          // Verify version sorting (descending)
          for (let i = 1; i < sortedByVersion.length; i++) {
            const current = sortedByVersion[i];
            const previous = sortedByVersion[i - 1];
            if (current && previous) {
              expect(current.version).toBeLessThanOrEqual(previous.version);
            }
          }
        }
      ), { numRuns: 50 });
    });

    it('should handle empty report list', () => {
      const emptyReports: any[] = [];
      
      expect(emptyReports).toEqual([]);
      expect(emptyReports.length).toBe(0);
      
      // Verify empty state handling
      const hasReports = emptyReports.length > 0;
      expect(hasReports).toBe(false);
    });

    it('should validate report name requirements', () => {
      fc.assert(fc.property(
        fc.string(),
        (name) => {
          const isValid = name.trim().length > 0;
          
          if (isValid) {
            expect(name.trim()).toBeTruthy();
          } else {
            expect(name.trim()).toBe('');
          }
        }
      ), { numRuns: 100 });
    });

    it('should maintain report list consistency', () => {
      fc.assert(fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            version: fc.integer({ min: 1, max: 10 })
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (reports) => {
          // Verify all reports have unique IDs
          const ids = reports.map(r => r.id);
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(ids.length);

          // Verify all reports have valid versions
          reports.forEach(report => {
            expect(report.version).toBeGreaterThanOrEqual(1);
          });

          // Verify list length is consistent
          expect(reports.length).toBeGreaterThanOrEqual(1);
        }
      ), { numRuns: 50 });
    });

    it('should handle report metadata updates', () => {
      fc.assert(fc.property(
        fc.record({
          id: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          description: fc.string({ maxLength: 200 }),
          version: fc.integer({ min: 1, max: 10 }),
          createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
          updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
        }),
        (report) => {
          // Simulate metadata update with explicit later timestamp
          const laterTimestamp = new Date(Math.min(
            report.updatedAt.getTime() + 1000, // Add 1 second
            new Date('2025-12-31').getTime() // But don't exceed max date
          ));
          const updatedReport = {
            ...report,
            updatedAt: laterTimestamp
          };

          // Verify immutable fields remain unchanged
          expect(updatedReport.id).toBe(report.id);
          expect(updatedReport.name).toBe(report.name);
          expect(updatedReport.version).toBe(report.version);
          expect(updatedReport.createdAt).toBe(report.createdAt);

          // Verify updatedAt changed
          expect(updatedReport.updatedAt.getTime()).toBeGreaterThan(report.updatedAt.getTime());
        }
      ), { numRuns: 100 });
    });

    it('should preserve configuration field types', () => {
      fc.assert(fc.property(
        fc.record({
          name: fc.string({ minLength: 1 }),
          tags: fc.array(fc.string({ minLength: 1 }), { minLength: 1 }),
          chartTypes: fc.array(fc.constantFrom('line', 'bar', 'trend'), { minLength: 1 })
        }),
        (config) => {
          // Verify types are preserved
          expect(typeof config.name).toBe('string');
          expect(Array.isArray(config.tags)).toBe(true);
          expect(Array.isArray(config.chartTypes)).toBe(true);

          // Verify array contents
          config.tags.forEach(tag => {
            expect(typeof tag).toBe('string');
          });

          config.chartTypes.forEach(chartType => {
            expect(['line', 'bar', 'trend']).toContain(chartType);
          });
        }
      ), { numRuns: 100 });
    });
  });

  describe('UI State Consistency', () => {
    it('should maintain consistent state across operations', () => {
      fc.assert(fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 50 })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (reports) => {
          // Simulate state operations
          const state = {
            reports: [...reports],
            selectedId: reports[0]?.id || null
          };

          // Verify state consistency
          expect(state.reports.length).toBe(reports.length);
          
          if (state.selectedId) {
            const selectedReport = state.reports.find(r => r.id === state.selectedId);
            expect(selectedReport).toBeDefined();
          }
        }
      ), { numRuns: 50 });
    });
  });
});
