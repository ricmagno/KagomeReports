/**
 * Chart Generation Service
 * Handles chart generation using Chart.js for embedding in PDF reports
 * Requirements: 4.2
 */

import { createCanvas } from 'canvas';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { TimeSeriesData, StatisticsResult, TrendResult } from '@/types/historian';
import { reportLogger } from '@/utils/logger';
import { env } from '@/config/environment';

// Register Chart.js components
Chart.register(...registerables);

// Try to register date adapter, but don't fail if it's not available
try {
  require('chartjs-adapter-date-fns');
} catch (error) {
  reportLogger.warn('Chart.js date adapter not available, date scaling may not work properly');
}

// Register Chart.js components
Chart.register(...registerables);

export interface ChartOptions {
  width?: number;
  height?: number;
  title?: string;
  backgroundColor?: string;
  colors?: string[];
}

export interface LineChartData {
  tagName: string;
  data: TimeSeriesData[];
  color?: string;
}

export interface BarChartData {
  labels: string[];
  values: number[];
  label: string;
  color?: string;
}

export interface TrendChartData {
  tagName: string;
  data: TimeSeriesData[];
  trend: TrendResult;
  color?: string;
}

export class ChartGenerationService {
  private defaultWidth: number;
  private defaultHeight: number;
  private defaultColors: string[];

  constructor() {
    this.defaultWidth = (env.CHART_WIDTH as number) || 800;
    this.defaultHeight = (env.CHART_HEIGHT as number) || 400;
    this.defaultColors = [
      '#3b82f6', // Blue
      '#10b981', // Green
      '#f59e0b', // Yellow
      '#ef4444', // Red
      '#8b5cf6', // Purple
      '#f97316', // Orange
      '#06b6d4', // Cyan
      '#84cc16'  // Lime
    ];
  }

  /**
   * Generate a line chart for time-series data
   */
  async generateLineChart(
    datasets: LineChartData[],
    options: ChartOptions = {}
  ): Promise<Buffer> {
    const width = options.width || this.defaultWidth;
    const height = options.height || this.defaultHeight;
    
    try {
      reportLogger.info('Generating line chart', { 
        datasets: datasets.length,
        width,
        height 
      });

      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // Prepare chart data
      const chartDatasets = datasets.map((dataset, index) => ({
        label: dataset.tagName,
        data: dataset.data.map(point => ({
          x: point.timestamp.getTime(),
          y: point.value
        })),
        borderColor: dataset.color || this.defaultColors[index % this.defaultColors.length],
        backgroundColor: this.addAlpha(dataset.color || this.defaultColors[index % this.defaultColors.length], 0.1),
        borderWidth: 2,
        fill: false,
        tension: 0.1
      }));

      const config: ChartConfiguration = {
        type: 'line',
        data: {
          datasets: chartDatasets
        },
        options: {
          responsive: false,
          animation: false,
          plugins: {
            title: {
              display: !!options.title,
              text: options.title || '',
              font: {
                size: 16,
                weight: 'bold'
              }
            },
            legend: {
              display: datasets.length > 1,
              position: 'top'
            }
          },
          scales: {
            x: {
              type: 'time',
              time: {
                displayFormats: {
                  hour: 'MMM dd HH:mm',
                  day: 'MMM dd',
                  week: 'MMM dd',
                  month: 'MMM yyyy'
                }
              },
              title: {
                display: true,
                text: 'Time'
              }
            },
            y: {
              title: {
                display: true,
                text: 'Value'
              },
              beginAtZero: false
            }
          },
          elements: {
            point: {
              radius: 2,
              hoverRadius: 4
            }
          }
        }
      };

      // Create chart
      const chart = new Chart(ctx, config);

      // Convert to buffer
      const buffer = canvas.toBuffer('image/png');
      
      // Clean up
      chart.destroy();

      reportLogger.info('Line chart generated successfully', {
        bufferSize: buffer.length,
        dataPoints: datasets.reduce((sum, d) => sum + d.data.length, 0)
      });

      return buffer;
    } catch (error) {
      reportLogger.error('Failed to generate line chart', { error });
      throw error;
    }
  }

  /**
   * Generate a bar chart for aggregated data
   */
  async generateBarChart(
    data: BarChartData,
    options: ChartOptions = {}
  ): Promise<Buffer> {
    const width = options.width || this.defaultWidth;
    const height = options.height || this.defaultHeight;
    
    try {
      reportLogger.info('Generating bar chart', { 
        dataPoints: data.values.length,
        width,
        height 
      });

      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      const config: ChartConfiguration = {
        type: 'bar',
        data: {
          labels: data.labels,
          datasets: [{
            label: data.label,
            data: data.values,
            backgroundColor: data.color || this.defaultColors[0],
            borderColor: data.color || this.defaultColors[0],
            borderWidth: 1
          }]
        },
        options: {
          responsive: false,
          animation: false,
          plugins: {
            title: {
              display: !!options.title,
              text: options.title || '',
              font: {
                size: 16,
                weight: 'bold'
              }
            },
            legend: {
              display: false
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: 'Category'
              }
            },
            y: {
              title: {
                display: true,
                text: 'Value'
              },
              beginAtZero: true
            }
          }
        }
      };

      // Create chart
      const chart = new Chart(ctx, config);

      // Convert to buffer
      const buffer = canvas.toBuffer('image/png');
      
      // Clean up
      chart.destroy();

      reportLogger.info('Bar chart generated successfully', {
        bufferSize: buffer.length
      });

      return buffer;
    } catch (error) {
      reportLogger.error('Failed to generate bar chart', { error });
      throw error;
    }
  }

  /**
   * Generate a trend chart with regression line
   */
  async generateTrendChart(
    data: TrendChartData,
    options: ChartOptions = {}
  ): Promise<Buffer> {
    const width = options.width || this.defaultWidth;
    const height = options.height || this.defaultHeight;
    
    try {
      reportLogger.info('Generating trend chart', { 
        dataPoints: data.data.length,
        width,
        height 
      });

      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // Prepare actual data points
      const actualData = data.data.map(point => ({
        x: point.timestamp.getTime(),
        y: point.value
      }));

      // Generate trend line points
      const trendData = this.generateTrendLinePoints(data.data, data.trend);

      const config: ChartConfiguration = {
        type: 'line',
        data: {
          datasets: [
            {
              label: `${data.tagName} (Actual)`,
              data: actualData,
              borderColor: data.color || this.defaultColors[0],
              backgroundColor: this.addAlpha(data.color || this.defaultColors[0], 0.1),
              borderWidth: 2,
              fill: false,
              tension: 0.1,
              pointRadius: 3
            },
            {
              label: `${data.tagName} (Trend)`,
              data: trendData,
              borderColor: this.addAlpha(data.color || this.defaultColors[1], 0.8),
              backgroundColor: 'transparent',
              borderWidth: 2,
              borderDash: [5, 5],
              fill: false,
              pointRadius: 0
            }
          ]
        },
        options: {
          responsive: false,
          animation: false,
          plugins: {
            title: {
              display: !!options.title,
              text: options.title || `${data.tagName} Trend Analysis`,
              font: {
                size: 16,
                weight: 'bold'
              }
            },
            legend: {
              display: true,
              position: 'top'
            }
          },
          scales: {
            x: {
              type: 'time',
              time: {
                displayFormats: {
                  hour: 'MMM dd HH:mm',
                  day: 'MMM dd',
                  week: 'MMM dd',
                  month: 'MMM yyyy'
                }
              },
              title: {
                display: true,
                text: 'Time'
              }
            },
            y: {
              title: {
                display: true,
                text: 'Value'
              },
              beginAtZero: false
            }
          },
          elements: {
            point: {
              radius: 2,
              hoverRadius: 4
            }
          }
        }
      };

      // Create chart
      const chart = new Chart(ctx, config);

      // Convert to buffer
      const buffer = canvas.toBuffer('image/png');
      
      // Clean up
      chart.destroy();

      reportLogger.info('Trend chart generated successfully', {
        bufferSize: buffer.length,
        correlation: data.trend.correlation,
        confidence: data.trend.confidence
      });

      return buffer;
    } catch (error) {
      reportLogger.error('Failed to generate trend chart', { error });
      throw error;
    }
  }

  /**
   * Generate statistical summary chart
   */
  async generateStatisticsChart(
    statistics: Record<string, StatisticsResult>,
    options: ChartOptions = {}
  ): Promise<Buffer> {
    const width = options.width || this.defaultWidth;
    const height = options.height || this.defaultHeight;
    
    try {
      reportLogger.info('Generating statistics chart', { 
        tags: Object.keys(statistics).length,
        width,
        height 
      });

      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      const tagNames = Object.keys(statistics);
      const averages = tagNames.map(tag => statistics[tag]?.average || 0);
      const mins = tagNames.map(tag => statistics[tag]?.min || 0);
      const maxs = tagNames.map(tag => statistics[tag]?.max || 0);

      const config: ChartConfiguration = {
        type: 'bar',
        data: {
          labels: tagNames,
          datasets: [
            {
              label: 'Average',
              data: averages,
              backgroundColor: this.defaultColors[0],
              borderColor: this.defaultColors[0],
              borderWidth: 1
            },
            {
              label: 'Minimum',
              data: mins,
              backgroundColor: this.defaultColors[1],
              borderColor: this.defaultColors[1],
              borderWidth: 1
            },
            {
              label: 'Maximum',
              data: maxs,
              backgroundColor: this.defaultColors[2],
              borderColor: this.defaultColors[2],
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: false,
          animation: false,
          plugins: {
            title: {
              display: !!options.title,
              text: options.title || 'Statistical Summary',
              font: {
                size: 16,
                weight: 'bold'
              }
            },
            legend: {
              display: true,
              position: 'top'
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: 'Tags'
              }
            },
            y: {
              title: {
                display: true,
                text: 'Value'
              },
              beginAtZero: false
            }
          }
        }
      };

      // Create chart
      const chart = new Chart(ctx, config);

      // Convert to buffer
      const buffer = canvas.toBuffer('image/png');
      
      // Clean up
      chart.destroy();

      reportLogger.info('Statistics chart generated successfully', {
        bufferSize: buffer.length
      });

      return buffer;
    } catch (error) {
      reportLogger.error('Failed to generate statistics chart', { error });
      throw error;
    }
  }

  /**
   * Generate multiple charts for a report
   */
  async generateReportCharts(
    data: Record<string, TimeSeriesData[]>,
    statistics?: Record<string, StatisticsResult>,
    trends?: Record<string, TrendResult>,
    chartTypes: ('line' | 'bar' | 'trend' | 'scatter')[] = ['line']
  ): Promise<Record<string, Buffer>> {
    const charts: Record<string, Buffer> = {};

    try {
      reportLogger.info('Generating report charts', {
        tags: Object.keys(data).length,
        chartTypes
      });

      // Generate line charts for each tag
      if (chartTypes.includes('line')) {
        for (const [tagName, tagData] of Object.entries(data)) {
          if (tagData.length > 0) {
            const chartBuffer = await this.generateLineChart(
              [{ tagName, data: tagData }],
              { title: `${tagName} - Time Series` }
            );
            charts[`${tagName}_line`] = chartBuffer;
          }
        }
      }

      // Generate trend charts if trend data is available
      if (chartTypes.includes('trend') && trends) {
        for (const [tagName, tagData] of Object.entries(data)) {
          const trendData = trends[tagName];
          if (tagData.length > 0 && trendData) {
            const chartBuffer = await this.generateTrendChart(
              { tagName, data: tagData, trend: trendData },
              { title: `${tagName} - Trend Analysis` }
            );
            charts[`${tagName}_trend`] = chartBuffer;
          }
        }
      }

      // Generate statistics chart if statistics are available
      if (chartTypes.includes('bar') && statistics && Object.keys(statistics).length > 0) {
        const chartBuffer = await this.generateStatisticsChart(
          statistics,
          { title: 'Statistical Summary' }
        );
        charts['statistics_summary'] = chartBuffer;
      }

      reportLogger.info('Report charts generated successfully', {
        chartCount: Object.keys(charts).length
      });

      return charts;
    } catch (error) {
      reportLogger.error('Failed to generate report charts', { error });
      throw error;
    }
  }

  /**
   * Generate trend line points based on linear regression
   */
  private generateTrendLinePoints(
    data: TimeSeriesData[],
    trend: TrendResult
  ): Array<{ x: number; y: number }> {
    if (data.length < 2) return [];

    const firstTime = data[0]?.timestamp.getTime() || 0;
    const lastTime = data[data.length - 1]?.timestamp.getTime() || 0;
    
    // Generate points for the trend line
    const points = [];
    const numPoints = Math.min(100, data.length); // Limit to 100 points for performance
    
    for (let i = 0; i <= numPoints; i++) {
      const x = firstTime + (lastTime - firstTime) * (i / numPoints);
      // Convert timestamp to a normalized value for the trend calculation
      const normalizedX = (x - firstTime) / (lastTime - firstTime);
      const y = trend.slope * normalizedX + trend.intercept;
      
      points.push({ x, y });
    }

    return points;
  }

  /**
   * Add alpha transparency to a color
   */
  private addAlpha(color: string | undefined, alpha: number): string {
    if (!color) return `rgba(0, 0, 0, ${alpha})`;
    
    // Simple implementation for hex colors
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  }
}

// Export singleton instance
export const chartGenerationService = new ChartGenerationService();