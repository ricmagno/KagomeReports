/**
 * ConfigExportService
 * 
 * Service responsible for exporting report configurations to various formats.
 * Supports JSON export for backup/sharing and Power BI export for external analysis.
 * 
 * Features:
 * - JSON export with metadata and versioning
 * - Power BI M Query generation
 * - Credential filtering for security
 * - Descriptive filename generation
 * - File size validation
 */

import { ReportConfig } from '@/types/reports';
import {
  ExportOptions,
  ExportResult,
  ExportMetadata,
  ExportedConfiguration,
  ExportedReportConfig,
  CURRENT_SCHEMA_VERSION,
  MAX_EXPORT_SIZE_BYTES,
  PowerBIQueryParams,
  ConnectionMetadata,
  SecurityNotice,
} from '@/types/reportExportImport';
import { logger } from '@/utils/logger';
import { version as appVersion } from '../../package.json';
import { env } from '@/config/environment';
import { normalizePathsInObject } from '@/utils/pathNormalization';

const exportLogger = logger.child({ service: 'ConfigExportService' });

/**
 * Service for exporting report configurations
 */
export class ConfigExportService {
  /**
   * Export report configuration to specified format
   * 
   * @param config - Report configuration to export
   * @param options - Export options (format, metadata inclusion)
   * @returns Export result with filename, content type, and data
   * @throws Error if export fails or file size exceeds limit
   */
  async exportConfiguration(
    config: ReportConfig,
    options: ExportOptions
  ): Promise<ExportResult> {
    exportLogger.info('Starting export', {
      format: options.format,
      configName: config.name,
      tags: config.tags.length,
    });

    try {
      let result: ExportResult;

      switch (options.format) {
        case 'json':
          result = this.generateJSONExport(config, options.includeMetadata ?? true);
          break;
        case 'powerbi':
          result = this.generatePowerBIExport(config);
          break;
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      // Validate file size
      const sizeBytes = Buffer.isBuffer(result.data)
        ? result.data.length
        : Buffer.byteLength(result.data, 'utf8');

      if (sizeBytes > MAX_EXPORT_SIZE_BYTES) {
        const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
        const maxMB = (MAX_EXPORT_SIZE_BYTES / (1024 * 1024)).toFixed(0);
        throw new Error(
          `Configuration exceeds maximum export size of ${maxMB} MB (actual: ${sizeMB} MB)`
        );
      }

      exportLogger.info('Export completed successfully', {
        format: options.format,
        filename: result.filename,
        sizeBytes,
      });

      return result;
    } catch (error) {
      exportLogger.error('Export failed', {
        format: options.format,
        configName: config.name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Generate JSON export with metadata
   * 
   * The export uses UTF-8 encoding to ensure proper handling of Unicode characters
   * across all platforms. JSON.stringify in Node.js produces UTF-8 encoded strings
   * by default, which are then properly handled by Buffer operations.
   * 
   * @param config - Report configuration to export
   * @param includeMetadata - Whether to include export metadata
   * @returns Export result with JSON data
   * @private
   */
  private generateJSONExport(
    config: ReportConfig,
    includeMetadata: boolean
  ): ExportResult {
    // Build the exported configuration structure
    const exportedConfig: ExportedConfiguration = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportMetadata: includeMetadata ? this.buildMetadata() : this.buildMinimalMetadata(),
      connectionMetadata: this.buildConnectionMetadata(),
      securityNotice: this.buildSecurityNotice(),
      reportConfig: this.convertToExportedConfig(config),
    };

    // Normalize paths to forward slashes for cross-platform compatibility
    const normalizedConfig = this.normalizePathsInExport(exportedConfig);

    // Serialize to JSON with proper indentation for human readability
    const jsonString = JSON.stringify(normalizedConfig, null, 2);

    // Generate descriptive filename
    const filename = this.generateFilename(config, 'json');

    return {
      filename,
      contentType: 'application/json',
      data: jsonString,
    };
  }

  /**
   * Generate Power BI connection file (M Query)
   * 
   * Creates a Power Query (M Query) file that can be imported into Power BI Desktop.
   * The query connects directly to AVEVA Historian database and retrieves time-series data
   * for the selected tags and time range.
   * 
   * @param config - Report configuration to export
   * @returns Export result with Power BI M Query data
   * @private
   */
  private generatePowerBIExport(config: ReportConfig): ExportResult {
    // Extract configuration parameters
    const queryParams = this.buildPowerBIQueryParams(config);

    // Generate M Query template
    const mQuery = this.generateMQueryTemplate(queryParams);

    // Generate filename
    const filename = this.generateFilename(config, 'powerbi');

    return {
      filename,
      contentType: 'text/plain',
      data: mQuery,
    };
  }

  /**
   * Build Power BI query parameters from report configuration
   * 
   * @param config - Report configuration
   * @returns Power BI query parameters
   * @private
   */
  private buildPowerBIQueryParams(config: ReportConfig): PowerBIQueryParams {
    // Extract time range
    const startTime = config.timeRange.startTime instanceof Date
      ? config.timeRange.startTime
      : new Date(config.timeRange.startTime);
    const endTime = config.timeRange.endTime instanceof Date
      ? config.timeRange.endTime
      : new Date(config.timeRange.endTime);

    return {
      server: env.DB_HOST,
      database: env.DB_NAME,
      tags: config.tags,
      startTime,
      endTime,
      qualityFilter: 192, // Good quality only (standard AVEVA Historian quality code)
    };
  }

  /**
   * Generate M Query template for Power BI
   * 
   * Creates a complete M Query that Power BI can execute to retrieve data from
   * AVEVA Historian. The query includes:
   * - Connection parameters (server, database)
   * - Tag selection criteria
   * - Time range filtering
   * - Quality code filtering
   * - Documentation comments
   * 
   * @param params - Query parameters
   * @returns M Query string
   * @private
   */
  private generateMQueryTemplate(params: PowerBIQueryParams): string {
    // Format dates for SQL query (YYYY-MM-DD HH:mm:ss)
    const startTimeStr = this.formatDateForSQL(params.startTime);
    const endTimeStr = this.formatDateForSQL(params.endTime);

    // Build tag list for SQL IN clause
    const tagList = params.tags.map(tag => `'${tag.replace(/'/g, "''")}'`).join(', ');

    // Generate M Query
    const mQuery = `/*
 * AVEVA Historian Data Query for Power BI
 * 
 * This Power Query (M Query) connects to AVEVA Historian database and retrieves
 * time-series data for analysis in Power BI.
 * 
 * CONFIGURATION INSTRUCTIONS:
 * 1. Open Power BI Desktop
 * 2. Go to Home -> Get Data -> Blank Query
 * 3. Open Advanced Editor (Home -> Advanced Editor)
 * 4. Replace EVERYTHING in the editor with this script
 * 5. Click Done
 * 6. When prompted, provide database credentials:
 *    - Authentication: Windows or Database
 *    - Username: Your AVEVA Historian database username
 *    - Password: Your database password
 * 
 * SECURITY NOTICE:
 * This query does NOT contain credentials. You must provide them when connecting.
 * Never share files containing credentials.
 * 
 * QUERY PARAMETERS:
 * - Server: ${params.server}
 * - Database: ${params.database}
 * - Tags: ${params.tags.length} tag(s) selected
 * - Time Range: ${startTimeStr} to ${endTimeStr}
 * - Quality Filter: ${params.qualityFilter} (Good quality only)
 */

let
    // ========================================================================
    // Configuration Parameters
    // ========================================================================
    
    // Database connection settings
    Server = "${params.server}",
    Database = "${params.database}",
    
    // Tag selection
    Tags = {${params.tags.map(tag => `"${tag.replace(/"/g, '""')}"`).join(', ')}},
    
    // Time range for data retrieval
    StartTime = #datetime(${params.startTime.getFullYear()}, ${params.startTime.getMonth() + 1}, ${params.startTime.getDate()}, ${params.startTime.getHours()}, ${params.startTime.getMinutes()}, ${params.startTime.getSeconds()}),
    EndTime = #datetime(${params.endTime.getFullYear()}, ${params.endTime.getMonth() + 1}, ${params.endTime.getDate()}, ${params.endTime.getHours()}, ${params.endTime.getMinutes()}, ${params.endTime.getSeconds()}),
    
    // Quality code filter (192 = Good quality in AVEVA Historian)
    QualityFilter = ${params.qualityFilter},
    
    // ========================================================================
    // Query Construction & Execution
    // ========================================================================
    
    // Build SQL query
    SqlQuery = "
        SELECT 
            t.TagName,
            h.DateTime,
            h.Value,
            h.QualityCode,
            CASE 
                WHEN h.QualityCode = 192 THEN 'Good'
                WHEN h.QualityCode = 0 THEN 'Bad'
                ELSE 'Uncertain'
            END as QualityStatus
        FROM History h
        INNER JOIN Tag t ON h.TagId = t.TagId
        WHERE t.TagName IN (" & Text.Combine(List.Transform(Tags, each "'" & Text.Replace(_, "'", "''") & "'"), ", ") & ")
          AND h.DateTime >= '${startTimeStr}'
          AND h.DateTime <= '${endTimeStr}'
          AND h.QualityCode = " & Number.ToText(QualityFilter) & "
        ORDER BY t.TagName, h.DateTime
    ",
    
    // Connect to database and execute query
    Source = Sql.Database(Server, Database, [Query=SqlQuery]),
    
    // Apply type conversions for proper data handling
    TypedData = Table.TransformColumnTypes(Source, {
        {"TagName", type text},
        {"DateTime", type datetime},
        {"Value", type number},
        {"QualityCode", Int64.Type},
        {"QualityStatus", type text}
    })
in
    TypedData`;

    return mQuery;
  }

  /**
   * Format date for SQL query (YYYY-MM-DD HH:mm:ss)
   * 
   * @param date - Date object
   * @returns Formatted date string
   * @private
   */
  private formatDateForSQL(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Build metadata object for export
   * 
   * @returns Export metadata with timestamp, user, version, platform, and encoding info
   * @private
   */
  private buildMetadata(): ExportMetadata {
    return {
      exportDate: new Date().toISOString(),
      exportedBy: process.env.USER || process.env.USERNAME || 'unknown',
      applicationVersion: appVersion,
      platform: process.platform,
      encoding: 'UTF-8',
    };
  }

  /**
   * Build minimal metadata for exports that don't need full metadata
   * 
   * @returns Minimal export metadata
   * @private
   */
  private buildMinimalMetadata(): ExportMetadata {
    return {
      exportDate: new Date().toISOString(),
      exportedBy: 'system',
      applicationVersion: appVersion,
      platform: process.platform,
      encoding: 'UTF-8',
    };
  }

  /**
   * Build connection metadata (without credentials)
   * Includes server addresses and database names for reference,
   * but excludes all authentication credentials for security.
   * 
   * @returns Connection metadata without sensitive credentials
   * @private
   */
  private buildConnectionMetadata(): ConnectionMetadata {
    return {
      databaseServer: env.DB_HOST,
      databaseName: env.DB_NAME,
      smtpServer: env.SMTP_HOST,
      smtpPort: env.SMTP_PORT,
    };
  }

  /**
   * Build security notice for exported files
   * Warns users that credentials are not included and must be configured separately.
   * 
   * @returns Security notice with instructions
   * @private
   */
  private buildSecurityNotice(): SecurityNotice {
    return {
      message: 'SECURITY NOTICE: This exported configuration does NOT contain sensitive credentials (database passwords, SMTP passwords, or user credentials). You must configure these separately in your application environment.',
      instructions: [
        'Database credentials (DB_USER, DB_PASSWORD) must be configured in your environment variables or .env file',
        'SMTP credentials (SMTP_USER, SMTP_PASSWORD) must be configured in your environment variables or .env file',
        'Connection metadata (server addresses, database names) is included for reference only',
        'When importing this configuration, the application will use its current database and SMTP connection settings',
        'Never share files containing credentials. This export is safe to share as it contains no sensitive information',
      ],
    };
  }

  /**
   * Convert ReportConfig to ExportedReportConfig
   * Transforms internal config structure to export-friendly format
   * Filters out sensitive credentials
   * 
   * @param config - Internal report configuration
   * @returns Export-friendly configuration structure
   * @private
   */
  private convertToExportedConfig(config: ReportConfig): ExportedReportConfig {
    // Extract time range
    const timeRange = config.timeRange;
    const startTime = timeRange.startTime instanceof Date
      ? timeRange.startTime.toISOString()
      : new Date(timeRange.startTime).toISOString();
    const endTime = timeRange.endTime instanceof Date
      ? timeRange.endTime.toISOString()
      : new Date(timeRange.endTime).toISOString();

    // Calculate duration
    const duration = new Date(endTime).getTime() - new Date(startTime).getTime();

    // Determine sampling configuration
    const samplingMode = this.determineSamplingMode(config);
    const samplingInterval = this.determineSamplingInterval(config);

    // Build analytics configuration
    const analytics = {
      enabled: config.includeSPCCharts || config.includeTrendLines || config.includeStatsSummary || false,
      showTrendLine: config.includeTrendLines || false,
      showSPCMetrics: config.includeSPCCharts || false,
      showStatistics: config.includeStatsSummary ?? true,
    };

    // Build specification limits (if any)
    const specificationLimits = this.extractSpecificationLimits(config);

    // Build exported config
    const exportedConfig: ExportedReportConfig = {
      tags: config.tags,
      timeRange: {
        startTime,
        endTime,
        duration,
      },
      sampling: {
        mode: samplingMode,
        ...(samplingInterval !== undefined && { interval: samplingInterval }),
      },
      analytics,
      reportName: config.name,
      ...(config.description && { description: config.description }),
    };

    // Add optional fields
    if (specificationLimits) {
      exportedConfig.specificationLimits = specificationLimits;
    }

    // Add custom settings (extensible for future use)
    if (config.metadata || config.branding) {
      exportedConfig.customSettings = {
        metadata: config.metadata,
        branding: config.branding,
        template: config.template,
        chartTypes: config.chartTypes,
      };
    }

    return exportedConfig;
  }

  /**
   * Determine sampling mode from config
   * 
   * @param config - Report configuration
   * @returns Sampling mode
   * @private
   */
  private determineSamplingMode(config: ReportConfig): 'Cyclic' | 'Delta' | 'BestFit' {
    // Check if retrievalMode is explicitly set in config
    if (config.retrievalMode === 'Cyclic' || config.retrievalMode === 'Delta') {
      return config.retrievalMode as 'Cyclic' | 'Delta';
    }

    // Check if filters contain sampling mode information (legacy support)
    if (config.filters && config.filters.length > 0) {
      const samplingFilter = config.filters.find(f => 'samplingMode' in f);
      if (samplingFilter && 'samplingMode' in samplingFilter) {
        const mode = (samplingFilter as any).samplingMode;
        if (mode === 'Cyclic' || mode === 'Delta' || mode === 'BestFit') {
          return mode;
        }
      }
    }
    // Default to Cyclic if not specified
    return 'Cyclic';
  }

  /**
   * Determine sampling interval from config
   * 
   * @param config - Report configuration
   * @returns Sampling interval in seconds (if applicable)
   * @private
   */
  private determineSamplingInterval(config: ReportConfig): number | undefined {
    // Check if filters contain sampling interval information
    if (config.filters && config.filters.length > 0) {
      const samplingFilter = config.filters.find(f => 'samplingInterval' in f);
      if (samplingFilter && 'samplingInterval' in samplingFilter) {
        return samplingFilter.samplingInterval as number;
      }
    }
    // Return undefined if not specified (will use default for Cyclic mode)
    return undefined;
  }

  /**
   * Extract specification limits from config
   * 
   * @param config - Report configuration
   * @returns Specification limits or undefined
   * @private
   */
  private extractSpecificationLimits(
    config: ReportConfig
  ): ExportedReportConfig['specificationLimits'] | undefined {
    if (!config.specificationLimits || Object.keys(config.specificationLimits).length === 0) {
      return undefined;
    }

    // For simplicity, export the first tag's spec limits
    // In a multi-tag scenario, we might need a different approach
    const firstTag = config.tags[0];
    if (!firstTag) {
      return undefined;
    }

    const limits = config.specificationLimits[firstTag];

    if (!limits) {
      return undefined;
    }

    const result: ExportedReportConfig['specificationLimits'] = {
      enabled: true,
    };

    if (limits.usl !== undefined) {
      result.upperLimit = limits.usl;
    }
    if (limits.lsl !== undefined) {
      result.lowerLimit = limits.lsl;
    }

    return result;
  }

  /**
   * Generate descriptive filename for export
   * 
   * Pattern: ReportConfig_{TagNames}_{Timestamp}.{extension}
   * - Single tag: ReportConfig_Temperature_20240115_143022.json
   * - Multiple tags: ReportConfig_Temp_Press_Flow_20240115_143022.json
   * - Many tags: ReportConfig_5Tags_20240115_143022.json
   * 
   * @param config - Report configuration
   * @param format - Export format (determines file extension)
   * @returns Generated filename
   * @private
   */
  private generateFilename(config: ReportConfig, format: string): string {
    // Generate timestamp in format YYYYMMDD_HHMMSS
    const now = new Date();
    const timestamp = now
      .toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '_')
      .substring(0, 15); // YYYYMMDD_HHMMSS

    // Generate tag names portion
    let tagsPortion: string;
    if (config.tags.length === 1) {
      // Single tag: use the tag name (sanitized)
      tagsPortion = this.sanitizeForFilename(config.tags[0] || 'unnamed');
    } else if (config.tags.length <= 3) {
      // Multiple tags (up to 3): use abbreviated tag names
      tagsPortion = config.tags
        .map(tag => this.abbreviateTagName(tag))
        .join('_');
    } else {
      // Many tags: use count
      tagsPortion = `${config.tags.length}Tags`;
    }

    // Determine file extension
    const extension = format === 'json' ? 'json' : 'm';

    // Determine prefix
    const prefix = format === 'powerbi' ? 'PowerBI' : 'ReportConfig';

    // Construct filename
    return `${prefix}_${tagsPortion}_${timestamp}.${extension}`;
  }

  /**
   * Sanitize string for use in filename
   * Removes or replaces characters that are invalid in filenames
   * 
   * @param str - String to sanitize
   * @returns Sanitized string
   * @private
   */
  private sanitizeForFilename(str: string): string {
    // Handle empty or undefined strings
    if (!str) {
      return 'unnamed';
    }

    return str
      .replace(/[^a-zA-Z0-9_\-\.]/g, '_') // Replace invalid chars with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .substring(0, 50); // Limit length
  }

  /**
   * Normalize paths in exported configuration to use forward slashes.
   * This ensures cross-platform compatibility when configurations are shared
   * between Windows, macOS, and Linux systems.
   * 
   * @param config - Exported configuration
   * @returns Configuration with normalized paths
   * @private
   */
  private normalizePathsInExport(config: ExportedConfiguration): ExportedConfiguration {
    // Create a deep copy to avoid modifying the original
    const normalized = JSON.parse(JSON.stringify(config));

    // Normalize any path fields in customSettings
    if (normalized.reportConfig.customSettings) {
      const customSettings = normalized.reportConfig.customSettings;

      // Check for common path fields in custom settings
      const pathFields = ['outputPath', 'templatePath', 'dataPath', 'reportPath'];

      for (const field of pathFields) {
        if (customSettings[field] && typeof customSettings[field] === 'string') {
          customSettings[field] = normalizePathsInObject(
            { path: customSettings[field] },
            ['path']
          ).path;
        }
      }

      // Handle nested objects that might contain paths
      if (customSettings.paths && typeof customSettings.paths === 'object') {
        const pathKeys = Object.keys(customSettings.paths);
        customSettings.paths = normalizePathsInObject(
          customSettings.paths,
          pathKeys as any
        );
      }
    }

    return normalized;
  }

  /**
   * Abbreviate tag name for filename
   * Takes first 4-6 characters or first word
   * 
   * @param tagName - Tag name to abbreviate
   * @returns Abbreviated tag name
   * @private
   */
  private abbreviateTagName(tagName: string): string {
    // If tag has dots or underscores, take the last segment
    const segments = tagName.split(/[._]/);
    const lastSegment = segments[segments.length - 1];

    // Handle case where lastSegment might be undefined or empty
    if (!lastSegment) {
      return this.sanitizeForFilename(tagName.substring(0, 6));
    }

    // Take first 6 characters of the last segment
    const abbreviated = lastSegment.substring(0, 6);

    return this.sanitizeForFilename(abbreviated);
  }
}

// Export singleton instance
export const configExportService = new ConfigExportService();
