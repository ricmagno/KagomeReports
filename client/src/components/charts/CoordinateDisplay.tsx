/**
 * CoordinateDisplay Component
 * Displays X and Y coordinate values for guide lines
 */

import React from 'react';
import { formatYValue, formatTimestamp } from './chartUtils';

interface CoordinateDisplayProps {
  /** Type of guide line */
  type: 'horizontal' | 'vertical';
  
  /** X position in pixel space */
  x: number;
  
  /** Y position in pixel space */
  y: number;
  
  /** X value in data space (timestamp) */
  xValue?: number | Date;
  
  /** Y value in data space */
  yValue?: number;
  
  /** Optional units for Y value */
  units?: string;
  
  /** Optional custom class name */
  className?: string;
}

export const CoordinateDisplay: React.FC<CoordinateDisplayProps> = ({
  type,
  x,
  y,
  xValue,
  yValue,
  units,
  className = '',
}) => {
  // Calculate position to avoid obscuring data
  const offset = 8; // pixels from guide line
  
  let displayX = x;
  let displayY = y;
  let anchor: 'start' | 'middle' | 'end' = 'start';
  
  if (type === 'horizontal') {
    // Position to the right of the line, vertically centered
    displayX = x + offset;
    anchor = 'start';
  } else {
    // Position above the line, horizontally centered
    displayY = y - offset;
    displayX = x;
    anchor = 'middle';
  }
  
  // Format the display text
  let displayText = '';
  
  if (type === 'horizontal' && yValue !== undefined) {
    // Show Y value for horizontal lines
    displayText = formatYValue(yValue, 2, units);
  } else if (type === 'vertical' && xValue !== undefined) {
    // Show timestamp for vertical lines
    displayText = formatTimestamp(xValue, false);
  }
  
  if (!displayText) return null;
  
  return (
    <g className={className}>
      {/* Background rectangle for readability */}
      <rect
        x={anchor === 'middle' ? displayX - 40 : displayX - 2}
        y={displayY - 12}
        width={anchor === 'middle' ? 80 : displayText.length * 6 + 8}
        height={20}
        fill="rgba(255, 255, 255, 0.95)"
        stroke="#e5e7eb"
        strokeWidth="1"
        rx="4"
        style={{
          filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
        }}
      />
      
      {/* Text */}
      <text
        x={displayX}
        y={displayY + 3}
        textAnchor={anchor}
        className="text-[11px] font-mono font-medium fill-gray-800"
        style={{ pointerEvents: 'none' }}
      >
        {displayText}
      </text>
    </g>
  );
};
