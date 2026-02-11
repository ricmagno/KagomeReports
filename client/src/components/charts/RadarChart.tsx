import React from 'react';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { cn } from '../../utils/cn';

interface RadarChartProps {
    data: Record<string, number>;
    title?: string;
    height?: number | string;
    className?: string;
}

export const RadarChart: React.FC<RadarChartProps> = ({
    data,
    title,
    height = 350,
    className = ''
}) => {
    const categories = Object.keys(data);
    const series = [{
        name: 'Value',
        data: Object.values(data),
    }];

    const options: ApexOptions = {
        chart: {
            type: 'radar',
            toolbar: {
                show: false
            },
            dropShadow: {
                enabled: true,
                blur: 1,
                left: 1,
                top: 1
            }
        },
        title: {
            text: title,
            align: 'left',
            style: {
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#374151'
            }
        },
        stroke: {
            width: 2,
            colors: ['#3b82f6'] // Blue-500
        },
        fill: {
            opacity: 0.2,
            colors: ['#3b82f6']
        },
        markers: {
            size: 4,
            colors: ['#fff'],
            strokeColors: '#3b82f6',
            strokeWidth: 2,
        },
        xaxis: {
            categories: categories,
            labels: {
                style: {
                    colors: Array(categories.length).fill('#6b7280'),
                    fontSize: '11px',
                }
            }
        },
        yaxis: {
            show: false,
        },
        legend: {
            show: false
        }
    };

    return (
        <div className={cn("bg-white p-2 h-full w-full", className)}>
            <Chart
                options={options}
                series={series}
                type="radar"
                height={height}
                width="100%"
            />
        </div>
    );
};
