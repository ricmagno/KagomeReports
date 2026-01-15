# Implementation Plan: Data Preview Table

## Overview

This implementation plan breaks down the Data Preview Table feature into incremental, testable tasks. The table will display time-series data below the trends chart in the Report Configuration page, with sorting, pagination, quality indicators, and CSV export capabilities.

## Tasks

- [x] 1. Create utility functions and helpers
  - Create formatting utilities for timestamps and numeric values
  - Create sorting utility function for table data
  - Create CSV generation utility function
  - Create quality code mapping utility
  - _Requirements: 2.5, 2.6, 3.1, 3.2, 3.3, 7.2, 7.3_

- [ ]* 1.1 Write property tests for utility functions
  - **Property 6: Timestamp Formatting** - Round-trip timestamp formatting
  - **Property 9: Value Precision** - Numeric precision validation
  - **Property 3: Quality Code Mapping** - Consistent quality mapping
  - **Validates: Requirements 2.5, 2.6, 3.1, 3.2, 3.3**

- [x] 2. Implement QualityIndicator component
  - [x] 2.1 Create QualityIndicator component with visual states
    - Implement good (green), bad (red), uncertain (yellow) indicators
    - Add quality code number display
    - Style with Tailwind CSS
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 2.2 Add tooltip functionality
    - Implement hover tooltip with quality code explanation
    - Add ARIA labels for accessibility
    - _Requirements: 3.5, 10.2_

- [ ]* 2.3 Write unit tests for QualityIndicator
  - Test all three quality states render correctly
  - Test tooltip display on hover
  - Test accessibility attributes
  - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 3. Implement PaginationControls component
  - [x] 3.1 Create pagination UI
    - Implement previous/next buttons
    - Add page number display
    - Add page size selector dropdown
    - Style with Tailwind CSS and Lucide icons
    - _Requirements: 5.2, 5.3, 5.4_

  - [x] 3.2 Implement pagination logic
    - Handle page navigation with boundary validation
    - Handle page size changes
    - Calculate total pages from dataset size
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 3.3 Add keyboard navigation support
    - Support Tab navigation through controls
    - Add ARIA labels for screen readers
    - _Requirements: 10.2, 10.3_

- [ ]* 3.4 Write property tests for pagination
  - **Property 4: Pagination Consistency** - Page size calculations
  - **Property 13: Page Boundary Validation** - Page number bounds
  - **Validates: Requirements 5.1, 5.2, 5.4**

- [x] 4. Implement DataPreviewTable component structure
  - [x] 4.1 Create main table component with props interface
    - Define TypeScript interfaces for props and state
    - Set up component skeleton with table structure
    - Add loading and error states
    - _Requirements: 1.1, 8.1, 8.2_

  - [x] 4.2 Implement table header with sortable columns
    - Create column headers (Tag Name, Timestamp, Value, Quality)
    - Add sort indicators (arrows) to headers
    - Implement click handlers for sorting
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 6.1, 6.3_

  - [x] 4.3 Implement table body with data rows
    - Render data rows with proper cell formatting
    - Integrate QualityIndicator component
    - Apply timestamp and value formatting
    - Handle empty state display
    - _Requirements: 1.2, 2.5, 2.6, 4.1, 4.2_

  - [x] 4.4 Add responsive styling
    - Implement mobile-first responsive design
    - Add horizontal scroll for narrow screens
    - Ensure touch-friendly interactions
    - _Requirements: 1.4_

- [ ]* 4.5 Write unit tests for table structure
  - Test table renders with mock data
  - Test empty state display
  - Test loading state display
  - Test error state display
  - _Requirements: 1.1, 1.2, 8.1, 8.2_

- [x] 5. Implement sorting functionality
  - [x] 5.1 Add sorting state management
    - Create state for sort column and direction
    - Implement sort toggle logic (asc ↔ desc)
    - Update UI to show current sort state
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 5.2 Implement data sorting
    - Sort by tag name (alphabetical)
    - Sort by timestamp (chronological)
    - Sort by value (numerical)
    - Sort by quality code (numerical)
    - Maintain sort state across pagination
    - _Requirements: 6.4, 6.5_

- [ ]* 5.3 Write property tests for sorting
  - **Property 2: Sort Stability** - Consistent sort results
  - **Property 8: Sort Direction Toggle** - Direction reversal
  - **Validates: Requirements 6.1, 6.2, 6.3, 6.5**

- [x] 6. Implement pagination functionality
  - [x] 6.1 Add pagination state management
    - Create state for current page and page size
    - Implement page change handlers
    - Implement page size change handlers
    - _Requirements: 5.1, 5.4_

  - [x] 6.2 Implement data slicing for current page
    - Calculate start and end indices for current page
    - Slice data array to show only current page
    - Update when page or page size changes
    - _Requirements: 5.1_

  - [x] 6.3 Integrate PaginationControls component
    - Add pagination controls to table footer
    - Wire up event handlers
    - Show/hide pagination based on dataset size
    - _Requirements: 5.1, 5.2, 5.3_

- [ ]* 6.4 Write property tests for pagination
  - **Property 1: Data Completeness** - All data accessible through pages
  - **Validates: Requirements 1.1, 5.1**

- [x] 7. Implement CSV export functionality
  - [x] 7.1 Create CSV generation logic
    - Generate CSV string from full dataset
    - Include column headers
    - Format timestamps and values appropriately
    - Handle special characters and escaping
    - _Requirements: 7.2, 7.3_

  - [x] 7.2 Add export button and download trigger
    - Add export button to table header
    - Implement file download with proper filename
    - Add loading state during export
    - Handle export errors gracefully
    - _Requirements: 7.1, 7.4, 8.2_

- [ ]* 7.3 Write property tests for CSV export
  - **Property 5: Export Completeness** - All rows in CSV
  - **Property 14: CSV Header Consistency** - Matching headers
  - **Validates: Requirements 7.2, 7.3, 7.5**

- [x] 8. Implement multi-tag support
  - [x] 8.1 Ensure tag identification in rows
    - Display tag name clearly in each row
    - Support data from multiple tags
    - _Requirements: 4.1, 4.2_

  - [x] 8.2 Add tag-based grouping or highlighting
    - Consider alternating row colors by tag
    - Ensure visual distinction between tags
    - _Requirements: 4.3_

- [ ]* 8.3 Write property tests for multi-tag display
  - **Property 7: Multi-Tag Identification** - Unique tag identification
  - **Validates: Requirements 4.1, 4.2**

- [x] 9. Add accessibility features
  - [x] 9.1 Implement semantic HTML structure
    - Use proper table elements (table, thead, tbody, tr, th, td)
    - Add appropriate ARIA attributes
    - _Requirements: 10.1, 10.2_

  - [x] 9.2 Add keyboard navigation
    - Support Tab navigation through interactive elements
    - Add focus styles for keyboard users
    - _Requirements: 10.3_

  - [x] 9.3 Add screen reader support
    - Add aria-sort to column headers
    - Add aria-label to icon-only buttons
    - Announce sort changes
    - _Requirements: 10.2, 10.4_

  - [x] 9.4 Ensure color contrast
    - Verify quality indicators meet contrast requirements
    - Test with accessibility tools
    - _Requirements: 10.5_

- [ ]* 9.5 Write accessibility tests
  - Test semantic HTML structure
  - Test ARIA attributes
  - Test keyboard navigation
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 10. Integrate DataPreviewTable into ReportPreview
  - [x] 10.1 Add DataPreviewTable to ReportPreview component
    - Import and render DataPreviewTable below TrendsChart
    - Pass time-series data as props
    - Pass loading and error states
    - _Requirements: 1.1_

  - [x] 10.2 Handle data flow from parent component
    - Ensure data is available when table renders
    - Handle data updates when report config changes
    - _Requirements: 1.1_

  - [x] 10.3 Add retry functionality
    - Implement retry handler for data fetch errors
    - Pass retry function to table component
    - _Requirements: 8.3_

- [ ]* 10.4 Write integration tests
  - Test table integration with ReportPreview
  - Test data flow from parent to table
  - Test retry functionality
  - _Requirements: 1.1, 8.3, 8.4_

- [x] 11. Performance optimization
  - [x] 11.1 Add memoization for expensive calculations
    - Memoize sorted data with useMemo
    - Memoize paginated data with useMemo
    - Memoize formatted values where appropriate
    - _Requirements: 9.1, 9.3_

  - [x] 11.2 Consider virtualization for large datasets
    - Evaluate need for react-window or similar
    - Implement if dataset size warrants it
    - _Requirements: 9.2_

- [ ]* 11.3 Write performance tests
  - Test rendering performance with large datasets
  - Test sort performance
  - Test pagination performance
  - _Requirements: 9.1, 9.2_

- [x] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The table uses existing time-series data, so no backend changes are needed
- Focus on incremental development with early integration into ReportPreview
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
