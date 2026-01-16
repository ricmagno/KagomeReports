/**
 * Chart Bounds Calculator
 * Utilities to calculate chart boundaries and scale from chart dimensions and data
 */

import { TimeSeriesData } from '../types/api';
import { ChartBounds, ChartScale } from '../types/guideLines';

/**
 * Calculate chart bounds from dimensions and padding
 * @param width - Total chart width in pixels
 * @param height - Total chart height in pixels
 * @param leftPad - Left padding in pixels (default: 60)
 * @param rightPad - Right padding in pixels (default: 20)
 * @param topPad - Top padding in pixels (default: 20)
 * @param bottomPad - Bottom padding in pixels (default: 40)
 * @returns Chart bounds object
 */
export function calculateChartBounds(
  width: number,
  height: number,
  leftPad: number = 60,
  rightPad: number = 20,
  topPad: number = 20,
  bottomPad: number = 40
): ChartBounds {
  const graphWidth = Math.max(0, width - leftPad - rightPad);
  const graphHeight = Math.max(0, height - topPad - bottomPad);
  
  return {
    leftPad,
    rightPad,
    topPad,
    bottomPad,
    width,
    height,
    graphWidth,
    graphHeight,
  };
}

/**
 * Calculate chart scale from data points
 * @param dataPoints - Record of tag names to their data points
 * @returns Chart scale object with min/max values
 */
export function calculateChartScale(
  dataPoints: Record<string, TimeSeriesData[]>
): ChartScale {
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  
  // Find global min/max across all data series
  Object.values(dataPoints).forEach(data => {
    if (!data || data.length === 0) return;
    
    data.forEach(point => {
      // Process timestamp (X value)
      const timestamp = new Date(point.timestamp).getTime();
      if (!isNaN(timestamp)) {
        xMin = Math.min(xMin, timestamp);
        xMax = Math.max(xMax, timestamp);
      }
      
      // Process value (Y value)
      if (point.value !== null && !isNaN(point.value)) {
        yMin = Math.min(yMin, point.value);
        yMax = Math.max(yMax, point.value);
      }
    });
  });
  
  // Handle edge cases
  if (!isFinite(xMin)) xMin = Date.now() - 3600000; // 1 hour ago
  if (!isFinite(xMax)) xMax = Date.now();
  if (!isFinite(yMin)) yMin = 0;
  if (!isFinite(yMax)) yMax = 100;
  
  // Ensure min !== max (add small padding if needed)
  if (xMin === xMax) {
    xMin -= 1800000; // 30 minutes before
    xMax += 1800000; // 30 minutes after
  }
  
  if (yMin === yMax) {
    const padding = Math.abs(yMin) * 0.1 || 1;
    yMin -= padding;
    yMax += padding;
  }
  
  return {
    xMin,
    xMax,
    yMin,
    yMax,
  };
}

/**
 * Calculate chart scale with custom Y range (useful for multi-trend charts)
 * @param dataPoints - Record of tag names to their data points
 * @param yMinOverride - Optional minimum Y value
 * @param yMaxOverride - Optional maximum Y value
 * @returns Chart scale object
 */
export function calculateChartScaleWithYRange(
  dataPoints: Record<string, TimeSeriesData[]>,
  yMinOverride?: number,
  yMaxOverride?: number
): ChartScale {
  const scale = calculateChartScale(dataPoints);
  
  if (yMinOverride !== undefined) {
    scale.yMin = yMinOverride;
  }
  
  if (yMaxOverride !== undefined) {
    scale.yMax = yMaxOverride;
  }
  
  return scale;
}

/**
 * Extract bounds from existing chart component props
 * This is a helper to extract bounds from MultiTrendChart or MiniChart
 * @param width - Chart width
 * @param height - Chart height
 * @param showAxis - Whether axes are shown (affects padding)
 * @returns Chart bounds
 */
export function extractBoundsFromChartProps(
  width: number,
  height: number,
  showAxis: boolean = true
): ChartBounds {
  // Match the padding used in MultiTrendChart and MiniChart
  const leftPad = showAxis ? 60 : 10;
  const rightPad = showAxis ? 20 : 15;
  const topPad = showAxis ? 20 : 10;
  const bottomPad = showAxis ? 40 : 10;
  
  return calculateChartBounds(width, height, leftPad, rightPad, topPad, bottomPad);
}

/**
 * Check if a point is within chart bounds
 * @param x - X coordinate in pixel space
 * @param y - Y coordinate in pixel space
 * @param bounds - Chart boundaries
 * @returns True if point is within bounds
 */
export function isPointInBounds(x: number, y: number, bounds: ChartBounds): boolean {
  return (
    x >= bounds.leftPad &&
    x <= bounds.width - bounds.rightPad &&
    y >= bounds.topPad &&
    y <= bounds.height - bounds.bottomPad
  );
}

/**
 * Constrain a point to be within chart bounds
 * @param x - X coordinate in pixel space
 * @param y - Y coordinate in pixel space
 * @param bounds - Chart boundaries
 * @returns Constrained coordinates
 */
export function constrainPointToBounds(
  x: number,
  y: number,
  bounds: ChartBounds
): { x: number; y: number } {
  return {
    x: Math.max(bounds.leftPad, Math.min(bounds.width - bounds.rightPad, x)),
    y: Math.max(bounds.topPad, Math.min(bounds.height - bounds.bottomPad, y)),
  };
}
