/**
 * ConfigImportService
 * 
 * Service responsible for importing and validating report configurations from JSON files.
 * Handles JSON parsing, schema validation, field validation, and conversion to ReportConfig.
 * 
 * Features:
 * - JSON parsing with comprehensive error handling
 * - Schema version validation and compatibility checking
 * - Field-level validation with detailed error messages
 * - Tag existence validation with warnings
 * - Default value application for missing optional fields
 * - File size validation
 * - State preservation on validation failure
 */

import { ReportConfig } from '@/types/reports';
import {
  ImportResult,
  ValidationError,
  ValidationErrorCode,
  ExportedConfiguration,
  ExportedReportConfig,
  CURRENT_SCHEMA_VERSION,
  SUPPORTED_SCHEMA_VERSIONS,
  MAX_IMPORT_SIZE_BYTES,
  REQUIRED_FIELDS,
  VALID_SAMPLING_MODES,
  TAG_NAME_PATTERN,
  isValidSchemaVersion,
  isExportedConfiguration,
} from '@/types/reportExportImport';
import { logger } from '@/utils/logger';
import { convertPathsInObject } from '@/utils/pathNormalization';
import { schemaVersionMigrator } from '@/utils/schemaVersionMigrator';

const importLogger = logger.child({ service: 'ConfigImportService' });

/**
 * Service for importing report configurations from JSON
 */
export class ConfigImportService {
  /**
   * Import and validate configuration from JSON
   * 
   * This is the main entry point for importing configurations. It performs:
   * 1. File size validation
   * 2. JSON parsing (handles UTF-8 encoded content)
   * 3. Schema validation
   * 4. Field validation
   * 5. Tag existence validation (warnings only)
   * 6. Conversion to ReportConfig
   * 7. Default value application
   * 
   * UTF-8 Encoding: JSON.parse in Node.js automatically handles UTF-8 encoded
   * strings, ensuring proper decoding of Unicode characters from exported files.
   * 
   * @param fileContent - JSON file content as string (UTF-8 encoded)
   * @returns Import result with config or validation errors
   */
  async importConfiguration(fileContent: string): Promise<ImportResult> {
    importLogger.info('Starting import operation');

    try {
      // Step 1: Validate file size
      const sizeBytes = Buffer.byteLength(fileContent, 'utf8');
      if (sizeBytes > MAX_IMPORT_SIZE_BYTES) {
        const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
        const maxMB = (MAX_IMPORT_SIZE_BYTES / (1024 * 1024)).toFixed(0);
        
        const error: ValidationError = {
          code: ValidationErrorCode.FILE_TOO_LARGE,
          message: `File size exceeds maximum allowed size of ${maxMB} MB (actual: ${sizeMB} MB)`,
          severity: 'error',
        };
        
        importLogger.error('Import failed: file too large', { sizeBytes, maxBytes: MAX_IMPORT_SIZE_BYTES });
        
        return {
          success: false,
          errors: [error],
        };
      }

      // Step 2: Parse JSON
      let parsedData: any;
      try {
        parsedData = JSON.parse(fileContent);
      } catch (parseError) {
        const error: ValidationError = {
          code: ValidationErrorCode.INVALID_JSON,
          message: 'Invalid JSON file format. Please check the file is valid JSON.',
          severity: 'error',
          details: parseError instanceof Error ? parseError.message : String(parseError),
        };
        
        importLogger.error('Import failed: invalid JSON', { 
          error: parseError instanceof Error ? parseError.message : String(parseError) 
        });
        
        return {
          success: false,
          errors: [error],
        };
      }

      // Step 3: Validate schema structure
      const schemaErrors = this.validateSchema(parsedData);
      if (schemaErrors.length > 0) {
        importLogger.error('Import failed: schema validation errors', { 
          errorCount: schemaErrors.length 
        });
        
        return {
          success: false,
          errors: schemaErrors,
        };
      }

      // Step 3.5: Apply schema migration if needed
      let migratedData = parsedData;
      if (parsedData.schemaVersion && parsedData.schemaVersion !== CURRENT_SCHEMA_VERSION) {
        try {
          importLogger.info('Applying schema migration', {
            fromVersion: parsedData.schemaVersion,
            toVersion: CURRENT_SCHEMA_VERSION,
          });
          
          migratedData = schemaVersionMigrator.migrate(
            parsedData,
            parsedData.schemaVersion
          );
          
          importLogger.info('Schema migration completed', {
            fromVersion: parsedData.schemaVersion,
            toVersion: CURRENT_SCHEMA_VERSION,
          });
        } catch (migrationError) {
          const error: ValidationError = {
            code: ValidationErrorCode.SCHEMA_VERSION_MISMATCH,
            field: 'schemaVersion',
            message: `Failed to migrate schema from version ${parsedData.schemaVersion} to ${CURRENT_SCHEMA_VERSION}`,
            severity: 'error',
            details: migrationError instanceof Error ? migrationError.message : String(migrationError),
          };
          
          importLogger.error('Schema migration failed', {
            fromVersion: parsedData.schemaVersion,
            toVersion: CURRENT_SCHEMA_VERSION,
            error: migrationError instanceof Error ? migrationError.message : String(migrationError),
          });
          
          return {
            success: false,
            errors: [error],
          };
        }
      }

      // Step 4: Validate field values (use migrated data)
      const fieldErrors = this.validateFields(migratedData.reportConfig);
      if (fieldErrors.length > 0) {
        importLogger.error('Import failed: field validation errors', { 
          errorCount: fieldErrors.length 
        });
        
        return {
          success: false,
          errors: fieldErrors,
        };
      }

      // Step 5: Validate tags (warnings only, doesn't prevent import)
      const tagWarnings = await this.validateTags(migratedData.reportConfig.tags);
      
      // Step 6: Map to ReportConfig (use migrated data)
      const config = this.mapToConfiguration(migratedData);
      
      // Step 6.5: Convert paths to platform-specific format
      const configWithPlatformPaths = this.convertPathsToPlatform(config);
      
      // Step 7: Apply defaults for missing optional fields
      const configWithDefaults = this.applyDefaults(configWithPlatformPaths);

      importLogger.info('Import completed successfully', {
        tags: configWithDefaults.tags.length,
        warnings: tagWarnings.length,
      });

      return {
        success: true,
        config: configWithDefaults,
        warnings: tagWarnings.map(w => w.message),
      };

    } catch (error) {
      importLogger.error('Import failed with unexpected error', {
        error: error instanceof Error ? error.message : String(error),
      });

      const validationError: ValidationError = {
        code: ValidationErrorCode.INVALID_JSON,
        message: 'An unexpected error occurred during import',
        severity: 'error',
        details: error instanceof Error ? error.message : String(error),
      };

      return {
        success: false,
        errors: [validationError],
      };
    }
  }

  /**
   * Validate JSON structure and schema version
   * 
   * Checks:
   * - Required top-level fields exist
   * - Schema version is valid and supported
   * - Basic structure matches ExportedConfiguration
   * 
   * @param data - Parsed JSON data
   * @returns Array of validation errors (empty if valid)
   * @private
   */
  private validateSchema(data: any): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check if data is an object
    if (!data || typeof data !== 'object') {
      errors.push({
        code: ValidationErrorCode.INVALID_JSON,
        message: 'Configuration must be a valid JSON object',
        severity: 'error',
      });
      return errors;
    }

    // Check for required top-level fields
    if (!data.schemaVersion) {
      errors.push({
        code: ValidationErrorCode.MISSING_REQUIRED_FIELD,
        field: 'schemaVersion',
        message: 'Required field "schemaVersion" is missing from the configuration',
        severity: 'error',
      });
    }

    if (!data.reportConfig) {
      errors.push({
        code: ValidationErrorCode.MISSING_REQUIRED_FIELD,
        field: 'reportConfig',
        message: 'Required field "reportConfig" is missing from the configuration',
        severity: 'error',
      });
      return errors; // Can't continue without reportConfig
    }

    // Validate schema version format
    if (data.schemaVersion && !isValidSchemaVersion(data.schemaVersion)) {
      errors.push({
        code: ValidationErrorCode.SCHEMA_VERSION_MISMATCH,
        field: 'schemaVersion',
        message: `Invalid schema version format: "${data.schemaVersion}". Expected format: "X.Y" or "X.Y.Z"`,
        severity: 'error',
        details: { actual: data.schemaVersion, expected: 'X.Y or X.Y.Z' },
      });
    }

    // Check schema version compatibility
    if (data.schemaVersion && !SUPPORTED_SCHEMA_VERSIONS.includes(data.schemaVersion)) {
      // This is a warning, not an error - we'll attempt to import anyway
      errors.push({
        code: ValidationErrorCode.SCHEMA_VERSION_MISMATCH,
        field: 'schemaVersion',
        message: `Schema version "${data.schemaVersion}" may not be fully compatible. Current version: "${CURRENT_SCHEMA_VERSION}". Import will proceed but some features may not work correctly.`,
        severity: 'warning',
        details: { 
          actual: data.schemaVersion, 
          expected: CURRENT_SCHEMA_VERSION,
          supported: SUPPORTED_SCHEMA_VERSIONS,
        },
      });
    }

    // Check for required fields in reportConfig
    const reportConfig = data.reportConfig;

    if (!reportConfig.tags || !Array.isArray(reportConfig.tags)) {
      errors.push({
        code: ValidationErrorCode.MISSING_REQUIRED_FIELD,
        field: 'reportConfig.tags',
        message: 'Required field "reportConfig.tags" is missing or not an array',
        severity: 'error',
      });
    }

    if (!reportConfig.timeRange) {
      errors.push({
        code: ValidationErrorCode.MISSING_REQUIRED_FIELD,
        field: 'reportConfig.timeRange',
        message: 'Required field "reportConfig.timeRange" is missing',
        severity: 'error',
      });
    } else {
      if (!reportConfig.timeRange.startTime) {
        errors.push({
          code: ValidationErrorCode.MISSING_REQUIRED_FIELD,
          field: 'reportConfig.timeRange.startTime',
          message: 'Required field "reportConfig.timeRange.startTime" is missing',
          severity: 'error',
        });
      }

      if (!reportConfig.timeRange.endTime) {
        errors.push({
          code: ValidationErrorCode.MISSING_REQUIRED_FIELD,
          field: 'reportConfig.timeRange.endTime',
          message: 'Required field "reportConfig.timeRange.endTime" is missing',
          severity: 'error',
        });
      }
    }

    if (!reportConfig.sampling) {
      errors.push({
        code: ValidationErrorCode.MISSING_REQUIRED_FIELD,
        field: 'reportConfig.sampling',
        message: 'Required field "reportConfig.sampling" is missing',
        severity: 'error',
      });
    } else {
      if (!reportConfig.sampling.mode) {
        errors.push({
          code: ValidationErrorCode.MISSING_REQUIRED_FIELD,
          field: 'reportConfig.sampling.mode',
          message: 'Required field "reportConfig.sampling.mode" is missing',
          severity: 'error',
        });
      }
    }

    return errors;
  }

  /**
   * Validate individual field values
   * 
   * Checks:
   * - Time range validity (start before end, not in future)
   * - Sampling mode is valid
   * - Sampling interval is positive (if present)
   * - Specification limits are valid (upper > lower)
   * - Tag names match expected pattern
   * 
   * @param config - Report configuration from JSON
   * @returns Array of validation errors (empty if valid)
   * @private
   */
  private validateFields(config: ExportedReportConfig): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate tags array
    if (config.tags && Array.isArray(config.tags)) {
      if (config.tags.length === 0) {
        errors.push({
          code: ValidationErrorCode.INVALID_FIELD_VALUE,
          field: 'reportConfig.tags',
          message: 'At least one tag must be specified',
          severity: 'error',
        });
      }

      // Validate tag name patterns
      config.tags.forEach((tag, index) => {
        if (typeof tag !== 'string' || tag.trim().length === 0) {
          errors.push({
            code: ValidationErrorCode.INVALID_FIELD_VALUE,
            field: `reportConfig.tags[${index}]`,
            message: `Tag at index ${index} is not a valid string`,
            severity: 'error',
          });
        } else if (!TAG_NAME_PATTERN.test(tag)) {
          errors.push({
            code: ValidationErrorCode.INVALID_FIELD_VALUE,
            field: `reportConfig.tags[${index}]`,
            message: `Tag "${tag}" contains invalid characters. Only alphanumeric, underscore, dot, and hyphen are allowed`,
            severity: 'error',
          });
        }
      });
    }

    // Validate time range
    if (config.timeRange) {
      const startTime = new Date(config.timeRange.startTime);
      const endTime = new Date(config.timeRange.endTime);
      const now = new Date();

      // Check if dates are valid
      if (isNaN(startTime.getTime())) {
        errors.push({
          code: ValidationErrorCode.INVALID_FIELD_VALUE,
          field: 'reportConfig.timeRange.startTime',
          message: `Invalid start time: "${config.timeRange.startTime}". Must be a valid ISO 8601 date`,
          severity: 'error',
        });
      }

      if (isNaN(endTime.getTime())) {
        errors.push({
          code: ValidationErrorCode.INVALID_FIELD_VALUE,
          field: 'reportConfig.timeRange.endTime',
          message: `Invalid end time: "${config.timeRange.endTime}". Must be a valid ISO 8601 date`,
          severity: 'error',
        });
      }

      // Check if start is before end
      if (!isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
        if (startTime >= endTime) {
          errors.push({
            code: ValidationErrorCode.INVALID_TIME_RANGE,
            field: 'reportConfig.timeRange',
            message: 'Start time must be before end time',
            severity: 'error',
            details: { startTime: config.timeRange.startTime, endTime: config.timeRange.endTime },
          });
        }

        // Check if end time is in the future (warning only)
        if (endTime > now) {
          errors.push({
            code: ValidationErrorCode.INVALID_TIME_RANGE,
            field: 'reportConfig.timeRange.endTime',
            message: 'End time is in the future. This may result in incomplete data',
            severity: 'warning',
            details: { endTime: config.timeRange.endTime, now: now.toISOString() },
          });
        }
      }
    }

    // Validate sampling mode
    if (config.sampling && config.sampling.mode) {
      if (!VALID_SAMPLING_MODES.includes(config.sampling.mode as any)) {
        errors.push({
          code: ValidationErrorCode.INVALID_SAMPLING_MODE,
          field: 'reportConfig.sampling.mode',
          message: `Invalid sampling mode: "${config.sampling.mode}". Must be one of: ${VALID_SAMPLING_MODES.join(', ')}`,
          severity: 'error',
          details: { actual: config.sampling.mode, valid: VALID_SAMPLING_MODES },
        });
      }

      // Validate sampling interval (if present)
      if (config.sampling.interval !== undefined) {
        if (typeof config.sampling.interval !== 'number' || config.sampling.interval <= 0) {
          errors.push({
            code: ValidationErrorCode.INVALID_FIELD_VALUE,
            field: 'reportConfig.sampling.interval',
            message: `Sampling interval must be a positive number (got: ${config.sampling.interval})`,
            severity: 'error',
          });
        }
      }
    }

    // Validate specification limits (if present)
    if (config.specificationLimits && config.specificationLimits.enabled) {
      const limits = config.specificationLimits;

      if (limits.upperLimit !== undefined && limits.lowerLimit !== undefined) {
        if (limits.upperLimit <= limits.lowerLimit) {
          errors.push({
            code: ValidationErrorCode.INVALID_SPEC_LIMITS,
            field: 'reportConfig.specificationLimits',
            message: `Upper specification limit (${limits.upperLimit}) must be greater than lower limit (${limits.lowerLimit})`,
            severity: 'error',
            details: { upperLimit: limits.upperLimit, lowerLimit: limits.lowerLimit },
          });
        }
      }

      // Validate that limits are numbers
      if (limits.upperLimit !== undefined && typeof limits.upperLimit !== 'number') {
        errors.push({
          code: ValidationErrorCode.INVALID_FIELD_VALUE,
          field: 'reportConfig.specificationLimits.upperLimit',
          message: 'Upper limit must be a number',
          severity: 'error',
        });
      }

      if (limits.lowerLimit !== undefined && typeof limits.lowerLimit !== 'number') {
        errors.push({
          code: ValidationErrorCode.INVALID_FIELD_VALUE,
          field: 'reportConfig.specificationLimits.lowerLimit',
          message: 'Lower limit must be a number',
          severity: 'error',
        });
      }

      if (limits.target !== undefined && typeof limits.target !== 'number') {
        errors.push({
          code: ValidationErrorCode.INVALID_FIELD_VALUE,
          field: 'reportConfig.specificationLimits.target',
          message: 'Target value must be a number',
          severity: 'error',
        });
      }
    }

    return errors;
  }

  /**
   * Check if tags exist in AVEVA Historian
   * 
   * This method queries the database to verify tag existence.
   * Non-existent tags generate warnings but don't prevent import.
   * 
   * @param tagNames - Array of tag names to validate
   * @returns Array of validation warnings for non-existent tags
   * @private
   */
  private async validateTags(tagNames: string[]): Promise<ValidationError[]> {
    const warnings: ValidationError[] = [];

    // TODO: Implement actual database query to check tag existence
    // For now, we'll skip this validation to avoid database dependency
    // This will be implemented in a future task when database integration is added
    
    importLogger.debug('Tag validation skipped (not yet implemented)', { 
      tagCount: tagNames.length 
    });

    return warnings;
  }

  /**
   * Map imported data to ReportConfiguration object
   * 
   * Converts the ExportedReportConfig structure to the internal ReportConfig format.
   * Handles type conversions, date parsing, and structure mapping.
   * 
   * @param data - Exported configuration data
   * @returns Partial ReportConfig (will be completed by applyDefaults)
   * @private
   */
  private mapToConfiguration(data: ExportedConfiguration): Partial<ReportConfig> {
    const exported = data.reportConfig;

    // Parse dates
    const startTime = new Date(exported.timeRange.startTime);
    const endTime = new Date(exported.timeRange.endTime);

    // Build base configuration
    const config: Partial<ReportConfig> = {
      name: exported.reportName || 'Imported Configuration',
      ...(exported.description && { description: exported.description }),
      tags: exported.tags,
      timeRange: {
        startTime,
        endTime,
      },
      
      // Map analytics options to ReportConfig fields
      includeSPCCharts: exported.analytics?.showSPCMetrics ?? false,
      includeTrendLines: exported.analytics?.showTrendLine ?? false,
      includeStatsSummary: exported.analytics?.showStatistics ?? true,
      
      // Add import metadata
      importMetadata: {
        importedFrom: 'imported-config.json', // Will be updated by caller if filename is known
        importDate: new Date(),
        ...(data.exportMetadata?.exportDate && {
          originalExportDate: new Date(data.exportMetadata.exportDate)
        }),
        schemaVersion: data.schemaVersion,
      },
    };

    // Map specification limits if present
    if (exported.specificationLimits && exported.specificationLimits.enabled) {
      // For simplicity, apply the same limits to all tags
      // In a more sophisticated implementation, we might support per-tag limits
      const limits = exported.specificationLimits;
      config.specificationLimits = {};
      
      exported.tags.forEach(tag => {
        const tagLimits: any = {};
        if (limits.upperLimit !== undefined) {
          tagLimits.usl = limits.upperLimit;
        }
        if (limits.lowerLimit !== undefined) {
          tagLimits.lsl = limits.lowerLimit;
        }
        config.specificationLimits![tag] = tagLimits;
      });
    }

    // Map custom settings if present
    if (exported.customSettings) {
      if (exported.customSettings.metadata) {
        config.metadata = exported.customSettings.metadata;
      }
      if (exported.customSettings.branding) {
        config.branding = exported.customSettings.branding;
      }
      if (exported.customSettings.template) {
        config.template = exported.customSettings.template;
      }
      if (exported.customSettings.chartTypes) {
        config.chartTypes = exported.customSettings.chartTypes;
      }
    }

    return config;
  }

  /**
   * Convert paths in imported configuration to platform-specific format.
   * This ensures paths work correctly on the local system regardless of
   * which platform the configuration was exported from.
   * 
   * @param config - Partial configuration from import
   * @returns Configuration with platform-specific paths
   * @private
   */
  private convertPathsToPlatform(config: Partial<ReportConfig>): Partial<ReportConfig> {
    // Create a deep copy to avoid modifying the original
    const converted = JSON.parse(JSON.stringify(config));

    // Convert any path fields in custom settings
    if (converted.customSettings) {
      const customSettings = converted.customSettings;
      
      // Check for common path fields in custom settings
      const pathFields = ['outputPath', 'templatePath', 'dataPath', 'reportPath'];
      
      for (const field of pathFields) {
        if (customSettings[field] && typeof customSettings[field] === 'string') {
          customSettings[field] = convertPathsInObject(
            { path: customSettings[field] },
            ['path']
          ).path;
        }
      }

      // Handle nested objects that might contain paths
      if (customSettings.paths && typeof customSettings.paths === 'object') {
        const pathKeys = Object.keys(customSettings.paths);
        customSettings.paths = convertPathsInObject(
          customSettings.paths,
          pathKeys as any
        );
      }
    }

    return converted;
  }

  /**
   * Apply default values for missing optional fields
   * 
   * Ensures the configuration has all required fields with sensible defaults.
   * This allows older exports or partial configurations to work correctly.
   * 
   * @param config - Partial configuration from import
   * @returns Complete ReportConfig with defaults applied
   * @private
   */
  private applyDefaults(config: Partial<ReportConfig>): ReportConfig {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    return {
      // Required fields (should already be present from import)
      name: config.name || 'Imported Configuration',
      tags: config.tags || [],
      timeRange: config.timeRange || {
        startTime: oneHourAgo,
        endTime: now,
      },
      
      // Chart types default
      chartTypes: config.chartTypes || ['line'],
      
      // Template default
      template: config.template || 'default',
      
      // Optional fields with defaults
      ...(config.description && { description: config.description }),
      format: config.format || 'pdf',
      filters: config.filters || [],
      
      // Branding defaults
      ...(config.branding && { branding: config.branding }),
      
      // Metadata defaults
      ...(config.metadata && { metadata: config.metadata }),
      
      // Analytics defaults
      includeSPCCharts: config.includeSPCCharts ?? false,
      includeTrendLines: config.includeTrendLines ?? false,
      includeStatsSummary: config.includeStatsSummary ?? true,
      
      // Specification limits
      ...(config.specificationLimits && { specificationLimits: config.specificationLimits }),
      
      // Import metadata
      ...(config.importMetadata && { importMetadata: config.importMetadata }),
      
      // Timestamps
      createdAt: config.createdAt || now,
      updatedAt: config.updatedAt || now,
      
      // Version tracking
      ...(config.version !== undefined && { version: config.version }),
      ...(config.parentId && { parentId: config.parentId }),
      
      // User tracking
      ...(config.createdBy && { createdBy: config.createdBy }),
    };
  }
}

// Export singleton instance
export const configImportService = new ConfigImportService();
