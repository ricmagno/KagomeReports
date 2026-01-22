# PDF Rendering Fixes - Implementation Specification

## Overview

This document specifies the fixes for 10 critical PDF rendering issues identified in the Historian Reports application.

## Issues and Solutions

### Issue 1: Chart Resolution Too Low
**Problem**: Charts are 800x400 pixels, too low for print quality
**Solution**: Increase to 1200x600 pixels

**Files to Modify**:
- `src/services/chartGeneration.ts` - Update defaultWidth and defaultHeight in constructor
- `src/services/reportGeneration.ts` - Update chart generation calls (lines ~270, ~285)

**Changes**:
```typescript
// In chartGeneration.ts constructor:
this.defaultWidth = 1200;  // Was 800
this.defaultHeight = 600;  // Was 400

// In reportGeneration.ts chart generation calls:
width: 1200,  // Was 800
height: 600   // Was 400
```

### Issue 2: Chart Width Not Full Page
**Problem**: Charts use 450px fit width, not utilizing full page width
**Solution**: Use full page width minus margins (515px for A4)

**Files to Modify**:
- `src/services/reportGeneration.ts` - addChartsSection method (line ~750)

**Changes**:
```typescript
// In addChartsSection method:
const chartWidth = 515;  // Was 450 - full page width minus margins
const chartHeight = 350; // Was 300 - proportional increase
```

### Issue 3: SPC Metrics Table Symbols Incorrect
**Problem**: Unicode characters (X̄, σest) display as garbled text
**Solution**: Use ASCII alternatives or proper UTF-8 encoding

**Files to Modify**:
- `src/services/reportGeneration.ts` - addSPCMetricsTable method (line ~1200)

**Changes**:
```typescript
// Replace Unicode symbols with ASCII alternatives:
const headers = ['Tag Name', 'Mean', 'StdDev', 'LSL', 'USL', 'Cp', 'Cpk', 'Capability'];
// Was: ['Tag Name', 'X̄', 'σest', 'LSL', 'USL', 'Cp', 'Cpk', 'Capability']
```

### Issue 4: SPC Metrics Showing N/A
**Problem**: Most metrics show N/A because specification limits are missing
**Solution**: This is actually correct behavior - N/A should show when spec limits aren't provided. However, we need to ensure the test data includes spec limits.

**Action**: Document this as expected behavior. Users must provide specification limits to see Cp/Cpk values.

### Issue 5: Statistics Not Displayed on Charts
**Problem**: Statistics annotation box is positioned outside visible area
**Solution**: Fix annotation positioning to be inside chart bounds

**Files to Modify**:
- `src/services/chartGeneration.ts` - generateLineChart method, annotation configuration

**Changes**:
```typescript
// In generateLineChart, fix statsBox annotation:
annotations.statsBox = {
  type: 'label',
  xValue: (ctx: any) => {
    const xScale = ctx.chart.scales.x;
    return xScale.max - (xScale.max - xScale.min) * 0.05; // 5% from right edge
  },
  yValue: (ctx: any) => {
    const yScale = ctx.chart.scales.y;
    return yScale.max - (yScale.max - yScale.min) * 0.05; // 5% from top
  },
  xAdjust: -10,
  yAdjust: 10,
  // ... rest of config
};
```

### Issue 6: Trend Line Calculation Incorrect
**Problem**: Need to verify linear regression algorithm
**Solution**: Review and test the calculation in statisticalAnalysis.ts

**Action**: Add logging and verification tests to ensure trend line calculations are correct.

### Issue 7: Legend Cut Off
**Problem**: Chart legend extends beyond visible area
**Solution**: Adjust legend positioning and chart layout

**Files to Modify**:
- `src/services/chartGeneration.ts` - chart configuration

**Changes**:
```typescript
// In chart options:
plugins: {
  legend: {
    display: true,
    position: 'top',
    labels: {
      color: '#000000',
      font: {
        size: 10
      },
      usePointStyle: false,
      boxWidth: 15,  // Reduce box width
      padding: 8     // Reduce padding
    },
    maxHeight: 60    // Limit legend height
  }
}
```

### Issue 8: Header Too Close to Content
**Problem**: Header ends at y=75, content starts immediately after
**Solution**: Increase spacing after header

**Files to Modify**:
- `src/services/reportGeneration.ts` - addReportHeader method

**Changes**:
```typescript
// In addReportHeader method:
doc.y = 90;  // Was 75 - add 15px more spacing
```

### Issue 9: Executive Summary Misaligned
**Problem**: Text appears tabbed too far right
**Solution**: Remove or fix text positioning constraints

**Files to Modify**:
- `src/services/reportGeneration.ts` - addExecutiveSummary method

**Changes**:
```typescript
// In addExecutiveSummary method:
// Ensure text starts at left margin (40px)
doc.fontSize(14)
  .fillColor('#111827')
  .font('Helvetica-Bold')
  .text('Executive Summary', 40);  // Explicit x position

doc.moveDown(0.5);

doc.fontSize(12)
  .fillColor('#111827')
  .font('Helvetica')
  .text(`This report analyzes...`, 40, doc.y, {  // Explicit x position
    width: doc.page.width - 80,  // Full width minus margins
    align: 'left'
  });
```

### Issue 10: Statistical Summary Title Misaligned
**Problem**: Same as Issue 9
**Solution**: Same fix as Issue 9

**Files to Modify**:
- `src/services/reportGeneration.ts` - addStatisticalSummary method

**Changes**:
```typescript
// In addStatisticalSummary method:
doc.fontSize(14)
  .fillColor('#111827')
  .font('Helvetica-Bold')
  .text('Statistical Summary', 40);  // Explicit x position
```

## Implementation Order

1. **Phase 1: Chart Quality** (30 minutes)
   - Issue 1: Increase chart resolution
   - Issue 2: Increase chart width
   - Issue 7: Fix legend positioning

2. **Phase 2: Text & Layout** (20 minutes)
   - Issue 3: Fix SPC table symbols
   - Issue 8: Increase header spacing
   - Issue 9: Fix Executive Summary alignment
   - Issue 10: Fix Statistical Summary alignment

3. **Phase 3: Chart Annotations** (20 minutes)
   - Issue 5: Fix statistics display positioning

4. **Phase 4: Verification** (15 minutes)
   - Issue 4: Document N/A behavior
   - Issue 6: Verify trend line calculations
   - Generate test reports
   - Review print quality

## Testing Checklist

After implementation:
- [ ] Generate test report with analog tags
- [ ] Verify chart resolution is 1200x600
- [ ] Verify charts span full page width
- [ ] Verify SPC table symbols display correctly (Mean, StdDev)
- [ ] Verify statistics box is visible on charts
- [ ] Verify legend is fully visible
- [ ] Verify proper spacing after header
- [ ] Verify Executive Summary is left-aligned
- [ ] Verify Statistical Summary is left-aligned
- [ ] Print test report to verify print quality
- [ ] Verify trend line calculations are accurate

## Files to Modify Summary

1. `src/services/chartGeneration.ts`
   - Constructor: Update default dimensions
   - generateLineChart: Fix statistics annotation positioning
   - Chart options: Fix legend configuration

2. `src/services/reportGeneration.ts`
   - Chart generation calls: Update dimensions
   - addChartsSection: Update chart fit dimensions
   - addSPCMetricsTable: Fix table headers
   - addReportHeader: Increase spacing
   - addExecutiveSummary: Fix text positioning
   - addStatisticalSummary: Fix text positioning

## Expected Outcomes

After fixes:
- Charts will be crisp and clear when printed
- All text will be properly aligned and readable
- Statistics will be visible on charts
- Legends will be fully visible
- Professional layout with proper spacing
- SPC table will display correctly with readable symbols
