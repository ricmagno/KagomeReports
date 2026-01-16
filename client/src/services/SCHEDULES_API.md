# Schedules API Documentation

This document provides comprehensive documentation for all schedule-related API endpoints and service methods.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [API Endpoints](#api-endpoints)
- [Type Definitions](#type-definitions)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)

## Overview

The Schedules API provides endpoints for managing automated report schedules. All endpoints are accessed through the `apiService` object exported from `client/src/services/api.ts`.

**Base URL**: `/api/schedules`

**Features**:
- Create, read, update, and delete schedules
- Enable/disable schedules
- Manual execution (Run Now)
- Execution history with filtering and pagination
- Execution statistics
- Scheduler health monitoring

## Authentication

All schedule endpoints require authentication. The API service automatically includes the authentication token in request headers when available.

```typescript
import { setAuthToken } from '../services/api';

// Set token after login
setAuthToken(token);

// Clear token on logout
setAuthToken(null);
```

## Error Handling

The API service includes comprehensive error handling with retry logic:

- **Network Errors**: Automatically retried up to 3 times with exponential backoff
- **Client Errors (4xx)**: Not retried (except 408 timeout and 429 rate limit)
- **Server Errors (5xx)**: Automatically retried
- **Custom Error Class**: `ApiError` with status code and response data

```typescript
try {
  const response = await apiService.getSchedules();
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`API Error ${error.status}: ${error.message}`);
    console.error('Response:', error.response);
  }
}
```

## API Endpoints

### Get All Schedules

Retrieves a paginated list of schedules with optional filtering.

**Method**: `getSchedules(params?: ScheduleListParams)`

**Parameters**:
```typescript
interface ScheduleListParams {
  page?: number;        // Page number (default: 1)
  limit?: number;       // Items per page (default: 10)
  enabled?: boolean;    // Filter by enabled status
  search?: string;      // Search by name/description
}
```

**Returns**:
```typescript
Promise<ApiResponse<{
  schedules: Schedule[];
  pagination: PaginationInfo;
}>>
```

**Example**:
```typescript
const response = await apiService.getSchedules({
  page: 1,
  limit: 10,
  enabled: true,
  search: 'daily'
});

console.log(response.data.schedules);
console.log(response.data.pagination);
```

---

### Get Single Schedule

Retrieves a single schedule by ID.

**Method**: `getSchedule(id: string)`

**Parameters**:
- `id` (string): Schedule ID

**Returns**:
```typescript
Promise<ApiResponse<Schedule>>
```

**Example**:
```typescript
const response = await apiService.getSchedule('schedule-123');
console.log(response.data);
```

---

### Create Schedule

Creates a new schedule.

**Method**: `createSchedule(config: ScheduleConfig)`

**Parameters**:
```typescript
interface ScheduleConfig {
  name: string;                    // Schedule name (1-100 chars)
  description?: string;            // Optional description (max 500 chars)
  reportConfig: ReportConfig;      // Report configuration
  cronExpression: string;          // Valid cron expression
  enabled: boolean;                // Initial enabled state
  recipients?: string[];           // Email recipients
}
```

**Returns**:
```typescript
Promise<ApiResponse<{
  scheduleId: string;
  schedule: Schedule;
  message: string;
}>>
```

**Example**:
```typescript
const response = await apiService.createSchedule({
  name: 'Daily Production Report',
  description: 'Automated daily report at 9 AM',
  reportConfig: selectedReportConfig,
  cronExpression: '0 9 * * *',
  enabled: true,
  recipients: ['user@example.com']
});

console.log('Created schedule:', response.data.scheduleId);
```

---

### Update Schedule

Updates an existing schedule.

**Method**: `updateSchedule(id: string, updates: ScheduleUpdatePayload)`

**Parameters**:
- `id` (string): Schedule ID
- `updates` (ScheduleUpdatePayload): Partial schedule updates

```typescript
type ScheduleUpdatePayload = Partial<Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>>;
```

**Returns**:
```typescript
Promise<ApiResponse<{
  schedule: Schedule;
  message: string;
}>>
```

**Example**:
```typescript
const response = await apiService.updateSchedule('schedule-123', {
  name: 'Updated Schedule Name',
  cronExpression: '0 10 * * *',
  recipients: ['newuser@example.com']
});

console.log('Updated schedule:', response.data.schedule);
```

---

### Delete Schedule

Deletes a schedule and stops its cron job.

**Method**: `deleteSchedule(id: string)`

**Parameters**:
- `id` (string): Schedule ID

**Returns**:
```typescript
Promise<ApiResponse<{
  message: string;
}>>
```

**Example**:
```typescript
const response = await apiService.deleteSchedule('schedule-123');
console.log(response.data.message);
```

---

### Enable Schedule

Enables a schedule and starts its cron job.

**Method**: `enableSchedule(id: string)`

**Parameters**:
- `id` (string): Schedule ID

**Returns**:
```typescript
Promise<ApiResponse<{
  schedule: Schedule;
  message: string;
}>>
```

**Example**:
```typescript
const response = await apiService.enableSchedule('schedule-123');
console.log('Next run:', response.data.schedule.nextRun);
```

---

### Disable Schedule

Disables a schedule and stops its cron job.

**Method**: `disableSchedule(id: string)`

**Parameters**:
- `id` (string): Schedule ID

**Returns**:
```typescript
Promise<ApiResponse<{
  schedule: Schedule;
  message: string;
}>>
```

**Example**:
```typescript
const response = await apiService.disableSchedule('schedule-123');
console.log(response.data.message);
```

---

### Execute Schedule (Run Now)

Manually triggers a schedule execution immediately.

**Method**: `executeSchedule(id: string)`

**Parameters**:
- `id` (string): Schedule ID

**Returns**:
```typescript
Promise<ApiResponse<{
  executionId: string;
  status: string;
  message: string;
}>>
```

**Example**:
```typescript
const response = await apiService.executeSchedule('schedule-123');
console.log('Execution ID:', response.data.executionId);
console.log('Status:', response.data.status);
```

---

### Get Execution History

Retrieves execution history for a schedule with filtering and pagination.

**Method**: `getExecutionHistory(id: string, params?: ExecutionHistoryParams)`

**Parameters**:
- `id` (string): Schedule ID
- `params` (ExecutionHistoryParams): Optional query parameters

```typescript
interface ExecutionHistoryParams {
  page?: number;                              // Page number
  limit?: number;                             // Items per page
  status?: 'running' | 'success' | 'failed'; // Filter by status
}
```

**Returns**:
```typescript
Promise<ApiResponse<{
  executions: ScheduleExecution[];
  pagination: PaginationInfo;
}>>
```

**Example**:
```typescript
const response = await apiService.getExecutionHistory('schedule-123', {
  page: 1,
  limit: 10,
  status: 'failed'
});

console.log('Failed executions:', response.data.executions);
```

---

### Get Execution Statistics

Retrieves execution statistics for a schedule.

**Method**: `getExecutionStatistics(id: string)`

**Parameters**:
- `id` (string): Schedule ID

**Returns**:
```typescript
Promise<ApiResponse<ExecutionStatistics>>

interface ExecutionStatistics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  averageDuration: number;
  lastExecution?: Date;
  nextExecution?: Date;
  recentFailures: Array<{
    executionId: string;
    timestamp: Date;
    error: string;
    duration?: number;
  }>;
}
```

**Example**:
```typescript
const response = await apiService.getExecutionStatistics('schedule-123');
console.log('Success rate:', response.data.successRate);
console.log('Average duration:', response.data.averageDuration);
```

---

### Get Scheduler Health

Retrieves system health information for the scheduler service.

**Method**: `getSchedulerHealth()`

**Returns**:
```typescript
Promise<ApiResponse<SchedulerHealth>>

interface SchedulerHealth {
  status: 'healthy' | 'warning' | 'critical';
  activeSchedules: number;
  runningExecutions: number;
  queueLength: number;
  lastExecutionTime?: Date;
  issues: string[];
}
```

**Example**:
```typescript
const response = await apiService.getSchedulerHealth();
console.log('Scheduler status:', response.data.status);
console.log('Active schedules:', response.data.activeSchedules);
console.log('Running executions:', response.data.runningExecutions);
```

---

## Type Definitions

### Schedule

```typescript
interface Schedule {
  id: string;
  name: string;
  description?: string;
  reportConfig: ReportConfig;
  cronExpression: string;
  enabled: boolean;
  nextRun?: Date;
  lastRun?: Date;
  lastStatus?: 'success' | 'failed' | 'running';
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
  recipients?: string[];
}
```

### ScheduleExecution

```typescript
interface ScheduleExecution {
  id: string;
  scheduleId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'success' | 'failed';
  reportPath?: string;
  error?: string;
  duration?: number;
}
```

### PaginationInfo

```typescript
interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
```

### ApiResponse

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
```

---

## Usage Examples

### Complete CRUD Workflow

```typescript
import { apiService } from '../services/api';

// 1. Create a schedule
const createResponse = await apiService.createSchedule({
  name: 'Daily Report',
  description: 'Automated daily report',
  reportConfig: myReportConfig,
  cronExpression: '0 9 * * *',
  enabled: true,
  recipients: ['user@example.com']
});

const scheduleId = createResponse.data.scheduleId;

// 2. Get the schedule
const getResponse = await apiService.getSchedule(scheduleId);
console.log('Schedule:', getResponse.data);

// 3. Update the schedule
const updateResponse = await apiService.updateSchedule(scheduleId, {
  cronExpression: '0 10 * * *'
});

// 4. Execute manually
const executeResponse = await apiService.executeSchedule(scheduleId);
console.log('Execution ID:', executeResponse.data.executionId);

// 5. Check execution history
const historyResponse = await apiService.getExecutionHistory(scheduleId);
console.log('Executions:', historyResponse.data.executions);

// 6. Disable the schedule
await apiService.disableSchedule(scheduleId);

// 7. Delete the schedule
await apiService.deleteSchedule(scheduleId);
```

### Error Handling with Retry

```typescript
import { apiService, ApiError } from '../services/api';

async function fetchSchedulesWithRetry() {
  try {
    const response = await apiService.getSchedules();
    return response.data.schedules;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        // Handle authentication error
        console.error('Authentication required');
        // Redirect to login
      } else if (error.status >= 500) {
        // Handle server error
        console.error('Server error:', error.message);
        // Show error message to user
      } else {
        // Handle other errors
        console.error('API error:', error.message);
      }
    } else {
      // Handle network error
      console.error('Network error:', error);
    }
    throw error;
  }
}
```

### Pagination Example

```typescript
async function fetchAllSchedules() {
  const allSchedules: Schedule[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await apiService.getSchedules({
      page,
      limit: 50
    });

    allSchedules.push(...response.data.schedules);
    
    hasMore = page < response.data.pagination.totalPages;
    page++;
  }

  return allSchedules;
}
```

---

## Best Practices

### 1. Always Handle Errors

```typescript
try {
  const response = await apiService.createSchedule(config);
  // Handle success
} catch (error) {
  // Handle error
  console.error('Failed to create schedule:', error);
}
```

### 2. Use TypeScript Types

```typescript
import { Schedule, ScheduleConfig } from '../types/schedule';

const config: ScheduleConfig = {
  name: 'My Schedule',
  // TypeScript will ensure all required fields are present
};
```

### 3. Validate Before Sending

```typescript
import { validateScheduleConfig } from '../utils/validationUtils';

const validation = validateScheduleConfig(config);
if (!validation.isValid) {
  console.error('Validation error:', validation.error);
  return;
}

await apiService.createSchedule(config);
```

### 4. Use Pagination for Large Lists

```typescript
// Don't fetch all schedules at once
const response = await apiService.getSchedules({
  page: 1,
  limit: 10
});
```

### 5. Check Response Success

```typescript
const response = await apiService.getSchedules();
if (response.success && response.data) {
  // Process data
  console.log(response.data.schedules);
} else {
  // Handle error
  console.error(response.error || 'Unknown error');
}
```

### 6. Use Filters to Reduce Data Transfer

```typescript
// Only fetch enabled schedules
const response = await apiService.getSchedules({
  enabled: true,
  search: 'production'
});
```

### 7. Monitor Scheduler Health

```typescript
// Periodically check scheduler health
setInterval(async () => {
  const health = await apiService.getSchedulerHealth();
  if (health.data.status !== 'healthy') {
    console.warn('Scheduler health issue:', health.data.issues);
  }
}, 60000); // Check every minute
```

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Default Limit**: 100 requests per minute per user
- **Response Header**: `X-RateLimit-Remaining` indicates remaining requests
- **Status Code**: 429 (Too Many Requests) when limit exceeded
- **Retry-After**: Header indicates when to retry

---

## Versioning

The API follows semantic versioning:

- **Current Version**: v1
- **Base Path**: `/api/schedules`
- **Breaking Changes**: Will be introduced in new major versions (v2, v3, etc.)

---

## Support

For API issues or questions:

1. Check this documentation
2. Review error messages and status codes
3. Check the browser console for detailed error information
4. Contact the development team

---

## Changelog

### Version 1.0.0 (Current)
- Initial release
- Full CRUD operations for schedules
- Execution history and statistics
- Scheduler health monitoring
- Comprehensive error handling
- Retry logic for failed requests
