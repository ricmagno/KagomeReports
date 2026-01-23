/**
 * Unit tests for ConfigExportService
 * 
 * Tests the JSON export functionality including:
 * - Basic export operations
 * - Filename generation
 * - Metadata inclusion
 * - Field mapping
 * - Error handling
 */

import { ConfigExportService } from '../configExportService';
import { ReportConfig } from '@/types/reports';
import { ExportedConfiguration, CURRENT_SCHEMA_VERSION } from '@/types/reportExportImport';

describe('ConfigExportService', () => {
  let service: ConfigExportService;

  beforeEach(() => {
    service = new ConfigExportService();
  });

  describe('exportConfiguration - JSON format', () => {
    it('should export a simple configuration to JSON', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Test Report',
        description: 'Test description',
        tags: ['Temperature'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act
      const result = await service.exportConfiguration(config, { format: 'json' });

      // Assert
      expect(result.filename).toMatch(/^ReportConfig_Temperature_\d{8}_\d{6}\.json$/);
      expect(result.contentType).toBe('application/json');
      expect(typeof result.data).toBe('string');

      // Parse and validate JSON structure
      const exportedConfig: ExportedConfiguration = JSON.parse(result.data as string);
      expect(exportedConfig.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(exportedConfig.exportMetadata).toBeDefined();
      expect(exportedConfig.exportMetadata.exportDate).toBeDefined();
      expect(exportedConfig.exportMetadata.applicationVersion).toBeDefined();
      expect(exportedConfig.reportConfig).toBeDefined();
      expect(exportedConfig.reportConfig.tags).toEqual(['Temperature']);
      expect(exportedConfig.reportConfig.reportName).toBe('Test Report');
    });

    it('should export configuration with multiple tags', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Multi-Tag Report',
        tags: ['Temperature', 'Pressure', 'Flow'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act
      const result = await service.exportConfiguration(config, { format: 'json' });

      // Assert
      expect(result.filename).toMatch(/^ReportConfig_Temper_Pressu_Flow_\d{8}_\d{6}\.json$/);

      const exportedConfig: ExportedConfiguration = JSON.parse(result.data as string);
      expect(exportedConfig.reportConfig.tags).toEqual(['Temperature', 'Pressure', 'Flow']);
    });

    it('should export configuration with many tags using count', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Many Tags Report',
        tags: ['Tag1', 'Tag2', 'Tag3', 'Tag4', 'Tag5'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act
      const result = await service.exportConfiguration(config, { format: 'json' });

      // Assert
      expect(result.filename).toMatch(/^ReportConfig_5Tags_\d{8}_\d{6}\.json$/);
    });

    it('should include analytics options in export', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Analytics Report',
        tags: ['Temperature'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
        includeTrendLines: true,
        includeSPCCharts: true,
        includeStatsSummary: true,
      };

      // Act
      const result = await service.exportConfiguration(config, { format: 'json' });

      // Assert
      const exportedConfig: ExportedConfiguration = JSON.parse(result.data as string);
      expect(exportedConfig.reportConfig.analytics.enabled).toBe(true);
      expect(exportedConfig.reportConfig.analytics.showTrendLine).toBe(true);
      expect(exportedConfig.reportConfig.analytics.showSPCMetrics).toBe(true);
      expect(exportedConfig.reportConfig.analytics.showStatistics).toBe(true);
    });

    it('should include specification limits in export', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Spec Limits Report',
        tags: ['Temperature'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
        specificationLimits: {
          Temperature: {
            usl: 100,
            lsl: 0,
          },
        },
      };

      // Act
      const result = await service.exportConfiguration(config, { format: 'json' });

      // Assert
      const exportedConfig: ExportedConfiguration = JSON.parse(result.data as string);
      expect(exportedConfig.reportConfig.specificationLimits).toBeDefined();
      expect(exportedConfig.reportConfig.specificationLimits?.enabled).toBe(true);
      expect(exportedConfig.reportConfig.specificationLimits?.upperLimit).toBe(100);
      expect(exportedConfig.reportConfig.specificationLimits?.lowerLimit).toBe(0);
    });

    it('should format JSON with proper indentation', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Test Report',
        tags: ['Temperature'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act
      const result = await service.exportConfiguration(config, { format: 'json' });

      // Assert
      const jsonString = result.data as string;
      // Check for indentation (should have newlines and spaces)
      expect(jsonString).toContain('\n');
      expect(jsonString).toContain('  '); // 2-space indentation
      // Should not be minified
      expect(jsonString.length).toBeGreaterThan(100);
    });

    it('should calculate duration from time range', async () => {
      // Arrange
      const startTime = new Date('2024-01-01T00:00:00Z');
      const endTime = new Date('2024-01-02T00:00:00Z');
      const expectedDuration = endTime.getTime() - startTime.getTime();

      const config: ReportConfig = {
        name: 'Test Report',
        tags: ['Temperature'],
        timeRange: {
          startTime,
          endTime,
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act
      const result = await service.exportConfiguration(config, { format: 'json' });

      // Assert
      const exportedConfig: ExportedConfiguration = JSON.parse(result.data as string);
      expect(exportedConfig.reportConfig.timeRange.duration).toBe(expectedDuration);
    });

    it('should include custom settings when metadata or branding is present', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Branded Report',
        tags: ['Temperature'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'technical',
        branding: {
          companyName: 'ACME Corp',
          logo: '/path/to/logo.png',
        },
        metadata: {
          author: 'John Doe',
          subject: 'Process Report',
        },
      };

      // Act
      const result = await service.exportConfiguration(config, { format: 'json' });

      // Assert
      const exportedConfig: ExportedConfiguration = JSON.parse(result.data as string);
      expect(exportedConfig.reportConfig.customSettings).toBeDefined();
      expect(exportedConfig.reportConfig.customSettings?.branding).toEqual(config.branding);
      expect(exportedConfig.reportConfig.customSettings?.metadata).toEqual(config.metadata);
      expect(exportedConfig.reportConfig.customSettings?.template).toBe('technical');
    });
  });

  describe('filename generation', () => {
    it('should sanitize special characters in tag names', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Test Report',
        tags: ['Tag@#$%Name'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act
      const result = await service.exportConfiguration(config, { format: 'json' });

      // Assert
      // Special characters should be replaced with underscores
      expect(result.filename).toMatch(/^ReportConfig_Tag_Name_\d{8}_\d{6}\.json$/);
    });

    it('should handle empty tag names gracefully', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Test Report',
        tags: [''],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act
      const result = await service.exportConfiguration(config, { format: 'json' });

      // Assert
      expect(result.filename).toMatch(/^ReportConfig_unnamed_\d{8}_\d{6}\.json$/);
    });
  });

  describe('error handling', () => {
    it('should throw error for unsupported format', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Test Report',
        tags: ['Temperature'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act & Assert
      await expect(
        service.exportConfiguration(config, { format: 'invalid' as any })
      ).rejects.toThrow('Unsupported export format');
    });

    it('should reject exports exceeding 5 MB file size limit', async () => {
      // Arrange - Create a configuration with a very large description to exceed 5 MB
      const largeDescription = 'x'.repeat(6 * 1024 * 1024); // 6 MB of text
      const config: ReportConfig = {
        name: 'Oversized Report',
        description: largeDescription,
        tags: ['Temperature'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act & Assert
      await expect(
        service.exportConfiguration(config, { format: 'json' })
      ).rejects.toThrow(/Configuration exceeds maximum export size of 5 MB/);
    });

    it('should include actual file size in error message for oversized exports', async () => {
      // Arrange - Create a configuration that will exceed the limit
      const largeDescription = 'x'.repeat(6 * 1024 * 1024); // 6 MB of text
      const config: ReportConfig = {
        name: 'Oversized Report',
        description: largeDescription,
        tags: ['Temperature'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act & Assert
      try {
        await service.exportConfiguration(config, { format: 'json' });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain('Configuration exceeds maximum export size of 5 MB');
        expect(errorMessage).toMatch(/actual: \d+\.\d+ MB/);
      }
    });

    it('should allow exports under 5 MB file size limit', async () => {
      // Arrange - Create a configuration with a reasonable size (well under 5 MB)
      const reasonableDescription = 'This is a normal report description';
      const config: ReportConfig = {
        name: 'Normal Report',
        description: reasonableDescription,
        tags: ['Temperature', 'Pressure', 'Flow'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
        includeTrendLines: true,
        includeSPCCharts: true,
        includeStatsSummary: true,
      };

      // Act
      const result = await service.exportConfiguration(config, { format: 'json' });

      // Assert
      expect(result).toBeDefined();
      expect(result.filename).toBeDefined();
      expect(result.data).toBeDefined();

      // Verify the size is reasonable
      const sizeBytes = Buffer.byteLength(result.data as string, 'utf8');
      expect(sizeBytes).toBeLessThan(5 * 1024 * 1024); // Less than 5 MB
    });

    it('should export configuration to Power BI format', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Test Report',
        tags: ['Temperature'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act
      const result = await service.exportConfiguration(config, { format: 'powerbi' });

      // Assert
      expect(result.filename).toMatch(/^PowerBI_Temperature_\d{8}_\d{6}\.m$/);
      expect(result.contentType).toBe('text/plain');
      expect(typeof result.data).toBe('string');

      // Verify M Query content
      const mQuery = result.data as string;
      expect(mQuery).toContain('AVEVA Historian Data Query for Power BI');
      expect(mQuery).toContain('Server = ');
      expect(mQuery).toContain('Database = ');
      expect(mQuery).toContain('Tags = {"Temperature"}');
      expect(mQuery).toContain('QualityFilter = 192');
      expect(mQuery).toContain('SELECT');
      expect(mQuery).toContain('FROM History h');
      expect(mQuery).toContain('INNER JOIN Tag t ON h.TagId = t.TagId');
      expect(mQuery).toContain('Sql.Database');
    });
  });

  describe('metadata', () => {
    it('should include export metadata when includeMetadata is true', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Test Report',
        tags: ['Temperature'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act
      const result = await service.exportConfiguration(config, {
        format: 'json',
        includeMetadata: true,
      });

      // Assert
      const exportedConfig: ExportedConfiguration = JSON.parse(result.data as string);
      expect(exportedConfig.exportMetadata).toBeDefined();
      expect(exportedConfig.exportMetadata.exportDate).toBeDefined();
      expect(exportedConfig.exportMetadata.exportedBy).toBeDefined();
      expect(exportedConfig.exportMetadata.applicationVersion).toBeDefined();
      expect(exportedConfig.exportMetadata.platform).toBeDefined();
    });

    it('should include minimal metadata when includeMetadata is false', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Test Report',
        tags: ['Temperature'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act
      const result = await service.exportConfiguration(config, {
        format: 'json',
        includeMetadata: false,
      });

      // Assert
      const exportedConfig: ExportedConfiguration = JSON.parse(result.data as string);
      expect(exportedConfig.exportMetadata).toBeDefined();
      expect(exportedConfig.exportMetadata.exportedBy).toBe('system');
    });
  });

  describe('security and credential exclusion', () => {
    it('should include connection metadata without credentials', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Test Report',
        tags: ['Temperature'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act
      const result = await service.exportConfiguration(config, { format: 'json' });

      // Assert
      const exportedConfig: ExportedConfiguration = JSON.parse(result.data as string);
      expect(exportedConfig.connectionMetadata).toBeDefined();
      expect(exportedConfig.connectionMetadata.databaseServer).toBeDefined();
      expect(exportedConfig.connectionMetadata.databaseName).toBeDefined();
      expect(exportedConfig.connectionMetadata.smtpServer).toBeDefined();
      expect(exportedConfig.connectionMetadata.smtpPort).toBeDefined();
    });

    it('should NOT include database passwords in export', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Test Report',
        tags: ['Temperature'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act
      const result = await service.exportConfiguration(config, { format: 'json' });

      // Assert
      const exportedConfig: ExportedConfiguration = JSON.parse(result.data as string);

      // Verify the exported config structure doesn't have credential fields
      expect(exportedConfig.connectionMetadata).not.toHaveProperty('password');
      expect(exportedConfig.connectionMetadata).not.toHaveProperty('databasePassword');
      expect(exportedConfig.connectionMetadata).not.toHaveProperty('databaseUser');
      expect(exportedConfig.connectionMetadata).not.toHaveProperty('user');

      // Verify connection metadata only has safe fields
      const connectionKeys = Object.keys(exportedConfig.connectionMetadata);
      expect(connectionKeys).toEqual(['databaseServer', 'databaseName', 'smtpServer', 'smtpPort']);
    });

    it('should NOT include SMTP credentials in export', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Test Report',
        tags: ['Temperature'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act
      const result = await service.exportConfiguration(config, { format: 'json' });

      // Assert
      const exportedConfig: ExportedConfiguration = JSON.parse(result.data as string);

      // Verify the exported config structure doesn't have SMTP credential fields
      expect(exportedConfig.connectionMetadata).not.toHaveProperty('smtpPassword');
      expect(exportedConfig.connectionMetadata).not.toHaveProperty('smtpUser');
      expect(exportedConfig.connectionMetadata).not.toHaveProperty('smtpUsername');

      // Verify connection metadata only has safe fields
      const connectionKeys = Object.keys(exportedConfig.connectionMetadata);
      expect(connectionKeys).toEqual(['databaseServer', 'databaseName', 'smtpServer', 'smtpPort']);
    });

    it('should include security notice in export', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Test Report',
        tags: ['Temperature'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act
      const result = await service.exportConfiguration(config, { format: 'json' });

      // Assert
      const exportedConfig: ExportedConfiguration = JSON.parse(result.data as string);
      expect(exportedConfig.securityNotice).toBeDefined();
      expect(exportedConfig.securityNotice.message).toBeDefined();
      expect(exportedConfig.securityNotice.message).toContain('SECURITY NOTICE');
      expect(exportedConfig.securityNotice.message).toContain('credentials');
      expect(exportedConfig.securityNotice.instructions).toBeDefined();
      expect(Array.isArray(exportedConfig.securityNotice.instructions)).toBe(true);
      expect(exportedConfig.securityNotice.instructions.length).toBeGreaterThan(0);
    });

    it('should include instructions about credential configuration in security notice', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Test Report',
        tags: ['Temperature'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act
      const result = await service.exportConfiguration(config, { format: 'json' });

      // Assert
      const exportedConfig: ExportedConfiguration = JSON.parse(result.data as string);
      const instructions = exportedConfig.securityNotice.instructions.join(' ');

      // Verify instructions mention key security points
      expect(instructions).toContain('DB_USER');
      expect(instructions).toContain('DB_PASSWORD');
      expect(instructions).toContain('SMTP_USER');
      expect(instructions).toContain('SMTP_PASSWORD');
      expect(instructions).toContain('environment variables');
    });

    it('should warn about safe sharing in security notice', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Test Report',
        tags: ['Temperature'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act
      const result = await service.exportConfiguration(config, { format: 'json' });

      // Assert
      const exportedConfig: ExportedConfiguration = JSON.parse(result.data as string);
      const instructions = exportedConfig.securityNotice.instructions.join(' ');

      // Verify instructions mention safe sharing
      expect(instructions).toContain('safe to share');
      expect(instructions).toContain('no sensitive information');
    });
  });

  describe('Power BI export', () => {
    it('should generate valid M Query with all required components', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Power BI Test Report',
        tags: ['Temperature', 'Pressure'],
        timeRange: {
          startTime: new Date('2024-01-15T10:30:00Z'),
          endTime: new Date('2024-01-16T14:45:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act
      const result = await service.exportConfiguration(config, { format: 'powerbi' });

      // Assert
      const mQuery = result.data as string;

      // Verify documentation comments
      expect(mQuery).toContain('AVEVA Historian Data Query for Power BI');
      expect(mQuery).toContain('CONFIGURATION INSTRUCTIONS');
      expect(mQuery).toContain('SECURITY NOTICE');
      expect(mQuery).toContain('QUERY PARAMETERS');

      // Verify connection parameters
      expect(mQuery).toContain('Server = ');
      expect(mQuery).toContain('Database = ');

      // Verify tag selection
      expect(mQuery).toContain('Tags = {"Temperature", "Pressure"}');

      // Verify SQL query structure
      expect(mQuery).toContain('SELECT');
      expect(mQuery).toContain('t.TagName');
      expect(mQuery).toContain('h.DateTime');
      expect(mQuery).toContain('h.Value');
      expect(mQuery).toContain('h.QualityCode');
      expect(mQuery).toContain('FROM History h');
      expect(mQuery).toContain('INNER JOIN Tag t ON h.TagId = t.TagId');
      expect(mQuery).toContain('WHERE t.TagName IN');
      expect(mQuery).toContain('ORDER BY t.TagName, h.DateTime');

      // Verify M Query execution
      expect(mQuery).toContain('Sql.Database(Server, Database, [Query=SqlQuery])');
      expect(mQuery).toContain('Table.TransformColumnTypes');
    });

    it('should generate correct filename for Power BI export', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Test Report',
        tags: ['Temperature'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act
      const result = await service.exportConfiguration(config, { format: 'powerbi' });

      // Assert
      expect(result.filename).toMatch(/^PowerBI_Temperature_\d{8}_\d{6}\.m$/);
      expect(result.filename).toContain('.m');
    });

    it('should handle multiple tags in Power BI export', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Multi-Tag Report',
        tags: ['Tag1', 'Tag2', 'Tag3'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act
      const result = await service.exportConfiguration(config, { format: 'powerbi' });

      // Assert
      const mQuery = result.data as string;
      expect(mQuery).toContain('Tags = {"Tag1", "Tag2", "Tag3"}');
      expect(result.filename).toMatch(/^PowerBI_Tag1_Tag2_Tag3_\d{8}_\d{6}\.m$/);
    });

    it('should escape double quotes in tag names for M Query array', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Special Chars Report',
        tags: ['Tag"With"Quotes'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act
      const result = await service.exportConfiguration(config, { format: 'powerbi' });

      // Assert
      const mQuery = result.data as string;
      // Double quotes should be escaped as "" in M Query
      expect(mQuery).toContain('Tag""With""Quotes');
    });

    it('should include quality filter in M Query and SQL query', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Test Report',
        tags: ['Temperature'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act
      const result = await service.exportConfiguration(config, { format: 'powerbi' });

      // Assert
      const mQuery = result.data as string;
      expect(mQuery).toContain('QualityFilter = 192');
      expect(mQuery).toContain('h.QualityCode = " & Number.ToText(QualityFilter) & "');
    });

    it('should format dates correctly in Power BI M Query', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Test Report',
        tags: ['Temperature'],
        timeRange: {
          startTime: new Date('2024-03-15T08:30:45Z'),
          endTime: new Date('2024-03-16T16:45:30Z'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act
      const result = await service.exportConfiguration(config, { format: 'powerbi' });

      // Assert
      const mQuery = result.data as string;
      // Check M Query datetime format
      expect(mQuery).toContain('#datetime(2024, 3, 15, 8, 30, 45)');
      expect(mQuery).toContain('#datetime(2024, 3, 16, 16, 45, 30)');
      // Check SQL datetime format in the query string
      expect(mQuery).toContain('2024-03-15 08:30:45');
      expect(mQuery).toContain('2024-03-16 16:45:30');
    });

    it('should include quality status mapping in M Query script', async () => {
      // Arrange
      const config: ReportConfig = {
        name: 'Test Report',
        tags: ['Temperature'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-02T00:00:00Z'),
        },
        chartTypes: ['line'],
        template: 'default',
      };

      // Act
      const result = await service.exportConfiguration(config, { format: 'powerbi' });

      // Assert
      const mQuery = result.data as string;
      expect(mQuery).toContain("CASE");
      expect(mQuery).toContain("WHEN h.QualityCode = 192 THEN 'Good'");
      expect(mQuery).toContain("ELSE 'Uncertain'");
      expect(mQuery).toContain("QualityStatus");
    });
  });
});
