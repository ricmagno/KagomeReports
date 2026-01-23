# Report Export/Import Type Definitions

This document describes the TypeScript type definitions for the report configuration export and import functionality.

## Overview

The export/import feature allows users to:
- Export report configurations to JSON format for backup and sharing
- Export report configurations to Power BI format for external analysis
- Import previously exported JSON configurations back into the application

## Type Organization

All export/import types are defined in `src/types/reportExportImport.ts` and organized into the following categories:

### Export Types

- **`ExportFormat`**: Union type for supported export formats (`'json' | 'powerbi'`)
- **`ExportOptions`**: Configuration options for export operations
- **`ExportResult`**: Result structure returned by export operations
- **`ExportMetadata`**: Metadata included in exported files (timestamp, user, version, platform)
- **`ExportedConfiguration`**: Complete structure of an exported JSON file (schema version 1.0)
- **`ExportedReportConfig`**: Serialization-friendly version of ReportConfig

### Import Types

- **`ImportResult`**: Result structure returned by import operations
- **`ValidationError`**: Detailed validation error information
- **`ValidationErrorCode`**: Enum of all possible validation error codes
- **`ImportMetadata`**: Metadata tracking import history

### Power BI Types

- **`PowerBIConnection`**: Connection configuration for Power BI
- **`PowerBIQueryParams`**: Parameters for generating Power BI M Query templates

### API Types

- **`ExportRequest`**: Request body for the export endpoint
- **`ImportRequest`**: Request body for the import endpoint
- **`ErrorResponse`**: Standard error response structure
- **`SuccessResponse<T>`**: Generic success response structure

## Constants

### Schema Version
- **`CURRENT_SCHEMA_VERSION`**: Current JSON schema version (`'1.0.0'`)
- **`SUPPORTED_SCHEMA_VERSIONS`**: Array of supported schema versions for import

### File Size Limits
- **`MAX_EXPORT_SIZE_MB`**: Maximum export file size (5 MB)
- **`MAX_IMPORT_SIZE_MB`**: Maximum import file size (10 MB)
- **`MAX_EXPORT_SIZE_BYTES`**: Maximum export size in bytes
- **`MAX_IMPORT_SIZE_BYTES`**: Maximum import size in bytes

### Validation Constants
- **`REQUIRED_FIELDS`**: Array of required field paths in exported configurations
- **`VALID_SAMPLING_MODES`**: Array of valid sampling mode values
- **`TAG_NAME_PATTERN`**: Regular expression for validating tag names

## Type Guards

The module provides several type guard functions for runtime type checking:

- **`isValidExportFormat(value: any): value is ExportFormat`**
  - Checks if a value is a valid export format

- **`isValidSamplingMode(value: any): value is 'Cyclic' | 'Delta' | 'BestFit'`**
  - Checks if a value is a valid sampling mode

- **`isValidSchemaVersion(version: any): version is string`**
  - Checks if a version string follows semantic versioning format

- **`isExportedConfiguration(obj: any): obj is ExportedConfiguration`**
  - Checks if an object conforms to the ExportedConfiguration structure

## JSON Schema Structure (Version 1.0)

An exported JSON file has the following structure:

```json
{
  "schemaVersion": "1.0.0",
  "exportMetadata": {
    "exportDate": "2024-01-15T14:30:22.000Z",
    "exportedBy": "user@example.com",
    "applicationVersion": "1.0.0",
    "platform": "linux"
  },
  "reportConfig": {
    "tags": ["Tag1", "Tag2"],
    "timeRange": {
      "startTime": "2024-01-01T00:00:00.000Z",
      "endTime": "2024-01-02T00:00:00.000Z",
      "duration": 86400000,
      "relativeRange": "last24h"
    },
    "sampling": {
      "mode": "Cyclic",
      "interval": 60
    },
    "analytics": {
      "enabled": true,
      "showTrendLine": true,
      "showSPCMetrics": false,
      "showStatistics": true
    },
    "specificationLimits": {
      "enabled": true,
      "upperLimit": 100,
      "lowerLimit": 0,
      "target": 50
    },
    "reportName": "My Report",
    "description": "Report description",
    "customSettings": {}
  }
}
```

## Validation Error Codes

The following error codes are defined in `ValidationErrorCode` enum:

- **`INVALID_JSON`**: File is not valid JSON
- **`SCHEMA_VERSION_MISMATCH`**: Schema version is not supported
- **`MISSING_REQUIRED_FIELD`**: A required field is missing
- **`INVALID_FIELD_VALUE`**: A field has an invalid value
- **`TAG_NOT_FOUND`**: A tag doesn't exist in the database (warning)
- **`INVALID_TIME_RANGE`**: Time range is invalid (start >= end, or end in future)
- **`FILE_TOO_LARGE`**: File exceeds size limits
- **`UNSUPPORTED_FORMAT`**: File format is not supported
- **`INVALID_SAMPLING_MODE`**: Sampling mode is not valid
- **`INVALID_SPEC_LIMITS`**: Specification limits are invalid (upper <= lower)

## Usage Examples

### Creating an Export Request

```typescript
import { ExportRequest } from '@/types/reportExportImport';
import { ReportConfig } from '@/types/reports';

const config: ReportConfig = {
  // ... report configuration
};

const exportRequest: ExportRequest = {
  config,
  format: 'json'
};
```

### Handling Import Results

```typescript
import { ImportResult, ValidationErrorCode } from '@/types/reportExportImport';

function handleImportResult(result: ImportResult) {
  if (result.success) {
    console.log('Import successful!');
    if (result.warnings && result.warnings.length > 0) {
      console.warn('Warnings:', result.warnings);
    }
    // Use result.config
  } else {
    console.error('Import failed!');
    result.errors?.forEach(error => {
      console.error(`${error.field}: ${error.message}`);
    });
  }
}
```

### Using Type Guards

```typescript
import { isValidExportFormat, isExportedConfiguration } from '@/types/reportExportImport';

// Validate user input
const format = req.body.format;
if (!isValidExportFormat(format)) {
  throw new Error('Invalid export format');
}

// Validate imported data
const data = JSON.parse(fileContent);
if (!isExportedConfiguration(data)) {
  throw new Error('Invalid configuration structure');
}
```

## Integration with Existing Types

The export/import types integrate with existing types from `src/types/reports.ts`:

- **`ReportConfig`**: Extended with optional `importMetadata` field to track import history
- Import operations return `ReportConfig` objects that can be used directly in the application
- Export operations accept `ReportConfig` objects and serialize them to `ExportedReportConfig`

## Security Considerations

The type definitions support security requirements:

- No password or credential fields in exported structures
- Connection metadata (server, database) is included but not credentials
- Import operations use the application's current database connection settings
- Security notices should be added to exported files (handled by services, not types)

## Testing

Comprehensive unit tests are provided in `src/types/__tests__/reportExportImport.test.ts` covering:

- Type guard functions
- Constant values
- Enum definitions
- Type compatibility and structure

Run tests with:
```bash
npm test -- src/types/__tests__/reportExportImport.test.ts
```

## Future Extensions

The type system is designed to support future enhancements:

- **Schema versioning**: `schemaVersion` field enables backward compatibility
- **Custom settings**: `customSettings` field allows extensibility
- **Additional export formats**: `ExportFormat` can be extended with new formats
- **Additional validation codes**: `ValidationErrorCode` enum can be extended

## Related Files

- `src/types/reportExportImport.ts` - Type definitions
- `src/types/reports.ts` - Report configuration types
- `src/types/historian.ts` - AVEVA Historian types
- `src/types/__tests__/reportExportImport.test.ts` - Unit tests
