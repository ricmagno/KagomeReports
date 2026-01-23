/**
 * Type definitions for report configuration export and import functionality
 * 
 * This module defines the data structures used for exporting report configurations
 * to various formats (JSON, Power BI) and importing them back into the application.
 */

import { ReportConfig } from './reports';

// ============================================================================
// Export Types
// ============================================================================

/**
 * Export format options
 */
export type ExportFormat = 'json' | 'powerbi';

/**
 * Options for configuring export behavior
 */
export interface ExportOptions {
  /** The format to export to */
  format: ExportFormat;
  /** Whether to include metadata in the export (default: true) */
  includeMetadata?: boolean;
}

/**
 * Result of an export operation
 */
export interface ExportResult {
  /** Generated filename for the export */
  filename: string;
  /** MIME type of the exported content */
  contentType: string;
  /** The exported data as a Buffer or string */
  data: Buffer | string;
}

/**
 * Metadata included in exported configurations
 */
export interface ExportMetadata {
  /** ISO 8601 timestamp when the export was created */
  exportDate: string;
  /** User identifier who performed the export */
  exportedBy: string;
  /** Application version that created the export */
  applicationVersion: string;
  /** Platform where the export was created (e.g., "linux", "win32", "darwin") */
  platform: string;
  /** Character encoding used in the export (always UTF-8) */
  encoding: 'UTF-8';
}

/**
 * Connection metadata (without credentials) for reference
 */
export interface ConnectionMetadata {
  /** Database server address */
  databaseServer: string;
  /** Database name */
  databaseName: string;
  /** SMTP server address */
  smtpServer: string;
  /** SMTP port */
  smtpPort: number;
}

/**
 * Security notice included in exported files
 */
export interface SecurityNotice {
  /** Warning message about credentials */
  message: string;
  /** Instructions for configuring credentials */
  instructions: string[];
}

/**
 * Complete exported configuration structure (JSON format)
 * Schema Version: 1.0
 */
export interface ExportedConfiguration {
  /** Schema version for backward compatibility */
  schemaVersion: string;
  /** Metadata about the export operation */
  exportMetadata: ExportMetadata;
  /** Connection metadata (without credentials) */
  connectionMetadata: ConnectionMetadata;
  /** Security notice about credentials */
  securityNotice: SecurityNotice;
  /** The actual report configuration */
  reportConfig: ExportedReportConfig;
}

/**
 * Report configuration structure for export
 * This is a serialization-friendly version of ReportConfig
 */
export interface ExportedReportConfig {
  /** Selected tag names */
  tags: string[];
  
  /** Time range configuration */
  timeRange: {
    /** ISO 8601 formatted start time */
    startTime: string;
    /** ISO 8601 formatted end time */
    endTime: string;
    /** Duration in milliseconds (optional) */
    duration?: number;
    /** Relative range identifier (optional) */
    relativeRange?: 'last1h' | 'last2h' | 'last6h' | 'last12h' | 'last24h' | 'last7d' | 'last30d';
  };
  
  /** Sampling configuration */
  sampling: {
    /** Sampling mode */
    mode: 'Cyclic' | 'Delta' | 'BestFit';
    /** Sampling interval in seconds (for Cyclic mode) */
    interval?: number;
  };
  
  /** Analytics options */
  analytics: {
    /** Whether analytics are enabled */
    enabled: boolean;
    /** Show trend lines on charts */
    showTrendLine: boolean;
    /** Show SPC metrics */
    showSPCMetrics: boolean;
    /** Show statistical summaries */
    showStatistics: boolean;
  };
  
  /** Specification limits (if configured) */
  specificationLimits?: {
    /** Whether specification limits are enabled */
    enabled: boolean;
    /** Upper specification limit */
    upperLimit?: number;
    /** Lower specification limit */
    lowerLimit?: number;
    /** Target value */
    target?: number;
  };
  
  /** Report metadata */
  reportName?: string;
  description?: string;
  
  /** Custom settings (extensible) */
  customSettings?: Record<string, any>;
}

// ============================================================================
// Import Types
// ============================================================================

/**
 * Result of an import operation
 */
export interface ImportResult {
  /** Whether the import was successful */
  success: boolean;
  /** The imported and validated configuration (if successful) */
  config?: ReportConfig;
  /** Validation errors (if any) */
  errors?: ValidationError[];
  /** Warnings that don't prevent import (e.g., non-existent tags) */
  warnings?: string[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  /** Machine-readable error code */
  code: ValidationErrorCode;
  /** Field name that failed validation (if applicable) */
  field?: string;
  /** Human-readable error message */
  message: string;
  /** Severity level */
  severity: 'error' | 'warning';
  /** Additional error details */
  details?: any;
}

/**
 * Validation error codes
 */
export enum ValidationErrorCode {
  INVALID_JSON = 'INVALID_JSON',
  SCHEMA_VERSION_MISMATCH = 'SCHEMA_VERSION_MISMATCH',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_VALUE = 'INVALID_FIELD_VALUE',
  TAG_NOT_FOUND = 'TAG_NOT_FOUND',
  INVALID_TIME_RANGE = 'INVALID_TIME_RANGE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  INVALID_SAMPLING_MODE = 'INVALID_SAMPLING_MODE',
  INVALID_SPEC_LIMITS = 'INVALID_SPEC_LIMITS',
}

/**
 * Import metadata to track import history
 */
export interface ImportMetadata {
  /** Original filename that was imported */
  importedFrom?: string;
  /** ISO 8601 timestamp when the import occurred */
  importDate?: Date;
  /** Original export date from the imported file */
  originalExportDate?: Date;
  /** Schema version of the imported file */
  schemaVersion?: string;
}

// ============================================================================
// Schema Version Constants
// ============================================================================

/**
 * Current JSON schema version
 * Format: MAJOR.MINOR.PATCH (semantic versioning)
 */
export const CURRENT_SCHEMA_VERSION = '1.0.0';

/**
 * Supported schema versions for import
 * Versions in this list can be imported (with migration if needed)
 */
export const SUPPORTED_SCHEMA_VERSIONS = ['1.0.0', '1.0'];

/**
 * Maximum file sizes
 */
export const MAX_EXPORT_SIZE_MB = 5;
export const MAX_IMPORT_SIZE_MB = 10;
export const MAX_EXPORT_SIZE_BYTES = MAX_EXPORT_SIZE_MB * 1024 * 1024;
export const MAX_IMPORT_SIZE_BYTES = MAX_IMPORT_SIZE_MB * 1024 * 1024;

// ============================================================================
// Power BI Types
// ============================================================================

/**
 * Power BI connection configuration
 */
export interface PowerBIConnection {
  /** Database server address */
  server: string;
  /** Database name */
  database: string;
  /** SQL query for retrieving data */
  query: string;
  /** Authentication method */
  authenticationType: 'Windows' | 'Database';
}

/**
 * Power BI M Query template parameters
 */
export interface PowerBIQueryParams {
  /** Server address */
  server: string;
  /** Database name */
  database: string;
  /** List of tag names */
  tags: string[];
  /** Start time for data retrieval */
  startTime: Date;
  /** End time for data retrieval */
  endTime: Date;
  /** Quality code filter (default: 192 for Good quality) */
  qualityFilter: number;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Request body for export endpoint
 */
export interface ExportRequest {
  /** Report configuration to export */
  config: ReportConfig;
  /** Export format */
  format: ExportFormat;
}

/**
 * Request body for import endpoint
 */
export interface ImportRequest {
  /** JSON file content as string */
  fileContent: string;
}

/**
 * Generic error response structure
 */
export interface ErrorResponse {
  success: false;
  error: {
    /** Machine-readable error code */
    code: string;
    /** User-friendly error message */
    message: string;
    /** Additional error details */
    details?: any;
    /** Field name (for validation errors) */
    field?: string;
    /** List of validation issues */
    validationErrors?: ValidationError[];
  };
}

/**
 * Generic success response structure
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
  /** Optional warnings */
  warnings?: string[];
  /** Optional metadata */
  metadata?: {
    processingTime?: number;
    schemaVersion?: string;
  };
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation rules for required fields
 */
export const REQUIRED_FIELDS = [
  'schemaVersion',
  'reportConfig',
  'reportConfig.tags',
  'reportConfig.timeRange',
  'reportConfig.timeRange.startTime',
  'reportConfig.timeRange.endTime',
  'reportConfig.sampling',
  'reportConfig.sampling.mode',
] as const;

/**
 * Valid sampling modes
 */
export const VALID_SAMPLING_MODES = ['Cyclic', 'Delta', 'BestFit'] as const;

/**
 * Tag name validation pattern
 * Allows alphanumeric characters, underscores, dots, and hyphens
 */
export const TAG_NAME_PATTERN = /^[A-Za-z0-9_.\-]+$/;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid ExportFormat
 */
export function isValidExportFormat(value: any): value is ExportFormat {
  return value === 'json' || value === 'powerbi';
}

/**
 * Type guard to check if a value is a valid sampling mode
 */
export function isValidSamplingMode(value: any): value is 'Cyclic' | 'Delta' | 'BestFit' {
  return VALID_SAMPLING_MODES.includes(value);
}

/**
 * Type guard to check if a value is a valid schema version
 */
export function isValidSchemaVersion(version: any): version is string {
  return typeof version === 'string' && /^\d+\.\d+(\.\d+)?$/.test(version);
}

/**
 * Type guard to check if an object is an ExportedConfiguration
 */
export function isExportedConfiguration(obj: any): obj is ExportedConfiguration {
  return (
    obj !== null &&
    obj !== undefined &&
    typeof obj === 'object' &&
    'schemaVersion' in obj &&
    'exportMetadata' in obj &&
    'reportConfig' in obj
  );
}
