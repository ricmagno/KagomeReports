# Chart Guide Lines Feature - PARKED

**Status**: PARKED - Implementation incomplete due to coordinate system alignment issues

**Date Parked**: January 16, 2026

## Summary

The interactive guide lines feature for trend charts was implemented but has persistent alignment issues that prevent it from working correctly. After multiple attempts to fix the coordinate system, the feature remains non-functional.

## What Was Completed

### Phase 1: Foundation (✅ Complete)
- Created TypeScript types for guide lines (`client/src/types/guideLines.ts`)
- Implemented coordinate transformation utilities (`client/src/components/charts/chartUtils.ts`)
- Created intersection detection algorithm (`client/src/utils/intersectionDetection.ts`)
- Implemented chart bounds calculator (`client/src/utils/chartBounds.ts`)

### Phase 2: Core Components (✅ Complete)
- Created `CoordinateDisplay` component
- Created `GuideLine` component (individual draggable line)
- Created `GuideLineControls` component (add/remove buttons)
- Created `GuideLines` container component
- Created `InteractiveChart` wrapper component

### Phase 3: Integration (✅ Complete)
- Updated chart exports
- Integrated `InteractiveChart` into `ReportPreview`
- Renamed "Data Preview" section to "Trends"
- Changed button icons to ArrowLeftRight/ArrowUpDown

## Critical Issues (Unresolved)

### 1. Horizontal Line Misalignment
- **Problem**: Horizontal guide lines appear shifted up by approximately 20% (~64px on 320px chart)
- **Root Cause**: The overlay positioning doesn't accurately match the chart SVG location
- **Attempted Fixes**: 
  - Adjusted hardcoded pixel offsets multiple times
  - Changed coordinate system from "full chart with padding" to "graph area only"
  - Updated all coordinate transformation functions
  - None of the fixes resolved the alignment issue

### 2. Vertical Lines Not Showing
- **Problem**: Vertical guide lines don't appear at all (counter increments but no visual line)
- **Root Cause**: Lines may be drawn outside visible SVG area or coordinate calculations are incorrect
- **Attempted Fixes**:
  - Fixed SVG width calculation (changed from `bounds.width` to `bounds.graphWidth`)
  - Updated coordinate transformations
  - Issue persists

### 3. Scale Mismatch
- **Problem**: User reports "the scale of the graph and the range of vertical movement of the horizontal line do not match"
- **Root Cause**: The scale calculation in `calculateChartScale()` may not match the scale used internally by `MultiTrendChart`
- **Debug Attempt**: Added console logging to compare scales, but user hasn't checked console output yet

## Technical Challenges

### Coordinate System Complexity
The main challenge is aligning an absolutely-positioned SVG overlay with the chart's internal SVG coordinate system:

1. **MultiTrendChart Structure**:
   - Card with `p-6` padding (24px)
   - Header section with title and description
   - SVG with internal padding (leftPad: 60px, rightPad: 20px, topPad: 20px, bottomPad: 40px)
   - SVG width is `width - 40` (not full width)

2. **Overlay Positioning**:
   - Must calculate exact pixel offset from card top to graph area
   - Must account for all padding and header heights
   - Current approach uses hardcoded offsets which don't work reliably

3. **Coordinate Transformations**:
   - Need to convert between data values and pixel positions
   - Must match the exact scale and coordinate system used by the chart
   - Multiple coordinate spaces: card space, SVG space, graph space, data space

## Files Involved

### Core Implementation
- `client/src/types/guideLines.ts` - Type definitions
- `client/src/components/charts/InteractiveChart.tsx` - Main wrapper component
- `client/src/components/charts/GuideLines.tsx` - Container for all guide lines
- `client/src/components/charts/GuideLine.tsx` - Individual guide line
- `client/src/components/charts/GuideLineControls.tsx` - UI controls
- `client/src/components/charts/CoordinateDisplay.tsx` - Coordinate labels
- `client/src/components/charts/chartUtils.ts` - Coordinate transformations
- `client/src/utils/chartBounds.ts` - Bounds and scale calculations
- `client/src/utils/intersectionDetection.ts` - Intersection algorithm

### Integration Points
- `client/src/components/reports/ReportPreview.tsx` - Uses InteractiveChart
- `client/src/components/charts/index.ts` - Exports
- `client/src/components/charts/MultiTrendChart.tsx` - Target chart component

### Documentation
- `.kiro/specs/chart-guide-lines/requirements.md` - Feature requirements
- `.kiro/specs/chart-guide-lines/design.md` - Technical design
- `.kiro/specs/chart-guide-lines/tasks.md` - Implementation tasks
- `GUIDE-LINES-FIX.md` - Latest fix attempt documentation
- `AGENTS.md` - Updated with guide lines documentation

## Recommendations for Future Work

### Option 1: Render Inside Chart SVG (Recommended)
Instead of using an absolutely-positioned overlay, render guide lines directly inside the `MultiTrendChart` SVG:
- **Pros**: No positioning issues, coordinates naturally align
- **Cons**: Requires modifying MultiTrendChart component, more coupling

### Option 2: Use React Refs for Dynamic Positioning
Get the actual chart SVG position dynamically using refs:
- **Pros**: More accurate positioning, adapts to layout changes
- **Cons**: More complex, may have timing issues

### Option 3: Simplify Chart Structure
Refactor MultiTrendChart to have a more predictable structure:
- **Pros**: Easier to overlay, more maintainable
- **Cons**: Requires significant refactoring of existing chart

### Option 4: Use Canvas Instead of SVG
Render both chart and guide lines on HTML Canvas:
- **Pros**: Single coordinate system, better performance
- **Cons**: Complete rewrite, loses SVG benefits (scaling, accessibility)

## How to Resume

If resuming this feature:

1. **First, diagnose the scale issue**:
   - Have user check Safari console (⌘ + ⌥ + C)
   - Compare "MultiTrendChart Scale" vs "Guide Lines Scale" logs
   - Verify they match exactly

2. **Consider Option 1 (render inside SVG)**:
   - Modify `MultiTrendChart` to accept optional `guideLines` prop
   - Render guide lines as part of the chart's SVG
   - This eliminates all positioning issues

3. **If sticking with overlay approach**:
   - Use refs to get actual chart SVG bounding rect
   - Calculate overlay position dynamically
   - Test with different screen sizes and zoom levels

## User Feedback

- "horizontal line is still up by around 20%"
- "vertical lines still not showing"
- "the scale of the graph and the range of vertical movement of the horizontal line do not match"
- "zero progress" (after multiple fix attempts)

## Conclusion

This feature requires a fundamental rethinking of the approach. The overlay positioning strategy has proven unreliable. The recommended path forward is to render guide lines directly inside the chart SVG rather than as an external overlay.

The feature is parked until a better architectural approach can be implemented.
