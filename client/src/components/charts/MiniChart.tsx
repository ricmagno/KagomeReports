/**
 * Mini Chart Component
 * Displays a small preview chart for report preview functionality using ApexCharts
 */

import React, { useMemo } from 'react';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { TimeSeriesData, StatisticsResult } from '../../types/api';
import { GuideLine } from '../../types/guideLines';
import { calculateTrendLine, TrendAnalysisResult } from './chartUtils';

interface MiniChartProps {
  data: TimeSeriesData[];
  tagName: string;
  type?: 'line' | 'bar' | 'area';
  width?: number | string;
  height?: number | string;
  className?: string;
  showTrend?: boolean;
  showAxis?: boolean;
  title?: string;
  description?: string;
  statistics?: StatisticsResult;
  color?: string;
  units?: string;
  /** Optional guide lines to render inside the chart */
  guideLines?: GuideLine[];
  /** Callback to update guide line positions (for compatibility) */
  onGuideLinesChange?: (lines: GuideLine[]) => void;
}

export const MiniChart: React.FC<MiniChartProps> = ({
  data,
  tagName,
  type = 'line',
  width = '100%',
  height = 160,
  className = '',
  showTrend = true,
  showAxis = false,
  title,
  description,
  statistics,
  color,
  units,
  guideLines = [],
}) => {
  const { chartData, trendResult } = useMemo(() => {
    if (!data || data.length === 0) return { chartData: null, trendResult: null };

    const validData = data
      .filter(point => point.value !== null && !isNaN(point.value))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (validData.length === 0) return { chartData: null, trendResult: null };

    const points = validData.map(p => ({
      x: new Date(p.timestamp).getTime(),
      y: Number(p.value.toFixed(2))
    }));

    const trend = showTrend && points.length >= 2 ? calculateTrendLine(points) : null;

    return { chartData: points, trendResult: trend };
  }, [data, showTrend]);

  const getQualityColor = () => {
    if (!data || data.length === 0) return '#94a3b8';
    const goodQualityCount = data.filter(point => point.quality === 'Good' || point.quality === 192).length;
    const qualityPercentage = (goodQualityCount / data.length) * 100;

    if (qualityPercentage >= 90) return '#10b981'; // green
    if (qualityPercentage >= 70) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  const baseColor = color || getQualityColor();

  const series = useMemo(() => {
    const s = [];

    if (chartData) {
      s.push({
        name: tagName,
        type: type === 'bar' ? 'column' : (type === 'area' ? 'area' : 'line'),
        data: chartData
      });

      if (trendResult) {
        s.push({
          name: 'Trend',
          type: 'line',
          data: trendResult.points
        });
      }
    }

    return s;
  }, [chartData, trendResult, tagName, type]);

  const annotations = useMemo(() => {
    const yaxis = guideLines
      .filter(l => l.type === 'horizontal')
      .map(l => ({
        y: l.position,
        borderColor: l.color,
        label: {
          borderColor: l.color,
          style: {
            color: '#fff',
            background: l.color,
          },
          text: `${l.position.toFixed(2)}${units ? ` ${units}` : ''}`,
        }
      }));

    const xaxis = guideLines
      .filter(l => l.type === 'vertical')
      .map(l => ({
        x: l.position,
        borderColor: l.color,
        label: {
          borderColor: l.color,
          style: {
            color: '#fff',
            background: l.color,
          },
          text: new Date(l.position).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      }));

    return { yaxis, xaxis };
  }, [guideLines, units]);

  if (!chartData) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg ${className}`}
        style={{ width, height }}
      >
        <span className="text-xs text-gray-400 font-medium">No data points available</span>
      </div>
    );
  }

  const options: ApexOptions = {
    chart: {
      id: `mini-chart-${tagName}`,
      type: 'line',
      sparkline: {
        enabled: !showAxis
      },
      animations: {
        enabled: true,
        speed: 400
      },
      fontFamily: 'Inter, sans-serif'
    },
    colors: [baseColor, '#64748b'],
    stroke: {
      curve: 'smooth',
      width: [2, 2],
      dashArray: [0, 5]
    },
    fill: {
      type: type === 'area' ? 'gradient' : 'solid',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [20, 100, 100, 100]
      }
    },
    plotOptions: {
      bar: {
        columnWidth: '60%',
        borderRadius: 2
      }
    },
    xaxis: {
      type: 'datetime',
      labels: {
        show: showAxis,
        datetimeUTC: false,
        style: {
          fontSize: '9px',
          colors: '#94a3b8'
        }
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    yaxis: {
      labels: {
        show: showAxis,
        formatter: (val) => typeof val === 'number' ? val.toFixed(1) : (val as any),
        style: {
          fontSize: '9px',
          colors: '#94a3b8'
        }
      }
    },
    tooltip: {
      x: {
        format: 'HH:mm:ss'
      },
      y: {
        formatter: (val, { seriesIndex }) => {
          if (seriesIndex === 1 && trendResult) {
            return `${val.toFixed(2)} [${trendResult.equation}]`;
          }
          return `${val}${units ? ` ${units}` : ''}`;
        }
      },
      theme: 'light'
    },
    grid: {
      show: showAxis,
      borderColor: '#f1f5f9',
      strokeDashArray: 2
    },
    annotations: annotations,
  };

  return (
    <div className={`relative bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow ${className}`}>
      <div className="mb-2 flex items-start justify-between border-b border-gray-100 pb-2">
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-bold text-gray-800 truncate" title={title || tagName}>
            {title || tagName}
          </span>
          {description && (
            <span className="text-[10px] font-normal text-gray-400 truncate mt-0.5" title={description}>
              {description}
            </span>
          )}
        </div>

        {statistics && showAxis && (
          <div className="flex flex-col items-end flex-shrink-0 ml-4">
            <div className="flex items-center space-x-2 text-[10px] font-mono leading-tight">
              <span className="text-gray-400">AVG: <span className="font-bold text-blue-600">{statistics.average.toFixed(2)}</span></span>
              <span className="text-gray-400">MAX: <span className="font-bold text-amber-600">{statistics.max.toFixed(2)}</span></span>
            </div>
            <span className="text-[9px] text-gray-400 font-mono mt-1">
              {chartData.length} pts
            </span>
          </div>
        )}
      </div>

      <div className="relative overflow-hidden">
        <Chart
          options={options}
          series={series}
          type="line"
          width={width}
          height={height}
        />
      </div>

      {trendResult && showAxis && (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[9px] font-mono bg-gray-50 p-2 rounded border border-gray-100">
          <div className="flex items-center">
            <span className="text-gray-400 w-8">EQ:</span>
            <span className="text-blue-600 font-bold truncate ml-1">{trendResult.equation}</span>
          </div>
          <div className="flex items-center">
            <span className="text-gray-400 w-8">R²:</span>
            <span className="text-amber-600 font-bold ml-1">{trendResult.rSquared.toFixed(3)}</span>
          </div>
          <div className="flex items-center">
            <span className="text-gray-400 w-8">SD:</span>
            <span className="text-gray-700 ml-1">{trendResult.standardDeviation.toFixed(2)}</span>
          </div>
          <div className="flex items-center">
            <span className="text-gray-400 w-8">VAR:</span>
            <span className="text-gray-700 ml-1">{trendResult.variance.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
};