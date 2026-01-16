# TypeScript Types Documentation

## Schedule Types (`schedule.ts`)

This module contains all TypeScript interfaces and types for the Scheduled Reports feature.

### Core Interfaces

#### `Schedule`
Complete schedule configuration with all metadata fields.

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

#### `ScheduleExecution`
Represents a single execution of a scheduled report.

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

#### `PaginationInfo`
Standard pagination metadata for API responses.

```typescript
interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
```

### Type Aliases

#### `ScheduleConfig`
Used for creating new schedules (omits auto-generated fields).

```typescript
type ScheduleConfig = Omit<Schedule, 'id' | 'createdAt' | 'updatedAt' | 'nextRun' | 'lastRun' | 'lastStatus' | 'lastError'>;
```

#### `ScheduleUpdatePayload`
Used for updating existing schedules (all fields optional).

```typescript
type ScheduleUpdatePayload = Partial<Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>>;
```

### Query Parameter Interfaces

#### `ExecutionHistoryParams`
Parameters for fetching execution history.

```typescript
interface ExecutionHistoryParams {
  page?: number;
  limit?: number;
  status?: 'running' | 'success' | 'failed';
}
```

#### `ScheduleListParams`
Parameters for fetching schedule lists.

```typescript
interface ScheduleListParams {
  page?: number;
  limit?: number;
  enabled?: boolean;
  search?: string;
}
```

### Statistics and Health Interfaces

#### `ExecutionStatistics`
Aggregated statistics for schedule executions.

```typescript
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

#### `SchedulerHealth`
System health status for the scheduler service.

```typescript
interface SchedulerHealth {
  status: 'healthy' | 'warning' | 'critical';
  activeSchedules: number;
  runningExecutions: number;
  queueLength: number;
  lastExecutionTime?: Date;
  issues: string[];
}
```

## Usage Examples

### Creating a Schedule

```typescript
import { apiService } from '../services/api';
import { ScheduleConfig } from '../types/schedule';

const newSchedule: ScheduleConfig = {
  name: 'Daily Production Report',
  description: 'Automated daily report for production metrics',
  reportConfig: {
    name: 'Production Metrics',
    description: 'Daily production data',
    tags: ['production.temperature', 'production.pressure'],
    timeRange: {
      startTime: new Date(),
      endTime: new Date(),
    },
    chartTypes: ['line'],
    template: 'default',
  },
  cronExpression: '0 9 * * *', // Daily at 9 AM
  enabled: true,
  recipients: ['manager@example.com', 'team@example.com'],
};

const result = await apiService.createSchedule(newSchedule);
console.log('Schedule created:', result.data.scheduleId);
```

### Fetching Schedules with Filters

```typescript
const schedules = await apiService.getSchedules({
  page: 1,
  limit: 20,
  enabled: true,
  search: 'production',
});

console.log(`Found ${schedules.data.pagination.total} schedules`);
schedules.data.schedules.forEach(schedule => {
  console.log(`- ${schedule.name} (${schedule.cronExpression})`);
});
```

### Viewing Execution History

```typescript
const history = await apiService.getExecutionHistory('schedule-id', {
  page: 1,
  limit: 50,
  status: 'failed',
});

history.data.executions.forEach(execution => {
  console.log(`Execution ${execution.id}:`);
  console.log(`  Status: ${execution.status}`);
  console.log(`  Duration: ${execution.duration}ms`);
  if (execution.error) {
    console.log(`  Error: ${execution.error}`);
  }
});
```

### Checking Scheduler Health

```typescript
const health = await apiService.getSchedulerHealth();

console.log(`Scheduler Status: ${health.data.status}`);
console.log(`Active Schedules: ${health.data.activeSchedules}`);
console.log(`Running Executions: ${health.data.runningExecutions}`);
console.log(`Queue Length: ${health.data.queueLength}`);

if (health.data.issues.length > 0) {
  console.log('Issues:');
  health.data.issues.forEach(issue => console.log(`  - ${issue}`));
}
```

## API Service Methods

All schedule-related API methods are available through `apiService` from `client/src/services/api.ts`:

- `getSchedules(params?)` - List all schedules with optional filtering
- `getSchedule(id)` - Get a single schedule by ID
- `createSchedule(config)` - Create a new schedule
- `updateSchedule(id, updates)` - Update an existing schedule
- `deleteSchedule(id)` - Delete a schedule
- `enableSchedule(id)` - Enable a schedule
- `disableSchedule(id)` - Disable a schedule
- `executeSchedule(id)` - Manually execute a schedule (Run Now)
- `getExecutionHistory(id, params?)` - Get execution history for a schedule
- `getExecutionStatistics(id)` - Get execution statistics for a schedule
- `getSchedulerHealth()` - Get scheduler system health status

All methods return `Promise<ApiResponse<T>>` where `T` is the expected data type.

## Error Handling

All API methods use the built-in error handling from the API service:

```typescript
try {
  const result = await apiService.createSchedule(config);
  // Handle success
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`API Error (${error.status}): ${error.message}`);
    // Access error.response for additional details
  } else {
    console.error('Network error:', error);
  }
}
```

## Testing

Comprehensive unit tests are available in `client/src/services/__tests__/schedules-api.test.ts`.

Run tests with:
```bash
cd client
npm test -- --testPathPattern=schedules-api
```
