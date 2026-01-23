# Implementation Plan: Report Configuration Export/Import

## Overview

This implementation plan breaks down the Report Configuration Export/Import feature into discrete, incremental coding tasks. The approach follows a bottom-up strategy: building core services first, then API endpoints, then frontend components, and finally integration. Each task builds on previous work, with testing integrated throughout to catch errors early.

## Tasks

- [x] 1. Set up type definitions and data models
  - Create TypeScript interfaces for export/import data structures
  - Define ExportedConfiguration, ExportMetadata, ImportResult, ValidationError types
  - Define ExportOptions, ExportResult interfaces
  - Create JSON schema version constants
  - _Requirements: 1.1, 1.3, 3.2, 3.3_

- [x] 2. Implement ConfigExportService for JSON export
  - [x] 2.1 Create ConfigExportService class with JSON export method
    - Implement `exportConfiguration()` method for JSON format
    - Implement `generateJSONExport()` private method
    - Implement `buildMetadata()` to create export metadata
    - Implement `generateFilename()` for descriptive filenames
    - Handle serialization with proper indentation (JSON.stringify with spacing)
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.7_

  - [ ]* 2.2 Write property test for JSON export completeness
    - **Property 1: JSON Export Completeness**
    - **Validates: Requirements 1.1, 1.3**

  - [ ]* 2.3 Write property test for filename pattern
    - **Property 2: JSON Export Filename Pattern**
    - **Validates: Requirements 1.4**

  - [ ]* 2.4 Write property test for JSON formatting
    - **Property 3: JSON Export Formatting**
    - **Validates: Requirements 1.5**

  - [ ]* 2.5 Write unit tests for JSON export edge cases
    - Test single tag configuration
    - Test multiple tags configuration
    - Test configuration with all options enabled
    - Test empty optional fields
    - _Requirements: 1.1, 1.3, 1.4, 1.5_

- [x] 3. Implement security and credential filtering
  - [x] 3.1 Add credential exclusion logic to export service
    - Implement filtering to remove database passwords
    - Implement filtering to remove SMTP credentials
    - Add security notice to exported files
    - Include connection metadata (server, database) without credentials
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [ ]* 3.2 Write property test for credential exclusion
    - **Property 21: Credential Exclusion**
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 3.3 Write property test for security notice inclusion
    - **Property 24: Security Notice Inclusion**
    - **Validates: Requirements 6.5**

- [x] 4. Implement Power BI export functionality
  - [x] 4.1 Add Power BI export method to ConfigExportService
    - Implement `generatePowerBIExport()` private method
    - Create M Query template generator
    - Build SQL query with tag selection and time range
    - Include connection parameters (server, database)
    - Add documentation comments to M Query output
    - Generate .pq filename
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 10.4, 10.5_

  - [ ]* 4.2 Write property test for Power BI export completeness
    - **Property 5: Power BI Export Completeness**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

  - [ ]* 4.3 Write property test for Power BI format compliance
    - **Property 6: Power BI Export Format Compliance**
    - **Validates: Requirements 2.7**

  - [ ]* 4.4 Write property test for SQL query consistency
    - **Property 7: Power BI SQL Query Consistency**
    - **Validates: Requirements 10.2, 10.3**

- [x] 5. Implement file size validation for exports
  - [x] 5.1 Add file size checking to export service
    - Implement size calculation before export
    - Add 5 MB limit check for JSON exports
    - Return appropriate error for oversized exports
    - _Requirements: 7.3, 7.4_

  - [ ]* 5.2 Write property test for export file size limit
    - **Property 25: Export File Size Limit**
    - **Validates: Requirements 7.3, 7.4**

- [~] 6. Implement ConfigImportService for JSON import
  - [x] 6.1 Create ConfigImportService class with import method
    - Implement `importConfiguration()` method
    - Implement JSON parsing with error handling
    - Implement `mapToConfiguration()` to convert JSON to ReportConfiguration
    - _Requirements: 3.2, 3.5_

  - [x] 6.2 Implement schema validation
    - Implement `validateSchema()` method
    - Check for required fields (tags, timeRange, sampling)
    - Validate schema version format
    - Return structured validation errors
    - _Requirements: 3.3, 3.4_

  - [x] 6.3 Implement field validation
    - Implement `validateFields()` method
    - Validate time range (start before end, not in future)
    - Validate sampling mode values
    - Validate specification limits (upper > lower)
    - Validate tag name patterns
    - Return specific error messages for each validation failure
    - _Requirements: 3.7, 5.3, 5.4_

  - [x] 6.4 Implement default value handling
    - Implement `applyDefaults()` method
    - Apply defaults for missing optional fields
    - Use application default values for analytics options
    - _Requirements: 3.8_

  - [ ]* 6.5 Write property test for JSON import round-trip
    - **Property 9: JSON Import Round-Trip**
    - **Validates: Requirements 3.5**

  - [ ]* 6.6 Write property test for schema validation
    - **Property 11: Schema Validation**
    - **Validates: Requirements 3.3**

  - [ ]* 6.7 Write property test for validation error reporting
    - **Property 13: Validation Error Reporting**
    - **Validates: Requirements 3.7, 5.3, 5.4**

  - [ ]* 6.8 Write unit tests for import edge cases
    - Test valid JSON import
    - Test JSON with missing optional fields
    - Test invalid JSON syntax
    - Test missing required fields
    - Test invalid field values
    - _Requirements: 3.2, 3.3, 3.7, 3.8, 3.9_

- [x] 7. Implement tag validation with database check
  - [x] 7.1 Add tag existence validation to import service
    - Implement `validateTags()` async method
    - Query AVEVA Historian for tag existence
    - Return warnings (not errors) for non-existent tags
    - Allow import to proceed with warnings
    - _Requirements: 5.5_

  - [ ]* 7.2 Write property test for tag validation warnings
    - **Property 16: Tag Validation Warnings**
    - **Validates: Requirements 5.5**

- [x] 8. Implement import file size validation
  - [x] 8.1 Add file size checking to import service
    - Check file size before parsing
    - Add 10 MB limit check
    - Return appropriate error for oversized files
    - _Requirements: 7.5_

  - [ ]* 8.2 Write property test for import file size limit
    - **Property 26: Import File Size Limit**
    - **Validates: Requirements 7.5**

- [x] 9. Implement cross-platform path handling
  - [x] 9.1 Add path normalization utilities
    - Create utility function to normalize paths to forward slashes
    - Create utility function to convert paths to platform-specific format
    - Apply normalization in export service
    - Apply conversion in import service
    - _Requirements: 8.1, 8.2, 8.5, 8.6_

  - [ ]* 9.2 Write property test for platform-independent paths
    - **Property 27: Platform-Independent Path Representation**
    - **Validates: Requirements 8.1, 8.5**

  - [ ]* 9.3 Write property test for path normalization on import
    - **Property 28: Path Normalization on Import**
    - **Validates: Requirements 8.2, 8.6**

- [x] 10. Implement UTF-8 encoding handling
  - [x] 10.1 Ensure UTF-8 encoding in export/import
    - Verify JSON.stringify produces UTF-8
    - Verify JSON.parse handles UTF-8
    - Add encoding metadata to exports
    - _Requirements: 8.3, 8.4_

  - [ ]* 10.2 Write property test for UTF-8 round-trip
    - **Property 29: UTF-8 Encoding Round-Trip**
    - **Validates: Requirements 8.3, 8.4**

- [x] 11. Checkpoint - Ensure all service tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement export API endpoint
  - [x] 12.1 Create POST /api/reports/export route
    - Add route handler in src/routes/reports.ts
    - Validate request body (config, format)
    - Call ConfigExportService with appropriate format
    - Set response headers (Content-Type, Content-Disposition)
    - Return file data with proper filename
    - Handle errors and return appropriate HTTP status codes
    - _Requirements: 1.1, 2.1, 4.3_

  - [x]* 12.2 Write integration test for export endpoint
    - Test JSON export via API
    - Test Power BI export via API
    - Test error handling (invalid config, oversized)
    - Verify response headers
    - _Requirements: 1.1, 2.1_

- [x] 13. Implement import API endpoint
  - [x] 13.1 Create POST /api/reports/import route
    - Add route handler in src/routes/reports.ts
    - Validate request body (fileContent)
    - Call ConfigImportService
    - Return validation result with config or errors
    - Handle errors and return appropriate HTTP status codes
    - _Requirements: 3.2, 3.3, 3.5_

  - [x]* 13.2 Write integration test for import endpoint
    - Test valid JSON import via API
    - Test invalid JSON import via API
    - Test validation errors via API
    - Verify response structure
    - _Requirements: 3.2, 3.3, 3.7_

- [~] 14. Implement format preference persistence
  - [x] 14.1 Add format preference storage
    - Store last selected format in user session or localStorage
    - Retrieve format preference on export
    - Default to JSON if no preference exists
    - _Requirements: 4.5_

  - [ ]* 14.2 Write property test for format preference persistence
    - **Property 20: Format Preference Persistence**
    - **Validates: Requirements 4.5**

- [x] 15. Implement frontend ExportImportControls component
  - [x] 15.1 Create ExportImportControls React component
    - Create component in client/src/components/reports/
    - Add Export and Import buttons with icons (Download, Upload)
    - Add tooltips explaining functionality
    - Position buttons in ReportConfiguration header
    - Implement loading states during operations
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 15.2 Implement export button handler
    - Open format selection dialog on click
    - Call export API with current configuration
    - Trigger browser download with response data
    - Show success/error notifications
    - _Requirements: 1.1, 1.6, 4.1_

  - [x] 15.3 Implement import button handler
    - Open file browser on click (accept .json files)
    - Read selected file content
    - Call import API with file content
    - Populate form fields with imported configuration
    - Show success/error notifications
    - Display validation errors if import fails
    - _Requirements: 3.1, 3.2, 3.5, 3.6_

  - [x]* 15.4 Write unit tests for ExportImportControls
    - Test button rendering
    - Test export button click
    - Test import button click
    - Test loading states
    - Test error handling
    - _Requirements: 9.1, 9.4, 9.5_

- [x] 16. Implement FormatSelectionDialog component
  - [x] 16.1 Create FormatSelectionDialog React component
    - Create modal dialog component
    - Add format options: JSON and Power BI
    - Add descriptions for each format
    - Implement confirm and cancel actions
    - Style with Tailwind CSS following design system
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x]* 16.2 Write unit tests for FormatSelectionDialog
    - Test dialog rendering
    - Test format selection
    - Test confirm action
    - Test cancel action
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 17. Implement validation error display
  - [x] 17.1 Create ValidationErrorDialog component
    - Create modal dialog for displaying validation errors
    - Display list of validation errors with field names
    - Display warnings separately from errors
    - Add "Close" and "Try Again" actions
    - Style with Tailwind CSS
    - _Requirements: 3.7, 5.1, 5.2, 5.3, 5.4_

  - [x]* 17.2 Write unit tests for ValidationErrorDialog
    - Test error list rendering
    - Test warning display
    - Test action buttons
    - _Requirements: 3.7, 5.3, 5.4_

- [x] 18. Integrate export/import into ReportConfiguration component
  - [x] 18.1 Add ExportImportControls to ReportConfiguration header
    - Import and render ExportImportControls component
    - Pass current configuration as prop
    - Implement onImportComplete callback to populate form
    - Handle unsaved changes indicator after import
    - _Requirements: 9.1, 9.2, 9.3, 9.6_

  - [x] 18.2 Implement configuration population from import
    - Map imported configuration to form state
    - Update all form fields (tags, time range, analytics, etc.)
    - Trigger form validation after import
    - Mark form as modified
    - _Requirements: 3.5, 3.6_

- [x] 19. Implement error logging for validation failures
  - [x] 19.1 Add logging to import service
    - Log all validation errors with context
    - Log import attempts (success and failure)
    - Include user identifier and timestamp
    - Use existing logging infrastructure
    - _Requirements: 5.6_

  - [ ]* 19.2 Write property test for validation error logging
    - **Property 17: Validation Error Logging**
    - **Validates: Requirements 5.6**

- [x] 20. Implement state preservation on import failure
  - [x] 20.1 Add state protection in import handler
    - Store current configuration before import
    - Only update configuration on successful validation
    - Restore original configuration on failure
    - _Requirements: 5.7_

  - [ ]* 20.2 Write property test for state preservation
    - **Property 18: State Preservation on Failure**
    - **Validates: Requirements 5.7**

- [x] 21. Implement schema version migration
  - [x] 21.1 Create SchemaVersionMigrator utility
    - Implement migration path detection
    - Create migration functions for version upgrades
    - Handle backward-compatible migrations
    - Log migration operations
    - _Requirements: 1.7, 3.4_

  - [ ]* 21.2 Write property test for schema version compatibility
    - **Property 12: Schema Version Compatibility**
    - **Validates: Requirements 3.4**

- [x] 22. Checkpoint - Ensure all integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 23. Add API documentation for export/import endpoints
  - Document POST /api/reports/export endpoint
  - Document POST /api/reports/import endpoint
  - Include request/response examples
  - Document error codes and messages
  - Add to existing API documentation
  - _Requirements: All_

- [x] 24. Create user documentation
  - Write user guide for export functionality
  - Write user guide for import functionality
  - Document Power BI integration steps
  - Include troubleshooting section
  - Add screenshots of UI components
  - _Requirements: All_

- [x] 25. Final integration testing and polish
  - [x] 25.1 End-to-end testing
    - Test complete export flow (UI → API → Service → File)
    - Test complete import flow (File → API → Service → UI)
    - Test Power BI export with Power BI Desktop
    - Test cross-platform compatibility (Windows, macOS, Linux)
    - Test with various configuration sizes
    - Test with Unicode characters
    - _Requirements: All_

  - [x] 25.2 Performance validation
    - Measure export time for typical configurations
    - Measure import time for typical configurations
    - Verify operations complete within 2 seconds
    - Optimize if necessary
    - _Requirements: 7.1, 7.2_

  - [x] 25.3 Security audit
    - Verify no credentials in exported files
    - Verify security notices are present
    - Test with sensitive data
    - Review code for security issues
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 25.4 UI/UX polish
    - Verify button positioning and styling
    - Verify tooltips are helpful
    - Verify error messages are clear
    - Verify loading states are smooth
    - Test accessibility (keyboard navigation, screen readers)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 26. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 4: Property-Based Testing (Optional)

The following property-based tests are optional but recommended for comprehensive validation. They validate universal correctness properties across all possible configurations.

- [ ]* 27. Implement property-based tests for export functionality
  - [ ]* 27.1 Write Property 1: JSON Export Completeness
    - Test that all configuration fields are present in JSON exports
    - Use FastCheck to generate 100+ random configurations
    - **Validates: Requirements 1.1, 1.3**

  - [ ]* 27.2 Write Property 2: JSON Export Filename Pattern
    - Test that filenames match the expected pattern for all configs
    - **Validates: Requirements 1.4**

  - [ ]* 27.3 Write Property 3: JSON Export Formatting
    - Test that JSON is properly indented and human-readable
    - **Validates: Requirements 1.5**

  - [ ]* 27.4 Write Property 4: JSON Export Schema Versioning
    - Test that schema version is always present and valid
    - **Validates: Requirements 1.7**

  - [ ]* 27.5 Write Property 5: Power BI Export Completeness
    - Test that all required fields are present in Power BI exports
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

  - [ ]* 27.6 Write Property 6: Power BI Export Format Compliance
    - Test that generated M Query is valid syntax
    - **Validates: Requirements 2.7**

  - [ ]* 27.7 Write Property 7: Power BI SQL Query Consistency
    - Test that SQL queries match internal query structure
    - **Validates: Requirements 10.2, 10.3**

  - [ ]* 27.8 Write Property 21: Credential Exclusion
    - Test that no credentials appear in any export
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 27.9 Write Property 25: Export File Size Limit
    - Test that oversized exports are rejected
    - **Validates: Requirements 7.3, 7.4**

  - [ ]* 27.10 Write Property 27: Platform-Independent Path Representation
    - Test that paths use forward slashes in exports
    - **Validates: Requirements 8.1, 8.5**

- [ ]* 28. Implement property-based tests for import functionality
  - [ ]* 28.1 Write Property 9: JSON Import Round-Trip
    - Test that export → import preserves all data
    - **Validates: Requirements 3.5**

  - [ ]* 28.2 Write Property 10: JSON Parsing
    - Test that valid JSON is always parsed successfully
    - **Validates: Requirements 3.2**

  - [ ]* 28.3 Write Property 11: Schema Validation
    - Test that schema validation correctly identifies invalid structures
    - **Validates: Requirements 3.3**

  - [ ]* 28.4 Write Property 12: Schema Version Compatibility
    - Test version compatibility detection across all versions
    - **Validates: Requirements 3.4**

  - [ ]* 28.5 Write Property 13: Validation Error Reporting
    - Test that all validation errors are reported with specific messages
    - **Validates: Requirements 3.7, 5.3, 5.4**

  - [ ]* 28.6 Write Property 14: Optional Field Defaults
    - Test that missing optional fields get correct defaults
    - **Validates: Requirements 3.8**

  - [ ]* 28.7 Write Property 15: Required Field Validation
    - Test that missing required fields are always rejected
    - **Validates: Requirements 3.9, 5.3**

  - [ ]* 28.8 Write Property 16: Tag Validation Warnings
    - Test that non-existent tags generate warnings but allow import
    - **Validates: Requirements 5.5**

  - [ ]* 28.9 Write Property 17: Validation Error Logging
    - Test that all validation errors are logged
    - **Validates: Requirements 5.6**

  - [ ]* 28.10 Write Property 18: State Preservation on Failure
    - Test that failed imports don't modify current state
    - **Validates: Requirements 5.7**

  - [ ]* 28.11 Write Property 26: Import File Size Limit
    - Test that oversized files are rejected
    - **Validates: Requirements 7.5**

  - [ ]* 28.12 Write Property 28: Path Normalization on Import
    - Test that platform-specific paths are normalized
    - **Validates: Requirements 8.2, 8.6**

  - [ ]* 28.13 Write Property 29: UTF-8 Encoding Round-Trip
    - Test that Unicode characters are preserved
    - **Validates: Requirements 8.3, 8.4**

- [ ]* 29. Implement property-based tests for format selection
  - [ ]* 29.1 Write Property 19: Format Selection Affects Output
    - Test that format selection produces correct output type
    - **Validates: Requirements 4.3**

  - [ ]* 29.2 Write Property 20: Format Preference Persistence
    - Test that format preference is saved and restored
    - **Validates: Requirements 4.5**

- [ ]* 30. Implement property-based tests for security
  - [ ]* 30.1 Write Property 22: Connection Metadata Inclusion
    - Test that connection metadata is included without credentials
    - **Validates: Requirements 6.3**

  - [ ]* 30.2 Write Property 23: Import Connection Isolation
    - Test that imports don't affect current connection settings
    - **Validates: Requirements 6.4**

  - [ ]* 30.3 Write Property 24: Security Notice Inclusion
    - Test that security notices are always present
    - **Validates: Requirements 6.5**

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Phase 4 (Property-Based Testing) is entirely optional but provides comprehensive validation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties across 100+ random inputs
- Unit tests validate specific examples and edge cases
- The implementation follows the existing codebase patterns (Service-Oriented Architecture)
- TypeScript is used throughout for type safety
- Frontend uses React with Tailwind CSS following the design system
- Backend uses Express with existing middleware patterns
- All core functionality (Phases 1-3) is complete and tested
