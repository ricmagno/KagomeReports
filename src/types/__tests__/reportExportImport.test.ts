/**
 * Unit tests for report export/import type definitions
 */

import {
  ExportFormat,
  ExportOptions,
  ExportResult,
  ExportMetadata,
  ExportedConfiguration,
  ExportedReportConfig,
  ImportResult,
  ValidationError,
  ValidationErrorCode,
  ImportMetadata,
  CURRENT_SCHEMA_VERSION,
  SUPPORTED_SCHEMA_VERSIONS,
  MAX_EXPORT_SIZE_BYTES,
  MAX_IMPORT_SIZE_BYTES,
  PowerBIConnection,
  PowerBIQueryParams,
  ExportRequest,
  ImportRequest,
  ErrorResponse,
  SuccessResponse,
  REQUIRED_FIELDS,
  VALID_SAMPLING_MODES,
  TAG_NAME_PATTERN,
  isValidExportFormat,
  isValidSamplingMode,
  isValidSchemaVersion,
  isExportedConfiguration,
} from '../reportExportImport';

describe('Report Export/Import Types', () => {
  describe('Type Guards', () => {
    describe('isValidExportFormat', () => {
      it('should return true for valid export formats', () => {
        expect(isValidExportFormat('json')).toBe(true);
        expect(isValidExportFormat('powerbi')).toBe(true);
      });

      it('should return false for invalid export formats', () => {
        expect(isValidExportFormat('pdf')).toBe(false);
        expect(isValidExportFormat('xml')).toBe(false);
        expect(isValidExportFormat('')).toBe(false);
        expect(isValidExportFormat(null)).toBe(false);
        expect(isValidExportFormat(undefined)).toBe(false);
      });
    });

    describe('isValidSamplingMode', () => {
      it('should return true for valid sampling modes', () => {
        expect(isValidSamplingMode('Cyclic')).toBe(true);
        expect(isValidSamplingMode('Delta')).toBe(true);
        expect(isValidSamplingMode('BestFit')).toBe(true);
      });

      it('should return false for invalid sampling modes', () => {
        expect(isValidSamplingMode('Invalid')).toBe(false);
        expect(isValidSamplingMode('cyclic')).toBe(false);
        expect(isValidSamplingMode('')).toBe(false);
        expect(isValidSamplingMode(null)).toBe(false);
      });
    });

    describe('isValidSchemaVersion', () => {
      it('should return true for valid schema versions', () => {
        expect(isValidSchemaVersion('1.0')).toBe(true);
        expect(isValidSchemaVersion('1.0.0')).toBe(true);
        expect(isValidSchemaVersion('2.1.3')).toBe(true);
      });

      it('should return false for invalid schema versions', () => {
        expect(isValidSchemaVersion('1')).toBe(false);
        expect(isValidSchemaVersion('v1.0')).toBe(false);
        expect(isValidSchemaVersion('1.0.0.0')).toBe(false);
        expect(isValidSchemaVersion('')).toBe(false);
        expect(isValidSchemaVersion(null)).toBe(false);
      });
    });

    describe('isExportedConfiguration', () => {
      it('should return true for valid exported configurations', () => {
        const validConfig = {
          schemaVersion: '1.0.0',
          exportMetadata: {
            exportDate: '2024-01-01T00:00:00Z',
            exportedBy: 'user1',
            applicationVersion: '1.0.0',
            platform: 'linux',
            encoding: 'UTF-8',
          },
          reportConfig: {
            tags: ['Tag1'],
            timeRange: {
              startTime: '2024-01-01T00:00:00Z',
              endTime: '2024-01-02T00:00:00Z',
            },
            sampling: {
              mode: 'Cyclic',
            },
            analytics: {
              enabled: false,
              showTrendLine: false,
              showSPCMetrics: false,
              showStatistics: true,
            },
          },
        };

        expect(isExportedConfiguration(validConfig)).toBe(true);
      });

      it('should return false for invalid exported configurations', () => {
        expect(isExportedConfiguration({})).toBe(false);
        expect(isExportedConfiguration({ schemaVersion: '1.0' })).toBe(false);
        expect(isExportedConfiguration({ exportMetadata: {} })).toBe(false);
        expect(isExportedConfiguration(null)).toBe(false);
        expect(isExportedConfiguration(undefined)).toBe(false);
      });
    });
  });

  describe('Constants', () => {
    it('should have valid schema version', () => {
      expect(CURRENT_SCHEMA_VERSION).toBe('1.0.0');
      expect(isValidSchemaVersion(CURRENT_SCHEMA_VERSION)).toBe(true);
    });

    it('should have supported schema versions', () => {
      expect(SUPPORTED_SCHEMA_VERSIONS).toContain('1.0.0');
      expect(SUPPORTED_SCHEMA_VERSIONS).toContain('1.0');
      expect(SUPPORTED_SCHEMA_VERSIONS.length).toBeGreaterThan(0);
    });

    it('should have valid file size limits', () => {
      expect(MAX_EXPORT_SIZE_BYTES).toBe(5 * 1024 * 1024);
      expect(MAX_IMPORT_SIZE_BYTES).toBe(10 * 1024 * 1024);
      expect(MAX_IMPORT_SIZE_BYTES).toBeGreaterThan(MAX_EXPORT_SIZE_BYTES);
    });

    it('should have required fields defined', () => {
      expect(REQUIRED_FIELDS).toContain('schemaVersion');
      expect(REQUIRED_FIELDS).toContain('reportConfig');
      expect(REQUIRED_FIELDS).toContain('reportConfig.tags');
      expect(REQUIRED_FIELDS.length).toBeGreaterThan(0);
    });

    it('should have valid sampling modes', () => {
      expect(VALID_SAMPLING_MODES).toContain('Cyclic');
      expect(VALID_SAMPLING_MODES).toContain('Delta');
      expect(VALID_SAMPLING_MODES).toContain('BestFit');
      expect(VALID_SAMPLING_MODES.length).toBe(3);
    });

    it('should have tag name pattern', () => {
      expect(TAG_NAME_PATTERN.test('Tag1')).toBe(true);
      expect(TAG_NAME_PATTERN.test('Tag_1')).toBe(true);
      expect(TAG_NAME_PATTERN.test('Tag.1')).toBe(true);
      expect(TAG_NAME_PATTERN.test('Tag-1')).toBe(true);
      expect(TAG_NAME_PATTERN.test('Tag 1')).toBe(false);
      expect(TAG_NAME_PATTERN.test('Tag@1')).toBe(false);
    });
  });

  describe('ValidationErrorCode enum', () => {
    it('should have all expected error codes', () => {
      expect(ValidationErrorCode.INVALID_JSON).toBe('INVALID_JSON');
      expect(ValidationErrorCode.SCHEMA_VERSION_MISMATCH).toBe('SCHEMA_VERSION_MISMATCH');
      expect(ValidationErrorCode.MISSING_REQUIRED_FIELD).toBe('MISSING_REQUIRED_FIELD');
      expect(ValidationErrorCode.INVALID_FIELD_VALUE).toBe('INVALID_FIELD_VALUE');
      expect(ValidationErrorCode.TAG_NOT_FOUND).toBe('TAG_NOT_FOUND');
      expect(ValidationErrorCode.INVALID_TIME_RANGE).toBe('INVALID_TIME_RANGE');
      expect(ValidationErrorCode.FILE_TOO_LARGE).toBe('FILE_TOO_LARGE');
      expect(ValidationErrorCode.UNSUPPORTED_FORMAT).toBe('UNSUPPORTED_FORMAT');
      expect(ValidationErrorCode.INVALID_SAMPLING_MODE).toBe('INVALID_SAMPLING_MODE');
      expect(ValidationErrorCode.INVALID_SPEC_LIMITS).toBe('INVALID_SPEC_LIMITS');
    });
  });

  describe('Type Compatibility', () => {
    it('should allow creating valid ExportOptions', () => {
      const options: ExportOptions = {
        format: 'json',
        includeMetadata: true,
      };

      expect(options.format).toBe('json');
      expect(options.includeMetadata).toBe(true);
    });

    it('should allow creating valid ExportResult', () => {
      const result: ExportResult = {
        filename: 'test.json',
        contentType: 'application/json',
        data: '{}',
      };

      expect(result.filename).toBe('test.json');
      expect(result.contentType).toBe('application/json');
    });

    it('should allow creating valid ImportResult', () => {
      const result: ImportResult = {
        success: true,
        warnings: ['Tag not found'],
      };

      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(1);
    });

    it('should allow creating valid ValidationError', () => {
      const error: ValidationError = {
        code: ValidationErrorCode.MISSING_REQUIRED_FIELD,
        field: 'tags',
        message: 'Tags field is required',
        severity: 'error',
      };

      expect(error.code).toBe(ValidationErrorCode.MISSING_REQUIRED_FIELD);
      expect(error.severity).toBe('error');
    });

    it('should allow creating valid ExportedConfiguration', () => {
      const config: ExportedConfiguration = {
        schemaVersion: '1.0.0',
        exportMetadata: {
          exportDate: '2024-01-01T00:00:00Z',
          exportedBy: 'user1',
          applicationVersion: '1.0.0',
          platform: 'linux',
          encoding: 'UTF-8',
        },
        connectionMetadata: {
          databaseServer: 'localhost',
          databaseName: 'Runtime',
          smtpServer: 'smtp.example.com',
          smtpPort: 587,
        },
        securityNotice: {
          message: 'SECURITY NOTICE: This exported configuration does NOT contain sensitive credentials.',
          instructions: ['Configure credentials separately'],
        },
        reportConfig: {
          tags: ['Tag1', 'Tag2'],
          timeRange: {
            startTime: '2024-01-01T00:00:00Z',
            endTime: '2024-01-02T00:00:00Z',
          },
          sampling: {
            mode: 'Cyclic',
            interval: 60,
          },
          analytics: {
            enabled: true,
            showTrendLine: true,
            showSPCMetrics: false,
            showStatistics: true,
          },
        },
      };

      expect(config.schemaVersion).toBe('1.0.0');
      expect(config.reportConfig.tags).toHaveLength(2);
    });
  });
});
