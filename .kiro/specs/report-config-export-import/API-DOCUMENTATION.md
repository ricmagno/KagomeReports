# Report Configuration Export/Import API Documentation

## Overview

The Export/Import API provides endpoints for exporting report configurations to various formats (JSON, Power BI) and importing previously exported configurations. These endpoints enable configuration portability, backup, and integration with external business intelligence tools.

**Base URL**: `/api/reports`

**Authentication**: All endpoints require JWT authentication via the `Authorization` header.

---

## Endpoints

### 1. Export Report Configuration

Export a report configuration to JSON or Power BI format.

**Endpoint**: `POST /api/reports/export`

**Authentication**: Required

**Request Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body**:
```typescript
{
  config: ReportConfig;      // The report configuration to export
  format: 'json' | 'powerbi'; // Export format
}
```

**ReportConfig Structure**:
```typescript
interface ReportConfig {
  name: string;
  description?: string;
  tags: string[];              // Tag names to include
  timeRange: {
    startTime: Date;
    endTime: Date;
  };
  chartTypes: string[];
  template: string;
  format: 'pdf' | 'docx';
  filters: any[];
  includeSPCCharts: boolean;
  includeTrendLines: boolean;
  includeStatsSummary: boolean;
  specificationLimits?: {
    enabled: boolean;
    upperLimit?: number;
    lowerLimit?: number;
    target?: number;
  };
}
```

**Response (JSON Export)**:
- **Status**: 200 OK
- **Headers**:
  - `Content-Type: application/json`
  - `Content-Disposition: attachment; filename="ReportConfig_<tags>_<timestamp>.json"`
- **Body**: JSON file content

**Response (Power BI Export)**:
- **Status**: 200 OK
- **Headers**:
  - `Content-Type: text/plain`
  - `Content-Disposition: attachment; filename="PowerBI_<tags>_<timestamp>.pq"`
- **Body**: Power Query M language file content

**Example Request (JSON)**:
```bash
curl -X POST http://localhost:3000/api/reports/export \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "name": "Temperature Report",
      "tags": ["Temperature", "Pressure"],
      "timeRange": {
        "startTime": "2024-01-01T00:00:00Z",
        "endTime": "2024-01-02T00:00:00Z"
      },
      "chartTypes": ["line"],
      "template": "default",
      "format": "pdf",
      "filters": [],
      "includeSPCCharts": true,
      "includeTrendLines": true,
      "includeStatsSummary": true
    },
    "format": "json"
  }'
```

**Example Response (JSON Export)**:
```json
{
  "schemaVersion": "1.0",
  "exportMetadata": {
    "exportDate": "2024-01-15T10:30:00Z",
    "exportedBy": "user123",
    "applicationVersion": "1.0.0",
    "platform": "darwin"
  },
  "reportConfig": {
    "tags": ["Temperature", "Pressure"],
    "timeRange": {
      "startTime": "2024-01-01T00:00:00Z",
      "endTime": "2024-01-02T00:00:00Z"
    },
    "sampling": {
      "mode": "Cyclic",
      "interval": 60
    },
    "analytics": {
      "enabled": true,
      "showTrendLine": true,
      "showSPCMetrics": true,
      "showStatistics": true
    },
    "specificationLimits": {
      "enabled": true,
      "upperLimit": 100,
      "lowerLimit": 0,
      "target": 50
    },
    "reportName": "Temperature Report",
    "description": "Temperature and pressure monitoring"
  },
  "securityNotice": "This file does not contain database credentials. Configure connection settings separately when importing."
}
```

**Error Responses**:

**400 Bad Request** - Invalid configuration or format:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid export format. Must be 'json' or 'powerbi'."
  }
}
```

**413 Payload Too Large** - Configuration exceeds size limit:
```json
{
  "success": false,
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "Configuration exceeds maximum export size of 5 MB"
  }
}
```

**500 Internal Server Error** - Serialization failure:
```json
{
  "success": false,
  "error": {
    "code": "EXPORT_FAILED",
    "message": "Failed to serialize configuration"
  }
}
```

---

### 2. Import Report Configuration

Import a report configuration from a JSON file.

**Endpoint**: `POST /api/reports/import`

**Authentication**: Required

**Request Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body**:
```typescript
{
  fileContent: string;  // JSON string content of the exported file
}
```

**Response (Success)**:
- **Status**: 200 OK
- **Body**:
```typescript
{
  success: true;
  config: ReportConfig;      // Validated and parsed configuration
  warnings?: string[];       // Optional warnings (e.g., non-existent tags)
  metadata?: {
    processingTime: number;  // Processing time in milliseconds
    schemaVersion: string;   // Schema version of imported file
  };
}
```

**Example Request**:
```bash
curl -X POST http://localhost:3000/api/reports/import \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "fileContent": "{\"schemaVersion\":\"1.0\",\"exportMetadata\":{...},\"reportConfig\":{...}}"
  }'
```

**Example Response (Success)**:
```json
{
  "success": true,
  "config": {
    "name": "Temperature Report",
    "tags": ["Temperature", "Pressure"],
    "timeRange": {
      "startTime": "2024-01-01T00:00:00.000Z",
      "endTime": "2024-01-02T00:00:00.000Z"
    },
    "chartTypes": ["line"],
    "template": "default",
    "format": "pdf",
    "filters": [],
    "includeSPCCharts": true,
    "includeTrendLines": true,
    "includeStatsSummary": true,
    "createdAt": "2024-01-15T10:35:00.000Z",
    "updatedAt": "2024-01-15T10:35:00.000Z"
  },
  "warnings": [
    "Tag 'OldSensor' does not exist in the database. It will not return data."
  ],
  "metadata": {
    "processingTime": 145,
    "schemaVersion": "1.0"
  }
}
```

**Error Responses**:

**400 Bad Request** - Invalid JSON syntax:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_JSON",
    "message": "Invalid JSON file format",
    "details": "Unexpected token } in JSON at position 42"
  }
}
```

**400 Bad Request** - Schema validation failure:
```json
{
  "success": false,
  "error": {
    "code": "SCHEMA_VALIDATION_FAILED",
    "message": "Configuration validation failed",
    "validationErrors": [
      {
        "code": "MISSING_REQUIRED_FIELD",
        "field": "tags",
        "message": "Tags array is required",
        "severity": "error"
      },
      {
        "code": "INVALID_FIELD_VALUE",
        "field": "timeRange.startTime",
        "message": "Start time must be before end time",
        "severity": "error"
      }
    ]
  }
}
```

**400 Bad Request** - Schema version mismatch:
```json
{
  "success": false,
  "error": {
    "code": "SCHEMA_VERSION_MISMATCH",
    "message": "This configuration was exported from version 2.0. Current version: 1.0.",
    "details": {
      "importedVersion": "2.0",
      "currentVersion": "1.0"
    }
  }
}
```

**413 Payload Too Large** - File exceeds size limit:
```json
{
  "success": false,
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "File size exceeds maximum allowed size of 10 MB"
  }
}
```

**500 Internal Server Error** - Import processing failure:
```json
{
  "success": false,
  "error": {
    "code": "IMPORT_FAILED",
    "message": "Failed to process imported configuration"
  }
}
```

---

## Data Models

### ExportedConfiguration (JSON Format)

```typescript
interface ExportedConfiguration {
  schemaVersion: string;           // Schema version (e.g., "1.0")
  exportMetadata: ExportMetadata;
  reportConfig: {
    tags: string[];
    timeRange: {
      startTime: string;           // ISO 8601 format
      endTime: string;             // ISO 8601 format
      duration?: number;           // Milliseconds
    };
    sampling: {
      mode: 'Cyclic' | 'Delta' | 'BestFit';
      interval?: number;           // Seconds (for Cyclic mode)
    };
    analytics: {
      enabled: boolean;
      showTrendLine: boolean;
      showSPCMetrics: boolean;
      showStatistics: boolean;
    };
    specificationLimits?: {
      enabled: boolean;
      upperLimit?: number;
      lowerLimit?: number;
      target?: number;
    };
    reportName?: string;
    description?: string;
    customSettings?: Record<string, any>;
  };
  securityNotice: string;
}

interface ExportMetadata {
  exportDate: string;              // ISO 8601 timestamp
  exportedBy: string;              // User identifier
  applicationVersion: string;      // Application version
  platform: string;                // OS platform
}
```

### ValidationError

```typescript
interface ValidationError {
  code: ValidationErrorCode;
  field?: string;                  // Field name that failed validation
  message: string;                 // User-friendly error message
  severity: 'error' | 'warning';
  details?: any;                   // Additional error context
}

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
```

---

## Security Considerations

### Credential Handling

**Exported Files**:
- Database passwords are **NOT** included in exports
- SMTP credentials are **NOT** included in exports
- Connection metadata (server address, database name) **IS** included
- All exports include a security notice about credential configuration

**Imported Files**:
- Use the application's current database connection settings
- Do not modify existing connection credentials
- Validate all imported data before processing

### File Size Limits

- **Export**: Maximum 5 MB per JSON export
- **Import**: Maximum 10 MB per import file
- Files exceeding limits are rejected with HTTP 413 status

### Cross-Platform Compatibility

- All file paths use forward slashes (/) in exports
- UTF-8 encoding is used for all text content
- Platform-specific paths are normalized on import

---

## Usage Examples

### Complete Export/Import Workflow

**Step 1: Export Configuration**
```javascript
// Frontend code
const exportConfig = async (config, format) => {
  const response = await fetch('/api/reports/export', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ config, format })
  });
  
  if (!response.ok) {
    throw new Error('Export failed');
  }
  
  // Trigger download
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = response.headers.get('Content-Disposition')
    .split('filename=')[1].replace(/"/g, '');
  a.click();
};
```

**Step 2: Import Configuration**
```javascript
// Frontend code
const importConfig = async (file) => {
  const fileContent = await file.text();
  
  const response = await fetch('/api/reports/import', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fileContent })
  });
  
  const result = await response.json();
  
  if (!result.success) {
    // Handle validation errors
    console.error('Import failed:', result.error);
    return;
  }
  
  // Handle warnings
  if (result.warnings && result.warnings.length > 0) {
    console.warn('Import warnings:', result.warnings);
  }
  
  // Use imported configuration
  return result.config;
};
```

---

## Error Handling Best Practices

### Client-Side Error Handling

```javascript
try {
  const result = await importConfig(file);
  
  if (result.warnings) {
    // Show warnings to user but allow import
    showWarningDialog(result.warnings);
  }
  
  // Populate form with imported config
  populateForm(result.config);
  
} catch (error) {
  if (error.response?.status === 400) {
    // Validation errors
    const { validationErrors } = error.response.data.error;
    showValidationErrorDialog(validationErrors);
  } else if (error.response?.status === 413) {
    // File too large
    showError('File is too large. Maximum size is 10 MB.');
  } else {
    // Generic error
    showError('Import failed. Please try again.');
  }
}
```

### Server-Side Error Logging

All validation failures and import errors are logged with:
- User identifier
- Timestamp
- Error details
- Configuration context (sanitized)

---

## Rate Limiting

- **Export**: 10 requests per minute per user
- **Import**: 5 requests per minute per user

Exceeding rate limits returns HTTP 429 (Too Many Requests).

---

## Changelog

### Version 1.0 (Current)
- Initial release
- JSON export/import support
- Power BI export support
- Schema version 1.0
- UTF-8 encoding
- Cross-platform path handling
- Credential filtering
- File size validation

---

## Support

For issues or questions:
- Check the troubleshooting section in the user documentation
- Review validation error messages for specific guidance
- Contact support with error codes and timestamps for faster resolution
