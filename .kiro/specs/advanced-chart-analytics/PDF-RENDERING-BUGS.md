# PDF Rendering Bugs - Critical Issues

## Summary

Multiple critical rendering issues identified in the PDF report generation that affect readability, layout, and data accuracy.

## Issues Identified

### 1. Chart Resolution Too Low ❌
**Problem**: Both SPC charts and time-series trend charts have low resolution, making them difficult to read when printed.

**Current**: 800x400 pixels
**Required**: Increase to at least 1200x600 pixels for better print quality

**Files Affected**:
- `src/services/reportGeneration.ts` (lines ~270, ~285)
- `src/services/chartGeneration.ts` (default dimensions)

### 2. Chart Width Not Full Page ❌
**Problem**: Charts don't span the full printable width of the page.

**Current**: 450px fit width in PDF
**Required**: Use full page width minus margins (~515px for A4)

**Files Affected**:
- `src/services/reportGeneration.ts` (addChartsSection method, line ~750)

### 3. SPC Metrics Table Symbols Incorrect ❌
**Problem**: Special characters (X̄, σest) are displaying as garbled text (X0@<6W7@).

**Current**: Using Unicode characters directly
**Required**: Use proper UTF-8 encoding or ASCII alternatives

**Files Affected**:
- `src/services/reportGeneration.ts` (addSPCMetricsTable method, line ~1200)

### 4. SPC Metrics Showing N/A ❌
**Problem**: Most SPC metrics calculations are showing as "N/A" instead of actual values.

**Root Cause**: Likely missing specification limits or calculation errors

**Files Affected**:
- `src/services/statisticalAnalysis.ts` (SPC calculation logic)
- `src/services/reportGeneration.ts` (SPC metrics generation)

### 5. Statistics Not Displayed on Charts ❌
**Problem**: Min, Max, Average statistics are not visible on time-series charts.

**Root Cause**: Statistics box annotation may be positioned outside visible area or not rendering

**Files Affected**:
- `src/services/chartGeneration.ts` (generateLineChart method, annotation configuration)

### 6. Trend Line Calculation Incorrect ❌
**Problem**: Data trend line is calculated incorrectly.

**Root Cause**: Need to verify linear regression algorithm

**Files Affected**:
- `src/services/statisticalAnalysis.ts` (calculateTrendLine method)

### 7. Legend Cut Off ❌
**Problem**: Chart legend is mostly outside the graph area and cut off.

**Root Cause**: Legend positioning or chart canvas size issue

**Files Affected**:
- `src/services/chartGeneration.ts` (chart configuration, legend settings)

### 8. Header Too Close to Content ❌
**Problem**: Page header overlaps with content, not enough spacing.

**Current**: Header ends at y=75
**Required**: Push content start to y=100 or more

**Files Affected**:
- `src/services/reportGeneration.ts` (addReportHeader method)

### 9. Executive Summary Misaligned ❌
**Problem**: Executive Summary text appears as second column or tabbed too far right.

**Root Cause**: Incorrect text positioning or width constraints

**Files Affected**:
- `src/services/reportGeneration.ts` (addExecutiveSummary method)

### 10. Statistical Summary Title Misaligned ❌
**Problem**: Statistical Summary title has same alignment issue as Executive Summary.

**Files Affected**:
- `src/services/reportGeneration.ts` (addStatisticalSummary method)

## Priority

**P0 (Critical - Blocks Usage)**:
1. Chart resolution too low
2. SPC metrics symbols incorrect
3. Statistics not displayed on charts
4. Legend cut off

**P1 (High - Affects Quality)**:
5. Chart width not full page
6. Header too close to content
7. Executive Summary misaligned
8. Statistical Summary title misaligned

**P2 (Medium - Data Accuracy)**:
9. SPC metrics showing N/A
10. Trend line calculation incorrect

## Fix Strategy

### Phase 1: Chart Rendering (P0)
1. Increase chart resolution to 1200x600
2. Fix chart width to use full page width
3. Fix statistics annotation positioning
4. Fix legend positioning and sizing

### Phase 2: Text Encoding (P0)
5. Fix SPC metrics table symbols using proper encoding

### Phase 3: Layout (P1)
6. Increase header spacing
7. Fix Executive Summary alignment
8. Fix Statistical Summary alignment

### Phase 4: Calculations (P2)
9. Debug SPC metrics N/A issue
10. Verify trend line calculation

## Testing Plan

After fixes:
1. Generate test report with analog tags
2. Verify chart resolution and clarity
3. Verify all text displays correctly
4. Verify statistics are visible
5. Verify proper spacing and alignment
6. Print test to verify print quality
