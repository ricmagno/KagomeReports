# Scheduled Reports Components

This directory contains all React components for the Scheduled Reports feature, which enables users to automate report generation and delivery on recurring schedules.

## Overview

The Scheduled Reports feature provides a comprehensive UI for managing automated report generation. Users can create, edit, delete, enable/disable, and monitor scheduled reports that automatically generate and optionally email reports at specified intervals using cron expressions.

## Component Architecture

```
SchedulesList (Main Container)
├── ScheduleCard (Individual Schedule Display)
│   └── StatusIndicator (Status Visual)
├── ScheduleForm (Create/Edit Form)
│   └── CronBuilder (Cron Expression Helper)
├── ExecutionHistory (Execution Records)
│   └── StatusIndicator (Status Visual)
└── ScheduleCardSkeleton (Loading State)
```

## Components

### SchedulesList

**File**: `SchedulesList.tsx`

**Purpose**: Main container component that displays all schedules with search, filter, and pagination capabilities.

**Key Features**:
- Grid/list view of all schedules
- Real-time search by name/description
- Filter by enabled/disabled status
- Filter by last execution status
- Pagination with configurable page size
- Create new schedule button
- Refresh schedules button
- Loading states with skeleton loaders
- Error handling with retry
- Empty state with call-to-action

**Props**:
```typescript
interface SchedulesListProps {
  className?: string;
}
```

**State Management**:
- Schedules list
- Loading and error states
- Search query (debounced)
- Filter states
- Pagination state
- UI state (form visibility, history visibility)
- Action loading states (toggling, running, deleting)

**Usage**:
```tsx
import { SchedulesList } from './components/schedules/SchedulesList';

<SchedulesList className="custom-class" />
```

---

### ScheduleCard

**File**: `ScheduleCard.tsx`

**Purpose**: Displays an individual schedule with all its information and action buttons.

**Key Features**:
- Schedule name and description
- Cron expression (human-readable)
- Next run time
- Last run status with icon
- Enabled/disabled toggle
- Action buttons (Edit, Delete, Run Now, View History)
- Success rate indicator
- Recipients count
- Error message display
- Optimistic UI updates
- Memoized for performance

**Props**:
```typescript
interface ScheduleCardProps {
  schedule: Schedule;
  onEdit: (schedule: Schedule) => void;
  onDelete: () => void;
  onToggleEnabled: (scheduleId: string, enabled: boolean) => Promise<void>;
  onRunNow: (scheduleId: string) => Promise<void>;
  onViewHistory: (schedule: Schedule) => void;
  className?: string;
  isTogglingEnabled?: boolean;
  isRunning?: boolean;
}
```

**Usage**:
```tsx
<ScheduleCard
  schedule={schedule}
  onEdit={handleEdit}
  onDelete={handleDelete}
  onToggleEnabled={handleToggle}
  onRunNow={handleRunNow}
  onViewHistory={handleViewHistory}
  isTogglingEnabled={togglingSchedules.has(schedule.id)}
  isRunning={runningSchedules.has(schedule.id)}
/>
```

---

### ScheduleForm

**File**: `ScheduleForm.tsx`

**Purpose**: Form component for creating new schedules or editing existing ones.

**Key Features**:
- Schedule name input (required, 1-100 characters)
- Description textarea (optional, max 500 characters)
- Report configuration selector
- Cron expression builder integration
- Enabled/disabled toggle
- Email recipients management (add/remove)
- Form validation
- Loading states
- Error display
- Memoized for performance

**Props**:
```typescript
interface ScheduleFormProps {
  schedule?: Schedule;
  reportConfigs?: ReportConfig[];
  onSave: (schedule: ScheduleConfig) => Promise<void>;
  onCancel: () => void;
  className?: string;
}
```

**Validation Rules**:
- Name: 1-100 characters, required
- Description: max 500 characters, optional
- Report config: required
- Cron expression: valid cron syntax, required
- Recipients: at least one valid email, required

**Usage**:
```tsx
<ScheduleForm
  schedule={selectedSchedule}
  reportConfigs={reportConfigs}
  onSave={handleSave}
  onCancel={handleCancel}
/>
```

---

### CronBuilder

**File**: `CronBuilder.tsx`

**Purpose**: Interactive cron expression builder with presets and validation.

**Key Features**:
- Preset buttons for common schedules
- Custom cron expression input
- Human-readable description
- Next 5 run times preview
- Real-time validation
- Error messages
- Memoized for performance

**Props**:
```typescript
interface CronBuilderProps {
  value: string;
  onChange: (cronExpression: string) => void;
  error?: string;
  className?: string;
}
```

**Presets**:
- Hourly: `0 * * * *`
- Every 6 Hours: `0 */6 * * *`
- Every 8 Hours: `0 */8 * * *`
- Every 12 Hours: `0 */12 * * *`
- Daily: `0 9 * * *`
- Weekly: `0 9 * * 1`
- Monthly: `0 9 1 * *`
- Custom: User-defined

**Usage**:
```tsx
<CronBuilder
  value={cronExpression}
  onChange={setCronExpression}
  error={validationError}
/>
```

---

### ExecutionHistory

**File**: `ExecutionHistory.tsx`

**Purpose**: Displays execution history for a specific schedule with filtering and pagination.

**Key Features**:
- Execution list with status icons
- Start time, end time, duration
- Status (success/failed/running)
- Error messages for failures
- Report file path for successes
- Pagination
- Status filter
- Execution statistics summary
- Memoized for performance

**Props**:
```typescript
interface ExecutionHistoryProps {
  scheduleId: string;
  scheduleName: string;
  onClose: () => void;
  onFetchHistory: (
    scheduleId: string,
    params: ExecutionHistoryParams
  ) => Promise<{
    executions: ScheduleExecution[];
    total: number;
    page: number;
    totalPages: number;
  }>;
  className?: string;
}
```

**Statistics Displayed**:
- Total executions
- Successful executions
- Failed executions
- Success rate percentage

**Usage**:
```tsx
<ExecutionHistory
  scheduleId={schedule.id}
  scheduleName={schedule.name}
  onClose={handleClose}
  onFetchHistory={fetchHistory}
/>
```

---

### StatusIndicator

**File**: `StatusIndicator.tsx`

**Purpose**: Visual indicator for schedule/execution status with icons and colors.

**Key Features**:
- Status-specific icons and colors
- Multiple sizes (sm, md, lg)
- Optional label display
- Accessible with ARIA labels
- Memoized for performance

**Props**:
```typescript
interface StatusIndicatorProps {
  status: 'success' | 'failed' | 'running' | 'disabled';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}
```

**Status Styles**:
- Success: Green checkmark icon
- Failed: Red X icon
- Running: Blue spinner icon (animated)
- Disabled: Gray pause icon

**Usage**:
```tsx
<StatusIndicator 
  status="success" 
  size="md" 
  showLabel={true} 
/>
```

---

### ScheduleCardSkeleton

**File**: `ScheduleCardSkeleton.tsx`

**Purpose**: Loading skeleton for schedule cards during data fetching.

**Key Features**:
- Matches ScheduleCard layout
- Animated shimmer effect
- Responsive design

**Usage**:
```tsx
{loading && (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {Array.from({ length: 10 }).map((_, index) => (
      <ScheduleCardSkeleton key={index} />
    ))}
  </div>
)}
```

---

### SchedulesErrorBoundary

**File**: `SchedulesErrorBoundary.tsx`

**Purpose**: Error boundary component for catching and displaying errors in the schedules section.

**Key Features**:
- Catches React errors
- Displays user-friendly error message
- Provides retry button
- Logs errors to console

**Usage**:
```tsx
<SchedulesErrorBoundary>
  <SchedulesList />
</SchedulesErrorBoundary>
```

---

## Utility Functions

### Cron Utilities (`cronUtils.ts`)

**Functions**:
- `validateCronExpression(cronExpression: string): boolean` - Validates cron syntax
- `getCronDescription(cronExpression: string): string` - Converts cron to human-readable text
- `getNextRunTimes(cronExpression: string, count: number): Date[]` - Calculates next run times
- `getCronPreset(cronExpression: string): CronPreset | undefined` - Finds matching preset
- `isPresetCron(cronExpression: string): boolean` - Checks if expression matches a preset

**Constants**:
- `CRON_PRESETS: CronPreset[]` - Array of predefined cron expressions

### Date/Time Utilities (`dateTimeUtils.ts`)

**Functions**:
- `formatTimestamp(date: Date): string` - Formats date as readable timestamp
- `formatDate(date: Date): string` - Formats date as short date string
- `formatTime(date: Date): string` - Formats date as time string
- `formatRelativeTime(date: Date): string` - Formats as relative time (e.g., "2 hours ago")
- `formatDuration(startDate: Date, endDate: Date): string` - Formats duration between dates
- `formatDurationMs(durationMs: number): string` - Formats milliseconds as duration
- `getTimezoneAbbreviation(date: Date): string` - Gets timezone abbreviation
- `getTimezoneOffset(date: Date): string` - Gets timezone offset string
- `isToday(date: Date): boolean` - Checks if date is today
- `isPast(date: Date): boolean` - Checks if date is in the past
- `isFuture(date: Date): boolean` - Checks if date is in the future

### Validation Utilities (`validationUtils.ts`)

**Functions**:
- `validateEmail(email: string): ValidationResult` - Validates email format
- `validateEmails(emails: string[]): ValidationResult` - Validates multiple emails
- `validateScheduleName(name: string): ValidationResult` - Validates schedule name
- `validateScheduleDescription(description?: string): ValidationResult` - Validates description
- `validateRequired(value: any, fieldName: string): ValidationResult` - Validates required field
- `validateLength(value: string, min: number, max: number): ValidationResult` - Validates string length
- `validateUrl(url: string): ValidationResult` - Validates URL format
- `validateRange(value: number, min: number, max: number): ValidationResult` - Validates number range
- `validateFutureDate(date: Date): ValidationResult` - Validates date is in future
- `validateScheduleConfig(config: object): ValidationResult` - Validates complete schedule config

## API Integration

All schedule operations are handled through the `apiService` in `client/src/services/api.ts`:

**Schedule Endpoints**:
- `getSchedules(params?: ScheduleListParams)` - Get all schedules with filtering
- `getSchedule(id: string)` - Get single schedule by ID
- `createSchedule(config: ScheduleConfig)` - Create new schedule
- `updateSchedule(id: string, updates: ScheduleUpdatePayload)` - Update schedule
- `deleteSchedule(id: string)` - Delete schedule
- `enableSchedule(id: string)` - Enable schedule
- `disableSchedule(id: string)` - Disable schedule
- `executeSchedule(id: string)` - Manually execute schedule (Run Now)
- `getExecutionHistory(id: string, params?: ExecutionHistoryParams)` - Get execution history
- `getExecutionStatistics(id: string)` - Get execution statistics
- `getSchedulerHealth()` - Get scheduler system health

## Type Definitions

All TypeScript interfaces are defined in `client/src/types/schedule.ts`:

**Main Types**:
- `Schedule` - Complete schedule object
- `ScheduleExecution` - Execution record
- `ScheduleConfig` - Schedule creation payload
- `ScheduleUpdatePayload` - Schedule update payload
- `ExecutionHistoryParams` - Execution history query params
- `ScheduleListParams` - Schedule list query params
- `ExecutionStatistics` - Execution statistics summary
- `SchedulerHealth` - Scheduler system health
- `PaginationInfo` - Pagination metadata

## State Management

The components use React hooks for state management:

**useState**: Local component state
**useEffect**: Side effects (data fetching, subscriptions)
**useCallback**: Memoized callbacks to prevent unnecessary re-renders
**useMemo**: Memoized values for expensive computations
**Custom Hooks**:
- `useDebounce` - Debounces values (e.g., search input)
- `useToast` - Toast notification management
- `useApiWithErrorHandling` - API calls with error handling

## Performance Optimizations

1. **Memoization**: All components use `React.memo` with custom comparison functions
2. **Debouncing**: Search input is debounced with 300ms delay
3. **Optimistic Updates**: Toggle actions update UI immediately
4. **Lazy Loading**: Execution history is loaded on demand
5. **Pagination**: Large lists are paginated to reduce rendering load
6. **Skeleton Loaders**: Improve perceived performance during loading

## Accessibility

All components follow WCAG 2.1 AA standards:

- **Keyboard Navigation**: All interactive elements are keyboard accessible
- **ARIA Labels**: Proper ARIA labels for screen readers
- **Focus Management**: Focus is managed in modals and forms
- **Color Contrast**: All text meets 4.5:1 contrast ratio
- **Screen Reader Support**: Status updates announced with `aria-live`
- **Semantic HTML**: Proper use of semantic elements

## Error Handling

Errors are handled at multiple levels:

1. **Component Level**: Try-catch blocks with user-friendly messages
2. **API Level**: Centralized error handling in `apiService`
3. **Error Boundary**: Catches React errors and displays fallback UI
4. **Validation**: Form validation prevents invalid submissions
5. **Network Errors**: Retry logic for failed requests

## Testing

Components have comprehensive test coverage:

**Unit Tests** (`__tests__/`):
- Component rendering
- User interactions
- Form validation
- Utility functions

**Integration Tests**:
- Full CRUD workflows
- Schedule execution flow
- Enable/disable toggle flow

**Accessibility Tests**:
- Keyboard navigation
- Screen reader compatibility
- ARIA attributes
- Color contrast

## Styling

Components use Tailwind CSS for styling:

- **Utility Classes**: Tailwind utility classes for rapid development
- **Responsive Design**: Mobile-first responsive breakpoints
- **Design Tokens**: Consistent colors, spacing, and typography
- **Dark Mode**: (Future enhancement)

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile browsers: iOS Safari, Chrome Mobile

## Future Enhancements

Planned features for future releases:

1. **Schedule Templates**: Pre-configured schedule templates
2. **Bulk Operations**: Bulk enable/disable/delete
3. **Schedule Groups**: Organize schedules into categories
4. **Advanced Cron Builder**: Visual calendar-based builder
5. **In-App Notifications**: Real-time execution notifications
6. **Export History**: Export execution history to CSV
7. **Analytics Dashboard**: Schedule performance analytics
8. **Conditional Scheduling**: Run only if data available
9. **Schedule Dependencies**: Chain schedules together
10. **Custom Retry Policies**: Per-schedule retry configuration

## Troubleshooting

### Common Issues

**Issue**: Schedules not appearing
- **Solution**: Check network connection, refresh the page, verify API is running

**Issue**: Cron expression validation fails
- **Solution**: Use preset buttons, check cron format, refer to CRON_GUIDE.md

**Issue**: Email recipients not saving
- **Solution**: Verify email format, check for duplicates, ensure at least one recipient

**Issue**: Schedule not running
- **Solution**: Check if schedule is enabled, verify cron expression, check execution history for errors

**Issue**: Performance issues with many schedules
- **Solution**: Use search/filter to narrow results, increase pagination limit

## Contributing

When adding new features or fixing bugs:

1. Follow existing code patterns and conventions
2. Add JSDoc comments to all functions
3. Write unit tests for new components
4. Update this README with new features
5. Ensure accessibility compliance
6. Test on multiple browsers and screen sizes

## Resources

- [Cron Expression Guide](./CRON_GUIDE.md) - Comprehensive cron expression documentation
- [Accessibility Guide](./ACCESSIBILITY.md) - Accessibility implementation details
- [Error Handling Guide](./ERROR_HANDLING.md) - Error handling patterns
- [API Documentation](../../services/api.ts) - API service documentation
- [Type Definitions](../../types/schedule.ts) - TypeScript interfaces

## Support

For questions or issues:
1. Check this README and related documentation
2. Review the cron expression guide
3. Check execution history for error messages
4. Contact the development team
