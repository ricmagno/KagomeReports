# Design Document: Interactive Guide Lines for Trends Chart

## 1. Overview

This document outlines the technical design for implementing interactive guide lines in the Trends chart section of the Report Preview. The feature will allow users to add, drag, and remove horizontal and vertical guide lines to measure and analyze data points precisely.

## 2. Architecture

### 2.1 Component Structure

The guide lines feature will be implemented as a new component that wraps or enhances the existing chart components:

```
client/src/components/charts/
├── InteractiveChart.tsx          # NEW: Wrapper component with guide lines
├── GuideLines.tsx                # NEW: Guide lines rendering and interaction
├── GuideLine.tsx                 # NEW: Individual guide line component
├── GuideLineControls.tsx         # NEW: Add/remove controls
├── CoordinateDisplay.tsx         # NEW: Coordinate value display
├── MultiTrendChart.tsx           # MODIFIED: Integrate with InteractiveChart
├── MiniChart.tsx                 # MODIFIED: Integrate with InteractiveChart
└── chartUtils.ts                 # MODIFIED: Add guide line utilities
```

### 2.2 Component Hierarchy

```
ReportPreview
└── InteractiveChart (NEW)
    ├── MultiTrendChart (existing, wrapped)
    ├── GuideLines (NEW)
    │   ├── GuideLine (horizontal) × N
    │   ├── GuideLine (vertical) × N
    │   └── CoordinateDisplay × N
    └── GuideLineControls (NEW)
```

## 3. Data Structures

### 3.1 Guide Line State

```typescript
interface GuideLine {
  id: string;                    // Unique identifier
  type: 'horizontal' | 'vertical';
  position: number;              // Y-value for horizontal, X-value (timestamp) for vertical
  color: string;                 // Visual color
  isDragging?: boolean;          // Drag state
}

interface GuideLineIntersection {
  guideLineId: string;
  tagName: string;
  x: number;                     // Pixel coordinate
  y: number;                     // Pixel coordinate
  xValue: number | Date;         // Actual X value (timestamp)
  yValue: number;                // Actual Y value
}

interface GuideLineState {
  lines: GuideLine[];
  intersections: GuideLineIntersection[];
  maxLines: {
    horizontal: number;          // Default: 5
    vertical: number;            // Default: 5
  };
}
```

### 3.2 Chart Coordinate System

```typescript
interface ChartBounds {
  leftPad: number;               // Left padding in pixels
  rightPad: number;              // Right padding in pixels
  topPad: number;                // Top padding in pixels
  bottomPad: number;             // Bottom padding in pixels
  width: number;                 // Total chart width
  height: number;                // Total chart height
  graphWidth: number;            // Actual graph area width
  graphHeight: number;           // Actual graph area height
}

interface ChartScale {
  xMin: number;                  // Minimum X value (timestamp)
  xMax: number;                  // Maximum X value (timestamp)
  yMin: number;                  // Minimum Y value
  yMax: number;                  // Maximum Y value
}
```

## 4. State Management

### 4.1 Local Component State

Guide lines will be managed using React's `useState` hook within the `InteractiveChart` component:

```typescript
const [guideLines, setGuideLines] = useState<GuideLine[]>([]);
const [dragState, setDragState] = useState<{
  lineId: string | null;
  startPosition: number;
  currentPosition: number;
} | null>(null);
```

### 4.2 State Persistence

Guide lines are **session-only** and will not be persisted:
- Guide lines reset when navigating away from the report preview
- Guide lines reset when changing report configuration
- No backend storage required

## 5. Coordinate Transformation

### 5.1 Pixel to Data Value Conversion

```typescript
// Convert pixel Y coordinate to data value
function pixelToDataY(pixelY: number, bounds: ChartBounds, scale: ChartScale): number {
  const graphY = pixelY - bounds.topPad;
  const ratio = 1 - (graphY / bounds.graphHeight); // Inverted because SVG Y increases downward
  return scale.yMin + (ratio * (scale.yMax - scale.yMin));
}

// Convert pixel X coordinate to timestamp
function pixelToDataX(pixelX: number, bounds: ChartBounds, scale: ChartScale): number {
  const graphX = pixelX - bounds.leftPad;
  const ratio = graphX / bounds.graphWidth;
  return scale.xMin + (ratio * (scale.xMax - scale.xMin));
}
```

### 5.2 Data Value to Pixel Conversion

```typescript
// Convert data Y value to pixel coordinate
function dataToPixelY(dataY: number, bounds: ChartBounds, scale: ChartScale): number {
  const ratio = (dataY - scale.yMin) / (scale.yMax - scale.yMin);
  return bounds.height - bounds.bottomPad - (ratio * bounds.graphHeight);
}

// Convert timestamp to pixel X coordinate
function dataToPixelX(dataX: number, bounds: ChartBounds, scale: ChartScale): number {
  const ratio = (dataX - scale.xMin) / (scale.xMax - scale.xMin);
  return bounds.leftPad + (ratio * bounds.graphWidth);
}
```

## 6. Interaction Handling

### 6.1 Adding Guide Lines

**User Action**: Click "Add Horizontal Line" or "Add Vertical Line" button

**Implementation**:
1. Generate unique ID using `crypto.randomUUID()` or timestamp
2. Calculate default position (center of chart for horizontal, current time for vertical)
3. Add new guide line to state
4. Validate against maximum line limit

```typescript
function addGuideLine(type: 'horizontal' | 'vertical') {
  if (guideLines.filter(l => l.type === type).length >= maxLines[type]) {
    // Show warning: maximum lines reached
    return;
  }
  
  const newLine: GuideLine = {
    id: crypto.randomUUID(),
    type,
    position: type === 'horizontal' 
      ? (scale.yMin + scale.yMax) / 2  // Center Y
      : Date.now(),                     // Current timestamp
    color: type === 'horizontal' ? '#3b82f6' : '#10b981',
  };
  
  setGuideLines([...guideLines, newLine]);
}
```

### 6.2 Dragging Guide Lines

**User Action**: Mouse down on guide line, drag, mouse up

**Implementation**:
1. **Mouse Down**: Capture line ID and initial position
2. **Mouse Move**: Calculate new position, constrain to chart bounds, update state
3. **Mouse Up**: Finalize position, clear drag state

```typescript
function handleMouseDown(lineId: string, event: React.MouseEvent) {
  const line = guideLines.find(l => l.id === lineId);
  if (!line) return;
  
  setDragState({
    lineId,
    startPosition: line.position,
    currentPosition: line.position,
  });
  
  // Prevent text selection during drag
  event.preventDefault();
}

function handleMouseMove(event: React.MouseEvent) {
  if (!dragState) return;
  
  const line = guideLines.find(l => l.id === dragState.lineId);
  if (!line) return;
  
  const rect = event.currentTarget.getBoundingClientRect();
  
  let newPosition: number;
  if (line.type === 'horizontal') {
    const pixelY = event.clientY - rect.top;
    newPosition = pixelToDataY(pixelY, bounds, scale);
    // Constrain to Y bounds
    newPosition = Math.max(scale.yMin, Math.min(scale.yMax, newPosition));
  } else {
    const pixelX = event.clientX - rect.left;
    newPosition = pixelToDataX(pixelX, bounds, scale);
    // Constrain to X bounds
    newPosition = Math.max(scale.xMin, Math.min(scale.xMax, newPosition));
  }
  
  setGuideLines(guideLines.map(l => 
    l.id === dragState.lineId 
      ? { ...l, position: newPosition, isDragging: true }
      : l
  ));
}

function handleMouseUp() {
  if (!dragState) return;
  
  setGuideLines(guideLines.map(l => 
    l.id === dragState.lineId 
      ? { ...l, isDragging: false }
      : l
  ));
  
  setDragState(null);
}
```

### 6.3 Removing Guide Lines

**User Action**: Click remove button on guide line or "Clear All" button

**Implementation**:
```typescript
function removeGuideLine(lineId: string) {
  setGuideLines(guideLines.filter(l => l.id !== lineId));
}

function clearAllGuideLines() {
  setGuideLines([]);
}
```

## 7. Intersection Detection

### 7.1 Algorithm

For each guide line, find the closest data points and interpolate if necessary:

```typescript
function calculateIntersections(
  guideLine: GuideLine,
  dataPoints: Record<string, TimeSeriesData[]>,
  bounds: ChartBounds,
  scale: ChartScale
): GuideLineIntersection[] {
  const intersections: GuideLineIntersection[] = [];
  
  if (guideLine.type === 'horizontal') {
    // For horizontal lines, find Y intersections for each tag
    Object.entries(dataPoints).forEach(([tagName, data]) => {
      const sortedData = [...data].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      // Find all points where the line crosses the data
      for (let i = 0; i < sortedData.length - 1; i++) {
        const p1 = sortedData[i];
        const p2 = sortedData[i + 1];
        
        // Check if guide line Y is between these two points
        if ((p1.value <= guideLine.position && p2.value >= guideLine.position) ||
            (p1.value >= guideLine.position && p2.value <= guideLine.position)) {
          
          // Interpolate X position (timestamp)
          const ratio = (guideLine.position - p1.value) / (p2.value - p1.value);
          const t1 = new Date(p1.timestamp).getTime();
          const t2 = new Date(p2.timestamp).getTime();
          const xValue = t1 + ratio * (t2 - t1);
          
          intersections.push({
            guideLineId: guideLine.id,
            tagName,
            x: dataToPixelX(xValue, bounds, scale),
            y: dataToPixelY(guideLine.position, bounds, scale),
            xValue: new Date(xValue),
            yValue: guideLine.position,
          });
        }
      }
    });
  } else {
    // For vertical lines, find X intersections for each tag
    Object.entries(dataPoints).forEach(([tagName, data]) => {
      const sortedData = [...data].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      // Find the closest data point to the guide line timestamp
      const targetTime = guideLine.position;
      let closestPoint = sortedData[0];
      let minDiff = Math.abs(new Date(closestPoint.timestamp).getTime() - targetTime);
      
      for (const point of sortedData) {
        const diff = Math.abs(new Date(point.timestamp).getTime() - targetTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestPoint = point;
        }
      }
      
      // Interpolate if we have adjacent points
      const pointTime = new Date(closestPoint.timestamp).getTime();
      const pointIndex = sortedData.indexOf(closestPoint);
      
      let yValue = closestPoint.value;
      
      if (pointTime < targetTime && pointIndex < sortedData.length - 1) {
        // Interpolate between this point and next
        const nextPoint = sortedData[pointIndex + 1];
        const nextTime = new Date(nextPoint.timestamp).getTime();
        const ratio = (targetTime - pointTime) / (nextTime - pointTime);
        yValue = closestPoint.value + ratio * (nextPoint.value - closestPoint.value);
      } else if (pointTime > targetTime && pointIndex > 0) {
        // Interpolate between previous point and this
        const prevPoint = sortedData[pointIndex - 1];
        const prevTime = new Date(prevPoint.timestamp).getTime();
        const ratio = (targetTime - prevTime) / (pointTime - prevTime);
        yValue = prevPoint.value + ratio * (closestPoint.value - prevPoint.value);
      }
      
      intersections.push({
        guideLineId: guideLine.id,
        tagName,
        x: dataToPixelX(targetTime, bounds, scale),
        y: dataToPixelY(yValue, bounds, scale),
        xValue: new Date(targetTime),
        yValue,
      });
    });
  }
  
  return intersections;
}
```

## 8. Visual Design

### 8.1 Guide Line Styling

```typescript
const guideLineStyles = {
  horizontal: {
    stroke: '#3b82f6',           // Blue
    strokeWidth: 2,
    strokeDasharray: '6 4',
    opacity: 0.7,
    cursor: 'ns-resize',         // North-south resize cursor
  },
  vertical: {
    stroke: '#10b981',           // Green
    strokeWidth: 2,
    strokeDasharray: '6 4',
    opacity: 0.7,
    cursor: 'ew-resize',         // East-west resize cursor
  },
  dragging: {
    opacity: 0.9,
    strokeWidth: 3,
  },
  hover: {
    opacity: 0.85,
    strokeWidth: 2.5,
  },
};
```

### 8.2 Coordinate Display Styling

```typescript
const coordinateDisplayStyles = {
  background: 'rgba(255, 255, 255, 0.95)',
  border: '1px solid #e5e7eb',
  borderRadius: '4px',
  padding: '4px 8px',
  fontSize: '11px',
  fontFamily: 'monospace',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
};
```

### 8.3 Intersection Point Styling

```typescript
const intersectionStyles = {
  radius: 4,
  fill: '#ef4444',               // Red
  stroke: '#ffffff',
  strokeWidth: 2,
  opacity: 0.9,
};
```

## 9. Responsive Behavior

### 9.1 Chart Resize Handling

When the chart is resized (window resize, container resize):

1. Recalculate chart bounds
2. Maintain guide line positions in **data space** (not pixel space)
3. Recalculate pixel positions based on new bounds
4. Update intersection calculations

```typescript
useEffect(() => {
  function handleResize() {
    // Recalculate bounds and scale
    const newBounds = calculateChartBounds();
    const newScale = calculateChartScale();
    
    // Guide line positions are already in data space, so they automatically
    // adjust when we recalculate pixel positions in the render
    setBounds(newBounds);
    setScale(newScale);
  }
  
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

## 10. Performance Considerations

### 10.1 Optimization Strategies

1. **Debounce intersection calculations** during drag operations
2. **Memoize coordinate transformations** using `useMemo`
3. **Limit maximum guide lines** to prevent performance degradation
4. **Use CSS transforms** for smooth dragging animations
5. **Throttle mouse move events** during drag operations

```typescript
const calculateIntersectionsMemo = useMemo(() => {
  return guideLines.map(line => 
    calculateIntersections(line, dataPoints, bounds, scale)
  ).flat();
}, [guideLines, dataPoints, bounds, scale]);

// Throttle mouse move during drag
const throttledMouseMove = useCallback(
  throttle((event: React.MouseEvent) => {
    handleMouseMove(event);
  }, 16), // ~60fps
  [dragState]
);
```

## 11. Accessibility

### 11.1 Keyboard Navigation

- **Tab**: Focus on guide line controls
- **Enter/Space**: Add guide line
- **Arrow Keys**: Move focused guide line (when implemented)
- **Delete**: Remove focused guide line

### 11.2 ARIA Attributes

```typescript
<button
  aria-label="Add horizontal guide line"
  aria-describedby="guide-line-help"
  onClick={() => addGuideLine('horizontal')}
>
  Add Horizontal Line
</button>

<div
  role="slider"
  aria-label={`${line.type} guide line at ${formatPosition(line.position)}`}
  aria-valuemin={line.type === 'horizontal' ? scale.yMin : scale.xMin}
  aria-valuemax={line.type === 'horizontal' ? scale.yMax : scale.xMax}
  aria-valuenow={line.position}
  tabIndex={0}
>
  {/* Guide line SVG */}
</div>
```

## 12. Integration Points

### 12.1 ReportPreview Component

Modify the "Data Preview" section (to be renamed "Trends") to use `InteractiveChart`:

```typescript
// Before
<MultiTrendChart
  dataPoints={previewData.dataPoints}
  tagDescriptions={previewData.tagDescriptions}
  tags={config.tags}
  title={config.name}
  description={config.description}
  width={800}
  height={320}
/>

// After
<InteractiveChart
  dataPoints={previewData.dataPoints}
  tagDescriptions={previewData.tagDescriptions}
  tags={config.tags}
  title={config.name}
  description={config.description}
  width={800}
  height={320}
  enableGuideLines={true}
/>
```

### 12.2 Section Label Update

Update the section heading from "Data Preview" to "Trends":

```typescript
// Before
<h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center">
  <BarChart3 className="w-4 h-4 mr-2" />
  Data Preview
</h4>

// After
<h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center">
  <TrendingUp className="w-4 h-4 mr-2" />
  Trends
</h4>
```

## 13. Testing Strategy

### 13.1 Unit Tests

- Coordinate transformation functions
- Intersection detection algorithm
- Guide line state management
- Boundary constraint logic

### 13.2 Integration Tests

- Adding/removing guide lines
- Dragging guide lines
- Chart resize behavior
- Multiple guide lines interaction

### 13.3 Manual Testing Checklist

- [ ] Add horizontal guide line
- [ ] Add vertical guide line
- [ ] Drag guide lines smoothly
- [ ] Guide lines constrained to chart bounds
- [ ] Coordinate displays update in real-time
- [ ] Intersections calculated correctly
- [ ] Remove individual guide lines
- [ ] Clear all guide lines
- [ ] Chart resize maintains guide line positions
- [ ] Maximum line limit enforced
- [ ] Visual feedback on hover
- [ ] Visual feedback during drag

## 14. Future Enhancements

Potential features for future iterations:

1. **Snap to data points**: Guide lines snap to nearest data point
2. **Guide line labels**: Custom labels for guide lines
3. **Guide line persistence**: Save guide lines with report configuration
4. **Crosshair mode**: Linked horizontal and vertical guide lines
5. **Measurement mode**: Display distance/difference between two guide lines
6. **Export guide line data**: Export intersection values to CSV
7. **Touch support**: Mobile/tablet drag support
8. **Keyboard fine-tuning**: Arrow keys for precise positioning

## 15. Dependencies

### 15.1 New Dependencies

None required - implementation uses existing React and TypeScript features.

### 15.2 Existing Dependencies

- React (hooks: useState, useEffect, useMemo, useCallback)
- TypeScript
- Tailwind CSS (for styling)
- Lucide React (for icons)

## 16. File Size Impact

Estimated additions:
- `InteractiveChart.tsx`: ~300 lines
- `GuideLines.tsx`: ~200 lines
- `GuideLine.tsx`: ~150 lines
- `GuideLineControls.tsx`: ~100 lines
- `CoordinateDisplay.tsx`: ~80 lines
- `chartUtils.ts` additions: ~150 lines

**Total**: ~980 lines of new code
