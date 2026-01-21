# Implementation Plan: Advanced Chart Analytics and SPC

## Overview

This implementation plan breaks down the Advanced Chart Analytics and SPC feature into discrete coding tasks. The approach follows an incremental development strategy: first implementing core analytics calculations, then enhancing chart generation, and finally integrating everything into the PDF report generation pipeline. Each task builds on previous work and includes validation through tests.

## Tasks

- [ ] 1. Implement Tag Classification Service
  - Create `src/services/tagClassificationService.ts` with tag type detection logic
  - Implement `classifyTag()` function to distinguish analog from digital tags
  - Implement `classifyTags()` batch classification function
  - Add classification algorithm based on unique value analysis
  - Export TypeScript interfaces: `TagClassification`, `TagClassificationService`
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ]* 1.1 Write property tests for tag classification
  - **Property 18: Tag Classification Correctness**
  - **Validates: Requirements 6.1, 6.2, 6.3**
  - Test binary data (0/1) is classified as digital
  - Test continuous data is classified as analog
  - Test edge cases (3 unique values, sparse data)

- [ ] 2. Implement Trend Line Calculation
  - Extend `src/services/statisticalAnalysis.ts` with trend line functions
  - Implement `calculateTrendLine()` using linear regression algorithm
  - Implement `formatEquation()` for equation string formatting
  - Calculate R² (coefficient of determination)
  - Handle edge cases: insufficient data points (<3), identical values
  - Export TypeScript interfaces: `TrendLineResult`, `TrendLineCalculator`
  - _Requirements: 1.1, 1.2, 1.3_

- [ ]* 2.1 Write property tests for trend line calculation
  - **Property 1: Linear Regression Correctness**
  - **Validates: Requirements 1.1**
  - Test least squares property holds for random datasets
  - Verify slope and intercept minimize sum of squared residuals

- [ ]* 2.2 Write property tests for equation formatting
  - **Property 2: Trend Equation Formatting**
  - **Validates: Requirements 1.2**
  - **Property 3: R² Value Formatting**
  - **Validates: Requirements 1.3**
  - Test equation format matches "y = mx + b" pattern
  - Test coefficients rounded to 2 decimal places
  - Test R² rounded to 3 decimal places

- [ ]* 2.3 Write unit tests for trend line edge cases
  - Test insufficient data (<3 points) throws error
  - Test horizontal line (slope = 0)
  - Test perfect fit (R² = 1.0)
  - Test poor fit (R² < 0.3)

- [ ] 3. Implement SPC Metrics Calculation
  - Extend `src/services/statisticalAnalysis.ts` with SPC functions
  - Implement `calculateSPCMetrics()` for control limits and capability indices
  - Calculate mean (X̄), standard deviation (σest)
  - Calculate UCL (X̄ + 3σ) and LCL (X̄ - 3σ)
  - Calculate Cp: (USL - LSL) / (6σ)
  - Calculate Cpk: min((USL - X̄) / 3σ, (X̄ - LSL) / 3σ)
  - Implement `identifyOutOfControlPoints()` function
  - Implement `assessCapability()` helper function
  - Export TypeScript interfaces: `SPCMetrics`, `SpecificationLimits`, `SPCCalculator`
  - _Requirements: 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ]* 3.1 Write property tests for SPC metrics
  - **Property 8: Control Limits Formula Correctness**
  - **Validates: Requirements 3.3, 3.4**
  - **Property 9: Center Line Equals Mean**
  - **Validates: Requirements 3.2**
  - **Property 11: SPC Metrics Formula Correctness**
  - **Validates: Requirements 4.3, 4.4**
  - Test UCL = mean + 3*stddev for random datasets
  - Test LCL = mean - 3*stddev for random datasets
  - Test Cp formula correctness
  - Test Cpk formula correctness

- [ ]* 3.2 Write property tests for out-of-control detection
  - **Property 10: Out-of-Control Point Identification**
  - **Validates: Requirements 3.5**
  - Test points exceeding UCL are identified
  - Test points below LCL are identified
  - Test points within limits are not identified

- [ ]* 3.3 Write unit tests for SPC edge cases
  - Test with no specification limits (Cp/Cpk = null)
  - Test with invalid spec limits (USL ≤ LSL)
  - Test with zero standard deviation
  - Test capability assessment thresholds (1.0, 1.33)

- [ ] 4. Checkpoint - Ensure all analytics tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Enhance Chart Generation with Trend Lines
  - Extend `src/services/reportGeneration.ts` chart generation functions
  - Add Chart.js configuration for trend line overlay
  - Add trend line dataset to chart data
  - Display trend equation and R² in chart legend
  - Add visual indicator for weak fit (R² < 0.3)
  - Ensure grayscale compatibility for printing
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 7.1_

- [ ]* 5.1 Write property tests for trend line display
  - **Property 4: Digital Tag Exclusion from Analytics**
  - **Validates: Requirements 1.4, 3.6, 6.4**
  - Test digital tags do not get trend lines
  - Test analog tags do get trend lines

- [ ] 6. Add Statistical Summaries to Charts
  - Extend chart generation to include statistics annotation
  - Use chartjs-plugin-annotation for stats legend box
  - Display min, max, mean, standard deviation
  - Format values to 2 decimal places
  - Position legend to avoid obscuring data
  - Ensure sufficient contrast in grayscale mode
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 7.2_

- [ ]* 6.1 Write property tests for statistical calculations
  - **Property 5: Statistical Calculations Accuracy**
  - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
  - **Property 6: Statistical Value Formatting**
  - **Validates: Requirements 2.5**
  - Test min/max identification for random datasets
  - Test mean calculation accuracy
  - Test standard deviation calculation accuracy
  - Test formatting to 2 decimal places

- [ ] 7. Implement SPC Chart Generation
  - Create new function `generateSPCChart()` in report generation service
  - Configure Chart.js for SPC chart layout
  - Add center line (X̄) as solid horizontal line
  - Add UCL and LCL as dashed horizontal lines
  - Mark out-of-control points with distinct styling
  - Add specification limits (LSL/USL) if configured
  - Ensure grayscale compatibility
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 5.5_

- [ ]* 7.1 Write property tests for SPC chart generation
  - **Property 7: SPC Chart Generation for Analog Tags**
  - **Validates: Requirements 3.1**
  - Test SPC charts generated for all analog tags
  - Test no SPC charts for digital tags

- [ ] 8. Implement SPC Metrics Summary Table
  - Create `generateSPCMetricsTable()` function in report generation service
  - Use PDFKit to render table with columns: Tag Name, X̄, σest, LSL, USL, Cp, Cpk, Capability
  - Format numeric values appropriately
  - Display "N/A" for missing spec limits or metrics
  - Add capability assessment indicators
  - Handle page breaks for long tables
  - _Requirements: 4.6, 4.7, 4.8_

- [ ]* 8.1 Write property tests for metrics summary
  - **Property 13: Missing Spec Limits Handling**
  - **Validates: Requirements 4.5**
  - **Property 14: SPC Metrics Summary Completeness**
  - **Validates: Requirements 4.6**
  - Test "N/A" displayed when spec limits missing
  - Test all required fields present in summary

- [ ] 9. Checkpoint - Ensure all chart generation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Extend Report Configuration Data Model
  - Update `src/types/` with new interfaces for report configuration
  - Add `specificationLimits` field: `Map<string, SpecificationLimits>`
  - Add boolean flags: `includeSPCCharts`, `includeTrendLines`, `includeStatsSummary`
  - Update `TagAnalytics` interface with classification and analytics results
  - Update `EnhancedReportData` interface
  - _Requirements: 5.1, 5.4_

- [ ] 11. Add Specification Limits Validation
  - Implement validation function `validateSpecificationLimits()`
  - Check USL > LSL constraint
  - Return validation errors with descriptive messages
  - Integrate validation into report configuration flow
  - _Requirements: 5.2, 9.2_

- [ ]* 11.1 Write property tests for spec limits validation
  - **Property 15: Specification Limits Validation**
  - **Validates: Requirements 5.2**
  - **Property 20: Invalid Specification Limits Rejection**
  - **Validates: Requirements 9.2**
  - Test invalid limits (USL ≤ LSL) are rejected
  - Test valid limits are accepted

- [ ] 12. Implement Specification Limits Persistence
  - Update report configuration save/load functions
  - Serialize specification limits to storage
  - Deserialize specification limits on load
  - Ensure round-trip consistency
  - _Requirements: 5.4_

- [ ]* 12.1 Write property tests for spec limits persistence
  - **Property 16: Specification Limits Persistence**
  - **Validates: Requirements 5.4**
  - **Property 17: Default Handling for Missing Spec Limits**
  - **Validates: Requirements 5.3**
  - Test save/load round-trip preserves values
  - Test missing limits handled gracefully

- [ ] 13. Integrate Analytics into Report Generation Pipeline
  - Update main report generation flow in `src/services/reportGeneration.ts`
  - Add tag classification step before analytics
  - Calculate trend lines for analog tags
  - Calculate SPC metrics for analog tags with spec limits
  - Generate enhanced charts with trend lines and statistics
  - Generate SPC charts for analog tags
  - Generate SPC metrics summary table
  - Maintain existing report structure and sections
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ]* 13.1 Write property tests for PDF content completeness
  - **Property 19: PDF Report Content Completeness**
  - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
  - Test trend equations present in PDF
  - Test statistical summaries present
  - Test SPC charts present for analog tags
  - Test SPC metrics table present

- [ ] 14. Implement Error Handling and Graceful Degradation
  - Create `AnalyticsErrorHandler` class
  - Implement error categorization (insufficient_data, invalid_config, calculation, rendering)
  - Add error logging with structured data
  - Implement graceful degradation for non-critical failures
  - Display "N/A" for failed metrics
  - Include placeholder images for failed chart renders
  - Ensure report generation continues despite individual failures
  - _Requirements: 9.1, 9.3, 9.4, 9.5_

- [ ]* 14.1 Write unit tests for error handling
  - Test insufficient data error (<3 points)
  - Test invalid config error (USL ≤ LSL)
  - Test calculation error handling (division by zero)
  - Test chart rendering error handling
  - Test graceful degradation continues report generation

- [ ] 15. Add Frontend UI for Specification Limits Configuration
  - Update report configuration form in `client/src/components/reports/`
  - Add input fields for LSL and USL per tag
  - Add checkboxes for: "Include trend lines", "Include SPC charts", "Include statistics"
  - Implement client-side validation (USL > LSL)
  - Display validation errors to user
  - Save specification limits with report configuration
  - _Requirements: 5.1, 5.2_

- [ ]* 15.1 Write unit tests for frontend validation
  - Test USL > LSL validation
  - Test form submission with valid limits
  - Test form submission with invalid limits
  - Test error message display

- [ ] 16. Update API Endpoints for Specification Limits
  - Update report configuration API in `src/routes/reports.ts`
  - Accept specification limits in request body
  - Validate specification limits on server side
  - Return validation errors with appropriate HTTP status codes
  - Store specification limits with report configuration
  - _Requirements: 5.2, 5.4_

- [ ] 17. Checkpoint - Ensure all integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Add Performance Monitoring
  - Add timing instrumentation to analytics calculations
  - Log performance metrics for trend line calculation
  - Log performance metrics for SPC metrics calculation
  - Log total report generation time
  - Add performance warning logs if thresholds exceeded
  - _Requirements: 8.5_

- [ ]* 18.1 Write unit tests for performance monitoring
  - Test timing instrumentation captures durations
  - Test performance warnings logged when thresholds exceeded
  - Test performance metrics included in logs

- [ ] 19. Create Integration Tests for End-to-End Report Generation
  - Create test in `tests/integration/` for full report generation
  - Test report with mixed analog and digital tags
  - Test report with specification limits configured
  - Test report without specification limits
  - Verify PDF contains all expected elements
  - Verify grayscale rendering
  - Verify error handling for edge cases
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 20. Update Documentation
  - Update API documentation with new endpoints and parameters
  - Document specification limits configuration
  - Document SPC metrics interpretation (Cp, Cpk, capability)
  - Add examples of enhanced reports
  - Document error messages and troubleshooting
  - Update user guide with new features

- [ ] 21. Final Checkpoint - Complete Feature Validation
  - Run full test suite (unit + property + integration)
  - Generate sample reports with various configurations
  - Verify all requirements are met
  - Verify performance targets are met
  - Verify grayscale printing quality
  - Ask the user if questions arise or if ready for deployment

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation maintains backward compatibility with existing reports
- New features are additive and do not break existing functionality
