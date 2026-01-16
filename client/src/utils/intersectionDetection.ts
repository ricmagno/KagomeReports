/**
 * Intersection Detection Algorithm for Guide Lines
 * Calculates where guide lines intersect with data series
 */

import { TimeSeriesData } from '../types/api';
import { GuideLine, GuideLineIntersection, ChartBounds, ChartScale } from '../types/guideLines';
import { dataToPixelX, dataToPixelY } from '../components/charts/chartUtils';

/**
 * Calculate all intersections for a guide line with data series
 * @param guideLine - The guide line to check
 * @param dataPoints - Record of tag names to their data points
 * @param bounds - Chart boundaries
 * @param scale - Chart data scale
 * @returns Array of intersection points
 */
export function calculateIntersections(
  guideLine: GuideLine,
  dataPoints: Record<string, TimeSeriesData[]>,
  bounds: ChartBounds,
  scale: ChartScale
): GuideLineIntersection[] {
  const intersections: GuideLineIntersection[] = [];
  
  if (guideLine.type === 'horizontal') {
    // For horizontal lines, find where the Y value crosses each data series
    intersections.push(...calculateHorizontalIntersections(guideLine, dataPoints, bounds, scale));
  } else {
    // For vertical lines, find where the X value (timestamp) crosses each data series
    intersections.push(...calculateVerticalIntersections(guideLine, dataPoints, bounds, scale));
  }
  
  return intersections;
}

/**
 * Calculate intersections for a horizontal guide line
 * Finds all points where the horizontal line crosses data series
 */
function calculateHorizontalIntersections(
  guideLine: GuideLine,
  dataPoints: Record<string, TimeSeriesData[]>,
  bounds: ChartBounds,
  scale: ChartScale
): GuideLineIntersection[] {
  const intersections: GuideLineIntersection[] = [];
  
  Object.entries(dataPoints).forEach(([tagName, data]) => {
    if (!data || data.length === 0) return;
    
    // Sort data by timestamp
    const sortedData = [...data].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // Find all segments where the line crosses
    for (let i = 0; i < sortedData.length - 1; i++) {
      const p1 = sortedData[i];
      const p2 = sortedData[i + 1];
      
      // Skip if either point has null value
      if (p1.value === null || p2.value === null) continue;
      if (isNaN(p1.value) || isNaN(p2.value)) continue;
      
      // Check if guide line Y is between these two points
      const crosses = (p1.value <= guideLine.position && p2.value >= guideLine.position) ||
                      (p1.value >= guideLine.position && p2.value <= guideLine.position);
      
      if (crosses) {
        // Interpolate X position (timestamp)
        const ratio = (guideLine.position - p1.value) / (p2.value - p1.value);
        const t1 = new Date(p1.timestamp).getTime();
        const t2 = new Date(p2.timestamp).getTime();
        const xValue = t1 + ratio * (t2 - t1);
        
        // Convert to pixel coordinates
        const x = dataToPixelX(xValue, bounds, scale);
        const y = dataToPixelY(guideLine.position, bounds, scale);
        
        intersections.push({
          guideLineId: guideLine.id,
          tagName,
          x,
          y,
          xValue: new Date(xValue),
          yValue: guideLine.position,
        });
      }
    }
  });
  
  return intersections;
}

/**
 * Calculate intersections for a vertical guide line
 * Finds the Y value at the specified timestamp for each data series
 */
function calculateVerticalIntersections(
  guideLine: GuideLine,
  dataPoints: Record<string, TimeSeriesData[]>,
  bounds: ChartBounds,
  scale: ChartScale
): GuideLineIntersection[] {
  const intersections: GuideLineIntersection[] = [];
  const targetTime = guideLine.position;
  
  Object.entries(dataPoints).forEach(([tagName, data]) => {
    if (!data || data.length === 0) return;
    
    // Sort data by timestamp
    const sortedData = [...data].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // Find the data points surrounding the target time
    let beforePoint: TimeSeriesData | null = null;
    let afterPoint: TimeSeriesData | null = null;
    
    for (let i = 0; i < sortedData.length; i++) {
      const point = sortedData[i];
      const pointTime = new Date(point.timestamp).getTime();
      
      if (pointTime <= targetTime) {
        beforePoint = point;
      }
      
      if (pointTime >= targetTime && !afterPoint) {
        afterPoint = point;
        break;
      }
    }
    
    // Calculate Y value at target time
    let yValue: number | null = null;
    
    if (beforePoint && afterPoint && beforePoint !== afterPoint) {
      // Interpolate between two points
      if (beforePoint.value !== null && afterPoint.value !== null &&
          !isNaN(beforePoint.value) && !isNaN(afterPoint.value)) {
        const t1 = new Date(beforePoint.timestamp).getTime();
        const t2 = new Date(afterPoint.timestamp).getTime();
        const ratio = (targetTime - t1) / (t2 - t1);
        yValue = beforePoint.value + ratio * (afterPoint.value - beforePoint.value);
      }
    } else if (beforePoint && beforePoint.value !== null && !isNaN(beforePoint.value)) {
      // Use exact point if we have it
      const pointTime = new Date(beforePoint.timestamp).getTime();
      if (Math.abs(pointTime - targetTime) < 1000) { // Within 1 second
        yValue = beforePoint.value;
      }
    } else if (afterPoint && afterPoint.value !== null && !isNaN(afterPoint.value)) {
      // Use exact point if we have it
      const pointTime = new Date(afterPoint.timestamp).getTime();
      if (Math.abs(pointTime - targetTime) < 1000) { // Within 1 second
        yValue = afterPoint.value;
      }
    }
    
    // Add intersection if we found a valid Y value
    if (yValue !== null) {
      const x = dataToPixelX(targetTime, bounds, scale);
      const y = dataToPixelY(yValue, bounds, scale);
      
      intersections.push({
        guideLineId: guideLine.id,
        tagName,
        x,
        y,
        xValue: new Date(targetTime),
        yValue,
      });
    }
  });
  
  return intersections;
}

/**
 * Calculate all intersections for multiple guide lines
 * @param guideLines - Array of guide lines
 * @param dataPoints - Record of tag names to their data points
 * @param bounds - Chart boundaries
 * @param scale - Chart data scale
 * @returns Flattened array of all intersection points
 */
export function calculateAllIntersections(
  guideLines: GuideLine[],
  dataPoints: Record<string, TimeSeriesData[]>,
  bounds: ChartBounds,
  scale: ChartScale
): GuideLineIntersection[] {
  return guideLines.flatMap(line => 
    calculateIntersections(line, dataPoints, bounds, scale)
  );
}
