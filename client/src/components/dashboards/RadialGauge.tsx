import React from 'react';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { cn } from '../../utils/cn';

interface RadialGaugeProps {
    value: number;
    min?: number;
    max?: number;
    tagName: string;
    unit?: string;
    description?: string;
    status?: 'good' | 'bad' | 'uncertain';
    height?: number | string;
    isMaximized?: boolean;
}

export const RadialGauge: React.FC<RadialGaugeProps> = ({
    value = 0,
    min = 0,
    max = 100,
    tagName,
    unit = '',
    description = '',
    status = 'good',
    height = "100%",
    isMaximized = false
}) => {
    const statusIcons = {
        good: 'bg-green-500',
        bad: 'bg-red-500',
        uncertain: 'bg-amber-500'
    };
    // Calculate percentage for the gauge
    const range = max - min;
    const percentage = range > 0 ? ((value - min) / range) * 100 : 0;
    const clampedPercentage = Math.min(Math.max(percentage, 0), 100);

    const options: ApexOptions = {
        chart: {
            type: 'radialBar',
            offsetY: -10,
            sparkline: {
                enabled: true
            }
        },
        plotOptions: {
            radialBar: {
                startAngle: -180,
                endAngle: 180,
                hollow: {
                    margin: 0,
                    size: '70%',
                    background: 'transparent',
                },
                track: {
                    background: '#f3f4f6',
                    strokeWidth: '97%',
                    margin: 5,
                },
                dataLabels: {
                    show: false // We use custom overlays for better control and consistency with ValueBlock
                }
            }
        },
        fill: {
            type: 'gradient',
            gradient: {
                shade: 'dark',
                shadeIntensity: 0.15,
                inverseColors: false,
                opacityFrom: 1,
                opacityTo: 1,
                stops: [0, 50, 65, 91],
                colorStops: [
                    {
                        offset: 0,
                        color: "#3b82f6", // Blue
                        opacity: 1
                    },
                    {
                        offset: 60,
                        color: "#10b981", // Green
                        opacity: 1
                    },
                    {
                        offset: 80,
                        color: "#f59e0b", // Amber
                        opacity: 1
                    },
                    {
                        offset: 100,
                        color: "#ef4444", // Red
                        opacity: 1
                    }
                ]
            }
        },
        labels: [tagName],
    };

    const series = [clampedPercentage];

    return (
        <div className="flex flex-col items-center justify-center h-full w-full relative">
            {/* Status indicator */}
            <div className={cn(
                "absolute top-3 right-3 rounded-full border-2 border-white shadow-sm z-10",
                isMaximized ? "w-6 h-6 border-4" : "w-3 h-3",
                statusIcons[status]
            )} />

            <div className="w-full h-full">
                <Chart
                    options={options}
                    series={series}
                    type="radialBar"
                    height={height}
                    width="100%"
                />
            </div>

            {/* Custom Overlay for Value and Unit */}
            <div className={cn(
                "absolute inset-0 flex flex-col items-center justify-center pointer-events-none",
                !isMaximized && "mt-[-10px]"
            )}>
                <div className="flex items-baseline justify-center space-x-1">
                    <span className={cn(
                        "font-black tracking-tighter text-gray-900 leading-none",
                        isMaximized ? "text-8xl" : "text-4xl"
                    )}>
                        {value.toFixed(1)}
                    </span>
                    {unit && (
                        <span className={cn(
                            "font-bold text-gray-400",
                            isMaximized ? "text-3xl" : "text-sm"
                        )}>
                            {unit}
                        </span>
                    )}
                </div>

                {/* Tag Name styled like Radial Gauge pattern */}
                <span className={cn(
                    "font-semibold text-gray-400 truncate max-w-[80%] px-2 mt-2",
                    isMaximized ? "text-xl" : "text-[10px]"
                )} title={tagName}>
                    {tagName}
                </span>
            </div>

            {/* Footer containing range and description */}
            <div className={cn(
                "w-full text-center space-y-1",
                isMaximized ? "mt-[-60px] pb-10" : "mt-[-20px] pb-2"
            )}>
                <div className={cn(
                    "text-gray-400 font-medium",
                    isMaximized ? "text-base" : "text-[10px]"
                )}>
                    Range: {min} - {max} {unit}
                </div>
                {description && (
                    <div className={cn(
                        "text-gray-400 font-normal truncate block opacity-70",
                        isMaximized ? "text-lg" : "text-[10px]"
                    )}>
                        {description}
                    </div>
                )}
            </div>
        </div>
    );
};
