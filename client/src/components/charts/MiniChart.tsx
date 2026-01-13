/**
 * Mini Chart Component
 * Displays a small preview chart for report preview functionality
 */

import React, { useMemo } from 'react';
import { TimeSeriesData, StatisticsResult } from '../../types/api';

interface MiniChartProps {
  data: TimeSeriesData[];
  tagName: string;
  type?: 'line' | 'bar' | 'area';
  width?: number;
  height?: number;
  className?: string;
  showTrend?: boolean;
  showAxis?: boolean;
  title?: string;
  description?: string;
  statistics?: StatisticsResult;
  color?: string;
  units?: string;
}

export const MiniChart: React.FC<MiniChartProps> = ({
  data,
  tagName,
  type = 'line',
  width = 200,
  height = 80,
  className = '',
  showTrend = true,
  showAxis = false,
  title,
  description,
  statistics,
  color,
  units
}) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    // Filter out null values and sort by timestamp
    const validData = data
      .filter(point => point.value !== null && !isNaN(point.value))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (validData.length === 0) return null;

    const values = validData.map(point => point.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1; // Avoid division by zero

    // Create SVG path points
    const leftPad = showAxis ? 50 : 10;
    const bottomPad = showAxis ? 30 : 10;
    const topPad = 10;
    const rightPad = 15;
    const graphHeight = height - topPad - bottomPad;
    const graphWidth = width - leftPad - rightPad;

    const points = validData.map((point, index) => {
      const x = (index / (validData.length - 1)) * graphWidth + leftPad;
      const y = (height - bottomPad) - ((point.value - minValue) / range) * graphHeight;
      return { x, y, value: point.value, timestamp: point.timestamp };
    });

    // Local trend calculation (Linear Regression)
    let trendPoints = null;
    if (showTrend && points.length >= 2) {
      const n = points.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += points[i].value;
        sumXY += i * points[i].value;
        sumXX += i * i;
      }
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      // Calculate start and end Y for the trend line
      const trendYStart = (height - bottomPad) - ((intercept - minValue) / range) * graphHeight;
      const trendYEnd = (height - bottomPad) - (((slope * (n - 1) + intercept) - minValue) / range) * graphHeight;

      trendPoints = {
        x1: points[0].x,
        y1: trendYStart,
        x2: points[n - 1].x,
        y2: trendYEnd
      };
    }

    // Calculate Y-axis subdivisions
    const subdivisions = [0.25, 0.5, 0.75, 1.0].map((ratio, index, arr) => {
      const value = minValue + (ratio * range);
      const y = (height - bottomPad) - (ratio * graphHeight);
      // Add units only to the highest subdivision (last item in our array)
      const label = value.toFixed(1) + (units && index === arr.length - 1 ? ` ${units}` : '');
      return { value, y, label };
    });

    // Calculate X-axis time subdivisions
    const timeSubdivisions: { x: number; label: string }[] = [];
    if (showAxis && validData.length > 1) {
      const start = new Date(validData[0].timestamp).getTime();
      const end = new Date(validData[validData.length - 1].timestamp).getTime();
      const durationMin = (end - start) / (1000 * 60);

      // Determine interval (1, 5, 10, 15, 25, 30, or 60/120... for longer ranges)
      const potentialIntervals = [1, 5, 10, 15, 25, 30, 60, 120, 240, 480, 720, 1440];
      let interval = potentialIntervals[0];
      for (const i of potentialIntervals) {
        interval = i;
        if (durationMin / i <= 8) break;
      }

      // Calculate nice start time (rounded to interval)
      const intervalMs = interval * 60 * 1000;
      let currentTick = Math.ceil(start / intervalMs) * intervalMs;

      while (currentTick <= end) {
        const ratio = (currentTick - start) / (end - start);
        const x = ratio * graphWidth + leftPad;
        const timeLabel = new Date(currentTick).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        timeSubdivisions.push({ x, label: timeLabel });
        currentTick += intervalMs;
      }
    }

    return {
      points,
      minValue,
      maxValue,
      range,
      validData,
      trendPoints,
      subdivisions,
      timeSubdivisions,
      bottomPad,
      leftPad,
      graphWidth,
      graphHeight
    };
  }, [data, width, height, showTrend, showAxis, units]);

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
      // Close the path to bottom (X-axis)
      const lastPoint = chartData.points[chartData.points.length - 1];
      const firstPoint = chartData.points[0];
      path += ` L ${lastPoint.x} ${height - chartData.bottomPad} L ${firstPoint.x} ${height - chartData.bottomPad} Z`;
    }
    return path;
  };

  const getQualityColor = () => {
    const goodQualityCount = data.filter(point => point.quality === 'Good' || point.quality === 192).length;
    const qualityPercentage = (goodQualityCount / data.length) * 100;

    if (qualityPercentage >= 90) return '#10b981'; // green
    if (qualityPercentage >= 70) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  const baseColor = color || getQualityColor();

  return (
    <div className={`relative bg-white border border-gray-200 rounded p-4 ${className}`}>
      <div className="mb-2 flex items-start justify-between border-b border-gray-100 pb-2">
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-bold text-gray-800 truncate" title={title || tagName}>
            {title || tagName}
          </span>
          {description && (
            <span className="text-xs font-normal text-gray-500 truncate" title={description}>
              {description}
            </span>
          )}
        </div>
        {showAxis && (
          <div className="flex flex-col items-end flex-shrink-0 ml-4">
            <div className="flex items-center space-x-3 text-[10px] font-mono mb-1">
              {statistics && (
                <>
                  <span className="text-gray-500">AVG: <span className="font-bold text-blue-600">{statistics.average.toFixed(2)}{units ? ` ${units}` : ''}</span></span>
                  <span className="text-gray-500">MIN: <span className="font-bold text-emerald-600">{statistics.min.toFixed(2)}{units ? ` ${units}` : ''}</span></span>
                  <span className="text-gray-500">MAX: <span className="font-bold text-amber-600">{statistics.max.toFixed(2)}{units ? ` ${units}` : ''}</span></span>
                </>
              )}
            </div>
            <span className="text-[10px] text-gray-400 font-mono italic">
              {chartData.validData.length} data points
            </span>
          </div>
        )}
      </div>

      <div className="relative">
        <svg width={width} height={height} className="overflow-visible">
          {/* Y-Axis Line */}
          {showAxis && (
            <line x1={chartData.leftPad - 5} y1="10" x2={chartData.leftPad - 5} y2={height - chartData.bottomPad} stroke="#94a3b8" strokeWidth="1" />
          )}

          {/* X-Axis Line */}
          {showAxis && (
            <line x1={chartData.leftPad - 5} y1={height - chartData.bottomPad} x2={width - 10} y2={height - chartData.bottomPad} stroke="#94a3b8" strokeWidth="1" />
          )}

          {/* Grid lines */}
          {showAxis && chartData.subdivisions.map((sub, i) => (
            <line
              key={`sub-line-${i}`}
              x1={chartData.leftPad - 5}
              y1={sub.y}
              x2={width - 10}
              y2={sub.y}
              stroke="#e2e8f0"
              strokeWidth="0.5"
              strokeDasharray="2 2"
            />
          ))}

          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f3f4f6" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={width} height={height} fill="url(#grid)" opacity="0.5" />

          {/* Chart area */}
          {type === 'bar' ? (
            // Bar chart
            chartData.points.map((point, index) => {
              const barWidth = Math.max(2, (width - 20) / chartData.points.length - 1);
              const barHeight = ((point.value - chartData.minValue) / chartData.range) * (chartData.graphHeight);
              return (
                <rect
                  key={index}
                  x={point.x - barWidth / 2}
                  y={height - chartData.bottomPad - barHeight}
                  width={barWidth}
                  height={barHeight}
                  fill={baseColor}
                  opacity="0.7"
                />
              );
            })
          ) : (
            // Line or area chart
            <path
              d={createPath()}
              fill={type === 'area' ? baseColor : 'none'}
              fillOpacity={type === 'area' ? 0.2 : 0}
              stroke={baseColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Trend Line */}
          {showTrend && chartData.trendPoints && (
            <line
              x1={chartData.trendPoints.x1}
              y1={chartData.trendPoints.y1}
              x2={chartData.trendPoints.x2}
              y2={chartData.trendPoints.y2}
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeDasharray="4 2"
              opacity="0.8"
            />
          )}

          {/* Data points */}
          {type === 'line' && chartData.points.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="2"
              fill={baseColor}
              className="opacity-60"
            />
          ))}

          {showAxis && chartData.subdivisions.map((sub, i) => (
            <text
              key={`sub-label-${i}`}
              x="5"
              y={sub.y + 3}
              className="text-[10px] fill-gray-400 font-medium"
            >
              {sub.label}
            </text>
          ))}

          <text
            x={showAxis ? 5 : 10}
            y={height - chartData.bottomPad - 5}
            className="text-[10px] fill-gray-500 font-medium"
          >
            {chartData.minValue.toFixed(1)}
          </text>

          {/* Time labels */}
          {showAxis && chartData.timeSubdivisions.map((sub, i) => (
            <text
              key={`time-sub-${i}`}
              x={sub.x}
              y={height - 10}
              className="text-[9px] fill-gray-500 font-medium"
              textAnchor="middle"
            >
              {sub.label}
            </text>
          ))}
        </svg>

      </div>
    </div>
  );
};