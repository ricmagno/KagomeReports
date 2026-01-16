# Error Handling in Scheduled Reports

This document describes the error handling implementation for the Scheduled Reports feature.

## Overview

The error handling system provides:
- **Global error boundary** for catching React component errors
- **Enhanced API error handling** with user-friendly messages
- **Automatic retry logic** with exponential backoff
- **Network timeout handling**
- **Categorized error types** for appropriate responses

## Components

### 1. SchedulesErrorBoundary

A React Error Boundary component that catches errors in the schedules section.

**Location**: `client/src/components/schedules/SchedulesErrorBoundary.tsx`

**Features**:
- Catches all React component errors in the schedules tree
- Displays user-friendly error UI
- Provides "Try Again" and "Reload Page" actions
- Shows error details in development mode
- Supports custom fallback UI

**Usage**:
```tsx
import { SchedulesErrorBoundary } from './components/schedules';

<SchedulesErrorBoundary>
  <SchedulesList />
</SchedulesErrorBoundary>
```

### 2. API Error Handler

Utility functions for handling API errors with retry logic.

**Location**: `client/src/utils/apiErrorHandler.ts`

**Features**:
- Categorizes errors by type (Network, Timeout, Authentication, etc.)
- Generates user-friendly error messages
- Determines if errors are retryable
- Implements exponential backoff for retries
- Handles network timeouts

**Error Types**:
- `NETWORK`: Connection failures
- `TIMEOUT`: Request timeouts
- `AUTHENTICATION`: 401 errors
- `AUTHORIZATION`: 403 errors
- `VALIDATION`: 400-499 errors
- `NOT_FOUND`: 404 errors
- `SERVER`: 500+ errors
- `UNKNOWN`: Unclassified errors

**Key Functions**:

```typescript
// Categorize an error
const errorType = categorizeError(error);

// Get user-friendly message
const message = getUserFriendlyMessage(error, 'Loading schedules');

// Check if error is retryable
const canRetry = isRetryableError(error);

// Retry with exponential backoff
await retryWithBackoff(
  () => apiService.getSchedules(),
  {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  }
);

// Fetch with timeout and retry
await fetchWithTimeoutAndRetry(
  () => apiService.getSchedules(),
  {
    timeout: 30000,
    retryConfig: { maxRetries: 3 },
  }
);
```

### 3. useApiWithErrorHandling Hook

Custom React hook for API calls with built-in error handling.

**Location**: `client/src/hooks/useApiWithErrorHandling.ts`

**Features**:
- Manages loading, data, and error states
- Automatic retry with exponential backoff
- Timeout handling
- Success and error callbacks
- Retry count tracking

**Usage**:
```typescript
import { useApiWithErrorHandling } from './hooks/useApiWithErrorHandling';

function MyComponent() {
  const { data, loading, error, execute, retryCount } = useApiWithErrorHandling();

  const loadSchedules = async () => {
    await execute(
      () => apiService.getSchedules(),
      {
        timeout: 30000,
        retryConfig: { maxRetries: 3 },
        context: 'Loading schedules',
        onSuccess: (data) => console.log('Success:', data),
        onError: (message, error) => console.error('Error:', message),
      }
    );
  };

  return (
    <div>
      {loading && <p>Loading... (Retry: {retryCount})</p>}
      {error && <p>Error: {error}</p>}
      {data && <p>Data loaded</p>}
    </div>
  );
}
```

## Retry Configuration

Default retry configuration:
```typescript
{
  maxRetries: 3,
  initialDelay: 1000,      // 1 second
  maxDelay: 10000,         // 10 seconds
  backoffMultiplier: 2,
  retryableErrors: [
    ErrorType.NETWORK,
    ErrorType.TIMEOUT,
    ErrorType.SERVER,
  ],
}
```

**Retry Delays**:
- Attempt 1: 1 second
- Attempt 2: 2 seconds
- Attempt 3: 4 seconds
- Maximum: 10 seconds

## Error Messages

User-friendly error messages are provided for each error type:

| Error Type | Message |
|------------|---------|
| Network | "Unable to connect to the server. Please check your internet connection and try again." |
| Timeout | "The request took too long to complete. Please try again." |
| Authentication | "Your session has expired. Please log in again." |
| Authorization | "You don't have permission to perform this action." |
| Validation | Shows the specific validation error from the API |
| Not Found | "The requested resource was not found." |
| Server | "A server error occurred. Please try again later." |
| Unknown | Shows the error message or "An unexpected error occurred." |

## Integration with SchedulesList

The `SchedulesList` component uses the error handling utilities:

```typescript
import { handleApiError } from '../../utils/apiErrorHandler';

const fetchSchedules = async () => {
  try {
    const response = await apiService.getSchedules(params);
    // Handle success
  } catch (err) {
    const errorMessage = handleApiError(err, 'Failed to load schedules', {
      logToConsole: true,
      showNotification: false,
    });
    setError(errorMessage);
  }
};
```

## Testing

### Unit Tests

**API Error Handler Tests**: `client/src/utils/__tests__/apiErrorHandler.test.ts`
- Tests error categorization
- Tests user-friendly message generation
- Tests retry logic
- Tests exponential backoff calculation

**Error Boundary Tests**: `client/src/components/schedules/__tests__/SchedulesErrorBoundary.test.tsx`
- Tests error catching
- Tests error UI rendering
- Tests reset functionality
- Tests custom fallback

### Running Tests

```bash
# Run all error handling tests
npm test -- apiErrorHandler.test.ts --watchAll=false
npm test -- SchedulesErrorBoundary.test.tsx --watchAll=false
```

## Best Practices

1. **Always wrap API calls in try-catch blocks**
2. **Use handleApiError for consistent error messages**
3. **Provide context in error messages** (e.g., "Failed to load schedules")
4. **Don't retry authentication/authorization errors**
5. **Log errors in development mode**
6. **Show user-friendly messages to users**
7. **Implement loading states during retries**
8. **Handle network offline scenarios**

## Future Enhancements

- [ ] Add error reporting service integration
- [ ] Implement offline queue for failed requests
- [ ] Add circuit breaker pattern for repeated failures
- [ ] Implement request cancellation
- [ ] Add error analytics and monitoring
- [ ] Implement progressive retry delays based on error patterns
