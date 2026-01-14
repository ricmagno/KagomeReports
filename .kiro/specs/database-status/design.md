# Design Document: Database Status Monitoring

## Overview

The Database Status Monitoring feature provides real-time visibility into the health and performance of the AVEVA Historian database through a comprehensive dashboard that displays system tag values. The system leverages AVEVA Historian's built-in system tags to monitor services, errors, storage, I/O statistics, and performance metrics without requiring external monitoring tools.

### Key Design Principles

1. **Real-time Monitoring**: Auto-refresh capability ensures operators always see current system state
2. **Categorized Organization**: System tags grouped by functional category for easy navigation
3. **Visual Indicators**: Color-coded status displays for quick problem identification
4. **Responsive Design**: Works across desktop, tablet, and mobile devices
5. **Performance Optimized**: Efficient batch queries and caching to minimize database load
6. **Export Capability**: Support for data export in multiple formats for reporting

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  StatusDashboard Component                             │ │
│  │  ├─ ErrorCountsCard                                    │ │
│  │  ├─ ServiceStatusCard                                  │ │
│  │  ├─ StorageSpaceCard                                   │ │
│  │  ├─ IOStatisticsCard                                   │ │
│  │  ├─ PerformanceMetricsCard                             │ │
│  │  └─ TrendChartModal                                    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/REST API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Backend (Node.js/Express)                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  /api/status/database Endpoint                         │ │
│  │  ├─ Authentication Middleware                          │ │
│  │  ├─ Request Validation                                 │ │
│  │  └─ Response Formatting                                │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  SystemStatusService                                   │ │
│  │  ├─ getSystemTagValues()                               │ │
│  │  ├─ getSystemTagsByCategory()                          │ │
│  │  ├─ getHistoricalTrends()                              │ │
│  │  └─ exportStatusData()                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ SQL Queries
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              AVEVA Historian Database                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  History Table (Time-series data)                      │ │
│  │  Tag Table (Tag metadata)                              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Initial Load**: Dashboard requests current system tag values via API
2. **Data Retrieval**: Backend queries AVEVA Historian for latest values of system tags
3. **Data Processing**: Backend formats and categorizes tag data
4. **Display**: Frontend renders categorized cards with visual indicators
5. **Auto-Refresh**: Timer triggers periodic updates at configured interval
6. **User Interaction**: Manual refresh, trend viewing, and export operations

## Components and Interfaces

### Backend Components

#### SystemStatusService

**Purpose**: Core service for retrieving and processing system tag data

**Methods**:

```typescript
class SystemStatusService {
  /**
   * Get current values for all monitored system tags
   * @returns Categorized system tag data
   */
  async getSystemTagValues(): Promise<SystemStatusData>

  /**
   * Get system tags filtered by category
   * @param category - Category filter (errors, services, storage, io, performance)
   * @returns Filtered system tag data
   */
  async getSystemTagsByCategory(category: StatusCategory): Promise<SystemTagValue[]>

  /**
   * Get historical trend data for specified tags
   * @param tagNames - Array of system tag names
   * @param timeRange - Time range for historical data
   * @returns Time-series data for each tag
   */
  async getHistoricalTrends(
    tagNames: string[],
    timeRange: TimeRange
  ): Promise<Record<string, TimeSeriesData[]>>

  /**
   * Export current status data in specified format
   * @param format - Export format (csv or json)
   * @returns Formatted export data
   */
  async exportStatusData(format: 'csv' | 'json'): Promise<string>
}
```

**Dependencies**:
- `DataRetrievalService`: For querying AVEVA Historian
- `CacheService`: For caching system tag values
- System tag configuration defining monitored tags

#### API Endpoint: `/api/status/database`

**Purpose**: REST API endpoint for system status data

**Methods**:
- `GET /api/status/database` - Get all system tag values
- `GET /api/status/database?category=errors` - Get filtered by category
- `GET /api/status/database/trends` - Get historical trends
- `GET /api/status/database/export` - Export status data

**Request Parameters**:
```typescript
interface StatusQueryParams {
  category?: 'errors' | 'services' | 'storage' | 'io' | 'performance'
  refresh?: boolean  // Force cache refresh
}

interface TrendsQueryParams {
  tags: string[]  // Comma-separated tag names
  timeRange: 'hour' | '24hours' | '7days'
}

interface ExportQueryParams {
  format: 'csv' | 'json'
}
```

**Response Format**:
```typescript
interface SystemStatusResponse {
  timestamp: Date
  categories: {
    errors: ErrorCountData
    services: ServiceStatusData
    storage: StorageSpaceData
    io: IOStatisticsData
    performance: PerformanceMetricsData
  }
}
```

### Frontend Components

#### StatusDashboard

**Purpose**: Main container component for status monitoring

**Props**:
```typescript
interface StatusDashboardProps {
  autoRefresh?: boolean
  refreshInterval?: number  // seconds, default 30
}
```

**State**:
```typescript
interface StatusDashboardState {
  statusData: SystemStatusResponse | null
  loading: boolean
  error: string | null
  autoRefreshEnabled: boolean
  countdown: number
  selectedTrendTags: string[]
  showTrendModal: boolean
}
```

**Key Methods**:
- `fetchStatusData()`: Load current status from API
- `startAutoRefresh()`: Begin automatic refresh cycle
- `stopAutoRefresh()`: Pause automatic refresh
- `handleManualRefresh()`: Trigger immediate refresh
- `handleExport(format)`: Export current data

#### ErrorCountsCard

**Purpose**: Display error count system tags

**Props**:
```typescript
interface ErrorCountsCardProps {
  data: {
    criticalErrors: number
    fatalErrors: number
    errors: number
    warnings: number
    lastUpdate: Date
  }
}
```

**Visual Indicators**:
- Red highlight when any count > 0
- Display cumulative nature of counts
- Show last update timestamp

#### ServiceStatusCard

**Purpose**: Display Historian service status tags

**Props**:
```typescript
interface ServiceStatusCardProps {
  services: Array<{
    name: string
    tagName: string
    status: 0 | 1 | null
    lastUpdate: Date
  }>
  operationalMode: 'read-only' | 'read-write' | 'unknown'
}
```

**Visual Indicators**:
- Green badge for status = 1 (Good)
- Red badge for status = 0 (Bad)
- Gray badge for status = null (Unknown)
- Operational mode indicator

#### StorageSpaceCard

**Purpose**: Display storage space metrics

**Props**:
```typescript
interface StorageSpaceCardProps {
  storage: Array<{
    path: string
    tagName: string
    spaceMB: number
    lastUpdate: Date
  }>
}
```

**Visual Indicators**:
- Critical alert (red) when space < 500 MB
- Warning (yellow) when space < 1000 MB
- Normal (green) when space >= 1000 MB
- Progress bars showing space utilization

#### IOStatisticsCard

**Purpose**: Display I/O statistics

**Props**:
```typescript
interface IOStatisticsCardProps {
  stats: {
    itemsPerSecond: number
    totalItems: number
    badValuesCount: number
    activeTopics: number
    lastUpdate: Date
  }
}
```

**Visual Indicators**:
- Warning when badValuesCount > 100
- Format numbers with appropriate precision

#### PerformanceMetricsCard

**Purpose**: Display performance metrics

**Props**:
```typescript
interface PerformanceMetricsCardProps {
  metrics: {
    cpuTotal: number  // percentage
    cpuMax: number    // percentage
    availableMemoryMB: number
    diskTime: number  // percentage
    lastUpdate: Date
  }
}
```

**Visual Indicators**:
- Warning when CPU > 80%
- Warning when memory < 500 MB
- Gauge charts for percentages

#### TrendChartModal

**Purpose**: Display historical trends for selected tags

**Props**:
```typescript
interface TrendChartModalProps {
  visible: boolean
  tagNames: string[]
  timeRange: 'hour' | '24hours' | '7days'
  onClose: () => void
}
```

**Features**:
- Line charts for analog tags
- Step charts for discrete tags
- Multi-series comparison
- Time range selector

## Data Models

### System Tag Configuration

```typescript
interface SystemTagConfig {
  category: StatusCategory
  tags: SystemTagDefinition[]
}

interface SystemTagDefinition {
  tagName: string
  description: string
  dataType: 'analog' | 'discrete'
  units?: string
  thresholds?: {
    warning?: number
    critical?: number
  }
  interpretation?: {
    0: string  // e.g., "Bad"
    1: string  // e.g., "Good"
  }
}

enum StatusCategory {
  Errors = 'errors',
  Services = 'services',
  Storage = 'storage',
  IO = 'io',
  Performance = 'performance'
}
```

### System Tag Value

```typescript
interface SystemTagValue {
  tagName: string
  value: number | string | null
  quality: QualityCode
  timestamp: Date
  category: StatusCategory
}
```

### System Status Data

```typescript
interface SystemStatusData {
  timestamp: Date
  errors: {
    critical: SystemTagValue
    fatal: SystemTagValue
    error: SystemTagValue
    warning: SystemTagValue
  }
  services: {
    storage: SystemTagValue
    retrieval: SystemTagValue
    indexing: SystemTagValue
    configuration: SystemTagValue
    replication: SystemTagValue
    eventStorage: SystemTagValue
    operationalMode: SystemTagValue
  }
  storage: {
    main: SystemTagValue
    permanent: SystemTagValue
    buffer: SystemTagValue
    alternate: SystemTagValue
  }
  io: {
    itemsPerSecond: SystemTagValue
    totalItems: SystemTagValue
    badValues: SystemTagValue
    activeTopics: SystemTagValue
  }
  performance: {
    cpuTotal: SystemTagValue
    cpuMax: SystemTagValue
    availableMemory: SystemTagValue
    diskTime: SystemTagValue
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: System Tag Data Completeness
*For any* system tag query result, each data point must contain timestamp, value, and quality code fields.
**Validates: Requirements 1.2**

### Property 2: Category Filtering Correctness
*For any* category filter applied to system tags, all returned tags must belong to the specified category.
**Validates: Requirements 1.5**

### Property 3: Discrete Tag Status Mapping
*For any* discrete tag with value 1, the display must show "Good" with green indicator; for value 0, "Bad" with red indicator; for null, "Unknown" with gray indicator.
**Validates: Requirements 4.2, 4.3, 4.4**

### Property 4: Analog Tag Formatting
*For any* analog tag value displayed, the output must include the numeric value with appropriate units.
**Validates: Requirements 2.4**

### Property 5: Timestamp Display Completeness
*For any* tag displayed in the dashboard, a last update timestamp must be shown.
**Validates: Requirements 2.5, 3.3, 5.5**

### Property 6: Problem Highlighting
*For any* tag value that meets problem criteria (error count > 0, service status = Bad, storage < 1000 MB, bad values > 100, CPU > 80%, memory < 500 MB), the dashboard must apply warning or critical styling.
**Validates: Requirements 2.6, 3.2, 5.3, 5.4, 6.4, 7.3, 7.4**

### Property 7: Storage Space Threshold Warnings
*For any* storage space value less than 1000 MB, a warning indicator must be displayed; for values less than 500 MB, a critical alert indicator must be displayed.
**Validates: Requirements 5.3, 5.4**

### Property 8: Number Formatting Consistency
*For any* numeric metric (items per second, CPU percentage, memory MB), the value must be formatted with consistent precision appropriate to the metric type.
**Validates: Requirements 6.2, 7.1, 7.2**

### Property 9: Auto-Refresh Timing
*For any* configured refresh interval, the dashboard must trigger data refresh at that interval when auto-refresh is enabled.
**Validates: Requirements 8.1**

### Property 10: Auto-Refresh State Management
*For any* auto-refresh state change (pause/resume), the refresh behavior must stop when paused and restart when resumed.
**Validates: Requirements 8.5**

### Property 11: API Response Structure
*For any* successful API call to `/api/status/database`, the response must be valid JSON containing system tag data organized by category.
**Validates: Requirements 9.2**

### Property 12: API Category Filtering
*For any* valid category query parameter, the API must return only tags belonging to that category.
**Validates: Requirements 9.3**

### Property 13: API Authentication
*For any* API request when authentication is required, requests without valid JWT tokens must be rejected with 401 status.
**Validates: Requirements 9.4**

### Property 14: HTTP Status Code Correctness
*For any* API request, the response must include appropriate HTTP status codes (200 for success, 401 for unauthorized, 500 for server errors).
**Validates: Requirements 9.5**

### Property 15: Trend Time Range Handling
*For any* selected time range (hour, 24 hours, 7 days), the trend view must query and display data for exactly that time period.
**Validates: Requirements 10.2**

### Property 16: Multi-Tag Trend Display
*For any* set of selected tags in trend view, all tags must be displayed on the same chart for comparison.
**Validates: Requirements 10.4**

### Property 17: Discrete Tag Trend Visualization
*For any* discrete tag in trend view, state changes over time must be visible in the chart.
**Validates: Requirements 10.5**

### Property 18: Export Format Support
*For any* export operation, both CSV and JSON format options must be available and produce valid output.
**Validates: Requirements 11.2**

### Property 19: Export Data Completeness
*For any* exported file, it must contain tag names, current values, timestamps, quality codes, and metadata (export timestamp, server name, user).
**Validates: Requirements 11.3, 11.4**

### Property 20: Export Error Handling
*For any* failed export operation, an error message must be displayed to the user.
**Validates: Requirements 11.5**

### Property 21: Responsive Layout Adaptation
*For any* viewport width, the dashboard layout must adapt appropriately (grid for desktop, vertical stack for mobile).
**Validates: Requirements 12.1, 12.2, 12.3**

### Property 22: Touch Interaction Support
*For any* mobile device, touch events must work correctly for all interactive elements.
**Validates: Requirements 12.5**

## Error Handling

### Backend Error Scenarios

1. **Database Connection Failure**
   - Retry with exponential backoff
   - Return cached data if available
   - Return 503 Service Unavailable with retry-after header

2. **System Tag Not Found**
   - Return null value with quality code indicating unavailable
   - Log warning for monitoring
   - Continue processing other tags

3. **Query Timeout**
   - Cancel long-running queries after 30 seconds
   - Return partial results if available
   - Log timeout for investigation

4. **Invalid Category Filter**
   - Return 400 Bad Request with error details
   - Provide list of valid categories in error message

5. **Authentication Failure**
   - Return 401 Unauthorized
   - Include WWW-Authenticate header
   - Log failed authentication attempts

### Frontend Error Scenarios

1. **API Request Failure**
   - Display error message in dashboard
   - Retry automatically after delay
   - Provide manual retry button

2. **Data Parsing Error**
   - Log error details
   - Display fallback UI with error state
   - Prevent dashboard crash

3. **Auto-Refresh Failure**
   - Pause auto-refresh
   - Notify user of issue
   - Allow manual refresh attempt

4. **Export Failure**
   - Display error toast notification
   - Provide error details
   - Allow retry

5. **Chart Rendering Error**
   - Display error message in chart area
   - Log error for debugging
   - Prevent modal crash

## Testing Strategy

### Unit Testing

**Backend Unit Tests**:
- `SystemStatusService.getSystemTagValues()` - Test data retrieval and categorization
- `SystemStatusService.getSystemTagsByCategory()` - Test category filtering
- `SystemStatusService.getHistoricalTrends()` - Test time range queries
- `SystemStatusService.exportStatusData()` - Test CSV and JSON export formatting
- API endpoint handlers - Test request validation and response formatting
- Error handling - Test all error scenarios

**Frontend Unit Tests**:
- Component rendering - Test each card component renders correctly with data
- Status mapping - Test discrete tag value to status text/color mapping
- Threshold logic - Test warning/critical threshold calculations
- Formatting functions - Test number formatting, unit display
- Auto-refresh logic - Test timer management and state transitions
- Export functionality - Test export button and format selection

### Property-Based Testing

**Property Tests** (minimum 100 iterations each):

1. **Test System Tag Data Completeness** (Property 1)
   - Generate random system tag query results
   - Verify each data point has timestamp, value, and quality fields
   - **Feature: database-status, Property 1: System Tag Data Completeness**

2. **Test Category Filtering** (Property 2)
   - Generate random category filters
   - Verify all returned tags belong to specified category
   - **Feature: database-status, Property 2: Category Filtering Correctness**

3. **Test Discrete Tag Mapping** (Property 3)
   - Generate random discrete tag values (0, 1, null)
   - Verify correct status text and color for each value
   - **Feature: database-status, Property 3: Discrete Tag Status Mapping**

4. **Test Threshold Warnings** (Property 6, 7)
   - Generate random metric values across threshold boundaries
   - Verify correct warning/critical styling applied
   - **Feature: database-status, Property 6: Problem Highlighting**

5. **Test Number Formatting** (Property 8)
   - Generate random numeric values for different metric types
   - Verify consistent formatting with appropriate precision
   - **Feature: database-status, Property 8: Number Formatting Consistency**

6. **Test API Response Structure** (Property 11)
   - Generate random API requests
   - Verify response is valid JSON with correct structure
   - **Feature: database-status, Property 11: API Response Structure**

7. **Test Export Data Completeness** (Property 19)
   - Generate random export operations
   - Verify exported files contain all required fields
   - **Feature: database-status, Property 19: Export Data Completeness**

8. **Test Responsive Layout** (Property 21)
   - Generate random viewport widths
   - Verify layout adapts correctly for each width
   - **Feature: database-status, Property 21: Responsive Layout Adaptation**

### Integration Testing

1. **End-to-End Dashboard Flow**
   - Load dashboard → Verify all categories display
   - Trigger manual refresh → Verify data updates
   - Enable auto-refresh → Verify periodic updates
   - View trends → Verify historical data loads
   - Export data → Verify file downloads correctly

2. **API Integration**
   - Test all API endpoints with real database
   - Verify authentication flow
   - Test category filtering
   - Test error responses

3. **Database Integration**
   - Test querying actual AVEVA Historian system tags
   - Verify data retrieval performance
   - Test with missing tags
   - Test with various data quality codes

### Performance Testing

1. **Query Performance**
   - Measure time to retrieve all system tags
   - Target: < 2 seconds for full status query
   - Test with database under load

2. **Dashboard Rendering**
   - Measure time to render full dashboard
   - Target: < 1 second initial render
   - Test with large datasets

3. **Auto-Refresh Impact**
   - Measure resource usage during auto-refresh
   - Verify no memory leaks over extended periods
   - Test with multiple concurrent users

4. **Export Performance**
   - Measure time to generate exports
   - Target: < 5 seconds for CSV/JSON export
   - Test with maximum data volumes

## Implementation Notes

### System Tag Configuration

The system will monitor the following AVEVA Historian system tags:

**Error Counts**:
- `SysCritErrCnt` - Critical errors
- `SysFatalErrCnt` - Fatal errors
- `SysErrErrCnt` - Non-fatal errors
- `SysWarnErrCnt` - Warnings

**Service Status**:
- `SysStorage` - Storage process status
- `SysRetrieval` - Retrieval service status
- `SysIndexing` - Indexing service status
- `SysConfiguration` - Configuration service status
- `SysReplication` - Replication service status
- `SysEventStorage` - Event storage service status
- `SysStatusMode` - Operational mode (read-only/read-write)

**Storage Space**:
- `SysSpaceMain` - Circular storage space (MB)
- `SysSpacePerm` - Permanent storage space (MB)
- `SysSpaceBuffer` - Buffer storage space (MB)
- `SysSpaceAlt` - Alternate storage space (MB)

**I/O Statistics**:
- `SysDataAcqOverallItemsPerSec` - Items per second
- `SysStatusRxTotalItems` - Total items received
- `SysDataAcqNBadValues` - Bad values count (N=0 for MDAS)
- `SysStatusTopicsRxData` - Active data topics

**Performance Metrics**:
- `SysPerfCPUTotal` - Overall CPU percentage
- `SysPerfCPUMax` - Maximum single core CPU percentage
- `SysPerfAvailableMBytes` - Available memory (MB)
- `SysPerfDiskTime` - Disk busy percentage

### Caching Strategy

- Cache system tag values for 10 seconds
- Invalidate cache on manual refresh
- Use in-memory cache for fast access
- Cache key: `system-status:{category}`

### Query Optimization

- Batch all system tag queries into single database call
- Use `wwRetrievalMode='Cyclic'` with `wwCycleCount=1` to get latest value
- Query only tags that have changed since last update (if supported)
- Use connection pooling for concurrent requests

### Security Considerations

- Require authentication for all API endpoints
- Validate JWT tokens on every request
- Rate limit API calls to prevent abuse (100 requests/minute per user)
- Sanitize all query parameters
- Log all access for audit trail

### Accessibility

- Use semantic HTML elements
- Provide ARIA labels for all interactive elements
- Ensure keyboard navigation works for all controls
- Maintain 4.5:1 color contrast ratio for text
- Support screen readers with descriptive labels
- Provide text alternatives for visual indicators

### Browser Compatibility

- Support modern browsers: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Use polyfills for older browser support if needed
- Test responsive design on iOS and Android devices
- Ensure touch interactions work on mobile browsers

## Dependencies

### Backend Dependencies
- `express` - Web framework
- `mssql` - SQL Server driver for AVEVA Historian
- `jsonwebtoken` - JWT authentication
- `csv-stringify` - CSV export generation
- Existing `DataRetrievalService` - For querying Historian
- Existing `CacheService` - For caching tag values

### Frontend Dependencies
- `react` - UI framework
- `recharts` or `chart.js` - Chart visualization
- `tailwindcss` - Styling
- `lucide-react` - Icons
- `date-fns` - Date formatting
- `axios` - HTTP client

## Deployment Considerations

1. **Configuration**
   - Add system tag list to configuration file
   - Configure refresh intervals
   - Set cache TTL values
   - Configure authentication requirements

2. **Monitoring**
   - Log all API requests and response times
   - Monitor cache hit rates
   - Track dashboard usage metrics
   - Alert on repeated query failures

3. **Scaling**
   - Cache system tag values to reduce database load
   - Use CDN for static frontend assets
   - Consider read replicas for high-traffic scenarios
   - Implement request queuing for burst traffic

4. **Maintenance**
   - Document system tag additions/changes
   - Provide admin interface for tag configuration
   - Include health check endpoint
   - Support graceful degradation when tags unavailable
