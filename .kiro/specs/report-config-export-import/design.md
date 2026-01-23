# Design Document: Report Configuration Export/Import

## Overview

This design document describes the implementation of export and import functionality for report configurations in the Historian Reports application. The feature enables users to save complete report configurations to disk in multiple formats (JSON and Power BI-compatible) and reload them later, facilitating configuration portability, backup, and integration with external business intelligence tools.

The implementation follows a service-oriented architecture pattern consistent with the existing codebase, adding new services for export/import operations while integrating with existing report configuration components.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ReportConfiguration Component                         │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │ │
│  │  │ Export Button│  │ Import Button│  │Format Dialog│ │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │ │
│  └─────────┼──────────────────┼─────────────────┼────────┘ │
│            │                  │                 │          │
└────────────┼──────────────────┼─────────────────┼──────────┘
             │                  │                 │
             │   HTTP API       │                 │
             ▼                  ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express Backend                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  /api/reports/export & /api/reports/import Routes     │ │
│  └────────────┬───────────────────────┬───────────────────┘ │
│               │                       │                     │
│  ┌────────────▼──────────┐  ┌────────▼──────────────────┐ │
│  │ ConfigExportService   │  │ ConfigImportService       │ │
│  │ ┌──────────────────┐  │  │ ┌──────────────────────┐ │ │
│  │ │ JSON Serializer  │  │  │ │ JSON Parser          │ │ │
│  │ │ PowerBI Generator│  │  │ │ Schema Validator     │ │ │
│  │ │ Metadata Builder │  │  │ │ Field Mapper         │ │ │
│  │ └──────────────────┘  │  │ └──────────────────────┘ │ │
│  └───────────────────────┘  └───────────────────────────┘ │
│               │                       │                     │
│  ┌────────────▼───────────────────────▼───────────────────┐ │
│  │         ReportConfigurationModel                       │ │
│  │  (Existing data structure for report configs)          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

**Export Flow:**
1. User clicks Export button in ReportConfiguration component
2. Frontend displays format selection dialog (JSON or Power BI)
3. User selects format and confirms
4. Frontend sends POST request to `/api/reports/export` with current configuration and format
5. Backend ConfigExportService serializes configuration to selected format
6. Backend returns file data with appropriate content-type header
7. Frontend triggers browser download with generated filename

**Import Flow:**
1. User clicks Import button in ReportConfiguration component
2. Frontend displays file browser dialog
3. User selects JSON file
4. Frontend reads file content and sends POST request to `/api/reports/import` with file data
5. Backend ConfigImportService validates and parses file
6. Backend returns validated configuration object or error details
7. Frontend populates form fields with imported configuration
8. User reviews and can modify before generating report

## Components and Interfaces

### Frontend Components

#### ExportImportControls Component

New component to be added to the ReportConfiguration header section.

```typescript
interface ExportImportControlsProps {
  currentConfig: ReportConfiguration;
  onImportComplete: (config: ReportConfiguration) => void;
  disabled?: boolean;
}

const ExportImportControls: React.FC<ExportImportControlsProps> = ({
  currentConfig,
  onImportComplete,
  disabled = false
}) => {
  // Component implementation
};
```

**Responsibilities:**
- Render Export and Import buttons with appropriate icons
- Handle export format selection dialog
- Manage file browser for import
- Display loading states during operations
- Show success/error notifications

#### FormatSelectionDialog Component

Modal dialog for selecting export format.

```typescript
interface FormatSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFormat: (format: 'json' | 'powerbi') => void;
}

const FormatSelectionDialog: React.FC<FormatSelectionDialogProps> = ({
  isOpen,
  onClose,
  onSelectFormat
}) => {
  // Component implementation
};
```

**Format Options:**
- **JSON**: "Friendly format for backup and sharing. Can be re-imported into this application."
- **Power BI**: "Connection file for Microsoft Power BI. Enables independent data analysis."

### Backend Services

#### ConfigExportService

Service responsible for serializing report configurations to various formats.

```typescript
interface ExportOptions {
  format: 'json' | 'powerbi';
  includeMetadata?: boolean;
}

interface ExportResult {
  filename: string;
  contentType: string;
  data: Buffer | string;
}

class ConfigExportService {
  /**
   * Export report configuration to specified format
   */
  async exportConfiguration(
    config: ReportConfiguration,
    options: ExportOptions
  ): Promise<ExportResult>;

  /**
   * Generate JSON export with metadata
   */
  private generateJSONExport(
    config: ReportConfiguration
  ): ExportResult;

  /**
   * Generate Power BI connection file
   */
  private generatePowerBIExport(
    config: ReportConfiguration
  ): ExportResult;

  /**
   * Build metadata object for export
   */
  private buildMetadata(): ExportMetadata;

  /**
   * Generate descriptive filename
   */
  private generateFilename(
    config: ReportConfiguration,
    format: string
  ): string;
}
```

#### ConfigImportService

Service responsible for parsing and validating imported configuration files.

```typescript
interface ImportResult {
  success: boolean;
  config?: ReportConfiguration;
  errors?: ValidationError[];
  warnings?: string[];
}

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

class ConfigImportService {
  /**
   * Import and validate configuration from JSON
   */
  async importConfiguration(
    fileContent: string
  ): Promise<ImportResult>;

  /**
   * Validate JSON structure and schema version
   */
  private validateSchema(
    data: any
  ): ValidationError[];

  /**
   * Validate individual field values
   */
  private validateFields(
    config: any
  ): ValidationError[];

  /**
   * Check if tags exist in AVEVA Historian
   */
  private async validateTags(
    tagNames: string[]
  ): Promise<ValidationError[]>;

  /**
   * Map imported data to ReportConfiguration object
   */
  private mapToConfiguration(
    data: any
  ): ReportConfiguration;

  /**
   * Apply default values for missing optional fields
   */
  private applyDefaults(
    config: Partial<ReportConfiguration>
  ): ReportConfiguration;
}
```

### API Routes

#### Export Endpoint

```typescript
// POST /api/reports/export
router.post('/export', authMiddleware, async (req, res) => {
  const { config, format } = req.body;
  
  // Validate request
  // Call ConfigExportService
  // Return file with appropriate headers
});
```

**Request Body:**
```typescript
{
  config: ReportConfiguration;
  format: 'json' | 'powerbi';
}
```

**Response:**
- Content-Type: `application/json` or `application/x-powerbi`
- Content-Disposition: `attachment; filename="..."`
- Body: File content

#### Import Endpoint

```typescript
// POST /api/reports/import
router.post('/import', authMiddleware, async (req, res) => {
  const { fileContent } = req.body;
  
  // Call ConfigImportService
  // Return validation result and config
});
```

**Request Body:**
```typescript
{
  fileContent: string; // JSON string
}
```

**Response:**
```typescript
{
  success: boolean;
  config?: ReportConfiguration;
  errors?: ValidationError[];
  warnings?: string[];
}
```

## Data Models

### JSON Export Schema (Version 1.0)

```typescript
interface ExportedConfiguration {
  // Schema metadata
  schemaVersion: string; // "1.0"
  exportMetadata: ExportMetadata;
  
  // Report configuration
  reportConfig: {
    // Tag selection
    tags: string[]; // Tag names
    
    // Time range
    timeRange: {
      startTime: string; // ISO 8601 format
      endTime: string;   // ISO 8601 format
      duration?: number; // Milliseconds
    };
    
    // Sampling configuration
    sampling: {
      mode: 'Cyclic' | 'Delta' | 'BestFit';
      interval?: number; // For Cyclic mode (seconds)
    };
    
    // Analytics options
    analytics: {
      enabled: boolean;
      showTrendLine: boolean;
      showSPCMetrics: boolean;
      showStatistics: boolean;
    };
    
    // Specification limits (if configured)
    specificationLimits?: {
      enabled: boolean;
      upperLimit?: number;
      lowerLimit?: number;
      target?: number;
    };
    
    // Report metadata
    reportName?: string;
    description?: string;
    
    // Custom settings
    customSettings?: Record<string, any>;
  };
}

interface ExportMetadata {
  exportDate: string;        // ISO 8601 timestamp
  exportedBy: string;        // User identifier
  applicationVersion: string; // e.g., "1.0.0"
  platform: string;          // e.g., "linux", "win32", "darwin"
}
```

### Power BI Connection File Structure

Power BI connection files will use the M Query language format:

```m
let
    // Connection parameters
    Server = "historian-server.company.com",
    Database = "Runtime",
    
    // Query for tag data
    TagQuery = "
        SELECT 
            t.TagName,
            h.DateTime,
            h.Value,
            h.QualityCode
        FROM History h
        INNER JOIN Tag t ON h.TagId = t.TagId
        WHERE t.TagName IN ('Tag1', 'Tag2', 'Tag3')
          AND h.DateTime >= '2024-01-01T00:00:00'
          AND h.DateTime <= '2024-01-02T00:00:00'
          AND h.QualityCode = 192
        ORDER BY h.DateTime
    ",
    
    // Execute query
    Source = Sql.Database(Server, Database, [Query=TagQuery])
in
    Source
```

### ReportConfiguration Type Extension

Extend existing ReportConfiguration type to support export/import metadata:

```typescript
interface ReportConfiguration {
  // Existing fields...
  
  // New optional fields for import tracking
  importMetadata?: {
    importedFrom?: string;     // Original filename
    importDate?: Date;
    originalExportDate?: Date;
    schemaVersion?: string;
  };
}
```

### Validation Rules

#### Required Fields
- `schemaVersion`: Must be present and supported
- `reportConfig.tags`: Must be non-empty array
- `reportConfig.timeRange.startTime`: Must be valid ISO 8601 date
- `reportConfig.timeRange.endTime`: Must be valid ISO 8601 date
- `reportConfig.sampling.mode`: Must be one of allowed values

#### Optional Fields with Defaults
- `analytics.enabled`: Default `false`
- `analytics.showTrendLine`: Default `false`
- `analytics.showSPCMetrics`: Default `false`
- `analytics.showStatistics`: Default `true`
- `sampling.interval`: Default `60` (for Cyclic mode)

#### Field Validation Rules
- `timeRange.startTime` must be before `timeRange.endTime`
- `timeRange.endTime` must not be in the future
- `sampling.interval` must be positive integer
- `specificationLimits.upperLimit` must be greater than `lowerLimit` (if both present)
- Tag names must match pattern: `^[A-Za-z0-9_\\.\\-]+$`

### Error Handling

#### Validation Error Types

```typescript
enum ValidationErrorCode {
  INVALID_JSON = 'INVALID_JSON',
  SCHEMA_VERSION_MISMATCH = 'SCHEMA_VERSION_MISMATCH',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_VALUE = 'INVALID_FIELD_VALUE',
  TAG_NOT_FOUND = 'TAG_NOT_FOUND',
  INVALID_TIME_RANGE = 'INVALID_TIME_RANGE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT'
}

interface ValidationError {
  code: ValidationErrorCode;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
  details?: any;
}
```

#### Error Messages

User-friendly error messages for common validation failures:

- **INVALID_JSON**: "The selected file is not a valid JSON file. Please check the file format."
- **SCHEMA_VERSION_MISMATCH**: "This configuration was exported from a different version (v{version}). Current version: v{currentVersion}."
- **MISSING_REQUIRED_FIELD**: "Required field '{field}' is missing from the configuration."
- **INVALID_FIELD_VALUE**: "Field '{field}' has an invalid value: {details}"
- **TAG_NOT_FOUND**: "Tag '{tagName}' does not exist in the database. The configuration will load, but this tag will not return data."
- **INVALID_TIME_RANGE**: "Start time must be before end time."
- **FILE_TOO_LARGE**: "File size exceeds maximum allowed size of 10 MB."

### Power BI Integration Details

#### Connection String Format

For Power BI, we'll generate an M Query file (.pq) that users can import into Power BI Desktop:

```m
let
    // Configuration
    Config = [
        Server = "historian-server.company.com",
        Database = "Runtime",
        Tags = {"Tag1", "Tag2", "Tag3"},
        StartTime = #datetime(2024, 1, 1, 0, 0, 0),
        EndTime = #datetime(2024, 1, 2, 0, 0, 0),
        QualityFilter = 192  // Good quality only
    ],
    
    // Build tag list for SQL IN clause
    TagList = Text.Combine(
        List.Transform(Config[Tags], each "'" & _ & "'"),
        ", "
    ),
    
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
        WHERE t.TagName IN (" & TagList & ")
          AND h.DateTime >= '" & DateTime.ToText(Config[StartTime], "yyyy-MM-dd HH:mm:ss") & "'
          AND h.DateTime <= '" & DateTime.ToText(Config[EndTime], "yyyy-MM-dd HH:mm:ss") & "'
          AND h.QualityCode = " & Number.ToText(Config[QualityFilter]) & "
        ORDER BY t.TagName, h.DateTime
    ",
    
    // Execute query
    Source = Sql.Database(Config[Server], Config[Database], [Query=SqlQuery]),
    
    // Type conversions
    TypedData = Table.TransformColumnTypes(Source, {
        {"TagName", type text},
        {"DateTime", type datetime},
        {"Value", type number},
        {"QualityCode", type number},
        {"QualityStatus", type text}
    })
in
    TypedData
```

#### Power BI File Format

The exported file will be a `.pq` (Power Query) file that can be imported into Power BI Desktop via:
1. Get Data → Blank Query
2. Advanced Editor
3. Paste the M Query code
4. Configure connection credentials

Alternatively, we could generate a `.pbix` template file, but this requires more complex binary file generation. The `.pq` approach is simpler and more transparent.

### Security Considerations

#### Credential Handling

**JSON Export:**
- Database credentials are NOT included
- SMTP credentials are NOT included
- Connection metadata (server, database name) IS included
- Security notice added to file header

**Power BI Export:**
- Connection string includes server and database name
- Authentication is set to "Windows" or "Database" (user must provide credentials)
- No passwords or tokens included in file
- Documentation includes instructions for configuring credentials

#### File Content Sanitization

Before export:
1. Remove any authentication tokens
2. Remove user passwords
3. Remove API keys
4. Sanitize file paths to use relative paths only
5. Remove any PII (Personally Identifiable Information) from metadata

### File Naming Conventions

#### JSON Export Filename Pattern

```
ReportConfig_{TagNames}_{Timestamp}.json
```

Examples:
- Single tag: `ReportConfig_Temperature_20240115_143022.json`
- Multiple tags: `ReportConfig_Temp_Press_Flow_20240115_143022.json`
- Many tags: `ReportConfig_5Tags_20240115_143022.json` (when >3 tags)

#### Power BI Export Filename Pattern

```
PowerBI_{TagNames}_{Timestamp}.pq
```

Examples:
- `PowerBI_Temperature_20240115_143022.pq`
- `PowerBI_Temp_Press_Flow_20240115_143022.pq`

### Frontend State Management

#### Export State

```typescript
interface ExportState {
  isExporting: boolean;
  selectedFormat: 'json' | 'powerbi' | null;
  showFormatDialog: boolean;
  error: string | null;
}
```

#### Import State

```typescript
interface ImportState {
  isImporting: boolean;
  selectedFile: File | null;
  validationResult: ImportResult | null;
  showValidationDialog: boolean;
  error: string | null;
}
```

### User Experience Flow

#### Export Flow (Detailed)

1. User clicks "Export" button
2. Format selection dialog appears with two options
3. User selects format (JSON or Power BI)
4. Loading indicator appears
5. Backend processes export
6. Browser triggers file download
7. Success notification appears: "Configuration exported successfully"
8. Dialog closes automatically

#### Import Flow (Detailed)

1. User clicks "Import" button
2. File browser dialog appears (filtered to .json files)
3. User selects file
4. Loading indicator appears
5. Backend validates file
6. If validation succeeds:
   - Configuration loads into form
   - Success notification: "Configuration imported successfully"
   - Form fields populate with imported values
   - User can review and modify
7. If validation fails:
   - Error dialog appears with specific issues
   - User can fix file and try again
   - Current configuration remains unchanged

### Performance Optimization

#### Export Performance

- Serialize configuration synchronously (fast operation)
- Use streaming for large files (if needed in future)
- Cache last export format preference in localStorage
- Debounce export button clicks (prevent double-clicks)

#### Import Performance

- Parse JSON asynchronously to avoid blocking UI
- Validate in chunks for large files
- Show progress indicator for validation steps
- Use Web Workers for heavy validation (future enhancement)

### Backward Compatibility Strategy

#### Schema Versioning

The JSON schema uses semantic versioning:
- **Major version**: Breaking changes (incompatible structure)
- **Minor version**: New optional fields (backward compatible)
- **Patch version**: Bug fixes, clarifications

Current version: `1.0.0`

#### Version Migration

When importing older schema versions:

```typescript
class SchemaVersionMigrator {
  /**
   * Migrate configuration from old schema to current
   */
  migrate(data: any, fromVersion: string): any {
    const migrations = this.getMigrationPath(fromVersion, CURRENT_VERSION);
    
    let migratedData = data;
    for (const migration of migrations) {
      migratedData = migration(migratedData);
    }
    
    return migratedData;
  }
  
  /**
   * Get list of migrations needed
   */
  private getMigrationPath(from: string, to: string): Migration[] {
    // Return ordered list of migration functions
  }
}
```

Example migration (1.0 → 1.1):
```typescript
function migrate_1_0_to_1_1(data: any): any {
  return {
    ...data,
    schemaVersion: '1.1',
    reportConfig: {
      ...data.reportConfig,
      // Add new optional field with default
      customSettings: data.reportConfig.customSettings || {}
    }
  };
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified the following redundancies and consolidations:

**Redundancies Eliminated:**
- Requirement 1.2 is redundant with 1.1 (both verify all fields are present in JSON export)
- Requirements 2.2, 2.4, and 2.5 can be consolidated into a single comprehensive property about Power BI export completeness
- Requirements 6.1 and 6.2 can be consolidated into a single property about credential exclusion
- Requirements 8.3 and 8.4 can be consolidated into a single round-trip property about UTF-8 encoding
- Requirements 8.5 and 8.6 can be consolidated into a single property about path normalization

**Properties Combined:**
- Power BI export field validation (2.2, 2.4, 2.5) → Single property verifying all required fields
- Security credential exclusion (6.1, 6.2) → Single property verifying no credentials in exports
- UTF-8 encoding (8.3, 8.4) → Single round-trip property
- Path normalization (8.5, 8.6, 8.1, 8.2) → Single property about platform-independent paths

### Export Properties

**Property 1: JSON Export Completeness**
*For any* valid report configuration, exporting to JSON format should produce a JSON object containing all configuration fields (tags, time ranges, analytics options, specification limits, sampling mode, custom settings) and all metadata fields (export timestamp, schema version, application version, user identifier).
**Validates: Requirements 1.1, 1.3**

**Property 2: JSON Export Filename Pattern**
*For any* report configuration, the generated JSON export filename should match the pattern "ReportConfig_{TagNames}_{Timestamp}.json" where TagNames is derived from the selected tags and Timestamp is in the format YYYYMMDD_HHMMSS.
**Validates: Requirements 1.4**

**Property 3: JSON Export Formatting**
*For any* report configuration, the exported JSON should be properly indented with newlines and spaces, making it human-readable (not minified).
**Validates: Requirements 1.5**

**Property 4: JSON Export Schema Versioning**
*For any* report configuration, the exported JSON should contain a schemaVersion field with a valid semantic version string.
**Validates: Requirements 1.7**

**Property 5: Power BI Export Completeness**
*For any* report configuration, exporting to Power BI format should produce an M Query file containing connection parameters (server address, database name, authentication method), tag selection criteria in the WHERE clause, and time range parameters in the query.
**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

**Property 6: Power BI Export Format Compliance**
*For any* report configuration, the exported Power BI file should be valid M Query syntax that can be parsed without errors.
**Validates: Requirements 2.7**

**Property 7: Power BI SQL Query Consistency**
*For any* report configuration, the SQL query generated in the Power BI export should match the structure and filtering logic of the application's internal queries, including quality code filtering.
**Validates: Requirements 10.2, 10.3**

**Property 8: Power BI Export Documentation**
*For any* report configuration, the exported Power BI file should include documentation comments explaining query parameters and data structure, plus sample queries.
**Validates: Requirements 10.4, 10.5**

### Import Properties

**Property 9: JSON Import Round-Trip**
*For any* valid report configuration, exporting to JSON then importing should produce an equivalent configuration with all fields preserved.
**Validates: Requirements 3.5**

**Property 10: JSON Parsing**
*For any* valid JSON string conforming to the export schema, the Import_Service should successfully parse it without errors.
**Validates: Requirements 3.2**

**Property 11: Schema Validation**
*For any* JSON object, the Validation_Engine should correctly identify whether it matches the expected JSON schema structure, rejecting invalid structures with appropriate error messages.
**Validates: Requirements 3.3**

**Property 12: Schema Version Compatibility**
*For any* JSON export with a schema version, the Validation_Engine should correctly determine if that version is compatible with the current application version.
**Validates: Requirements 3.4**

**Property 13: Validation Error Reporting**
*For any* invalid configuration JSON, the Validation_Engine should return error messages that identify all invalid or missing fields with specific reasons.
**Validates: Requirements 3.7, 5.3, 5.4**

**Property 14: Optional Field Defaults**
*For any* valid configuration JSON with missing optional fields, the Import_Service should apply appropriate default values for those fields.
**Validates: Requirements 3.8**

**Property 15: Required Field Validation**
*For any* configuration JSON missing required fields, the Import_Service should reject the import and return error messages listing all missing required fields.
**Validates: Requirements 3.9, 5.3**

**Property 16: Tag Validation Warnings**
*For any* configuration JSON containing tag names that don't exist in AVEVA Historian, the Import_Service should issue warnings but still allow the import to proceed.
**Validates: Requirements 5.5**

**Property 17: Validation Error Logging**
*For any* import operation that encounters validation errors, those errors should be logged to the application log system.
**Validates: Requirements 5.6**

**Property 18: State Preservation on Failure**
*For any* import operation that fails validation, the current report configuration should remain unchanged.
**Validates: Requirements 5.7**

### Format Selection Properties

**Property 19: Format Selection Affects Output**
*For any* report configuration, selecting JSON format should produce JSON output, and selecting Power BI format should produce M Query output.
**Validates: Requirements 4.3**

**Property 20: Format Preference Persistence**
*For any* user session, the last selected export format should be saved and restored as the default for future exports.
**Validates: Requirements 4.5**

### Security Properties

**Property 21: Credential Exclusion**
*For any* report configuration, exported JSON files should not contain database passwords or SMTP credentials.
**Validates: Requirements 6.1, 6.2**

**Property 22: Connection Metadata Inclusion**
*For any* report configuration, exported files should include connection metadata (server address, database name) but not authentication credentials.
**Validates: Requirements 6.3**

**Property 23: Import Connection Isolation**
*For any* import operation, the application's current database connection settings should remain unchanged after import.
**Validates: Requirements 6.4**

**Property 24: Security Notice Inclusion**
*For any* exported configuration, the file should include a security notice indicating that credentials must be configured separately.
**Validates: Requirements 6.5**

### File Size Properties

**Property 25: Export File Size Limit**
*For any* report configuration, if the exported JSON would exceed 5 MB, the Export_Service should reject the export and return an error message.
**Validates: Requirements 7.3, 7.4**

**Property 26: Import File Size Limit**
*For any* import operation, files larger than 10 MB should be rejected with an appropriate error message.
**Validates: Requirements 7.5**

### Cross-Platform Properties

**Property 27: Platform-Independent Path Representation**
*For any* report configuration containing file paths, exported JSON should use forward slashes (/) as path separators and platform-independent representations.
**Validates: Requirements 8.1, 8.5**

**Property 28: Path Normalization on Import**
*For any* imported configuration containing file paths with platform-specific separators, the Import_Service should normalize them to the current platform's format.
**Validates: Requirements 8.2, 8.6**

**Property 29: UTF-8 Encoding Round-Trip**
*For any* report configuration containing Unicode characters, exporting then importing should preserve all characters correctly through UTF-8 encoding.
**Validates: Requirements 8.3, 8.4**

## Error Handling

### Export Error Scenarios

1. **Configuration Too Large**
   - Trigger: Configuration serializes to >5 MB
   - Response: Return error with message "Configuration exceeds maximum export size of 5 MB"
   - HTTP Status: 413 Payload Too Large

2. **Invalid Configuration**
   - Trigger: Configuration object is missing required fields
   - Response: Return error listing missing fields
   - HTTP Status: 400 Bad Request

3. **Serialization Failure**
   - Trigger: JSON.stringify throws error
   - Response: Return error "Failed to serialize configuration"
   - HTTP Status: 500 Internal Server Error
   - Log: Full error details for debugging

4. **Power BI Generation Failure**
   - Trigger: M Query template generation fails
   - Response: Return error "Failed to generate Power BI connection file"
   - HTTP Status: 500 Internal Server Error
   - Log: Full error details

### Import Error Scenarios

1. **Invalid JSON Syntax**
   - Trigger: JSON.parse throws SyntaxError
   - Response: Return error "Invalid JSON file format"
   - HTTP Status: 400 Bad Request
   - User Action: Check file is valid JSON

2. **Schema Version Mismatch**
   - Trigger: schemaVersion is not supported
   - Response: Return warning with expected and actual versions
   - HTTP Status: 200 OK (with warnings)
   - Behavior: Attempt migration if possible

3. **Missing Required Fields**
   - Trigger: Required fields are undefined or null
   - Response: Return error listing all missing fields
   - HTTP Status: 400 Bad Request
   - User Action: Add missing fields to JSON

4. **Invalid Field Values**
   - Trigger: Field values fail validation rules
   - Response: Return error specifying invalid fields and reasons
   - HTTP Status: 400 Bad Request
   - User Action: Correct field values

5. **File Too Large**
   - Trigger: File size >10 MB
   - Response: Return error "File size exceeds maximum allowed size of 10 MB"
   - HTTP Status: 413 Payload Too Large
   - User Action: Reduce configuration complexity

6. **Tag Validation Warnings**
   - Trigger: Tags don't exist in database
   - Response: Return success with warnings listing non-existent tags
   - HTTP Status: 200 OK (with warnings)
   - Behavior: Import proceeds, user is warned

### Error Response Format

All error responses follow a consistent structure:

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;           // Machine-readable error code
    message: string;        // User-friendly error message
    details?: any;          // Additional error details
    field?: string;         // Field name (for validation errors)
    validationErrors?: ValidationError[];  // List of validation issues
  };
}
```

### Success Response Format

```typescript
interface SuccessResponse<T> {
  success: true;
  data: T;
  warnings?: string[];    // Optional warnings (e.g., non-existent tags)
  metadata?: {
    processingTime?: number;
    schemaVersion?: string;
  };
}
```

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests** focus on:
- Specific example configurations (single tag, multiple tags, all options enabled)
- Edge cases (empty configurations, maximum size configurations)
- Error conditions (invalid JSON, missing fields, oversized files)
- Integration points (API endpoints, file system operations)

**Property-Based Tests** focus on:
- Universal properties across all possible configurations
- Round-trip consistency (export → import → equivalence)
- Validation correctness across random inputs
- Format compliance across generated outputs

### Property-Based Testing Configuration

**Testing Library**: FastCheck (already used in the project)

**Test Configuration**:
- Minimum 100 iterations per property test
- Each test references its design document property
- Tag format: `Feature: report-config-export-import, Property {number}: {property_text}`

### Test Coverage Areas

#### Export Tests

**Unit Tests:**
- Export single-tag configuration to JSON
- Export multi-tag configuration to JSON
- Export configuration with all analytics options enabled
- Export configuration with specification limits
- Export to Power BI format
- Verify filename generation for various tag combinations
- Test file size limit enforcement
- Test credential exclusion

**Property Tests:**
- Property 1: JSON Export Completeness (100+ random configs)
- Property 2: JSON Export Filename Pattern (100+ random configs)
- Property 3: JSON Export Formatting (100+ random configs)
- Property 4: JSON Export Schema Versioning (100+ random configs)
- Property 5: Power BI Export Completeness (100+ random configs)
- Property 6: Power BI Export Format Compliance (100+ random configs)
- Property 21: Credential Exclusion (100+ random configs)
- Property 25: Export File Size Limit (100+ random configs)
- Property 27: Platform-Independent Path Representation (100+ random configs)

#### Import Tests

**Unit Tests:**
- Import valid JSON configuration
- Import configuration with missing optional fields
- Import configuration with invalid JSON syntax
- Import configuration with schema version mismatch
- Import configuration with missing required fields
- Import configuration with non-existent tags
- Test file size limit enforcement
- Test state preservation on validation failure

**Property Tests:**
- Property 9: JSON Import Round-Trip (100+ random configs)
- Property 10: JSON Parsing (100+ random JSON strings)
- Property 11: Schema Validation (100+ random objects)
- Property 12: Schema Version Compatibility (100+ version combinations)
- Property 13: Validation Error Reporting (100+ invalid configs)
- Property 14: Optional Field Defaults (100+ partial configs)
- Property 15: Required Field Validation (100+ incomplete configs)
- Property 18: State Preservation on Failure (100+ invalid imports)
- Property 26: Import File Size Limit (100+ file sizes)
- Property 28: Path Normalization on Import (100+ path formats)
- Property 29: UTF-8 Encoding Round-Trip (100+ Unicode strings)

#### Integration Tests

- End-to-end export flow (API → Service → File)
- End-to-end import flow (File → Service → API → Validation)
- Frontend component integration (button clicks, dialogs, notifications)
- File system operations (read, write, download)
- Database tag validation integration

### Test Data Generators

For property-based testing, we need generators for:

```typescript
// Generate random report configurations
const arbReportConfiguration = fc.record({
  tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
  timeRange: fc.record({
    startTime: fc.date(),
    endTime: fc.date()
  }),
  sampling: fc.record({
    mode: fc.constantFrom('Cyclic', 'Delta', 'BestFit'),
    interval: fc.option(fc.integer({ min: 1, max: 3600 }))
  }),
  analytics: fc.record({
    enabled: fc.boolean(),
    showTrendLine: fc.boolean(),
    showSPCMetrics: fc.boolean(),
    showStatistics: fc.boolean()
  }),
  specificationLimits: fc.option(fc.record({
    enabled: fc.boolean(),
    upperLimit: fc.option(fc.float()),
    lowerLimit: fc.option(fc.float()),
    target: fc.option(fc.float())
  })),
  reportName: fc.option(fc.string()),
  description: fc.option(fc.string()),
  customSettings: fc.option(fc.dictionary(fc.string(), fc.anything()))
});

// Generate random JSON strings (valid and invalid)
const arbJSONString = fc.oneof(
  fc.json(),  // Valid JSON
  fc.string().map(s => s + '{invalid}')  // Invalid JSON
);

// Generate random schema versions
const arbSchemaVersion = fc.oneof(
  fc.constant('1.0'),
  fc.constant('1.1'),
  fc.constant('2.0'),
  fc.string({ minLength: 3, maxLength: 10 })  // Invalid versions
);

// Generate random file paths
const arbFilePath = fc.oneof(
  fc.string().map(s => s.replace(/\\/g, '/')),  // Unix-style
  fc.string().map(s => s.replace(/\//g, '\\')),  // Windows-style
  fc.string()  // Mixed
);
```

### Manual Testing Checklist

- [ ] Export configuration with single tag
- [ ] Export configuration with 10+ tags
- [ ] Export configuration with all analytics enabled
- [ ] Export to Power BI format
- [ ] Import previously exported JSON
- [ ] Import JSON with missing optional fields
- [ ] Import JSON with invalid syntax (verify error message)
- [ ] Import JSON with non-existent tags (verify warning)
- [ ] Verify exported JSON is human-readable
- [ ] Verify Power BI file works in Power BI Desktop
- [ ] Verify no credentials in exported files
- [ ] Test on Windows, macOS, and Linux
- [ ] Test with Unicode characters in configuration
- [ ] Test file size limits (create large configuration)
- [ ] Verify format preference is remembered

### Performance Testing

While performance requirements (2-second limits) are difficult to test reliably in unit tests, we should include performance benchmarks:

```typescript
describe('Performance Benchmarks', () => {
  it('should export typical configuration in <2 seconds', async () => {
    const config = createTypicalConfiguration();
    const startTime = Date.now();
    
    await exportService.exportConfiguration(config, { format: 'json' });
    
    const duration = Date.now() - startTime;
    console.log(`Export duration: ${duration}ms`);
    // Note: This is a benchmark, not a strict assertion
  });
  
  it('should import typical configuration in <2 seconds', async () => {
    const jsonContent = getTypicalExportedJSON();
    const startTime = Date.now();
    
    await importService.importConfiguration(jsonContent);
    
    const duration = Date.now() - startTime;
    console.log(`Import duration: ${duration}ms`);
    // Note: This is a benchmark, not a strict assertion
  });
});
```

These benchmarks help identify performance regressions during development without creating flaky tests.
