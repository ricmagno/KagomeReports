/**
 * TypeScript types and interfaces for the interactive guide lines feature
 */

/**
 * Represents a single guide line on the chart
 */
export interface GuideLine {
  /** Unique identifier for the guide line */
  id: string;
  
  /** Type of guide line - horizontal spans width, vertical spans height */
  type: 'horizontal' | 'vertical';
  
  /** Position in data space - Y value for horizontal, timestamp for vertical */
  position: number;
  
  /** Visual color for the guide line */
  color: string;
  
  /** Whether the guide line is currently being dragged */
  isDragging?: boolean;
}

/**
 * Represents a point where a guide line intersects with a data series
 */
export interface GuideLineIntersection {
  /** ID of the guide line that created this intersection */
  guideLineId: string;
  
  /** Name of the tag/data series that was intersected */
  tagName: string;
  
  /** X coordinate in pixel space */
  x: number;
  
  /** Y coordinate in pixel space */
  y: number;
  
  /** X value in data space (timestamp as number) */
  xValue: number | Date;
  
  /** Y value in data space */
  yValue: number;
}

/**
 * State management for all guide lines
 */
export interface GuideLineState {
  /** Array of all guide lines */
  lines: GuideLine[];
  
  /** Array of all intersection points */
  intersections: GuideLineIntersection[];
  
  /** Maximum number of lines allowed per type */
  maxLines: {
    horizontal: number;
    vertical: number;
  };
}

/**
 * Chart boundaries and padding in pixel space
 */
export interface ChartBounds {
  /** Left padding in pixels */
  leftPad: number;
  
  /** Right padding in pixels */
  rightPad: number;
  
  /** Top padding in pixels */
  topPad: number;
  
  /** Bottom padding in pixels */
  bottomPad: number;
  
  /** Total chart width in pixels */
  width: number;
  
  /** Total chart height in pixels */
  height: number;
  
  /** Actual graph area width (width - leftPad - rightPad) */
  graphWidth: number;
  
  /** Actual graph area height (height - topPad - bottomPad) */
  graphHeight: number;
}

/**
 * Chart scale representing the data value ranges
 */
export interface ChartScale {
  /** Minimum X value (timestamp as number) */
  xMin: number;
  
  /** Maximum X value (timestamp as number) */
  xMax: number;
  
  /** Minimum Y value */
  yMin: number;
  
  /** Maximum Y value */
  yMax: number;
}

/**
 * Drag state for tracking guide line dragging
 */
export interface DragState {
  /** ID of the line being dragged */
  lineId: string;
  
  /** Starting position when drag began */
  startPosition: number;
  
  /** Current position during drag */
  currentPosition: number;
}
