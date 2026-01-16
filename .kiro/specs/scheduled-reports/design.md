# Design Document: Scheduled Reports

## Overview

The Scheduled Reports feature provides a comprehensive UI for managing automated report generation. The backend scheduler service is already implemented using node-cron and SQLite. This design focuses on the frontend React components and API integration to provide users with an intuitive interface for schedule management.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ SchedulesList  │  │ ScheduleForm │  │ ExecutionHistory│ │
│  └────────────────┘  └──────────────┘  └─────────────────┘ │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ CronBuilder    │  │ ScheduleCard │  │ StatusIndicator │ │
│  └────────────────┘  └──────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ REST API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Express)                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              /api/schedules Routes                      │ │
│  │  GET /schedules - List all schedules                   │ │
│  │  POST /schedules - Create schedule                     │ │
│  │  GET /schedules/:id - Get schedule details             │ │
│  │  PUT /schedules/:id - Update schedule                  │ │
│  │  DELETE /schedules/:id - Delete schedule               │ │
│  │  POST /schedules/:id/execute - Manual execution        │ │
│  │  POST /schedules/:id/enable - Enable schedule          │ │
│  │  POST /schedules/:id/disable - Disable schedule        │ │
│  │  GET /schedules/:id/executions - Execution history     │ │
│  └────────────────────────────────────────────────────────┘ │
│                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           SchedulerService (node-cron)                 │ │
│  │  - Manages cron jobs                                   │ │
│  │  - Executes scheduled reports                          │ │
│  │  - Handles retries and error recovery                  │ │
│  │  - Sends email notifications                           │ │
│  └────────────────────────────────────────────────────────┘ │
│                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              SQLite Database                            │ │
│  │  - schedules table                                     │ │
│  │  - schedule_executions table                           │ │
│  │  - execution_queue table                               │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Frontend Components

#### 1. SchedulesList Component
**Purpose**: Main container displaying all schedules with search, filter, and pagination

**Props**:
```typescript
interface SchedulesListProps {
  className?: string;
}
```

**State**:
```typescript
{
  schedules: Schedule[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  filterStatus: 'all' | 'enabled' | 'disabled';
  filterLastStatus: 'all' | 'success' | 'failed';
  page: number;
  limit: number;
  totalPages: number;
  selectedSchedule: Schedule | null;
  showForm: boolean;
  showHistory: boolean;
}
```

**Key Features**:
- Grid/list view of schedules
- Real-time search and filtering
- Pagination controls
- Create new schedule button
- Refresh schedules button

#### 2. ScheduleCard Component
**Purpose**: Display individual schedule with actions

**Props**:
```typescript
interface ScheduleCardProps {
  schedule: Schedule;
  onEdit: (schedule: Schedule) => void;
  onDelete: (scheduleId: string) => void;
  onToggleEnabled: (scheduleId: string, enabled: boolean) => void;
  onRunNow: (scheduleId: string) => void;
  onViewHistory: (schedule: Schedule) => void;
}
```

**Display Elements**:
- Schedule name and description
- Cron expression (human-readable)
- Next run time
- Last run status with icon
- Enabled/disabled toggle
- Action buttons (Edit, Delete, Run Now, View History)
- Success rate indicator
- Recipients count

#### 3. ScheduleForm Component
**Purpose**: Create or edit schedule configuration

**Props**:
```typescript
interface ScheduleFormProps {
  schedule?: Schedule; // undefined for create, populated for edit
  onSave: (schedule: ScheduleConfig) => Promise<void>;
  onCancel: () => void;
}
```

**Form Fields**:
- Schedule name (required, text input)
- Description (optional, textarea)
- Report configuration selector (dropdown of saved reports)
- Cron expression (with builder helper)
- Enabled toggle
- Email recipients (multi-input with validation)

**Validation**:
- Name: 1-100 characters, required
- Description: max 500 characters
- Cron expression: valid cron syntax
- Email recipients: valid email format

#### 4. CronBuilder Component
**Purpose**: Help users create cron expressions

**Props**:
```typescript
interface CronBuilderProps {
  value: string;
  onChange: (cronExpression: string) => void;
  error?: string;
}
```

**Features**:
- Preset buttons (Hourly, Daily, Weekly, Monthly, Custom)
- Visual cron expression builder (dropdowns for minute, hour, day, month, weekday)
- Human-readable description
- Next 5 run times preview
- Validation with error messages

**Presets**:
```typescript
const CRON_PRESETS = {
  hourly: '0 * * * *',
  every6hours: '0 */6 * * *',
  every8hours: '0 */8 * * *',
  every12hours: '0 */12 * * *',
  daily: '0 9 * * *', // 9 AM daily
  weekly: '0 9 * * 1', // 9 AM every Monday
  monthly: '0 9 1 * *', // 9 AM on 1st of month
};
```

#### 5. ExecutionHistory Component
**Purpose**: Display execution history for a schedule

**Props**:
```typescript
interface ExecutionHistoryProps {
  scheduleId: string;
  scheduleName: string;
  onClose: () => void;
}
```

**Display Elements**:
- Execution list with status icons
- Start time, end time, duration
- Status (success/failed/running)
- Error messages for failures
- Report file path for successes
- Pagination
- Status filter
- Execution statistics summary

#### 6. StatusIndicator Component
**Purpose**: Visual indicator for schedule/execution status

**Props**:
```typescript
interface StatusIndicatorProps {
  status: 'success' | 'failed' | 'running' | 'disabled';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}
```

**Visual Design**:
- Success: Green checkmark icon
- Failed: Red X icon
- Running: Blue spinner icon
- Disabled: Gray pause icon

## Data Models

### Schedule Interface
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

### ScheduleExecution Interface
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

### ReportConfig Interface
```typescript
interface ReportConfig {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  timeRange: {
    startTime: Date;
    endTime: Date;
  };
  chartTypes: ('line' | 'bar' | 'trend' | 'scatter')[];
  template: string;
  format: 'pdf' | 'docx';
  branding?: {
    companyName?: string;
    logo?: string;
    colors?: {
      primary?: string;
      secondary?: string;
    };
  };
  metadata?: {
    author?: string;
    subject?: string;
    keywords?: string[];
  };
}
```

## API Integration

### API Service Methods

```typescript
// client/src/services/api.ts

export const schedulesAPI = {
  // Get all schedules
  getSchedules: async (params?: {
    page?: number;
    limit?: number;
    enabled?: boolean;
  }): Promise<{
    success: boolean;
    data: Schedule[];
    pagination: PaginationInfo;
  }> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.enabled !== undefined) queryParams.append('enabled', params.enabled.toString());
    
    const response = await fetch(`/api/schedules?${queryParams}`);
    return response.json();
  },

  // Create schedule
  createSchedule: async (config: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>): Promise<{
    success: boolean;
    data: Schedule;
    message: string;
  }> => {
    const response = await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return response.json();
  },

  // Get schedule by ID
  getSchedule: async (id: string): Promise<{
    success: boolean;
    data: Schedule;
  }> => {
    const response = await fetch(`/api/schedules/${id}`);
    return response.json();
  },

  // Update schedule
  updateSchedule: async (id: string, updates: Partial<Schedule>): Promise<{
    success: boolean;
    data: Schedule;
    message: string;
  }> => {
    const response = await fetch(`/api/schedules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return response.json();
  },

  // Delete schedule
  deleteSchedule: async (id: string): Promise<{
    success: boolean;
    message: string;
  }> => {
    const response = await fetch(`/api/schedules/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  },

  // Enable schedule
  enableSchedule: async (id: string): Promise<{
    success: boolean;
    message: string;
  }> => {
    const response = await fetch(`/api/schedules/${id}/enable`, {
      method: 'POST',
    });
    return response.json();
  },

  // Disable schedule
  disableSchedule: async (id: string): Promise<{
    success: boolean;
    message: string;
  }> => {
    const response = await fetch(`/api/schedules/${id}/disable`, {
      method: 'POST',
    });
    return response.json();
  },

  // Manual execution
  executeSchedule: async (id: string): Promise<{
    success: boolean;
    executionId: string;
    status: string;
    message: string;
  }> => {
    const response = await fetch(`/api/schedules/${id}/execute`, {
      method: 'POST',
    });
    return response.json();
  },

  // Get execution history
  getExecutionHistory: async (id: string, params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{
    success: boolean;
    data: ScheduleExecution[];
    pagination: PaginationInfo;
  }> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    
    const response = await fetch(`/api/schedules/${id}/executions?${queryParams}`);
    return response.json();
  },
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Schedule Creation Validation
*For any* schedule creation request with valid inputs (name, cron expression, report config), the system should successfully create the schedule and return a unique schedule ID

**Validates: Requirements 2.9**

### Property 2: Cron Expression Validation
*For any* cron expression input, the system should either accept it as valid or reject it with a specific validation error, never accepting invalid expressions

**Validates: Requirements 2.6, 8.4**

### Property 3: Enable/Disable Idempotence
*For any* schedule, enabling an already-enabled schedule or disabling an already-disabled schedule should succeed without error and maintain the same state

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 4: Email Validation
*For any* email address input, the system should only accept properly formatted email addresses (containing @ and valid domain)

**Validates: Requirements 9.2, 15.3**

### Property 5: Execution History Ordering
*For any* schedule's execution history, executions should be ordered by start time in descending order (most recent first)

**Validates: Requirements 7.2**

### Property 6: Pagination Consistency
*For any* paginated list request, the total count of items across all pages should equal the total count reported in pagination metadata

**Validates: Requirements 1.5, 7.3**

### Property 7: Schedule Update Preserves ID
*For any* schedule update operation, the schedule ID should remain unchanged after the update

**Validates: Requirements 3.4**

### Property 8: Concurrent Execution Limit
*For any* point in time, the number of running schedule executions should never exceed the configured maximum (5)

**Validates: Requirements 14.1**

### Property 9: Search Filter Subset
*For any* search query applied to schedules, the filtered results should be a subset of the unfiltered results

**Validates: Requirements 11.4**

### Property 10: Next Run Time Calculation
*For any* valid cron expression, the calculated next run time should be in the future relative to the current time

**Validates: Requirements 8.4**

## Error Handling

### Frontend Error Handling

**Network Errors**:
- Display user-friendly error messages
- Provide retry buttons for failed operations
- Show loading states during API calls
- Handle timeout scenarios

**Validation Errors**:
- Display inline validation errors on form fields
- Prevent form submission until all validations pass
- Show field-specific error messages

**API Errors**:
- Parse error responses from backend
- Display appropriate error messages
- Log errors for debugging
- Provide fallback UI for critical failures

### Backend Error Handling

**Already Implemented**:
- Cron expression validation
- Database error handling
- Execution retry logic (3 attempts with exponential backoff)
- Concurrent execution limits
- Error logging

## Testing Strategy

### Unit Tests
- Component rendering tests
- Form validation logic
- Cron expression parsing
- Date formatting utilities
- API service methods (mocked)

### Property-Based Tests
- Schedule creation with random valid inputs
- Cron expression validation with generated expressions
- Email validation with generated addresses
- Pagination with random page sizes
- Search filtering with random queries

### Integration Tests
- Full schedule CRUD workflow
- Manual execution flow
- Enable/disable toggle flow
- Execution history retrieval
- Email recipient management

### E2E Tests
- Create schedule → verify in list
- Edit schedule → verify changes
- Delete schedule → verify removal
- Manual execution → verify execution history
- Enable/disable → verify cron job state

## UI/UX Considerations

### Visual Design
- Use consistent color scheme matching existing app
- Status indicators with clear colors (green/red/blue/gray)
- Responsive layout for mobile and desktop
- Loading skeletons for better perceived performance

### User Experience
- Autosave form drafts to prevent data loss
- Confirm destructive actions (delete)
- Provide helpful tooltips for cron expressions
- Show success notifications for actions
- Keyboard shortcuts for common actions

### Accessibility
- ARIA labels for screen readers
- Keyboard navigation support
- Focus management in modals
- Color contrast compliance (WCAG AA)
- Error announcements for screen readers

## Performance Considerations

### Frontend Optimization
- Lazy load execution history
- Debounce search input
- Virtualize long lists if needed
- Cache schedule list data
- Optimize re-renders with React.memo

### Backend Optimization
- Already implemented: SQLite indexing
- Already implemented: Concurrent execution limits
- Already implemented: Queue-based execution
- Already implemented: Efficient cron job management

## Security Considerations

### Authentication & Authorization
- All API endpoints require authentication
- Permission checks for schedule operations
- User can only access their own schedules

### Input Validation
- Sanitize all user inputs
- Validate cron expressions server-side
- Validate email addresses
- Prevent SQL injection (using parameterized queries)
- Limit input lengths

### Data Protection
- Secure email credentials storage
- HTTPS for all API communication
- No sensitive data in logs
- Rate limiting on API endpoints

## Deployment Considerations

### Database Migrations
- SQLite database already initialized by scheduler service
- No additional migrations needed

### Environment Configuration
- Email SMTP settings (already configured)
- Maximum concurrent jobs (already configured)
- Cron timezone settings (UTC)

### Monitoring
- Log all schedule executions
- Track execution success/failure rates
- Monitor queue length
- Alert on high failure rates

## Future Enhancements

### Phase 2 Features
- Schedule templates
- Bulk schedule operations
- Schedule groups/categories
- Advanced cron expression builder with visual calendar
- Schedule execution notifications (in-app)
- Export execution history to CSV
- Schedule performance analytics dashboard
- Conditional scheduling (only run if data available)
- Schedule dependencies (run after another schedule)
- Custom retry policies per schedule
