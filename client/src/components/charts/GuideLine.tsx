/**
 * GuideLine Component
 * Individual draggable guide line with coordinate display
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { GuideLine as GuideLineType, ChartBounds } from '../../types/guideLines';
import { CoordinateDisplay } from './CoordinateDisplay';
import { dataToPixelX, dataToPixelY } from './chartUtils';

interface GuideLineProps {
  /** Guide line data */
  line: GuideLineType;
  
  /** Chart boundaries */
  bounds: ChartBounds;
  
  /** Chart scale */
  scale: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
  
  /** Optional units for Y values */
  units?: string;
  
  /** Callback when mouse down on line (start drag) */
  onMouseDown: (lineId: string, event: React.MouseEvent) => void;
  
  /** Callback to remove this line */
  onRemove: (lineId: string) => void;
}

export const GuideLine: React.FC<GuideLineProps> = ({
  line,
  bounds,
  scale,
  units,
  onMouseDown,
  onRemove,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  // Calculate pixel position from data position
  const pixelX = line.type === 'vertical' 
    ? dataToPixelX(line.position, bounds, scale)
    : 0;
    
  const pixelY = line.type === 'horizontal'
    ? dataToPixelY(line.position, bounds, scale)
    : 0;
  
  // Calculate line endpoints (relative to graph area, no padding offsets)
  const x1 = line.type === 'horizontal' ? 0 : pixelX;
  const y1 = line.type === 'horizontal' ? pixelY : 0;
  const x2 = line.type === 'horizontal' ? bounds.graphWidth : pixelX;
  const y2 = line.type === 'horizontal' ? pixelY : bounds.graphHeight;
  
  // Determine cursor style
  const cursor = line.type === 'horizontal' ? 'ns-resize' : 'ew-resize';
  
  // Calculate opacity and stroke width based on state
  const opacity = line.isDragging ? 0.9 : isHovered ? 0.85 : 0.7;
  const strokeWidth = line.isDragging ? 3 : isHovered ? 2.5 : 2;
  
  // Position for remove button
  const removeButtonX = line.type === 'horizontal' 
    ? bounds.graphWidth - 20
    : pixelX + 10;
  const removeButtonY = line.type === 'horizontal'
    ? pixelY - 10
    : 10;
  
  return (
    <g
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ cursor }}
    >
      {/* Invisible wider line for easier interaction */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="transparent"
        strokeWidth="10"
        style={{ cursor }}
        onMouseDown={(e) => onMouseDown(line.id, e)}
      />
      
      {/* Visible guide line */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={line.color}
        strokeWidth={strokeWidth}
        strokeDasharray="6 4"
        opacity={opacity}
        strokeLinecap="round"
        style={{
          cursor,
          pointerEvents: 'none',
          transition: 'opacity 0.2s, stroke-width 0.2s',
        }}
      />
      
      {/* Coordinate display */}
      <CoordinateDisplay
        type={line.type}
        x={line.type === 'horizontal' ? 10 : pixelX}
        y={line.type === 'horizontal' ? pixelY : 30}
        xValue={line.type === 'vertical' ? line.position : undefined}
        yValue={line.type === 'horizontal' ? line.position : undefined}
        units={units}
      />
      
      {/* Remove button (shown on hover) */}
      {isHovered && !line.isDragging && (
        <g
          onClick={(e) => {
            e.stopPropagation();
            onRemove(line.id);
          }}
          style={{ cursor: 'pointer' }}
          className="hover:opacity-100 opacity-80 transition-opacity"
        >
          <circle
            cx={removeButtonX}
            cy={removeButtonY}
            r="10"
            fill="white"
            stroke="#ef4444"
            strokeWidth="2"
          />
          <g transform={`translate(${removeButtonX - 6}, ${removeButtonY - 6})`}>
            <X size={12} color="#ef4444" strokeWidth={2.5} />
          </g>
        </g>
      )}
    </g>
  );
};
