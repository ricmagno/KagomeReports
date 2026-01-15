# Design Document: Data Preview Table

## Overview

The Data Preview Table feature adds a comprehensive tabular view of time-series data below the existing trends chart in the Report Configuration page. This enhancement provides users with detailed access to the raw data points, including timestamps, values, and quality indicators, enabling better data verification and analysis before report generation.

## Architecture

### Component Hierarchy

```
ReportPreview (existing)
├── TrendsChart (existing)
└── DataPreviewTable (new)
    ├── TableHeader
    │   ├── ColumnHeaders (sortable)
    │   └── ExportButton
    ├── TableBody
    │   ├── DataRow (repeated)
    │   │   ├── TagCell
    │   │   ├── TimestampCell
    │   │   ├── ValueCell
    │   │   └── QualityCell
    │   └── EmptyState
    ├── TableFooter
    │   └── PaginationControls
    └── LoadingOverlay
```

### Data Flow

1. **Data Source**: The table receives the same time-series data used by the TrendsChart component
2. **State Management**: React state manages sorting, pagination, and loading states
3. **Rendering**: Table renders visible rows based on current page and page size
4. **Export**: CSV generation happens client-side using the full dataset

## Components and Interfaces

### DataPreviewTable Component

**Location**: `client/src/components/reports/DataPreviewTable.tsx`

```typescript
interface DataPreviewTableProps {
  data: TimeSeriesData[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

interface TimeSeriesData {
  tagName: string;
  timestamp: Date;
  value: number;
  quality: number;
}

interface TableState {
  sortColumn: 'tagName' | 'timestamp' | 'value' | 'quality';
  sortDirection: 'asc' | 'desc';
  currentPage: number;
  pageSize: number;
}
```

### QualityIndicator Component

**Location**: `client/src/components/reports/QualityIndicator.tsx`

```typescript
interface QualityIndicatorProps {
  qualityCode: number;
  showTooltip?: boolean;
}

// Quality code mappings
const QUALITY_CODES = {
  GOOD: 192,
  BAD: 0,
} as const;

function getQualityStatus(code: number): 'good' | 'bad' | 'uncertain' {
  if (code === QUALITY_CODES.GOOD) return 'good';
  if (code === QUALITY_CODES.BAD) return 'bad';
  return 'uncertain';
}
```

### PaginationControls Component

**Location**: `client/src/components/reports/PaginationControls.tsx`

```typescript
interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}
```

## Data Models

### Extended TimeSeriesData

The existing `TimeSeriesData` interface already contains the necessary fields:

```typescript
// From client/src/types/historian.ts
export interface TimeSeriesData {
  tagName: string;
  timestamp: Date;
  value: number;
  quality: number;
}
```

### Table Configuration

```typescript
interface TableConfig {
  defaultPageSize: number;
  pageSizeOptions: number[];
  maxRowsBeforePagination: number;
  dateTimeFormat: string;
  valueDecimalPlaces: number;
}

const DEFAULT_TABLE_CONFIG: TableConfig = {
  defaultPageSize: 100,
  pageSizeOptions: [50, 100, 200, 500],
  maxRowsBeforePagination: 100,
  dateTimeFormat: 'YYYY-MM-DD HH:mm:ss',
  valueDecimalPlaces: 4,
};
```

### Sort State

```typescript
type SortColumn = 'tagName' | 'timestamp' | 'value' | 'quality';
type SortDirection = 'asc' | 'desc';

interface SortState {
  column: SortColumn;
  direction: SortDirection;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Data Completeness
*For any* time-series dataset provided to the table, all data points should be accessible through pagination, meaning the sum of all paginated rows equals the total dataset size.
**Validates: Requirements 1.1, 5.1**

### Property 2: Sort Stability
*For any* column sort operation, applying the same sort twice should produce identical row ordering.
**Validates: Requirements 6.1, 6.2, 6.5**

### Property 3: Quality Code Mapping
*For any* quality code value, the quality indicator should consistently map to the same visual state (good/bad/uncertain) across all rows.
**Validates: Requirements 3.1, 3.2, 3.3**

### Property 4: Pagination Consistency
*For any* page size selection, the total number of pages multiplied by page size (minus the last page remainder) should equal the total dataset size.
**Validates: Requirements 5.1, 5.4**

### Property 5: Export Completeness
*For any* dataset in the table, the exported CSV should contain exactly the same number of rows as the total dataset, regardless of current page.
**Validates: Requirements 7.2, 7.5**

### Property 6: Timestamp Formatting
*For any* timestamp value, the formatted string should be parseable back to the original date/time within one second precision.
**Validates: Requirements 2.5**

### Property 7: Multi-Tag Identification
*For any* row in the table, the tag name should uniquely identify which data source the row belongs to.
**Validates: Requirements 4.1, 4.2**

### Property 8: Sort Direction Toggle
*For any* sorted column, clicking the header again should reverse the sort direction (asc ↔ desc).
**Validates: Requirements 6.2, 6.3**

### Property 9: Value Precision
*For any* numeric value, the displayed string should maintain the configured decimal precision without rounding errors exceeding 0.0001.
**Validates: Requirements 2.6**

### Property 10: Empty State Display
*For any* empty dataset (length = 0), the table should display the empty state message instead of table rows.
**Validates: Requirements 1.2**

### Property 11: Loading State Non-Blocking
*For any* loading state, the trends chart should remain visible and interactive.
**Validates: Requirements 8.4**

### Property 12: Keyboard Navigation
*For any* focusable table element, pressing Tab should move focus to the next interactive element in logical order.
**Validates: Requirements 10.3**

### Property 13: Page Boundary Validation
*For any* page navigation action, the resulting page number should be within bounds [1, totalPages].
**Validates: Requirements 5.2**

### Property 14: CSV Header Consistency
*For any* exported CSV, the header row should contain exactly the same column names as displayed in the table.
**Validates: Requirements 7.3**

### Property 15: Quality Code Tooltip
*For any* quality indicator with tooltip enabled, hovering should display the quality code meaning.
**Validates: Requirements 3.5**

## Error Handling

### Data Fetch Errors
- Display error message with specific details (network error, timeout, etc.)
- Provide retry button that re-fetches data
- Log errors to console for debugging
- Don't crash the entire Report Preview component

### Rendering Errors
- Use React Error Boundaries to catch rendering errors
- Display fallback UI with error message
- Allow the trends chart to continue functioning
- Log component stack trace for debugging

### Export Errors
- Catch CSV generation errors (memory issues, encoding problems)
- Display user-friendly error message
- Suggest reducing dataset size if memory error
- Provide fallback to export current page only

### Pagination Errors
- Validate page numbers before navigation
- Clamp page numbers to valid range [1, totalPages]
- Reset to page 1 if page size changes
- Handle edge cases (empty dataset, single page)

## Testing Strategy

### Unit Tests
- Test individual components (QualityIndicator, PaginationControls)
- Test utility functions (formatTimestamp, formatValue, sortData)
- Test CSV generation logic
- Test quality code mapping function
- Test pagination calculations

### Property-Based Tests
- Each correctness property will be implemented as a property-based test
- Use fast-check library for generating random test data
- Run minimum 100 iterations per property test
- Tag each test with feature name and property number

### Integration Tests
- Test DataPreviewTable with mock time-series data
- Test sorting interaction with pagination
- Test export functionality with various dataset sizes
- Test responsive behavior at different screen sizes
- Test keyboard navigation through table elements

### Accessibility Tests
- Verify semantic HTML structure
- Test screen reader announcements
- Verify keyboard navigation
- Check color contrast ratios for quality indicators
- Test ARIA labels and roles

## Implementation Notes

### Performance Optimizations

1. **Memoization**: Use `React.useMemo` for sorted and paginated data
2. **Virtualization**: Consider react-window for datasets > 1000 rows
3. **Debouncing**: Debounce sort operations to prevent excessive re-renders
4. **Lazy Loading**: Load data incrementally for very large datasets

### Styling Approach

- Use Tailwind CSS utility classes for consistent styling
- Follow existing design system color palette
- Ensure responsive design with mobile-first approach
- Use Lucide React icons for sort indicators and export button

### Accessibility Considerations

- Use semantic `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>` elements
- Add `aria-sort` attribute to sorted column headers
- Provide `aria-label` for icon-only buttons
- Ensure keyboard navigation with proper `tabIndex`
- Maintain 4.5:1 color contrast ratio for text

### CSV Export Format

```csv
Tag Name,Timestamp,Value,Quality Code
TAG001,2026-01-15 10:30:00,45.6789,192
TAG001,2026-01-15 10:31:00,45.7123,192
TAG002,2026-01-15 10:30:00,23.4567,192
```

### Integration with Existing Code

The DataPreviewTable will be added to the existing `ReportPreview` component:

```typescript
// In client/src/components/reports/ReportPreview.tsx
<div className="space-y-6">
  {/* Existing trends chart */}
  <TrendsChart data={timeSeriesData} />
  
  {/* New data preview table */}
  <DataPreviewTable 
    data={timeSeriesData}
    loading={loading}
    error={error}
    onRetry={handleRetry}
  />
</div>
```

No backend changes are required since the table uses the same data already fetched for the trends chart.
