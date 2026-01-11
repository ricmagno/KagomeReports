/**
 * Mini Chart Component
 * Displays a small preview chart for report preview functionality
 */

import React, { useMemo } from 'react';
import { TimeSeriesData } from '../../types/api';

interface MiniChartProps {
  data: TimeSeriesData[];
  tagName: string;
  type?: 'line' | 'bar' | 'area';
  width?: number;
  height?: number;
  className?: string;
}

export const MiniChart: React.FC<MiniChartProps> = ({
  data,
  tagName,
  type = 'line',
  width = 200,
  height = 80,
  className = ''
}) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    // Filter out null values and sort by timestamp
    const validData = data
      .filter(point => point.value !== null && !isNaN(point.value))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (validData.length === 0) return null;

    const values = validData.map(point => point.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1; // Avoid division by zero

    // Create SVG path points
    const points = validData.map((point, index) => {
      const x = (index / (validData.length - 1)) * (width - 20) + 10; // 10px padding
      const y = height - 10 - ((point.value - minValue) / range) * (height - 20); // 10px padding, inverted Y
      return { x, y, value: point.value, timestamp: point.timestamp };
    });

    return {
      points,
      minValue,
      maxValue,
      range,
      validData
    };
  }, [data, width, height]);

  if (!chartData) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-50 border border-gray-200 rounded ${className}`}
        style={{ width, height }}
      >
        <span className="text-xs text-gray-400">No data</span>
      </div>
    );
  }

  const createPath = () => {
    if (chartData.points.length === 0) return '';

    let path = `M ${chartData.points[0].x} ${chartData.points[0].y}`;
    
    if (type === 'line') {
      // Simple line chart
      for (let i = 1; i < chartData.points.length; i++) {
        path += ` L ${chartData.points[i].x} ${chartData.points[i].y}`;
      }
    } else if (type === 'area') {
      // Area chart - line + fill to bottom
      for (let i = 1; i < chartData.points.length; i++) {
        path += ` L ${chartData.points[i].x} ${chartData.points[i].y}`;
      }
      // Close the path to bottom
      const lastPoint = chartData.points[chartData.points.length - 1];
      const firstPoint = chartData.points[0];
      path += ` L ${lastPoint.x} ${height - 10} L ${firstPoint.x} ${height - 10} Z`;
    }

    return path;
  };

  const getQualityColor = () => {
    const goodQualityCount = data.filter(point => point.quality === 'Good').length;
    const qualityPercentage = (goodQualityCount / data.length) * 100;
    
    if (qualityPercentage >= 90) return '#10b981'; // green
    if (qualityPercentage >= 70) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  return (
    <div className={`relative bg-white border border-gray-200 rounded ${className}`}>
      <svg width={width} height={height} className="overflow-visible">
        {/* Grid lines */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f3f4f6" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#grid)" opacity="0.5" />
        
        {/* Chart area */}
        {type === 'bar' ? (
          // Bar chart
          chartData.points.map((point, index) => {
            const barWidth = Math.max(2, (width - 20) / chartData.points.length - 1);
            const barHeight = ((point.value - chartData.minValue) / chartData.range) * (height - 20);
            return (
              <rect
                key={index}
                x={point.x - barWidth / 2}
                y={height - 10 - barHeight}
                width={barWidth}
                height={barHeight}
                fill={getQualityColor()}
                opacity="0.7"
              />
            );
          })
        ) : (
          // Line or area chart
          <path
            d={createPath()}
            fill={type === 'area' ? getQualityColor() : 'none'}
            fillOpacity={type === 'area' ? 0.2 : 0}
            stroke={getQualityColor()}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data points */}
        {type === 'line' && chartData.points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="2"
            fill={getQualityColor()}
            className="opacity-60"
          />
        ))}

        {/* Value labels */}
        <text
          x="10"
          y="15"
          className="text-xs fill-gray-500"
          fontSize="10"
        >
          {chartData.maxValue.toFixed(1)}
        </text>
        <text
          x="10"
          y={height - 5}
          className="text-xs fill-gray-500"
          fontSize="10"
        >
          {chartData.minValue.toFixed(1)}
        </text>
      </svg>

      {/* Chart info overlay */}
      <div className="absolute top-1 right-1 bg-white bg-opacity-90 rounded px-1 py-0.5">
        <span className="text-xs text-gray-600">
          {chartData.validData.length} pts
        </span>
      </div>

      {/* Tag name */}
      <div className="absolute bottom-1 left-1 bg-white bg-opacity-90 rounded px-1 py-0.5">
        <span className="text-xs text-gray-700 font-medium truncate max-w-[120px]">
          {tagName}
        </span>
      </div>
    </div>
  );
};