# Historian Reports API Documentation

## Overview

The Historian Reports API provides endpoints for retrieving and analyzing time-series data from AVEVA Historian databases. The API supports data filtering, statistical analysis, and trend detection.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Currently, the API provides mock authentication endpoints. Full JWT-based authentication will be implemented in a future version.

## Endpoints

### Health Check Endpoints

#### GET /health
Basic health check for the application.

#### GET /api/health
Detailed health check including service status.

#### GET /api/health/detailed
Comprehensive health check with component-specific information.

#### GET /api/health/database
Database-specific health check.

#### GET /api/health/historian
Historian connection-specific health check.

### Data Retrieval Endpoints

#### GET /api/data/tags
Get available tags with optional filtering.

#### GET /api/data/:tagName
Get time-series data for a specific tag.

#### POST /api/data/query
Execute custom data queries with advanced filtering.

#### GET /api/data/:tagName/statistics
Get statistical analysis for a specific tag.

#### POST /api/data/multiple
Get time-series data for multiple tags.

#### GET /api/data/:tagName/trend
Get trend analysis for a specific tag.

### Report Management Endpoints

#### GET /api/reports
Get list of saved report configurations.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `search`: Search term for name/description
- `category`: Filter by category

#### POST /api/reports
Save a new report configuration.

#### GET /api/reports/:id
Get a specific report configuration.

#### PUT /api/reports/:id
Update a report configuration.

#### DELETE /api/reports/:id
Delete a report configuration.

#### POST /api/reports/generate
Generate a report on-demand.

**Request Body:**
```json
{
  "name": "Temperature Report",
  "description": "Daily temperature analysis",
  "tags": ["TEMP001", "TEMP002"],
  "timeRange": {
    "startTime": "2023-01-01T00:00:00Z",
    "endTime": "2023-01-02T00:00:00Z"
  },
  "chartTypes": ["line", "trend"],
  "template": "default",
  "format": "pdf"
}
```

#### GET /api/reports/:id/download
Download a generated report.

### Schedule Management Endpoints

#### GET /api/schedules
Get list of scheduled reports.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `status`: Filter by status (`enabled`, `disabled`)
- `reportId`: Filter by report ID

#### POST /api/schedules
Create a new schedule.

**Request Body:**
```json
{
  "reportId": "report-001",
  "name": "Daily Temperature Schedule",
  "interval": "daily",
  "recipients": ["user@example.com"],
  "enabled": true,
  "timezone": "UTC",
  "emailSubject": "Daily Report - {{date}}",
  "emailBody": "Please find attached the daily report."
}
```

#### GET /api/schedules/:id
Get a specific schedule.

#### PUT /api/schedules/:id
Update a schedule.

#### DELETE /api/schedules/:id
Delete a schedule.

#### POST /api/schedules/:id/execute
Manually execute a schedule.

#### POST /api/schedules/:id/enable
Enable a schedule.

#### POST /api/schedules/:id/disable
Disable a schedule.

#### GET /api/schedules/:id/executions
Get execution history for a schedule.

### Authentication Endpoints

#### POST /api/auth/login
Authenticate user and return JWT token.

**Request Body:**
```json
{
  "username": "admin",
  "password": "password",
  "rememberMe": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h",
  "user": {
    "id": "user-001",
    "username": "admin",
    "email": "admin@example.com",
    "firstName": "Admin",
    "lastName": "User",
    "role": "admin"
  }
}
```

#### POST /api/auth/register
Register a new user account.

#### POST /api/auth/logout
Logout user and invalidate token.

#### GET /api/auth/me
Get current user information.

#### PUT /api/auth/password
Change user password.

#### POST /api/auth/refresh
Refresh JWT token.

#### GET /api/auth/permissions
Get user permissions.

### System Monitoring Endpoints

#### GET /api/system/info
Get system information.

**Response:**
```json
{
  "success": true,
  "data": {
    "application": {
      "name": "Historian Reports",
      "version": "1.0.0",
      "environment": "development",
      "uptime": 3600
    },
    "system": {
      "platform": "darwin",
      "architecture": "arm64",
      "nodeVersion": "v18.17.0",
      "memory": {...},
      "cpu": {...}
    },
    "configuration": {...}
  }
}
```

#### GET /api/system/metrics
Get system performance metrics.

#### GET /api/system/logs
Get recent system logs.

**Query Parameters:**
- `level`: Log level filter (`error`, `warn`, `info`, `debug`, `all`)
- `limit`: Number of logs to return (default: 100)
- `since`: ISO timestamp to filter logs from

#### GET /api/system/stats
Get system statistics.

#### POST /api/system/gc
Trigger garbage collection (admin only).

#### GET /api/system/config
Get system configuration (admin only).

## Error Responses

All endpoints return errors in the following format:

```json
{
  "error": "Error Type",
  "message": "Detailed error message"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad Request (validation errors)
- `404`: Not Found
- `500`: Internal Server Error
- `503`: Service Unavailable (database connection issues)

## Data Types

### TimeSeriesData
```json
{
  "timestamp": "2023-01-01T00:00:00Z",
  "value": 25.5,
  "quality": 192,
  "tagName": "TAG001"
}
```

### Quality Codes
- `192`: Good quality data
- `0`: Bad quality data
- `64`: Uncertain quality data

### Retrieval Modes
- `Full`: All data points
- `Cyclic`: Fixed time intervals
- `Delta`: Value change based
- `BestFit`: Optimized sampling

## Rate Limiting

The API implements rate limiting to prevent abuse:
- Maximum 100 requests per 15-minute window per IP address
- Rate limit headers are included in responses

## Examples

### Get temperature data for the last 24 hours
```bash
curl "http://localhost:3000/api/data/TEMP001?startTime=2023-01-01T00:00:00Z&endTime=2023-01-02T00:00:00Z&includeStats=true"
```

### Query multiple tags with filtering
```bash
curl -X POST http://localhost:3000/api/data/query \
  -H "Content-Type: application/json" \
  -d '{
    "timeRange": {
      "startTime": "2023-01-01T00:00:00Z",
      "endTime": "2023-01-02T00:00:00Z"
    },
    "filter": {
      "tagNames": ["TEMP001", "PRESS001"],
      "qualityFilter": [192]
    },
    "includeStatistics": true
  }'
```

### Get trend analysis
```bash
curl "http://localhost:3000/api/data/TEMP001/trend?startTime=2023-01-01T00:00:00Z&endTime=2023-01-02T00:00:00Z&windowSize=20"
```