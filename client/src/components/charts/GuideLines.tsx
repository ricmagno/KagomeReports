/**
 * GuideLines Component
 * Container managing all guide lines and their interactions
 */

import React, { useState, useCallback, useMemo } from 'react';
import { TimeSeriesData } from '../../types/api';
import { GuideLine as GuideLineType, DragState, ChartBounds, ChartScale } from '../../types/guideLines';
import { GuideLine } from './GuideLine';
import { pixelToDataX, pixelToDataY, constrainValue } from './chartUtils';
import { calculateAllIntersections } from '../../utils/intersectionDetection';

interface GuideLinesProps {
  /** Chart data points */
  dataPoints: Record<string, TimeSeriesData[]>;
  
  /** Chart boundaries */
  bounds: ChartBounds;
  
  /** Chart scale */
  scale: ChartScale;
  
  /** Guide lines state */
  guideLines: GuideLineType[];
  
  /** Callback to update guide lines */
  onGuideLinesChange: (lines: GuideLineType[]) => void;
  
  /** Optional units for Y values */
  units?: string;
  
  /** Optional class name */
  className?: string;
}

export const GuideLines: React.FC<GuideLinesProps> = ({
  dataPoints,
  bounds,
  scale,
  guideLines,
  onGuideLinesChange,
  units,
  className = '',
}) => {
  const [dragState, setDragState] = useState<DragState | null>(null);
  
  // Calculate intersections (memoized for performance)
  const intersections = useMemo(() => {
    return calculateAllIntersections(guideLines, dataPoints, bounds, scale);
  }, [guideLines, dataPoints, bounds, scale]);
  
  // Handle mouse down on guide line (start drag)
  const handleMouseDown = useCallback((lineId: string, event: React.MouseEvent) => {
    const line = guideLines.find(l => l.id === lineId);
    if (!line) return;
    
    setDragState({
      lineId,
      startPosition: line.position,
      currentPosition: line.position,
    });
    
    // Mark line as dragging
    onGuideLinesChange(
      guideLines.map(l => 
        l.id === lineId ? { ...l, isDragging: true } : l
      )
    );
    
    // Prevent text selection during drag
    event.preventDefault();
  }, [guideLines, onGuideLinesChange]);
  
  // Handle mouse move (during drag)
  const handleMouseMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (!dragState) return;
    
    const line = guideLines.find(l => l.id === dragState.lineId);
    if (!line) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    
    let newPosition: number;
    
    if (line.type === 'horizontal') {
      // Calculate Y position
      const pixelY = event.clientY - rect.top;
      newPosition = pixelToDataY(pixelY, bounds, scale);
      // Constrain to Y bounds
      newPosition = constrainValue(newPosition, scale.yMin, scale.yMax);
    } else {
      // Calculate X position (timestamp)
      const pixelX = event.clientX - rect.left;
      newPosition = pixelToDataX(pixelX, bounds, scale);
      // Constrain to X bounds
      newPosition = constrainValue(newPosition, scale.xMin, scale.xMax);
    }
    
    // Update guide line position
    onGuideLinesChange(
      guideLines.map(l => 
        l.id === dragState.lineId 
          ? { ...l, position: newPosition }
          : l
      )
    );
    
    setDragState({
      ...dragState,
      currentPosition: newPosition,
    });
  }, [dragState, guideLines, bounds, scale, onGuideLinesChange]);
  
  // Handle mouse up (end drag)
  const handleMouseUp = useCallback(() => {
    if (!dragState) return;
    
    // Mark line as not dragging
    onGuideLinesChange(
      guideLines.map(l => 
        l.id === dragState.lineId 
          ? { ...l, isDragging: false }
          : l
      )
    );
    
    setDragState(null);
  }, [dragState, guideLines, onGuideLinesChange]);
  
  // Handle remove guide line
  const handleRemove = useCallback((lineId: string) => {
    onGuideLinesChange(guideLines.filter(l => l.id !== lineId));
  }, [guideLines, onGuideLinesChange]);
  
  if (guideLines.length === 0) {
    return null;
  }
  
  return (
    <svg
      width={bounds.graphWidth}
      height={bounds.graphHeight}
      className={`absolute top-0 left-0 pointer-events-none ${className}`}
      style={{ zIndex: 10 }}
      onMouseMove={dragState ? handleMouseMove : undefined}
      onMouseUp={dragState ? handleMouseUp : undefined}
      onMouseLeave={dragState ? handleMouseUp : undefined}
    >
      {/* Interaction overlay (only active during drag) */}
      {dragState && (
        <rect
          width={bounds.graphWidth}
          height={bounds.graphHeight}
          fill="transparent"
          style={{ pointerEvents: 'all', cursor: 'grabbing' }}
        />
      )}
      
      {/* Render all guide lines */}
      <g style={{ pointerEvents: 'all' }}>
        {guideLines.map(line => (
          <GuideLine
            key={line.id}
            line={line}
            bounds={bounds}
            scale={scale}
            units={units}
            onMouseDown={handleMouseDown}
            onRemove={handleRemove}
          />
        ))}
      </g>
      
      {/* Render intersection points */}
      <g style={{ pointerEvents: 'none' }}>
        {intersections.map((intersection, index) => (
          <g key={`intersection-${index}`}>
            {/* Intersection point circle */}
            <circle
              cx={intersection.x}
              cy={intersection.y}
              r={4}
              fill="#ef4444"
              stroke="#ffffff"
              strokeWidth={2}
              opacity={0.9}
            />
            
            {/* Tooltip on hover (simplified - could be enhanced) */}
            <title>
              {intersection.tagName}
              {'\n'}
              Time: {intersection.xValue instanceof Date 
                ? intersection.xValue.toLocaleTimeString() 
                : new Date(intersection.xValue).toLocaleTimeString()}
              {'\n'}
              Value: {intersection.yValue.toFixed(2)}{units ? ` ${units}` : ''}
            </title>
          </g>
        ))}
      </g>
    </svg>
  );
};
