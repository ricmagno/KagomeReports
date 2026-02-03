/**
 * InteractiveChart Component
 * Wrapper that adds interactive guide lines to ApexCharts components
 */

import React, { useState, useMemo } from 'react';
import { TimeSeriesData } from '../../types/api';
import { GuideLine as GuideLineType } from '../../types/guideLines';
import { MultiTrendChart } from './MultiTrendChart';
import { MiniChart } from './MiniChart';
import { GuideLineControls } from './GuideLineControls';
import { calculateChartScale } from '../../utils/chartBounds';

interface InteractiveChartProps {
  /** Chart data points */
  dataPoints: Record<string, TimeSeriesData[]>;

  /** Tag descriptions */
  tagDescriptions: Record<string, string>;

  /** Tag names */
  tags?: string[];

  /** Chart type (line, bar, area) */
  type?: 'line' | 'bar' | 'area';

  /** Chart width */
  width?: number | string;

  /** Chart height */
  height?: number | string;

  /** Chart title */
  title?: string;

  /** Chart description */
  description?: string;

  /** Optional class name */
  className?: string;

  /** Whether to enable guide lines (default: true) */
  enableGuideLines?: boolean;

  /** Whether to include trend lines (default: true) */
  includeTrendLines?: boolean;

  /** Chart display mode - determines which chart component to render */
  displayMode?: 'multi' | 'single';

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
  type = 'line',
  width = '100%',
  height = 320,
  title,
  description,
  className = '',
  enableGuideLines = true,
  includeTrendLines = true,
  displayMode = 'multi',
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

  // Calculate scale for initial placement of guide lines
  const scale = useMemo(() => {
    return calculateChartScale(dataPoints);
  }, [dataPoints]);

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

      {/* Chart container */}
      <div className="relative">
        {/* Render appropriate chart type */}
        {displayMode === 'multi' ? (
          <MultiTrendChart
            dataPoints={dataPoints}
            tagDescriptions={tagDescriptions}
            tags={tags}
            type={type}
            width={width}
            height={height}
            title={title}
            description={description}
            guideLines={guideLines}
            units={units}
            includeTrendLines={includeTrendLines}
            onGuideLinesChange={setGuideLines}
          />
        ) : (
          tagName && dataPoints[tagName] && (
            <MiniChart
              data={dataPoints[tagName]}
              tagName={tagName}
              type={type}
              width={width}
              height={height}
              showTrend={includeTrendLines}
              showAxis={true}
              title={title || tagName}
              description={tagDescriptions[tagName]}
              units={units}
              statistics={statistics}
              color={color}
              guideLines={guideLines}
              onGuideLinesChange={setGuideLines}
            />
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
