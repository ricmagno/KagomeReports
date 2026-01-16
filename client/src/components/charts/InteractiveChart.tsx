/**
 * InteractiveChart Component
 * Wrapper that adds interactive guide lines to existing chart components
 */

import React, { useState, useMemo, useEffect } from 'react';
import { TimeSeriesData } from '../../types/api';
import { GuideLine as GuideLineType } from '../../types/guideLines';
import { MultiTrendChart } from './MultiTrendChart';
import { MiniChart } from './MiniChart';
import { GuideLines } from './GuideLines';
import { GuideLineControls } from './GuideLineControls';
import { calculateChartBounds, calculateChartScale } from '../../utils/chartBounds';

interface InteractiveChartProps {
  /** Chart data points */
  dataPoints: Record<string, TimeSeriesData[]>;
  
  /** Tag descriptions */
  tagDescriptions: Record<string, string>;
  
  /** Tag names */
  tags?: string[];
  
  /** Chart width */
  width?: number;
  
  /** Chart height */
  height?: number;
  
  /** Chart title */
  title?: string;
  
  /** Chart description */
  description?: string;
  
  /** Optional class name */
  className?: string;
  
  /** Whether to enable guide lines (default: true) */
  enableGuideLines?: boolean;
  
  /** Chart type - determines which chart component to render */
  chartType?: 'multi' | 'single';
  
  /** For single chart: tag name */
  tagName?: string;
  
  /** For single chart: statistics */
  statistics?: any;
  
  /** For single chart: units */
  units?: string;
  
  /** For single chart: color */
  color?: string;
}

export const InteractiveChart: React.FC<InteractiveChartProps> = ({
  dataPoints,
  tagDescriptions,
  tags,
  width = 800,
  height = 320,
  title,
  description,
  className = '',
  enableGuideLines = true,
  chartType = 'multi',
  tagName,
  statistics,
  units,
  color,
}) => {
  // Guide lines state
  const [guideLines, setGuideLines] = useState<GuideLineType[]>([]);
  
  // Maximum lines configuration
  const maxLines = {
    horizontal: 5,
    vertical: 5,
  };
  
  // Calculate chart bounds and scale
  const bounds = useMemo(() => {
    // Account for MultiTrendChart's SVG being width-40
    const actualSvgWidth = chartType === 'multi' ? width - 40 : width;
    return calculateChartBounds(actualSvgWidth, height, 60, 20, 20, 40);
  }, [width, height, chartType]);
  
  const scale = useMemo(() => {
    const calculatedScale = calculateChartScale(dataPoints);
    console.log('Guide Lines Scale:', calculatedScale);
    console.log('Guide Lines Bounds:', bounds);
    return calculatedScale;
  }, [dataPoints, bounds]);
  
  // Reset guide lines when data changes significantly
  useEffect(() => {
    // Optional: Clear guide lines when switching between different reports
    // For now, we keep them to allow comparison
  }, [dataPoints]);
  
  // Handle window resize
  useEffect(() => {
    function handleResize() {
      // Bounds and scale will automatically recalculate via useMemo
      // Guide line positions are in data space, so they adjust automatically
    }
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Add horizontal guide line
  const addHorizontalLine = () => {
    const horizontalCount = guideLines.filter(l => l.type === 'horizontal').length;
    if (horizontalCount >= maxLines.horizontal) return;
    
    const newLine: GuideLineType = {
      id: `h-${Date.now()}-${Math.random()}`,
      type: 'horizontal',
      position: (scale.yMin + scale.yMax) / 2, // Center Y
      color: '#3b82f6', // Blue
    };
    
    setGuideLines([...guideLines, newLine]);
  };
  
  // Add vertical guide line
  const addVerticalLine = () => {
    const verticalCount = guideLines.filter(l => l.type === 'vertical').length;
    if (verticalCount >= maxLines.vertical) return;
    
    const newLine: GuideLineType = {
      id: `v-${Date.now()}-${Math.random()}`,
      type: 'vertical',
      position: Date.now(), // Current timestamp
      color: '#10b981', // Green
    };
    
    setGuideLines([...guideLines, newLine]);
  };
  
  // Clear all guide lines
  const clearAllLines = () => {
    setGuideLines([]);
  };
  
  // Count lines by type
  const horizontalCount = guideLines.filter(l => l.type === 'horizontal').length;
  const verticalCount = guideLines.filter(l => l.type === 'vertical').length;
  
  return (
    <div className={`relative ${className}`}>
      {/* Guide line controls */}
      {enableGuideLines && (
        <div className="mb-3 flex justify-end">
          <GuideLineControls
            horizontalCount={horizontalCount}
            verticalCount={verticalCount}
            maxHorizontal={maxLines.horizontal}
            maxVertical={maxLines.vertical}
            onAddHorizontal={addHorizontalLine}
            onAddVertical={addVerticalLine}
            onClearAll={clearAllLines}
          />
        </div>
      )}
      
      {/* Chart container with guide lines overlay */}
      <div className="relative">
        {/* Render appropriate chart type */}
        {chartType === 'multi' ? (
          <div className="relative">
            <MultiTrendChart
              dataPoints={dataPoints}
              tagDescriptions={tagDescriptions}
              tags={tags}
              width={width}
              height={height}
              title={title}
              description={description}
            />
            
            {/* Guide lines overlay - positioned to match chart SVG */}
            {/* Adjust topOffset if lines don't align: increase to move down, decrease to move up */}
            {enableGuideLines && guideLines.length > 0 && (
              <div 
                className="absolute pointer-events-none"
                style={{
                  top: '100px', // Card padding (24px) + header section (~76px)
                  left: '84px', // Card padding (24px) + left axis padding (60px)
                  width: `${bounds.graphWidth}px`,
                  height: `${bounds.graphHeight}px`,
                }}
              >
                <GuideLines
                  dataPoints={dataPoints}
                  bounds={bounds}
                  scale={scale}
                  guideLines={guideLines}
                  onGuideLinesChange={setGuideLines}
                  units={units}
                />
              </div>
            )}
          </div>
        ) : (
          tagName && dataPoints[tagName] && (
            <div className="relative">
              <MiniChart
                data={dataPoints[tagName]}
                tagName={tagName}
                type="line"
                width={width}
                height={height}
                showTrend={true}
                showAxis={true}
                title={title || tagName}
                description={tagDescriptions[tagName]}
                units={units}
                statistics={statistics}
                color={color}
              />
              
              {/* Guide lines overlay - positioned to match chart SVG */}
              {enableGuideLines && guideLines.length > 0 && (
                <div 
                  className="absolute pointer-events-none"
                  style={{
                    top: '56px', // Account for padding (16px) + header (~40px)
                    left: '16px', // Account for p-4 padding
                    width: `${width}px`,
                    height: `${height}px`,
                  }}
                >
                  <GuideLines
                    dataPoints={dataPoints}
                    bounds={bounds}
                    scale={scale}
                    guideLines={guideLines}
                    onGuideLinesChange={setGuideLines}
                    units={units}
                  />
                </div>
              )}
            </div>
          )
        )}
      </div>
      
      {/* Helper text */}
      {enableGuideLines && guideLines.length === 0 && (
        <div className="mt-2 text-xs text-gray-500 text-center">
          Add guide lines to measure and compare data values
        </div>
      )}
    </div>
  );
};
