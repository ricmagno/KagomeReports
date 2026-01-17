/**
 * MultiTrendChart Component
 * Displays multiple trend lines on a single graph for comparison
 */

import React, { useMemo } from 'react';
import { TimeSeriesData } from '../../types/api';
import { GuideLine, ChartBounds, ChartScale } from '../../types/guideLines';
import { calculateAllIntersections } from '../../utils/intersectionDetection';
import { CHART_COLORS, getTagColor, getTagIndex, dataToPixelX, dataToPixelY, pixelToDataX, pixelToDataY } from './chartUtils';

interface MultiTrendChartProps {
    dataPoints: Record<string, TimeSeriesData[]>;
    tagDescriptions: Record<string, string>;
    tags?: string[];
    width?: number;
    height?: number;
    className?: string;
    title?: string;
    description?: string;
    /** Optional guide lines to render inside the chart */
    guideLines?: GuideLine[];
    /** Chart bounds for guide line positioning */
    bounds?: ChartBounds;
    /** Chart scale for guide line positioning */
    scale?: ChartScale;
    /** Optional units for Y values */
    units?: string;
    /** Callback to update guide line positions during drag */
    onGuideLinesChange?: (lines: GuideLine[]) => void;
}

export const MultiTrendChart: React.FC<MultiTrendChartProps> = ({
    dataPoints,
    tagDescriptions,
    tags,
    width = 800,
    height = 320,
    className = '',
    title = 'Combined Data Preview',
    description,
    guideLines = [],
    bounds,
    scale,
    units,
    onGuideLinesChange
}) => {
    const [dragState, setDragState] = React.useState<{lineId: string, type: 'horizontal' | 'vertical'} | null>(null);

    const chartData = useMemo(() => {
        // Use provided tags or fallback to keys of dataPoints
        const allTags = tags || Object.keys(dataPoints);
        const activeTags = allTags.filter(tag => dataPoints[tag] && dataPoints[tag].length > 0);

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

        console.log('MultiTrendChart Scale:', { yMin: minValue, yMax: maxValue, range });

        // Normalize Y to fit height
        const leftPad = 60; // More space for labels
        const rightPad = 20;
        const topPad = 20;
        const bottomPad = 40;
        const graphWidth = width - leftPad - rightPad;
        const graphHeight = height - topPad - bottomPad;

        const series = activeTags.map((tag) => {
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

            // Find original index for stable coloring (case-insensitive)
            const originalIndex = getTagIndex(tag, allTags);
            const color = getTagColor(originalIndex) || CHART_COLORS[0];

            return {
                tag,
                description: tagDescriptions[tag] || '',
                color,
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

        // Calculate X-axis time subdivisions
        const timeSubdivisions: { x: number; label: string }[] = [];
        const firstTag = activeTags[0];
        const sortedData = [...dataPoints[firstTag]].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const start = new Date(sortedData[0].timestamp).getTime();
        const end = new Date(sortedData[sortedData.length - 1].timestamp).getTime();
        const durationMin = (end - start) / (1000 * 60);

        const potentialIntervals = [1, 5, 10, 15, 25, 30, 60, 120, 240, 480, 720, 1440];
        let interval = potentialIntervals[0];
        for (const i of potentialIntervals) {
            interval = i;
            if (durationMin / i <= 8) break;
        }

        const intervalMs = interval * 60 * 1000;
        let currentTick = Math.ceil(start / intervalMs) * intervalMs;
        while (currentTick <= end) {
            const ratio = (currentTick - start) / (end - start);
            const x = ratio * graphWidth + leftPad;
            const timeLabel = new Date(currentTick).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            timeSubdivisions.push({ x, label: timeLabel });
            currentTick += intervalMs;
        }

        return {
            series,
            subdivisions,
            timeSubdivisions,
            leftPad,
            rightPad,
            topPad,
            bottomPad,
            minValue,
            maxValue,
            activeTags,
            graphWidth,
            graphHeight
        };
    }, [dataPoints, tagDescriptions, tags, width, height]);

    // Calculate intersections if guide lines are provided (must be before early return)
    const intersections = useMemo(() => {
        if (!chartData || !scale || !bounds || guideLines.length === 0) return [];
        return calculateAllIntersections(guideLines, dataPoints, bounds, scale);
    }, [guideLines, dataPoints, bounds, scale, chartData]);

    if (!chartData) return null;

    // Handle mouse down on guide line (start drag)
    const handleMouseDown = (lineId: string, type: 'horizontal' | 'vertical', event: React.MouseEvent<SVGLineElement>) => {
        if (!onGuideLinesChange) return;

        setDragState({ lineId, type });

        // Update the guide line to indicate it's being dragged
        const updatedLines = guideLines.map(line =>
            line.id === lineId ? { ...line, isDragging: true } : line
        );

        onGuideLinesChange(updatedLines);

        // Prevent text selection during drag
        event.preventDefault();
    };

    // Handle mouse move (during drag)
    const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
        if (!dragState || !onGuideLinesChange || !scale || !bounds) return;

        const line = guideLines.find(l => l.id === dragState.lineId);
        if (!line) return;

        const rect = event.currentTarget.getBoundingClientRect();

        // Calculate position relative to the SVG
        const svgX = event.clientX - rect.left;
        const svgY = event.clientY - rect.top;

        // Calculate new position based on drag direction
        let newPosition: number;

        if (dragState.type === 'horizontal') {
            // Calculate Y position in data space
            // The chart area starts at topPad and ends at height - bottomPad
            // So we need to map the full SVG height to the chart area
            const pixelY = svgY - chartData.topPad; // Subtract top padding to get to graph area
            // Ensure the pixelY is within the graph area bounds
            const clampedPixelY = Math.max(0, Math.min(chartData.graphHeight, pixelY));
            newPosition = pixelToDataY(clampedPixelY, bounds, scale);
            // Constrain to Y bounds
            newPosition = Math.max(scale.yMin, Math.min(scale.yMax, newPosition));
        } else {
            // Calculate X position (timestamp) in data space
            // The chart area starts at leftPad and ends at width - rightPad (but SVG width is width-40)
            const pixelX = svgX - chartData.leftPad; // Subtract left padding to get to graph area
            // Ensure the pixelX is within the graph area bounds
            const clampedPixelX = Math.max(0, Math.min(chartData.graphWidth, pixelX));
            newPosition = pixelToDataX(clampedPixelX, bounds, scale);
            // Constrain to X bounds
            newPosition = Math.max(scale.xMin, Math.min(scale.xMax, newPosition));
        }

        // Update guide line position
        const updatedLines = guideLines.map(l =>
            l.id === dragState.lineId
                ? { ...l, position: newPosition }
                : l
        );

        onGuideLinesChange(updatedLines);
    };

    // Handle mouse up (end drag)
    const handleMouseUp = () => {
        if (!dragState || !onGuideLinesChange) return;

        // Update the guide line to indicate it's no longer being dragged
        const updatedLines = guideLines.map(line =>
            line.id === dragState.lineId ? { ...line, isDragging: false } : line
        );

        onGuideLinesChange(updatedLines);

        setDragState(null);
    };

    return (
        <div className={`bg-white border border-gray-200 rounded p-6 shadow-md ${className}`}>
            <div className="mb-4 border-b border-gray-100 pb-2 flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                    <p className="text-xs text-gray-500 italic">
                        {description || `Comparison of ${chartData.series.length} tags`}
                    </p>
                </div>
            </div>

            <div className="relative mb-6">
                <svg
                    width={width - 40}
                    height={height}
                    className="overflow-visible"
                    onMouseMove={dragState ? handleMouseMove : undefined}
                    onMouseUp={dragState ? handleMouseUp : undefined}
                    onMouseLeave={dragState ? handleMouseUp : undefined}
                >
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
                    {chartData.timeSubdivisions.map((sub, i) => (
                        <text
                            key={`time-sub-${i}`}
                            x={sub.x}
                            y={height - 10}
                            className="text-[10px] fill-gray-500 font-medium"
                            textAnchor="middle"
                        >
                            {sub.label}
                        </text>
                    ))}

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

                    {/* Guide Lines - rendered inside the chart SVG */}
                    {guideLines && guideLines.length > 0 && scale && bounds && (
                        <>
                            {guideLines.map(line => {
                                // Calculate pixel position from data position
                                const pixelX = line.type === 'vertical'
                                    ? dataToPixelX(line.position, bounds, scale) + chartData.leftPad
                                    : 0;

                                const pixelY = line.type === 'horizontal'
                                    ? dataToPixelY(line.position, bounds, scale) + chartData.topPad
                                    : 0;

                                // Calculate line endpoints
                                // Use the actual SVG width (width - 40) for horizontal lines
                                const actualSvgWidth = width - 40;
                                const x1 = line.type === 'horizontal' ? chartData.leftPad : pixelX;
                                const y1 = line.type === 'horizontal' ? pixelY : chartData.topPad;
                                const x2 = line.type === 'horizontal' ? actualSvgWidth - chartData.rightPad : pixelX;
                                const y2 = line.type === 'horizontal' ? pixelY : height - chartData.bottomPad;

                                // Calculate opacity and stroke width based on state
                                const opacity = line.isDragging ? 0.9 : 0.7;
                                const strokeWidth = line.isDragging ? 3 : 2;

                                return (
                                    <g key={line.id}>
                                        {/* Invisible wider line for easier interaction */}
                                        <line
                                            x1={x1}
                                            y1={y1}
                                            x2={x2}
                                            y2={y2}
                                            stroke="transparent"
                                            strokeWidth="10"
                                            style={{ cursor: line.type === 'horizontal' ? 'ns-resize' : 'ew-resize' }}
                                            onMouseDown={(e) => handleMouseDown(line.id, line.type, e)}
                                        />

                                        {/* Guide line */}
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
                                        />

                                        {/* Coordinate display */}
                                        {line.type === 'horizontal' && (
                                            <g>
                                                {/* Background rectangle for readability */}
                                                <rect
                                                    x={width - 40 - chartData.rightPad - 50}
                                                    y={pixelY - 12}
                                                    width={48}
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
                                                    x={width - 40 - chartData.rightPad - 26}
                                                    y={pixelY + 3}
                                                    textAnchor="middle"
                                                    className="text-[11px] font-mono font-medium fill-gray-800"
                                                    style={{ pointerEvents: 'none' }}
                                                >
                                                    {line.position.toFixed(2)}{units ? ` ${units}` : ''}
                                                </text>
                                            </g>
                                        )}

                                        {line.type === 'vertical' && (
                                            <g>
                                                {/* Background rectangle for readability */}
                                                <rect
                                                    x={pixelX - 40}
                                                    y={chartData.topPad + 2}
                                                    width={80}
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
                                                    x={pixelX}
                                                    y={chartData.topPad + 16}
                                                    textAnchor="middle"
                                                    className="text-[11px] font-mono font-medium fill-gray-800"
                                                    style={{ pointerEvents: 'none' }}
                                                >
                                                    {new Date(line.position).toLocaleTimeString([], {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        second: '2-digit'
                                                    })}
                                                </text>
                                            </g>
                                        )}
                                    </g>
                                );
                            })}

                            {/* Render intersection points */}
                            {intersections.map((intersection, index) => (
                                <g key={`intersection-${index}`}>
                                    {/* Intersection point circle */}
                                    <circle
                                        cx={intersection.x + chartData.leftPad}
                                        cy={intersection.y + chartData.topPad}
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
                        </>
                    )}
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
