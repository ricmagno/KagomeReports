# Implementation Plan: PDF Chart Rendering Fix

## Overview

This implementation plan addresses the issue where charts are not appearing in generated PDF reports. The tasks are organized to first add diagnostic capabilities, then fix the core issues, and finally add robustness improvements.

## Tasks

- [x] 1. Add Chart Buffer Validation Utility
  - Create `src/utils/chartBufferValidator.ts` with buffer validation logic
  - Implement PNG magic byte detection
  - Implement buffer size validation
  - Add buffer info extraction method
  - _Requirements: 4.1, 4.2, 4.3_

- [ ]* 1.1 Write unit tests for buffer validator
  - Test PNG magic byte detection with valid and invalid buffers
  - Test buffer size validation with edge cases
  - Test validation result structure
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 2. Enhance Chart Generation Service Logging
  - [x] 2.1 Add detailed logging to `generateLineChart` method
    - Log input parameters (datasets, dimensions, data points)
    - Log canvas creation success
    - Log Chart.js rendering success
    - Log buffer conversion success with size
    - _Requirements: 1.1, 1.2, 3.1_

  - [x] 2.2 Add buffer validation after chart generation
    - Validate buffer before returning from generation methods
    - Log validation results
    - Throw descriptive errors for invalid buffers
    - _Requirements: 1.3, 1.4, 4.1_

  - [x] 2.3 Add error context to chart generation failures
    - Include chart type, tag name, and data point count in errors
    - Add stack traces to error logs
    - Log canvas state on failure
    - _Requirements: 3.1, 3.2_

- [ ] 3. Enhance PDF Chart Embedding
  - [x] 3.1 Update `addChartsSection` method with validation
    - Validate each chart buffer before embedding
    - Log validation results for each chart
    - Track success/failure counts
    - _Requirements: 2.1, 2.2, 3.3_

  - [x] 3.2 Add error handling and fallbacks
    - Wrap image embedding in try-catch
    - Add placeholder text for failed charts
    - Continue processing after failures
    - Log detailed error information
    - _Requirements: 2.2, 3.3, 5.1, 5.4_

  - [x] 3.3 Improve chart sizing and positioning
    - Increase default chart dimensions (450x300)
    - Add explicit alignment options
    - Ensure proper spacing between charts
    - Add page breaks for multiple charts
    - _Requirements: 2.3, 2.4_

  - [x] 3.4 Add embedding summary
    - Log summary of successful/failed embeddings
    - Add note to PDF if charts failed
    - Include failure list in report metadata
    - _Requirements: 3.4, 5.3_

- [ ] 4. Add Debug Mode Features
  - [ ] 4.1 Add environment variable for debug mode
    - Add `CHART_DEBUG_MODE` to environment configuration
    - Add `CHART_SAVE_TO_DISK` option
    - Add `CHART_VERBOSE_LOGGING` option
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 4.2 Implement chart buffer disk saving
    - Save chart buffers to `./debug/charts/` when enabled
    - Use descriptive filenames with timestamps
    - Log saved file paths
    - _Requirements: 6.1_

  - [ ] 4.3 Add chart generation test endpoint
    - Create `/api/debug/test-chart` endpoint
    - Generate sample chart without PDF
    - Return buffer info and validation results
    - _Requirements: 6.1_

- [ ] 5. Update Chart Generation Service Methods
  - [ ] 5.1 Apply enhancements to `generateBarChart`
    - Add same logging and validation as line charts
    - Add error context
    - Validate output buffer
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ] 5.2 Apply enhancements to `generateTrendChart`
    - Add same logging and validation as line charts
    - Add error context
    - Validate output buffer
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ] 5.3 Apply enhancements to `generateStatisticsChart`
    - Add same logging and validation as line charts
    - Add error context
    - Validate output buffer
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 6. Checkpoint - Test Chart Generation
  - Generate test report with multiple chart types
  - Verify charts appear in PDF
  - Check logs for any errors or warnings
  - Verify buffer validation is working
  - Ask user if charts are now visible in PDFs

- [ ] 7. Add Chart Metadata Tracking
  - [ ] 7.1 Create ChartMetadata interface
    - Define metadata structure in types
    - Include generation status and errors
    - _Requirements: 3.4_

  - [ ] 7.2 Track metadata during chart generation
    - Collect metadata for each chart
    - Include in report result
    - Log metadata summary
    - _Requirements: 3.4_

- [ ] 8. Improve Error Messages
  - [ ] 8.1 Add actionable error messages
    - Provide specific failure reasons
    - Suggest potential fixes
    - Include relevant context
    - _Requirements: 3.2, 4.4_

  - [ ] 8.2 Add error categorization
    - Categorize errors (data, rendering, embedding)
    - Log category with each error
    - Use categories for recovery strategies
    - _Requirements: 3.1, 3.2_

- [ ] 9. Add Configuration Options
  - [ ] 9.1 Add chart dimension configuration
    - Add `CHART_WIDTH` and `CHART_HEIGHT` env vars
    - Use configured values in chart generation
    - Validate configuration values
    - _Requirements: 6.1, 6.3_

  - [ ] 9.2 Add chart quality configuration
    - Add `CHART_QUALITY` env var
    - Apply quality setting to PNG export
    - Log active configuration
    - _Requirements: 6.2, 6.4_

- [ ]* 10. Add Integration Tests
  - [ ]* 10.1 Test end-to-end chart rendering
    - Generate report with real data
    - Verify charts in PDF
    - Check all chart types
    - _Requirements: 1.1, 2.1, 2.2_

  - [ ]* 10.2 Test error recovery
    - Inject chart generation failures
    - Verify PDF still generates
    - Verify placeholders appear
    - Verify logging is complete
    - _Requirements: 3.3, 5.1, 5.2_

  - [ ]* 10.3 Test buffer validation
    - Test with invalid buffers
    - Test with empty buffers
    - Test with oversized buffers
    - Verify appropriate handling
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 11. Final Checkpoint - Verify Complete Solution
  - Generate multiple test reports
  - Verify all charts appear correctly
  - Check logs for any remaining issues
  - Verify error handling works
  - Verify debug mode features work
  - Ask user to confirm charts are now visible

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Focus on diagnostic logging first to identify the root cause
- Buffer validation is critical for catching issues early
- Error handling should allow reports to complete even with chart failures
- Debug mode features will help with future troubleshooting
