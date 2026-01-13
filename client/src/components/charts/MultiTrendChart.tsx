/**
 * MultiTrendChart Component
 * Displays multiple trend lines on a single graph for comparison
 */

import React, { useMemo } from 'react';
import { TimeSeriesData } from '../../types/api';

interface MultiTrendChartProps {
    dataPoints: Record<string, TimeSeriesData[]>;
    tagDescriptions: Record<string, string>;
    width?: number;
    height?: number;
    className?: string;
    title?: string;
}

const SERIES_COLORS = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#f43f5e', // rose
    '#6366f1', // indigo
    '#f97316', // orange
    '#06b6d4', // cyan
    '#8b5cf6', // violet
];

export const MultiTrendChart: React.FC<MultiTrendChartProps> = ({
    dataPoints,
    tagDescriptions,
    width = 800,
    height = 320,
    className = '',
    title = 'Combined Data Preview'
}) => {
    const chartData = useMemo(() => {
        const activeTags = Object.keys(dataPoints).filter(tag => dataPoints[tag].length > 0);
        if (activeTags.length === 0) return null;

        // Calculate global min/max across all tags
        let allValues: number[] = [];
        activeTags.forEach(tag => {
            dataPoints[tag].forEach(p => {
                if (p.value !== null && !isNaN(p.value)) {
                    allValues.push(p.value);
                }
            });
        });

        if (allValues.length === 0) return null;

        const minValue = Math.min(...allValues);
        const maxValue = Math.max(...allValues);
        const range = maxValue - minValue || 1;

        // Normalize Y to fit height
        const leftPad = 60; // More space for labels
        const rightPad = 20;
        const topPad = 20;
        const bottomPad = 40;
        const graphWidth = width - leftPad - rightPad;
        const graphHeight = height - topPad - bottomPad;

        const series = activeTags.map((tag, seriesIndex) => {
            const data = dataPoints[tag].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            const points = data.map((p, i) => {
                const x = (i / (data.length - 1)) * graphWidth + leftPad;
                const y = height - bottomPad - ((p.value - minValue) / range) * graphHeight;
                return { x, y };
            });

            let path = '';
            points.forEach((p, i) => {
                path += (i === 0 ? 'M' : 'L') + `${p.x} ${p.y}`;
            });

            return {
                tag,
                description: tagDescriptions[tag] || '',
                color: SERIES_COLORS[seriesIndex % SERIES_COLORS.length],
                path,
                points
            };
        });

        // Calculate Y-axis subdivisions
        const subdivisions = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
            const value = minValue + (ratio * range);
            const y = height - bottomPad - (ratio * graphHeight);
            return { value, y, label: value.toFixed(1) };
        });

        // Get time range
        const firstTag = activeTags[0];
        const sortedData = dataPoints[firstTag].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const startTime = new Date(sortedData[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const endTime = new Date(sortedData[sortedData.length - 1].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return {
            series,
            subdivisions,
            leftPad,
            rightPad,
            topPad,
            bottomPad,
            startTime,
            endTime,
            minValue,
            maxValue
        };
    }, [dataPoints, tagDescriptions, width, height]);

    if (!chartData) return null;

    return (
        <div className={`bg-white border border-gray-200 rounded p-6 shadow-md ${className}`}>
            <div className="mb-4 border-b border-gray-100 pb-2 flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                    <p className="text-xs text-gray-500 italic">Comparison of {chartData.series.length} tags</p>
                </div>
            </div>

            <div className="relative mb-6">
                <svg width={width - 40} height={height} className="overflow-visible">
                    {/* Grid lines */}
                    {chartData.subdivisions.map((sub, i) => (
                        <React.Fragment key={`sub-${i}`}>
                            <line
                                x1={chartData.leftPad}
                                y1={sub.y}
                                x2={width - chartData.rightPad - 40}
                                y2={sub.y}
                                stroke="#e2e8f0"
                                strokeWidth="0.5"
                                strokeDasharray="4 4"
                            />
                            <text
                                x={chartData.leftPad - 10}
                                y={sub.y + 3}
                                textAnchor="end"
                                className="text-[10px] fill-gray-400 font-mono"
                            >
                                {sub.label}
                            </text>
                        </React.Fragment>
                    ))}

                    {/* X and Y Axis Lines */}
                    <line
                        x1={chartData.leftPad}
                        y1={chartData.topPad}
                        x2={chartData.leftPad}
                        y2={height - chartData.bottomPad}
                        stroke="#94a3b8"
                        strokeWidth="1"
                    />
                    <line
                        x1={chartData.leftPad}
                        y1={height - chartData.bottomPad}
                        x2={width - chartData.rightPad - 40}
                        y2={height - chartData.bottomPad}
                        stroke="#94a3b8"
                        strokeWidth="1"
                    />

                    {/* Time Labels */}
                    <text
                        x={chartData.leftPad}
                        y={height - 10}
                        className="text-[10px] fill-gray-500"
                    >
                        {chartData.startTime}
                    </text>
                    <text
                        x={width - chartData.rightPad - 90}
                        y={height - 10}
                        className="text-[10px] fill-gray-500"
                        textAnchor="end"
                    >
                        {chartData.endTime}
                    </text>

                    {/* Data Lines */}
                    {chartData.series.map((s, i) => (
                        <path
                            key={`path-${i}`}
                            d={s.path}
                            fill="none"
                            stroke={s.color}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="transition-all duration-300"
                        />
                    ))}
                </svg>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 bg-gray-50 p-4 rounded-lg">
                {chartData.series.map((s, i) => (
                    <div key={`legend-${i}`} className="flex items-start space-x-2">
                        <div
                            className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                            style={{ backgroundColor: s.color }}
                        />
                        <div className="min-w-0">
                            <div className="text-xs font-bold text-gray-800 truncate" title={s.tag}>
                                {s.tag}
                            </div>
                            <div className="text-[10px] text-gray-500 truncate" title={s.description}>
                                {s.description || 'No description'}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
