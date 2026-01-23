# End-to-End Testing Checklist: Report Configuration Export/Import

## Overview

This document provides a comprehensive checklist for end-to-end testing of the Report Configuration Export/Import feature. Complete all test scenarios to ensure production readiness.

**Test Environment**: Development/Staging  
**Tester**: _____________  
**Date**: _____________  
**Application Version**: _____________

---

## Pre-Test Setup

- [ ] Application is running (backend and frontend)
- [ ] Database connection is active
- [ ] Test user account is created and logged in
- [ ] Browser developer tools are open for debugging
- [ ] Test data tags exist in AVEVA Historian database
- [ ] Clean browser cache and localStorage

---

## Test Scenario 1: JSON Export - Complete Flow

### 1.1 Basic JSON Export

- [ ] Navigate to Report Configuration section
- [ ] Configure a simple report:
  - [ ] Select 2-3 tags
  - [ ] Set time range (last 24 hours)
  - [ ] Enable trend lines
  - [ ] Disable SPC metrics
- [ ] Click Export button
- [ ] Verify format selection dialog appears
- [ ] Select "JSON" format
- [ ] Click "Export" button
- [ ] Verify file downloads successfully
- [ ] Verify filename follows pattern: `ReportConfig_<tags>_<timestamp>.json`
- [ ] Open downloaded file in text editor
- [ ] Verify JSON is properly formatted (indented)
- [ ] Verify all configuration fields are present
- [ ] Verify metadata section exists (exportDate, exportedBy, etc.)
- [ ] Verify security notice is present
- [ ] Verify NO database passwords in file
- [ ] Verify NO SMTP credentials in file

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

### 1.2 JSON Export with All Options

- [ ] Configure a complex report:
  - [ ] Select 5+ tags
  - [ ] Set custom time range (specific dates)
  - [ ] Enable all analytics options
  - [ ] Configure specification limits (upper, lower, target)
  - [ ] Add report name and description
- [ ] Export to JSON
- [ ] Verify all options are preserved in export
- [ ] Verify specification limits are included
- [ ] Verify report name and description are included

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

### 1.3 JSON Export with Single Tag

- [ ] Configure report with only 1 tag
- [ ] Export to JSON
- [ ] Verify filename includes tag name
- [ ] Verify export succeeds

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

### 1.4 JSON Export with Many Tags

- [ ] Configure report with 10+ tags
- [ ] Export to JSON
- [ ] Verify filename shows "XTags" format (e.g., "10Tags")
- [ ] Verify all tags are in export file

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

---

## Test Scenario 2: JSON Import - Complete Flow

### 2.1 Basic JSON Import

- [ ] Clear current configuration (refresh page)
- [ ] Click Import button
- [ ] Select previously exported JSON file (from 1.1)
- [ ] Verify file browser accepts .json files
- [ ] Verify import succeeds
- [ ] Verify success notification appears
- [ ] Verify form fields populate with imported values:
  - [ ] Tags are selected
  - [ ] Time range matches
  - [ ] Analytics options match
  - [ ] Specification limits match (if any)
  - [ ] Report name and description match
- [ ] Verify form is marked as modified (unsaved)

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

### 2.2 Import with Missing Optional Fields

- [ ] Manually create a JSON file with minimal required fields only
- [ ] Import the file
- [ ] Verify import succeeds
- [ ] Verify default values are applied for missing fields
- [ ] Verify no errors are shown

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

### 2.3 Import with Non-Existent Tags

- [ ] Edit a JSON file to include fake tag names
- [ ] Import the file
- [ ] Verify import succeeds (not fails)
- [ ] Verify warning message appears listing non-existent tags
- [ ] Verify form still populates with all data
- [ ] Verify user can proceed with configuration

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

### 2.4 Import Round-Trip Test

- [ ] Export a configuration to JSON
- [ ] Import the same file immediately
- [ ] Verify all fields match exactly
- [ ] Export again
- [ ] Compare the two export files (should be identical except timestamps)

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

---

## Test Scenario 3: Power BI Export

### 3.1 Basic Power BI Export

- [ ] Configure a report with 2-3 tags
- [ ] Click Export button
- [ ] Select "Power BI" format
- [ ] Click "Export" button
- [ ] Verify file downloads with .pq extension
- [ ] Verify filename follows pattern: `PowerBI_<tags>_<timestamp>.pq`
- [ ] Open file in text editor
- [ ] Verify M Query syntax is present
- [ ] Verify connection parameters (server, database) are included
- [ ] Verify tag names are in SQL query
- [ ] Verify time range is in SQL query
- [ ] Verify quality code filtering is present (QualityCode = 192)
- [ ] Verify documentation comments are included

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

### 3.2 Power BI Export with Complex Configuration

- [ ] Configure report with 5+ tags and specification limits
- [ ] Export to Power BI format
- [ ] Verify all tags are in SQL query
- [ ] Verify time range is correct
- [ ] Verify file is valid M Query syntax

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

### 3.3 Power BI Integration Test (if Power BI Desktop available)

- [ ] Open Power BI Desktop
- [ ] Create blank query
- [ ] Open Advanced Editor
- [ ] Paste exported M Query code
- [ ] Configure database credentials
- [ ] Verify connection succeeds
- [ ] Verify data loads
- [ ] Verify data matches application data (spot check)

**Result**: ✅ Pass / ❌ Fail / ⚠️ Skipped (no Power BI)  
**Notes**: _____________

---

## Test Scenario 4: Error Handling

### 4.1 Invalid JSON Import

- [ ] Create a text file with invalid JSON syntax
- [ ] Try to import it
- [ ] Verify error dialog appears
- [ ] Verify error message says "Invalid JSON file format"
- [ ] Verify current configuration is NOT modified
- [ ] Click "Try Again" button
- [ ] Verify file browser opens again

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

### 4.2 Missing Required Fields

- [ ] Create JSON file missing "tags" field
- [ ] Try to import it
- [ ] Verify validation error dialog appears
- [ ] Verify error lists "tags" as missing field
- [ ] Verify current configuration is NOT modified

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

### 4.3 Invalid Time Range

- [ ] Create JSON with startTime > endTime
- [ ] Try to import it
- [ ] Verify validation error appears
- [ ] Verify error message mentions time range issue

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

### 4.4 File Too Large (Import)

- [ ] Create or obtain a JSON file > 10 MB
- [ ] Try to import it
- [ ] Verify error message about file size limit
- [ ] Verify import is rejected

**Result**: ✅ Pass / ❌ Fail / ⚠️ Skipped (hard to test)  
**Notes**: _____________

### 4.5 Schema Version Mismatch

- [ ] Edit JSON file to have unsupported schema version (e.g., "99.0")
- [ ] Try to import it
- [ ] Verify warning or error about version mismatch
- [ ] Verify migration is attempted (if applicable)

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

---

## Test Scenario 5: UI/UX Testing

### 5.1 Button States

- [ ] Verify Export button is enabled with valid configuration
- [ ] Verify Import button is always enabled
- [ ] Configure invalid report (no tags)
- [ ] Verify Export button is disabled
- [ ] Verify tooltip explains why button is disabled

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

### 5.2 Loading States

- [ ] Click Export button
- [ ] Verify loading indicator appears during export
- [ ] Verify button is disabled during export
- [ ] Click Import button and select file
- [ ] Verify loading indicator appears during import
- [ ] Verify button is disabled during import

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

### 5.3 Tooltips

- [ ] Hover over Export button
- [ ] Verify tooltip appears with helpful text
- [ ] Hover over Import button
- [ ] Verify tooltip appears with helpful text

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

### 5.4 Dialog Interactions

- [ ] Open format selection dialog
- [ ] Click outside dialog (backdrop)
- [ ] Verify dialog closes
- [ ] Open dialog again
- [ ] Press Escape key
- [ ] Verify dialog closes
- [ ] Open dialog again
- [ ] Click Cancel button
- [ ] Verify dialog closes

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

### 5.5 Error Dialog Interactions

- [ ] Trigger a validation error (import invalid JSON)
- [ ] Verify error dialog shows all errors
- [ ] Verify errors are grouped by severity (errors vs warnings)
- [ ] Click "Close" button
- [ ] Verify dialog closes
- [ ] Trigger error again
- [ ] Click "Try Again" button
- [ ] Verify file browser opens

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

---

## Test Scenario 6: Cross-Platform Testing

### 6.1 Windows Testing

- [ ] Export configuration on Windows
- [ ] Verify file paths use forward slashes in JSON
- [ ] Import configuration on Windows
- [ ] Verify import succeeds
- [ ] Verify paths are normalized correctly

**Result**: ✅ Pass / ❌ Fail / ⚠️ Skipped (no Windows)  
**Notes**: _____________

### 6.2 macOS Testing

- [ ] Export configuration on macOS
- [ ] Verify file paths use forward slashes in JSON
- [ ] Import configuration on macOS
- [ ] Verify import succeeds

**Result**: ✅ Pass / ❌ Fail / ⚠️ Skipped (no macOS)  
**Notes**: _____________

### 6.3 Linux Testing

- [ ] Export configuration on Linux
- [ ] Verify file paths use forward slashes in JSON
- [ ] Import configuration on Linux
- [ ] Verify import succeeds

**Result**: ✅ Pass / ❌ Fail / ⚠️ Skipped (no Linux)  
**Notes**: _____________

### 6.4 Cross-Platform Import

- [ ] Export on one platform (e.g., Windows)
- [ ] Import on different platform (e.g., macOS)
- [ ] Verify import succeeds
- [ ] Verify all data is preserved

**Result**: ✅ Pass / ❌ Fail / ⚠️ Skipped  
**Notes**: _____________

---

## Test Scenario 7: Unicode and Special Characters

### 7.1 Unicode in Configuration

- [ ] Create report with Unicode characters in name/description
  - Example: "温度报告" (Chinese)
  - Example: "Température" (French)
  - Example: "Температура" (Russian)
- [ ] Export to JSON
- [ ] Verify Unicode characters are preserved in file
- [ ] Import the file
- [ ] Verify Unicode characters display correctly

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

### 7.2 Special Characters in Tag Names

- [ ] Use tags with special characters (if available)
  - Example: "Tag.With.Dots"
  - Example: "Tag_With_Underscores"
  - Example: "Tag-With-Dashes"
- [ ] Export and import
- [ ] Verify special characters are preserved

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

---

## Test Scenario 8: Format Preference Persistence

### 8.1 Format Preference Storage

- [ ] Export configuration and select JSON format
- [ ] Close and reopen format dialog
- [ ] Verify JSON is still selected (default)
- [ ] Select Power BI format and export
- [ ] Close and reopen format dialog
- [ ] Verify Power BI is now selected (remembered)

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

### 8.2 Format Preference Across Sessions

- [ ] Select Power BI format and export
- [ ] Refresh the page
- [ ] Open format dialog again
- [ ] Verify Power BI is still selected

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

---

## Test Scenario 9: Security Testing

### 9.1 Credential Exclusion

- [ ] Configure database connection with password
- [ ] Export configuration to JSON
- [ ] Open JSON file and search for password
- [ ] Verify password is NOT present
- [ ] Search for "password", "credential", "secret"
- [ ] Verify no sensitive data is present

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

### 9.2 Security Notice

- [ ] Export configuration to JSON
- [ ] Open file and locate security notice
- [ ] Verify notice explains credentials must be configured separately

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

### 9.3 Connection Metadata

- [ ] Export configuration
- [ ] Verify server address IS included (metadata)
- [ ] Verify database name IS included (metadata)
- [ ] Verify these are informational only (no credentials)

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

---

## Test Scenario 10: Browser Compatibility

### 10.1 Chrome/Chromium

- [ ] Test all export/import flows in Chrome
- [ ] Verify file downloads work
- [ ] Verify file uploads work
- [ ] Verify dialogs render correctly

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

### 10.2 Firefox

- [ ] Test all export/import flows in Firefox
- [ ] Verify file downloads work
- [ ] Verify file uploads work
- [ ] Verify dialogs render correctly

**Result**: ✅ Pass / ❌ Fail / ⚠️ Skipped  
**Notes**: _____________

### 10.3 Safari

- [ ] Test all export/import flows in Safari
- [ ] Verify file downloads work
- [ ] Verify file uploads work
- [ ] Verify dialogs render correctly

**Result**: ✅ Pass / ❌ Fail / ⚠️ Skipped  
**Notes**: _____________

### 10.4 Edge

- [ ] Test all export/import flows in Edge
- [ ] Verify file downloads work
- [ ] Verify file uploads work
- [ ] Verify dialogs render correctly

**Result**: ✅ Pass / ❌ Fail / ⚠️ Skipped  
**Notes**: _____________

---

## Test Scenario 11: Accessibility Testing

### 11.1 Keyboard Navigation

- [ ] Tab to Export button
- [ ] Press Enter to open dialog
- [ ] Tab through format options
- [ ] Press Space to select format
- [ ] Tab to Export button in dialog
- [ ] Press Enter to export
- [ ] Verify entire flow works with keyboard only

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

### 11.2 Screen Reader Testing

- [ ] Enable screen reader (NVDA, JAWS, VoiceOver)
- [ ] Navigate to Export button
- [ ] Verify button label is announced
- [ ] Verify tooltip is announced
- [ ] Open format dialog
- [ ] Verify dialog title is announced
- [ ] Verify format options are announced
- [ ] Verify selected state is announced

**Result**: ✅ Pass / ❌ Fail / ⚠️ Skipped  
**Notes**: _____________

### 11.3 Focus Management

- [ ] Open format dialog
- [ ] Verify focus moves to dialog
- [ ] Close dialog
- [ ] Verify focus returns to Export button
- [ ] Open validation error dialog
- [ ] Verify focus moves to dialog
- [ ] Close dialog
- [ ] Verify focus returns appropriately

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

---

## Test Scenario 12: Performance Testing

### 12.1 Export Performance

- [ ] Configure typical report (3-5 tags, 24-hour range)
- [ ] Measure export time (use browser dev tools)
- [ ] Verify export completes in < 2 seconds
- [ ] Record actual time: _______ ms

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

### 12.2 Import Performance

- [ ] Import typical configuration file
- [ ] Measure import time (use browser dev tools)
- [ ] Verify import completes in < 2 seconds
- [ ] Record actual time: _______ ms

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

### 12.3 Large Configuration Performance

- [ ] Configure report with 20+ tags
- [ ] Measure export time
- [ ] Measure import time
- [ ] Verify reasonable performance (< 5 seconds)

**Result**: ✅ Pass / ❌ Fail  
**Notes**: _____________

---

## Summary

**Total Tests**: _______  
**Passed**: _______  
**Failed**: _______  
**Skipped**: _______  

**Pass Rate**: _______%

**Critical Issues Found**: _______

**Recommendations**:
- _______
- _______
- _______

**Sign-off**:
- Tester: _____________ Date: _______
- Reviewer: _____________ Date: _______

---

## Notes and Observations

_______________________________________________________________________
_______________________________________________________________________
_______________________________________________________________________
_______________________________________________________________________
