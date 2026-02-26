# Guide Lines Coordinate System Fix

## Problem Summary
The guide lines were misaligned with the chart because:
1. The overlay was positioned with hardcoded pixel offsets that didn't match the actual chart SVG position
2. The coordinate transformation functions included padding offsets when the SVG was already positioned to only cover the graph area
3. Missing 'px' unit on the top style property

## Solution Implemented

### 1. Fixed Overlay Positioning (InteractiveChart.tsx)
Changed the guide lines overlay container to:
- **Top**: `100px` (card padding 24px + header section ~76px)
- **Left**: `84px` (card padding 24px + left axis padding 60px)
- **Width**: `bounds.graphWidth` (only the graph area, not full width)
- **Height**: `bounds.graphHeight` (only the graph area, not full height)

### 2. Updated Coordinate System (All Components)
Changed from "full chart with padding" to "graph area only":

**Before**: SVG covered entire chart including padding, coordinates included offsets
**After**: SVG covers only the graph area, coordinates are relative to graph (0,0) = top-left of graph

### 3. Updated Components

#### GuideLines.tsx
- SVG dimensions changed from `bounds.width/height` to `bounds.graphWidth/graphHeight`
- Interaction overlay rect uses graph dimensions

#### GuideLine.tsx
- Line endpoints no longer include padding offsets
- Start from (0,0) for graph area instead of (leftPad, topPad)
- Remove button positions adjusted accordingly
- Coordinate displays adjusted

#### chartUtils.ts
- `pixelToDataY()`: Removed `bounds.topPad` offset
- `pixelToDataX()`: Removed `bounds.leftPad` offset
- `dataToPixelY()`: Returns position relative to graph area (0 to graphHeight)
- `dataToPixelX()`: Returns position relative to graph area (0 to graphWidth)

## What Changed

### Coordinate Transformation Logic

**Old System** (with padding):
```typescript
// Converting pixel to data
const graphY = pixelY - bounds.topPad;  // Remove padding offset
const ratio = 1 - (graphY / bounds.graphHeight);

// Converting data to pixel
return bounds.height - bounds.bottomPad - (ratio * bounds.graphHeight);
```

**New System** (graph-only):
```typescript
// Converting pixel to data
const ratio = 1 - (pixelY / bounds.graphHeight);  // No offset needed

// Converting data to pixel
return bounds.graphHeight - (ratio * bounds.graphHeight);
```

## Testing Instructions

1. **Refresh the browser** to load the new build
2. **Navigate to a report preview** with data
3. **Test Horizontal Lines**:
   - Click "Add Horizontal" button
   - Line should appear in the middle of the graph
   - Drag the line up and down - it should stay aligned with the Y-axis values
   - The coordinate display should show the correct Y value
   - The line should span the full width of the graph area

4. **Test Vertical Lines**:
   - Click "Add Vertical" button
   - Line should appear in the middle of the graph
   - Drag the line left and right - it should stay aligned with the time axis
   - The coordinate display should show the correct timestamp
   - The line should span the full height of the graph area

5. **Test Intersections**:
   - Add both horizontal and vertical lines
   - Red dots should appear where lines cross data series
   - Hover over dots to see tooltip with tag name, time, and value

6. **Test Remove Buttons**:
   - Hover over a line - X button should appear
   - Click X to remove the line
   - Click "Clear All" to remove all lines

## Expected Behavior

- **Horizontal lines**: Should align perfectly with Y-axis grid lines and values
- **Vertical lines**: Should align perfectly with time axis labels
- **Dragging**: Lines should move smoothly and stay within graph bounds
- **Scale**: The range of movement should match the data range exactly
- **Intersections**: Red dots should appear exactly where lines cross data points

## If Issues Persist

If horizontal lines are still misaligned:
1. Check Safari console (⌘ + ⌥ + C) for any errors
2. Compare the logged scale values:
   - "MultiTrendChart Scale" (from the chart)
   - "Guide Lines Scale" (from the guide lines)
   - These should match exactly

If vertical lines don't show:
1. Check if they're being created (counter should increment)
2. Check console for errors
3. Verify the line position is within the time range

## Manual Adjustment (If Needed)

If fine-tuning is still needed, adjust the overlay position in `client/src/components/charts/InteractiveChart.tsx` around line 185:

```typescript
style={{
  top: '100px',  // Increase to move lines DOWN, decrease to move UP
  left: '84px',  // Increase to move lines RIGHT, decrease to move LEFT
  width: `${bounds.graphWidth}px`,
  height: `${bounds.graphHeight}px`,
}}
```

## Files Modified

1. `client/src/components/charts/InteractiveChart.tsx` - Overlay positioning
2. `client/src/components/charts/GuideLines.tsx` - SVG dimensions
3. `client/src/components/charts/GuideLine.tsx` - Line rendering coordinates
4. `client/src/components/charts/chartUtils.ts` - Coordinate transformations
5. `client/src/utils/intersectionDetection.ts` - Uses updated transformations (no changes needed)

## Technical Notes

The key insight is that the guide lines overlay should be positioned to exactly match the graph area of the chart, not the entire chart card. This means:
- The overlay starts where the graph starts (after padding and header)
- The overlay dimensions match only the graph area
- All coordinates within the overlay are relative to the graph (0,0) = top-left of graph
- No padding offsets are needed in coordinate transformations
