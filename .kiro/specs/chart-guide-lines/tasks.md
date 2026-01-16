# Tasks Document: Interactive Guide Lines Implementation

## Overview

This document breaks down the implementation of interactive guide lines into discrete, actionable tasks. Tasks are organized by component and ordered for logical development flow.

## Task Categories

1. **Foundation**: Core utilities and types
2. **Components**: React component implementation
3. **Integration**: Integration with existing components
4. **Polish**: Visual refinements and UX improvements
5. **Testing**: Test coverage
6. **Documentation**: Update project documentation

---

## Phase 1: Foundation (Tasks 1-4)

### Task 1: Create TypeScript Types and Interfaces

**File**: `client/src/types/guideLines.ts` (NEW)

**Description**: Define all TypeScript interfaces for guide lines feature

**Acceptance Criteria**:
- [ ] Create `GuideLine` interface
- [ ] Create `GuideLineIntersection` interface
- [ ] Create `GuideLineState` interface
- [ ] Create `ChartBounds` interface
- [ ] Create `ChartScale` interface
- [ ] Export all types

**Estimated Time**: 30 minutes

---

### Task 2: Create Coordinate Transformation Utilities

**File**: `client/src/components/charts/chartUtils.ts` (MODIFY)

**Description**: Add utility functions for converting between pixel and data coordinates

**Acceptance Criteria**:
- [ ] Implement `pixelToDataY()` function
- [ ] Implement `pixelToDataX()` function
- [ ] Implement `dataToPixelY()` function
- [ ] Implement `dataToPixelX()` function
- [ ] Add unit tests for coordinate transformations
- [ ] Handle edge cases (zero range, invalid bounds)

**Estimated Time**: 1 hour

---

### Task 3: Create Intersection Detection Algorithm

**File**: `client/src/utils/intersectionDetection.ts` (NEW)

**Description**: Implement algorithm to find where guide lines intersect with data series

**Acceptance Criteria**:
- [ ] Implement `calculateIntersections()` function
- [ ] Handle horizontal guide line intersections
- [ ] Handle vertical guide line intersections
- [ ] Implement linear interpolation for accurate intersection points
- [ ] Handle edge cases (no data, single point, etc.)
- [ ] Add unit tests for intersection detection

**Estimated Time**: 2 hours

---

### Task 4: Create Chart Bounds Calculator

**File**: `client/src/utils/chartBounds.ts` (NEW)

**Description**: Utility to calculate chart bounds and scale from chart dimensions and data

**Acceptance Criteria**:
- [ ] Implement `calculateChartBounds()` function
- [ ] Implement `calculateChartScale()` function
- [ ] Extract bounds from existing chart components
- [ ] Handle different chart sizes
- [ ] Add unit tests

**Estimated Time**: 1 hour

---

## Phase 2: Core Components (Tasks 5-9)

### Task 5: Create CoordinateDisplay Component

**File**: `client/src/components/charts/CoordinateDisplay.tsx` (NEW)

**Description**: Component to display X and Y coordinate values

**Acceptance Criteria**:
- [ ] Create functional component with TypeScript props
- [ ] Display formatted Y value for horizontal guide lines
- [ ] Display formatted timestamp for vertical guide lines
- [ ] Position display near guide line without obscuring data
- [ ] Style with Tailwind CSS (white background, border, shadow)
- [ ] Format numbers to 2 decimal places
- [ ] Format timestamps as readable time strings
- [ ] Handle units display if provided

**Estimated Time**: 1.5 hours

---

### Task 6: Create GuideLine Component

**File**: `client/src/components/charts/GuideLine.tsx` (NEW)

**Description**: Individual guide line component with drag functionality

**Acceptance Criteria**:
- [ ] Create functional component with TypeScript props
- [ ] Render SVG line (horizontal or vertical)
- [ ] Apply appropriate styling (dashed line, color)
- [ ] Implement mouse down handler to initiate drag
- [ ] Show appropriate cursor (ns-resize or ew-resize)
- [ ] Apply hover effects (opacity, stroke width)
- [ ] Apply dragging effects
- [ ] Include remove button (small X icon)
- [ ] Integrate CoordinateDisplay component
- [ ] Add ARIA attributes for accessibility

**Estimated Time**: 2 hours

---

### Task 7: Create GuideLineControls Component

**File**: `client/src/components/charts/GuideLineControls.tsx` (NEW)

**Description**: Control panel for adding and removing guide lines

**Acceptance Criteria**:
- [ ] Create functional component with TypeScript props
- [ ] Add "Add Horizontal Line" button with icon
- [ ] Add "Add Vertical Line" button with icon
- [ ] Add "Clear All" button
- [ ] Disable buttons when maximum lines reached
- [ ] Show count of current lines (e.g., "3/5 horizontal")
- [ ] Style with Tailwind CSS
- [ ] Add tooltips for buttons
- [ ] Add ARIA labels

**Estimated Time**: 1.5 hours

---

### Task 8: Create GuideLines Component

**File**: `client/src/components/charts/GuideLines.tsx` (NEW)

**Description**: Container component managing all guide lines and their interactions

**Acceptance Criteria**:
- [ ] Create functional component with TypeScript props
- [ ] Manage guide lines state with useState
- [ ] Manage drag state with useState
- [ ] Implement `addGuideLine()` function
- [ ] Implement `removeGuideLine()` function
- [ ] Implement `clearAllGuideLines()` function
- [ ] Implement `handleMouseDown()` for drag initiation
- [ ] Implement `handleMouseMove()` for drag updates
- [ ] Implement `handleMouseUp()` for drag completion
- [ ] Constrain guide lines to chart bounds
- [ ] Calculate intersections using utility function
- [ ] Render all GuideLine components
- [ ] Render all intersection points
- [ ] Add SVG overlay for interaction area
- [ ] Throttle mouse move events for performance

**Estimated Time**: 3 hours

---

### Task 9: Create InteractiveChart Component

**File**: `client/src/components/charts/InteractiveChart.tsx` (NEW)

**Description**: Wrapper component that adds guide lines to existing charts

**Acceptance Criteria**:
- [ ] Create functional component with TypeScript props
- [ ] Accept `enableGuideLines` prop (boolean)
- [ ] Accept chart data and configuration props
- [ ] Render child chart component (MultiTrendChart or MiniChart)
- [ ] Render GuideLines component overlay
- [ ] Render GuideLineControls component
- [ ] Calculate and pass chart bounds to GuideLines
- [ ] Calculate and pass chart scale to GuideLines
- [ ] Handle window resize events
- [ ] Recalculate bounds/scale on resize
- [ ] Memoize expensive calculations
- [ ] Add proper TypeScript types

**Estimated Time**: 2.5 hours

---

## Phase 3: Integration (Tasks 10-12)

### Task 10: Update Chart Component Exports

**File**: `client/src/components/charts/index.ts` (MODIFY)

**Description**: Export new components from charts module

**Acceptance Criteria**:
- [ ] Export `InteractiveChart`
- [ ] Export `GuideLines`
- [ ] Export `GuideLine`
- [ ] Export `GuideLineControls`
- [ ] Export `CoordinateDisplay`

**Estimated Time**: 5 minutes

---

### Task 11: Integrate InteractiveChart into ReportPreview

**File**: `client/src/components/reports/ReportPreview.tsx` (MODIFY)

**Description**: Replace MultiTrendChart with InteractiveChart in the Trends section

**Acceptance Criteria**:
- [ ] Import `InteractiveChart` component
- [ ] Replace `MultiTrendChart` with `InteractiveChart` wrapper
- [ ] Pass `enableGuideLines={true}` prop
- [ ] Pass all existing chart props through
- [ ] Verify chart still renders correctly
- [ ] Verify guide lines appear and function

**Estimated Time**: 30 minutes

---

### Task 12: Rename "Data Preview" Section to "Trends"

**File**: `client/src/components/reports/ReportPreview.tsx` (MODIFY)

**Description**: Update section heading label

**Acceptance Criteria**:
- [ ] Change first "Data Preview" heading to "Trends"
- [ ] Change icon from `BarChart3` to `TrendingUp`
- [ ] Keep second "Data Preview" section (table) unchanged
- [ ] Verify visual consistency

**Estimated Time**: 10 minutes

---

## Phase 4: Polish (Tasks 13-16)

### Task 13: Add Visual Feedback and Animations

**Files**: Multiple component files

**Description**: Enhance user experience with smooth transitions and feedback

**Acceptance Criteria**:
- [ ] Add CSS transitions for guide line opacity changes
- [ ] Add CSS transitions for guide line stroke width changes
- [ ] Add smooth cursor changes on hover
- [ ] Add visual feedback when dragging (increased opacity/width)
- [ ] Add visual feedback when hovering over guide lines
- [ ] Add visual feedback for disabled buttons
- [ ] Ensure animations are performant (use CSS transforms)

**Estimated Time**: 1 hour

---

### Task 14: Implement Intersection Point Styling

**File**: `client/src/components/charts/GuideLines.tsx` (MODIFY)

**Description**: Style intersection points to be clearly visible

**Acceptance Criteria**:
- [ ] Render intersection points as SVG circles
- [ ] Use red fill color with white stroke
- [ ] Set appropriate radius (4px)
- [ ] Add opacity for subtle appearance
- [ ] Show tooltip on hover with exact values
- [ ] Ensure points don't obscure data too much

**Estimated Time**: 1 hour

---

### Task 15: Add Keyboard Support

**File**: `client/src/components/charts/GuideLine.tsx` (MODIFY)

**Description**: Enable keyboard navigation and control

**Acceptance Criteria**:
- [ ] Make guide lines focusable with tabIndex
- [ ] Add keyboard event handlers
- [ ] Support Delete key to remove focused guide line
- [ ] Support Arrow keys to move guide line (optional enhancement)
- [ ] Add focus visible styles
- [ ] Update ARIA attributes for keyboard users

**Estimated Time**: 1.5 hours

---

### Task 16: Optimize Performance

**Files**: Multiple component files

**Description**: Ensure smooth performance with multiple guide lines

**Acceptance Criteria**:
- [ ] Memoize coordinate transformation calculations
- [ ] Memoize intersection calculations
- [ ] Throttle mouse move events during drag (16ms for 60fps)
- [ ] Use `useCallback` for event handlers
- [ ] Profile performance with React DevTools
- [ ] Ensure no unnecessary re-renders
- [ ] Test with maximum number of guide lines (5 horizontal + 5 vertical)

**Estimated Time**: 1.5 hours

---

## Phase 5: Testing (Tasks 17-19)

### Task 17: Write Unit Tests for Utilities

**File**: `client/src/utils/__tests__/guideLineUtils.test.ts` (NEW)

**Description**: Test coordinate transformations and intersection detection

**Acceptance Criteria**:
- [ ] Test `pixelToDataY()` with various inputs
- [ ] Test `pixelToDataX()` with various inputs
- [ ] Test `dataToPixelY()` with various inputs
- [ ] Test `dataToPixelX()` with various inputs
- [ ] Test `calculateIntersections()` with horizontal lines
- [ ] Test `calculateIntersections()` with vertical lines
- [ ] Test edge cases (empty data, single point, etc.)
- [ ] Achieve >90% code coverage for utilities

**Estimated Time**: 2 hours

---

### Task 18: Write Component Tests

**File**: `client/src/components/charts/__tests__/GuideLines.test.tsx` (NEW)

**Description**: Test guide line components

**Acceptance Criteria**:
- [ ] Test adding horizontal guide line
- [ ] Test adding vertical guide line
- [ ] Test removing guide line
- [ ] Test clearing all guide lines
- [ ] Test maximum line limit enforcement
- [ ] Test drag interaction (mock mouse events)
- [ ] Test coordinate display rendering
- [ ] Test intersection point rendering
- [ ] Use React Testing Library

**Estimated Time**: 2.5 hours

---

### Task 19: Manual Testing and QA

**Description**: Comprehensive manual testing of the feature

**Acceptance Criteria**:
- [ ] Test on Chrome, Firefox, Safari
- [ ] Test on different screen sizes
- [ ] Test with single tag data
- [ ] Test with multiple tag data
- [ ] Test with large datasets (1000+ points)
- [ ] Test with small datasets (5-10 points)
- [ ] Test drag smoothness
- [ ] Test boundary constraints
- [ ] Test coordinate accuracy
- [ ] Test intersection accuracy
- [ ] Test visual appearance and styling
- [ ] Test accessibility with keyboard only
- [ ] Test accessibility with screen reader
- [ ] Document any bugs found

**Estimated Time**: 2 hours

---

## Phase 6: Documentation (Tasks 20-21)

### Task 20: Update AGENTS.md

**File**: `AGENTS.md` (MODIFY)

**Description**: Document the guide lines feature for future agents

**Acceptance Criteria**:
- [ ] Add section about Trends chart section
- [ ] Document guide lines feature and purpose
- [ ] Explain component structure
- [ ] Document state management approach
- [ ] Add code examples
- [ ] Document coordinate system
- [ ] Add troubleshooting tips

**Estimated Time**: 1 hour

---

### Task 21: Update Design System Documentation

**File**: `design-system.md` (MODIFY)

**Description**: Document guide lines as part of the design system

**Acceptance Criteria**:
- [ ] Add guide lines to chart components section
- [ ] Document visual styling (colors, line styles)
- [ ] Document interaction patterns
- [ ] Add usage guidelines
- [ ] Document accessibility considerations

**Estimated Time**: 45 minutes

---

## Summary

### Total Tasks: 21

### Estimated Total Time: ~30 hours

### Task Breakdown by Phase:
- **Phase 1 (Foundation)**: 4 tasks, ~4.5 hours
- **Phase 2 (Core Components)**: 5 tasks, ~10.5 hours
- **Phase 3 (Integration)**: 3 tasks, ~45 minutes
- **Phase 4 (Polish)**: 4 tasks, ~5 hours
- **Phase 5 (Testing)**: 3 tasks, ~6.5 hours
- **Phase 6 (Documentation)**: 2 tasks, ~1.75 hours

### Recommended Development Order:

1. Complete all Phase 1 tasks (foundation)
2. Complete Phase 2 tasks in order (components)
3. Complete Phase 3 tasks (integration)
4. Test basic functionality manually
5. Complete Phase 4 tasks (polish)
6. Complete Phase 5 tasks (testing)
7. Complete Phase 6 tasks (documentation)

### Dependencies:

- Task 2 must be completed before Task 3
- Task 4 must be completed before Task 9
- Tasks 5-8 must be completed before Task 9
- Task 9 must be completed before Task 11
- All Phase 1-3 tasks must be completed before Phase 4
- All Phase 1-4 tasks must be completed before Phase 5

### Notes:

- Tasks can be parallelized within phases where no dependencies exist
- Time estimates include implementation, basic testing, and code review
- Time estimates assume familiarity with React, TypeScript, and the codebase
- Additional time may be needed for bug fixes and refinements
- Consider breaking larger tasks (8, 9) into sub-tasks if needed
