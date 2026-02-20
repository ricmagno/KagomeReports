/**
 * Chart Generation Service
 * Handles chart generation using Chart.js for embedding in PDF reports
 * Requirements: 4.2
 */

import { createCanvas } from 'canvas';
import { Chart, ChartConfiguration, registerables, _adapters } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { TimeSeriesData, StatisticsResult, TrendResult, SPCMetrics, SpecificationLimits } from '@/types/historian';
import { reportLogger } from '@/utils/logger';
import { env } from '@/config/environment';
import { chartBufferValidator } from '@/utils/chartBufferValidator';

// Make sure Chart has _adapters property which the date adapter expects
if (Chart && !(Chart as any)._adapters) {
  (Chart as any)._adapters = _adapters;
}

// Register Chart.js components
Chart.register(...registerables, annotationPlugin);

// Load date adapter using require (works better in CommonJS context)
try {
  // Ensure Chart is available globally for the adapter to find it in Node environment
  if (typeof global !== 'undefined') {
    (global as any).Chart = Chart;
  }

  // Use the standard require which resolves to the correct entry point
  require('chartjs-adapter-date-fns');
  reportLogger.info('Chart.js date adapter loaded successfully');
} catch (error) {
  reportLogger.error('Failed to load Chart.js date adapter', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined
  });
}

export interface ChartOptions {
  width?: number;
  height?: number;
  title?: string;
  backgroundColor?: string;
  colors?: string[];
  timezone?: string | undefined;
}

export interface LineChartData {
  tagName: string;
  data: TimeSeriesData[];
  color?: string;
  trendLine?: {
    slope: number;
    intercept: number;
    rSquared: number;
    equation: string;
  };
  statistics?: {
    min: number;
    max: number;
    mean: number;
    stdDev: number;
  };
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
    this.defaultWidth = (env.CHART_WIDTH as number) || 2400;  // Increased to 2400 for high resolution
    this.defaultHeight = (env.CHART_HEIGHT as number) || 1200; // Increased to 1200 for high resolution
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
   * Generate a line chart for time-series data with optional trend lines and statistics
   */
  async generateLineChart(
    datasets: LineChartData[],
    options: ChartOptions = {}
  ): Promise<Buffer> {
    const width = options.width || this.defaultWidth;
    const height = options.height || this.defaultHeight;
    const totalDataPoints = datasets.reduce((sum, d) => sum + d.data.length, 0);
    const grayscale = false; // PRESERVE COLORS for time series trends - only SPC charts use grayscale

    try {
      reportLogger.info('Generating line chart with trend lines', {
        datasets: datasets.length,
        width,
        height,
        totalDataPoints,
        title: options.title || 'untitled',
        hasTrendLines: datasets.some(d => d.trendLine),
        hasStatistics: datasets.some(d => d.statistics)
      });

      // Validate input data
      if (datasets.length === 0) {
        throw new Error('No datasets provided for line chart generation');
      }

      if (totalDataPoints === 0) {
        throw new Error('No data points available in datasets for line chart generation');
      }

      reportLogger.debug('Creating canvas for line chart', { width, height });
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      reportLogger.debug('Canvas created successfully', {
        canvasWidth: canvas.width,
        canvasHeight: canvas.height
      });

      // Prepare chart data
      reportLogger.debug('Preparing chart datasets', {
        datasetCount: datasets.length,
        datasetNames: datasets.map(d => d.tagName)
      });

      const chartDatasets: any[] = [];

      // Add main data series
      datasets.forEach((dataset, index) => {
        const baseColor = grayscale ? '#000000' : (dataset.color || this.defaultColors[index % this.defaultColors.length]);

        chartDatasets.push({
          label: dataset.tagName,
          data: dataset.data.map(point => ({
            x: point.timestamp.getTime(),
            y: point.value
          })),
          borderColor: baseColor,
          backgroundColor: 'transparent',
          borderWidth: 1,
          fill: false,
          tension: 0.1,
          pointRadius: 2,
          pointHoverRadius: 4
        });

        // Add trend line if available
        if (dataset.trendLine && dataset.data.length >= 3) {
          const startTime = dataset.data[0]!.timestamp.getTime();
          const endTime = dataset.data[dataset.data.length - 1]!.timestamp.getTime();
          const timeSpanSeconds = (endTime - startTime) / 1000;

          // Calculate y values at start and end
          const yStart = dataset.trendLine.intercept;
          const yEnd = dataset.trendLine.slope * timeSpanSeconds + dataset.trendLine.intercept;

          // Determine if trend fit is weak (R² < 0.3)
          const weakFit = dataset.trendLine.rSquared < 0.3;
          const trendColor = grayscale ? (weakFit ? '#999999' : '#666666') : '#ef4444';

          chartDatasets.push({
            label: `Trend: ${dataset.trendLine.equation} (R² = ${dataset.trendLine.rSquared})${weakFit ? ' ⚠' : ''}`,
            data: [
              { x: startTime, y: yStart },
              { x: endTime, y: yEnd }
            ],
            borderColor: trendColor,
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            tension: 0
          });
        }
      });

      reportLogger.debug('Chart datasets prepared', {
        datasetCount: chartDatasets.length,
        totalPoints: chartDatasets.reduce((sum, d) => sum + (d.data?.length || 0), 0)
      });

      // Prepare annotations for statistics
      const annotations: any = {};

      // Add statistics box if available (only for single dataset)
      if (datasets.length === 1 && datasets[0]!.statistics) {
        const stats = datasets[0]!.statistics;
        annotations.statsBox = {
          type: 'label',
          xValue: (ctx: any) => {
            const xScale = ctx.chart.scales.x;
            return xScale.max - (xScale.max - xScale.min) * 0.15; // Moved further from right edge (15%)
          },
          yValue: (ctx: any) => {
            const yScale = ctx.chart.scales.y;
            return yScale.max - (yScale.max - yScale.min) * 0.15; // Moved further from top (15%)
          },
          xAdjust: 0,
          yAdjust: 0,
          content: [
            `Min: ${stats.min.toFixed(2)}`,
            `Max: ${stats.max.toFixed(2)}`,
            `Avg: ${stats.mean.toFixed(2)}`,
            `StdDev: ${stats.stdDev.toFixed(2)}`
          ],
          font: {
            size: 9
          },
          color: '#000000',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderColor: '#000000',
          borderWidth: 1,
          padding: 6,
          position: 'end'
        };
      }

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
              },
              color: '#000000'
            },
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: '#000000',
                font: {
                  size: 10
                },
                usePointStyle: false,
                boxWidth: 15,  // Reduced from 20 to save space
                padding: 8     // Reduced from 10 to save space
              },
              maxHeight: 100   // Increased from 60 to prevent legend cutoff
            },
            annotation: {
              annotations: annotations
            }
          },
          scales: {
            x: {
              type: 'linear',
              title: {
                display: true,
                text: 'Time',
                color: '#000000'
              },
              ticks: {
                color: '#000000',
                callback: function (value) {
                  const date = new Date(value);
                  return date.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: options.timezone || env.DEFAULT_TIMEZONE
                  });
                }
              },
              grid: {
                color: '#e5e7eb'
              }
            },
            y: {
              title: {
                display: true,
                text: 'Value',
                color: '#000000'
              },
              ticks: {
                color: '#000000'
              },
              grid: {
                color: '#e5e7eb'
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
      reportLogger.debug('Creating Chart.js instance');
      const chart = new Chart(ctx, config);
      reportLogger.debug('Chart.js instance created successfully');

      // Convert to buffer
      reportLogger.debug('Converting canvas to PNG buffer');
      const buffer = canvas.toBuffer('image/png');

      reportLogger.info('Canvas converted to buffer successfully', {
        bufferSize: buffer.length,
        bufferType: typeof buffer,
        isBuffer: Buffer.isBuffer(buffer)
      });

      // Validate buffer
      const validation = chartBufferValidator.validateBuffer(buffer, 'line_chart');

      if (!validation.valid) {
        const errorMsg = `Generated line chart buffer is invalid: ${validation.errors.join(', ')}`;
        reportLogger.error(errorMsg, {
          errors: validation.errors,
          bufferInfo: validation.bufferInfo
        });
        throw new Error(errorMsg);
      }

      if (validation.warnings.length > 0) {
        reportLogger.warn('Line chart buffer validation warnings', {
          warnings: validation.warnings,
          bufferInfo: validation.bufferInfo
        });
      }

      // Clean up
      chart.destroy();

      reportLogger.info('Line chart generated and validated successfully', {
        bufferSize: buffer.length,
        format: validation.bufferInfo.format,
        dimensions: validation.bufferInfo.dimensions || { width, height },
        dataPoints: datasets.reduce((sum, d) => sum + d.data.length, 0),
        trendLinesAdded: datasets.filter(d => d.trendLine).length,
        statisticsAdded: datasets.filter(d => d.statistics).length
      });

      return buffer;
    } catch (error) {
      reportLogger.error('Failed to generate line chart', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        datasets: datasets.length,
        totalDataPoints,
        dimensions: { width, height }
      });
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
              type: 'linear',
              title: {
                display: true,
                text: 'Time'
              },
              ticks: {
                callback: function (value) {
                  const date = new Date(value);
                  return date.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: options.timezone || env.DEFAULT_TIMEZONE
                  });
                }
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
   * Generate an SPC (Statistical Process Control) chart
   */
  async generateSPCChart(
    tagName: string,
    data: TimeSeriesData[],
    spcMetrics: {
      mean: number;
      stdDev: number;
      ucl: number;
      lcl: number;
      cp: number | null;
      cpk: number | null;
      outOfControlPoints: number[];
    },
    specLimits?: {
      lsl?: number;
      usl?: number;
    },
    options: ChartOptions = {}
  ): Promise<Buffer> {
    const width = options.width || this.defaultWidth;
    const height = options.height || this.defaultHeight;
    const grayscale = true; // Always use grayscale for printing

    try {
      reportLogger.info('Generating SPC chart', {
        tagName,
        dataPoints: data.length,
        width,
        height,
        hasSpecLimits: !!(specLimits?.lsl || specLimits?.usl),
        outOfControlCount: spcMetrics.outOfControlPoints.length
      });

      // Validate input data
      if (data.length === 0) {
        throw new Error('No data points provided for SPC chart generation');
      }

      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // Prepare data points with color coding for out-of-control points
      const chartData = data.map((point, index) => ({
        x: point.timestamp.getTime(),
        y: point.value
      }));

      // Determine point colors based on control status
      const pointColors = data.map((_, index) => {
        const isOutOfControl = spcMetrics.outOfControlPoints.includes(index);
        if (grayscale) {
          return isOutOfControl ? '#000000' : '#666666';
        }
        return isOutOfControl ? '#ef4444' : '#3b82f6';
      });

      // Prepare annotations for control limits and center line
      const annotations: any = {
        centerLine: {
          type: 'line',
          yMin: spcMetrics.mean,
          yMax: spcMetrics.mean,
          borderColor: grayscale ? '#000000' : '#10b981',
          borderWidth: 2,
          label: {
            display: true,
            content: `Mean = ${spcMetrics.mean.toFixed(2)}`,
            position: 'end',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            color: '#000000',
            font: {
              size: 9
            }
          }
        },
        ucl: {
          type: 'line',
          yMin: spcMetrics.ucl,
          yMax: spcMetrics.ucl,
          borderColor: grayscale ? '#666666' : '#ef4444',
          borderDash: [5, 5],
          borderWidth: 2,
          label: {
            display: true,
            content: `UCL = ${spcMetrics.ucl.toFixed(2)}`,
            position: 'end',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            color: '#000000',
            font: {
              size: 9
            }
          }
        },
        lcl: {
          type: 'line',
          yMin: spcMetrics.lcl,
          yMax: spcMetrics.lcl,
          borderColor: grayscale ? '#666666' : '#ef4444',
          borderDash: [5, 5],
          borderWidth: 2,
          label: {
            display: true,
            content: `LCL = ${spcMetrics.lcl.toFixed(2)}`,
            position: 'end',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            color: '#000000',
            font: {
              size: 9
            }
          }
        }
      };

      // Add specification limits if provided
      if (specLimits?.usl !== undefined) {
        annotations.usl = {
          type: 'line',
          yMin: specLimits.usl,
          yMax: specLimits.usl,
          borderColor: grayscale ? '#333333' : '#f59e0b',
          borderDash: [10, 5],
          borderWidth: 1,
          label: {
            display: true,
            content: `USL = ${specLimits.usl.toFixed(2)}`,
            position: 'start',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            color: '#000000',
            font: {
              size: 9
            }
          }
        };
      }

      if (specLimits?.lsl !== undefined) {
        annotations.lsl = {
          type: 'line',
          yMin: specLimits.lsl,
          yMax: specLimits.lsl,
          borderColor: grayscale ? '#333333' : '#f59e0b',
          borderDash: [10, 5],
          borderWidth: 1,
          label: {
            display: true,
            content: `LSL = ${specLimits.lsl.toFixed(2)}`,
            position: 'start',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            color: '#000000',
            font: {
              size: 9
            }
          }
        };
      }

      // Build capability info for subtitle
      let capabilityInfo = '';
      if (spcMetrics.cp !== null && spcMetrics.cpk !== null) {
        capabilityInfo = ` | Cp = ${spcMetrics.cp.toFixed(2)}, Cpk = ${spcMetrics.cpk.toFixed(2)}`;
      }

      const config: ChartConfiguration = {
        type: 'line',
        data: {
          datasets: [{
            label: 'Process Data',
            data: chartData,
            borderColor: grayscale ? '#000000' : '#3b82f6',
            backgroundColor: 'transparent',
            pointRadius: 4,
            pointBackgroundColor: pointColors,
            pointBorderColor: pointColors,
            pointBorderWidth: 2,
            borderWidth: 1,
            fill: false,
            tension: 0
          }]
        },
        options: {
          responsive: false,
          animation: false,
          plugins: {
            title: {
              display: true,
              text: [
                `${tagName} - Statistical Process Control Chart`,
                `σ = ${spcMetrics.stdDev.toFixed(2)}${capabilityInfo}`
              ],
              font: {
                size: 14,
                weight: 'bold'
              },
              color: '#000000',
              padding: {
                top: 10,
                bottom: 10
              }
            },
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: '#000000',
                font: {
                  size: 10
                },
                generateLabels: (chart) => {
                  const outOfControlCount = spcMetrics.outOfControlPoints.length;
                  const labels = [
                    {
                      text: `Process Data (${data.length} points)`,
                      fillStyle: grayscale ? '#666666' : '#3b82f6',
                      strokeStyle: grayscale ? '#666666' : '#3b82f6',
                      lineWidth: 2
                    }
                  ];

                  if (outOfControlCount > 0) {
                    labels.push({
                      text: `Out of Control (${outOfControlCount} points)`,
                      fillStyle: grayscale ? '#000000' : '#ef4444',
                      strokeStyle: grayscale ? '#000000' : '#ef4444',
                      lineWidth: 2
                    });
                  }

                  return labels;
                }
              }
            },
            annotation: {
              annotations: annotations
            }
          },
          scales: {
            x: {
              type: 'linear',
              title: {
                display: true,
                text: 'Time',
                color: '#000000',
                font: {
                  size: 12
                }
              },
              ticks: {
                color: '#000000',
                callback: function (value) {
                  const date = new Date(value);
                  return date.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: options.timezone || env.DEFAULT_TIMEZONE
                  });
                }
              },
              grid: {
                color: '#e5e7eb'
              }
            },
            y: {
              title: {
                display: true,
                text: 'Value',
                color: '#000000',
                font: {
                  size: 12
                }
              },
              ticks: {
                color: '#000000'
              },
              grid: {
                color: '#e5e7eb'
              },
              beginAtZero: false
            }
          },
          elements: {
            point: {
              radius: 4,
              hoverRadius: 6
            }
          }
        }
      };

      // Create chart
      reportLogger.debug('Creating SPC Chart.js instance');
      const chart = new Chart(ctx, config);
      reportLogger.debug('SPC Chart.js instance created successfully');

      // Convert to buffer
      reportLogger.debug('Converting SPC canvas to PNG buffer');
      const buffer = canvas.toBuffer('image/png');

      reportLogger.info('SPC canvas converted to buffer successfully', {
        bufferSize: buffer.length,
        bufferType: typeof buffer,
        isBuffer: Buffer.isBuffer(buffer)
      });

      // Validate buffer
      const validation = chartBufferValidator.validateBuffer(buffer, 'spc_chart');

      if (!validation.valid) {
        const errorMsg = `Generated SPC chart buffer is invalid: ${validation.errors.join(', ')}`;
        reportLogger.error(errorMsg, {
          errors: validation.errors,
          bufferInfo: validation.bufferInfo
        });
        throw new Error(errorMsg);
      }

      if (validation.warnings.length > 0) {
        reportLogger.warn('SPC chart buffer validation warnings', {
          warnings: validation.warnings,
          bufferInfo: validation.bufferInfo
        });
      }

      // Clean up
      chart.destroy();

      reportLogger.info('SPC chart generated and validated successfully', {
        tagName,
        bufferSize: buffer.length,
        format: validation.bufferInfo.format,
        dimensions: validation.bufferInfo.dimensions || { width, height },
        dataPoints: data.length,
        outOfControlPoints: spcMetrics.outOfControlPoints.length,
        hasSpecLimits: !!(specLimits?.lsl || specLimits?.usl)
      });

      return buffer;
    } catch (error) {
      reportLogger.error('Failed to generate SPC chart', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        tagName,
        dataPoints: data.length,
        dimensions: { width, height }
      });
      throw error;
    }
  }

  /**
   * Generate multiple charts for a report with trend lines and statistics
   */
  async generateReportCharts(
    data: Record<string, TimeSeriesData[]>,
    statistics?: Record<string, StatisticsResult>,
    trends?: Record<string, TrendResult>,
    chartTypes: ('line' | 'bar' | 'trend' | 'scatter')[] = ['line'],
    options: ChartOptions = {}
  ): Promise<Record<string, Buffer>> {
    const charts: Record<string, Buffer> = {};

    try {
      reportLogger.info('Generating report charts with trend lines', {
        tags: Object.keys(data).length,
        chartTypes,
        hasStatistics: !!statistics,
        hasTrends: !!trends
      });

      // Import statistical analysis service for trend line calculation
      const { statisticalAnalysisService } = await import('./statisticalAnalysis');
      const { classifyTag } = await import('./tagClassificationService');

      // Generate line charts
      if (chartTypes.includes('line')) {
        const analogDatasets: LineChartData[] = [];

        for (const [tagName, tagData] of Object.entries(data)) {
          if (tagData.length > 0) {
            const classification = classifyTag(tagData);
            const chartData: LineChartData = {
              tagName,
              data: tagData
            };

            // Calculate statistics and trends for analog tags
            if (classification.type === 'analog') {
              if (tagData.length >= 3) {
                try {
                  chartData.trendLine = statisticalAnalysisService.calculateAdvancedTrendLine(tagData);
                } catch (e) {
                  reportLogger.warn(`Trend calc failed for ${tagName}`, { error: e instanceof Error ? e.message : String(e) });
                }
              }

              if (statistics && statistics[tagName]) {
                chartData.statistics = {
                  min: statistics[tagName]!.min,
                  max: statistics[tagName]!.max,
                  mean: statistics[tagName]!.average,
                  stdDev: statistics[tagName]!.standardDeviation
                };
              } else {
                try {
                  const stats = statisticalAnalysisService.calculateStatisticsSync(tagData);
                  chartData.statistics = {
                    min: stats.min, max: stats.max, mean: stats.average, stdDev: stats.standardDeviation
                  };
                } catch (e) {
                  reportLogger.warn(`Stats calc failed for ${tagName}`, { error: e instanceof Error ? e.message : String(e) });
                }
              }
              analogDatasets.push(chartData);
            }

            // Generate individual chart for EACH tag (like frontend mini-charts)
            // Use standard key (tag name) to match frontend expectation
            const chartBuffer = await this.generateLineChart(
              [chartData],
              { title: `${tagName} - Time Series`, timezone: options.timezone }
            );
            charts[tagName] = chartBuffer;
          }
        }

        // Generate Multi-Trend Analysis chart if multiple analog tags exist
        if (analogDatasets.length > 1) {
          try {
            const multiTrendBuffer = await this.generateLineChart(
              analogDatasets,
              { title: 'Multi-Trend Analysis', timezone: options.timezone }
            );
            charts['Multi-Trend Analysis'] = multiTrendBuffer;
            reportLogger.info('Generated Multi-Trend Analysis chart for all analog tags');
          } catch (error) {
            reportLogger.error('Failed to generate Multi-Trend Analysis chart', { error });
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

      reportLogger.info('Report charts generated successfully with enhancements', {
        chartCount: Object.keys(charts).length,
        chartsWithTrendLines: Object.keys(charts).filter(k => k.includes('line')).length
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