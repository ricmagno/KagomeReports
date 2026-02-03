/**
 * Common color palette for charts to ensure consistency 
 * between multi-trend and individual trend views.
 */

import { ChartBounds, ChartScale } from '../../types/guideLines';

export const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald (green)
  '#f59e0b', // amber (orange)
  '#f43f5e', // rose
  '#6366f1', // indigo
  '#f97316', // orange-dark
  '#06b6d4', // cyan
  '#8b5cf6', // violet
];

/**
 * Assigns a stable color to a tag based on its index in a list.
 */
export const getTagColor = (index: number): string | undefined => {
  if (index < 0) return undefined;
  return CHART_COLORS[index % CHART_COLORS.length];
};

/**
 * Finds the index of a tag in a list, case-insensitively.
 */
export const getTagIndex = (tagName: string, tags: string[]): number => {
  if (!tagName || !tags) return -1;
  const lowerTag = tagName.toLowerCase().trim();
  return tags.findIndex(t => t && t.toLowerCase().trim() === lowerTag);
};

/**
 * Coordinate Transformation Utilities for Guide Lines
 * These functions convert between pixel coordinates and data values
 */

/**
 * Convert pixel Y coordinate to data value
 * @param pixelY - Y coordinate in pixel space (relative to graph area, no padding)
 * @param bounds - Chart boundaries
 * @param scale - Chart data scale
 * @returns Y value in data space
 */
export function pixelToDataY(
  pixelY: number,
  bounds: ChartBounds,
  scale: ChartScale
): number {
  // pixelY is already relative to graph area (no padding offset needed)

  // Handle edge cases
  if (bounds.graphHeight === 0) return scale.yMin;
  if (scale.yMax === scale.yMin) return scale.yMin;

  // Invert ratio because SVG Y increases downward
  const ratio = 1 - (pixelY / bounds.graphHeight);

  // Convert to data value
  return scale.yMin + (ratio * (scale.yMax - scale.yMin));
}

/**
 * Convert pixel X coordinate to timestamp
 * @param pixelX - X coordinate in pixel space (relative to graph area, no padding)
 * @param bounds - Chart boundaries
 * @param scale - Chart data scale
 * @returns Timestamp as number in data space
 */
export function pixelToDataX(
  pixelX: number,
  bounds: ChartBounds,
  scale: ChartScale
): number {
  // pixelX is already relative to graph area (no padding offset needed)

  // Handle edge cases
  if (bounds.graphWidth === 0) return scale.xMin;
  if (scale.xMax === scale.xMin) return scale.xMin;

  // Calculate ratio
  const ratio = pixelX / bounds.graphWidth;

  // Convert to timestamp
  return scale.xMin + (ratio * (scale.xMax - scale.xMin));
}

/**
 * Convert data Y value to pixel coordinate
 * @param dataY - Y value in data space
 * @param bounds - Chart boundaries
 * @param scale - Chart data scale
 * @returns Y coordinate in pixel space (relative to graph area, no padding)
 */
export function dataToPixelY(
  dataY: number,
  bounds: ChartBounds,
  scale: ChartScale
): number {
  // Handle edge cases
  if (scale.yMax === scale.yMin) return bounds.graphHeight;

  // Calculate ratio
  const ratio = (dataY - scale.yMin) / (scale.yMax - scale.yMin);

  // Convert to pixel coordinate (inverted because SVG Y increases downward)
  // Returns position relative to graph area (0 = top, graphHeight = bottom)
  return bounds.graphHeight - (ratio * bounds.graphHeight);
}

/**
 * Convert timestamp to pixel X coordinate
 * @param dataX - Timestamp as number in data space
 * @param bounds - Chart boundaries
 * @param scale - Chart data scale
 * @returns X coordinate in pixel space (relative to graph area, no padding)
 */
export function dataToPixelX(
  dataX: number,
  bounds: ChartBounds,
  scale: ChartScale
): number {
  // Handle edge cases
  if (scale.xMax === scale.xMin) return 0;

  // Calculate ratio
  const ratio = (dataX - scale.xMin) / (scale.xMax - scale.xMin);

  // Convert to pixel coordinate (relative to graph area)
  return ratio * bounds.graphWidth;
}

/**
 * Constrain a value to be within chart bounds
 * @param value - Value to constrain
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Constrained value
 */
export function constrainValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Format a Y value for display
 * @param value - Y value to format
 * @param decimals - Number of decimal places (default: 2)
 * @param units - Optional units to append
 * @returns Formatted string
 */
export function formatYValue(value: number, decimals: number = 2, units?: string): string {
  const formatted = value.toFixed(decimals);
  return units ? `${formatted} ${units}` : formatted;
}

/**
 * Format a timestamp for display
 * @param timestamp - Timestamp as number or Date
 * @param includeDate - Whether to include the date (default: false)
 * @returns Formatted string
 */
export function formatTimestamp(timestamp: number | Date, includeDate: boolean = false): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;

  if (includeDate) {
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Calculates a linear regression trend line for a set of data points
 * @param data - Array of data points with x (timestamp) and y (value)
 * @returns An array of two points representing the start and end of the trend line
 */
export function calculateTrendLine(data: { x: number; y: number | null }[]): { x: number; y: number }[] {
  const validData = data.filter(d => d.y !== null && !isNaN(d.y));
  const n = validData.length;

  if (n < 2) return [];

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    const x = validData[i].x;
    const y = validData[i].y!;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const startX = validData[0].x;
  const endX = validData[n - 1].x;

  return [
    { x: startX, y: slope * startX + intercept },
    { x: endX, y: slope * endX + intercept }
  ];
}
