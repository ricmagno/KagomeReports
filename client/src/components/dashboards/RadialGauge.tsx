import React from 'react';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';

interface RadialGaugeProps {
    value: number;
    min?: number;
    max?: number;
    tagName: string;
    unit?: string;
    height?: number | string;
    isMaximized?: boolean;
}

export const RadialGauge: React.FC<RadialGaugeProps> = ({
    value = 0,
    min = 0,
    max = 100,
    tagName,
    unit = '',
    height = "100%",
    isMaximized = false
}) => {
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
                    value: {
                        offsetY: isMaximized ? -30 : -15,
                        fontSize: isMaximized ? '64px' : '32px',
                        color: '#111827', // text-gray-900
                        fontWeight: 800,
                        formatter: (val) => {
                            return `${value.toFixed(1)}${unit}`;
                        }
                    },
                    name: {
                        fontSize: isMaximized ? '22px' : '11px',
                        color: '#9ca3af', // text-gray-400
                        offsetY: isMaximized ? 40 : 25,
                        show: true,
                        fontWeight: 600,
                    }
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
        <div className="flex flex-col items-center justify-center h-full w-full">
            <Chart
                options={options}
                series={series}
                type="radialBar"
                height={height}
                width="100%"
            />
            <div className="mt-[-20px] text-[10px] text-gray-400 font-medium">
                Range: {min} - {max} {unit}
            </div>
        </div>
    );
};
