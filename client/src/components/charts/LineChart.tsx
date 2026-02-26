import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { TimeSeriesData } from '../../types/api';
import { colors } from '../../design-tokens/colors';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

interface LineChartProps {
  data: TimeSeriesData[];
  title?: string;
  showLegend?: boolean;
  height?: number;
  theme?: 'light' | 'dark';
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  title,
  showLegend = true,
  height = 400,
  theme = 'light',
}) => {
  const chartData = {
    datasets: [
      {
        label: data[0]?.tagName || 'Data',
        data: data.map(point => ({
          x: point.timestamp,
          y: point.value,
        })),
        borderColor: colors.chart.blue,
        backgroundColor: colors.chart.blue + '20',
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 2,
        pointHoverRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: showLegend,
        position: 'top' as const,
      },
      title: {
        display: !!title,
        text: title,
        font: {
          size: 16,
          weight: 'bold' as const,
        },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: function (context: any) {
            return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          displayFormats: {
            minute: 'HH:mm',
            hour: 'HH:mm',
            day: 'MMM dd',
          },
        },
        title: {
          display: true,
          text: 'Time',
        },
        grid: {
          color: colors.gray[200],
        },
      },
      y: {
        title: {
          display: true,
          text: 'Value',
        },
        grid: {
          color: colors.gray[200],
        },
      },
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    },
  };

  return (
    <div style={{ height: `${height}px` }}>
      <Line data={chartData} options={options} />
    </div>
  );
};