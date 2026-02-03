/**
 * MultiTrendChart Component
 * Displays multiple trend lines on a single graph for comparison using ApexCharts
 */

import React, { useMemo } from 'react';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { TimeSeriesData } from '../../types/api';
import { GuideLine, ChartBounds, ChartScale } from '../../types/guideLines';
import { CHART_COLORS, getTagColor, getTagIndex, calculateTrendLine } from './chartUtils';

interface MultiTrendChartProps {
    dataPoints: Record<string, TimeSeriesData[]>;
    tagDescriptions: Record<string, string>;
    tags?: string[];
    type?: 'line' | 'bar' | 'area';
    width?: number | string;
    height?: number | string;
    className?: string;
    title?: string;
    description?: string;
    /** Optional guide lines to render inside the chart */
    guideLines?: GuideLine[];
    /** Chart bounds for guide line positioning (historical, for compatibility) */
    bounds?: ChartBounds;
    /** Chart scale for guide line positioning (historical, for compatibility) */
    scale?: ChartScale;
    /** Optional units for Y values */
    units?: string;
    /** Whether to include trend analysis best-fit lines */
    includeTrendLines?: boolean;
    /** Callback to update guide line positions during drag */
    onGuideLinesChange?: (lines: GuideLine[]) => void;
}

export const MultiTrendChart: React.FC<MultiTrendChartProps> = ({
    dataPoints,
    tagDescriptions,
    tags,
    type = 'line',
    width = '100%',
    height = 320,
    className = '',
    title = 'Combined Data Preview',
    description,
    guideLines = [],
    units,
    includeTrendLines = true,
}) => {
    // Transform data for ApexCharts
    const { series, colors, strokeWidths, dashArrays } = useMemo(() => {
        const allTags = tags || Object.keys(dataPoints);
        const activeTags = allTags.filter(tag => dataPoints[tag] && dataPoints[tag].length > 0);

        const seriesColors: string[] = [];
        const seriesData: any[] = [];
        const widths: number[] = [];
        const dashes: number[] = [];

        activeTags.forEach((tag) => {
            const data = [...dataPoints[tag]].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            // Stable color based on tag index
            const originalIndex = getTagIndex(tag, allTags);
            const color = getTagColor(originalIndex) || CHART_COLORS[0];

            // Current series data
            const points = data.map(p => ({
                x: new Date(p.timestamp).getTime(),
                y: p.value !== null && !isNaN(p.value) ? Number(p.value.toFixed(2)) : null
            }));

            // Main Data Series
            seriesData.push({
                name: tag,
                type: type === 'bar' ? 'column' : (type === 'area' ? 'area' : 'line'),
                data: points
            });
            seriesColors.push(color);
            widths.push(type === 'bar' ? 0 : 3);
            dashes.push(0);

            // Add Trend Line if enabled
            if (includeTrendLines && points.length >= 2) {
                const trendPoints = calculateTrendLine(points);
                if (trendPoints.length === 2) {
                    seriesData.push({
                        name: `${tag} (Trend)`,
                        type: 'line',
                        data: trendPoints
                    });
                    seriesColors.push(color);
                    widths.push(2);
                    dashes.push(5); // Dashed line for trend
                }
            }
        });

        return { series: seriesData, colors: seriesColors, strokeWidths: widths, dashArrays: dashes };
    }, [dataPoints, tags, type, includeTrendLines]);

    // Transform guide lines to ApexCharts annotations
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
                    text: new Date(l.position).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                }
            }));

        return { yaxis, xaxis };
    }, [guideLines, units]);

    const options: ApexOptions = {
        chart: {
            id: 'multi-trend-chart',
            type: 'line', // Base type, overridden by series[].type
            toolbar: {
                show: true,
                tools: {
                    download: true,
                    selection: true,
                    zoom: true,
                    zoomin: true,
                    zoomout: true,
                    pan: true,
                }
            },
            animations: {
                enabled: true,
                speed: 800,
            },
            fontFamily: 'Inter, sans-serif',
            background: 'transparent',
        },
        colors: colors,
        stroke: {
            curve: 'smooth',
            width: strokeWidths,
            dashArray: dashArrays,
            lineCap: 'round'
        },
        plotOptions: {
            bar: {
                columnWidth: '50%',
                borderRadius: 2
            }
        },
        dataLabels: {
            enabled: false
        },
        markers: {
            size: 0,
            hover: {
                size: 5
            }
        },
        xaxis: {
            type: 'datetime',
            labels: {
                datetimeUTC: false,
                style: {
                    colors: '#64748b',
                    fontSize: '10px'
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
                formatter: (val) => typeof val === 'number' ? val.toFixed(1) : val,
                style: {
                    colors: '#64748b',
                    fontSize: '10px'
                }
            },
            title: units ? {
                text: units,
                style: {
                    color: '#64748b',
                    fontWeight: 500
                }
            } : undefined
        },
        grid: {
            borderColor: '#f1f5f9',
            strokeDashArray: 4,
            xaxis: {
                lines: {
                    show: true
                }
            }
        },
        tooltip: {
            x: {
                format: 'dd MMM HH:mm:ss'
            },
            theme: 'light',
            shared: true,
            intersect: false,
        },
        legend: {
            position: 'bottom',
            horizontalAlign: 'center',
            fontSize: '12px',
            markers: {
                size: 6,
                strokeWidth: 0,
            },
            itemMargin: {
                horizontal: 10,
                vertical: 5
            }
        },
        annotations: annotations,
    };

    return (
        <div className={`bg-white border border-gray-200 rounded-lg p-6 shadow-sm ${className}`}>
            <div className="mb-4 border-b border-gray-100 pb-2">
                <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                <p className="text-xs text-gray-500 italic">
                    {description || `Comparison of ${Object.keys(dataPoints).length} tags`}
                </p>
            </div>

            <div className="relative min-h-[320px]">
                <Chart
                    options={options}
                    series={series}
                    type="line"
                    width={width}
                    height={height}
                />
            </div>
        </div>
    );
};
