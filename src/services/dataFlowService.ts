/**
 * Data Flow Service
 * Orchestrates end-to-end data flow from AVEVA Historian to report generation
 * Requirements: 2.1, 3.1, 4.1
 */

import { reportLogger } from '@/utils/logger';
import { dataRetrievalService } from './dataRetrieval';
import { statisticalAnalysisService } from './statisticalAnalysis';
import { reportGenerationService, ReportConfig, ReportData, ReportResult } from './reportGeneration';
import { chartGenerationService } from './chartGeneration';
import { TimeSeriesData, StatisticsResult, TrendResult, QualityCode } from '@/types/historian';
import { createError } from '@/middleware/errorHandler';

export interface DataFlowConfig {
  reportConfig: ReportConfig;
  includeStatistics?: boolean;
  includeTrends?: boolean;
  includeAnomalies?: boolean | undefined;
  includeDataTable?: boolean | undefined;
  preGeneratedCharts?: Record<string, Buffer> | undefined;
  realTimeData?: Record<string, TimeSeriesData[]> | undefined; // For real-time updates
}

export interface DataFlowResult {
  success: boolean;
  reportResult?: ReportResult;
  dataMetrics: {
    totalDataPoints: number;
    tagsProcessed: number;
    processingTime: number;
    dataQuality: number;
  };
  error?: string;
}

export class DataFlowService {
  /**
   * Execute complete end-to-end data flow
   */
  async executeDataFlow(config: DataFlowConfig): Promise<DataFlowResult> {
    const startTime = Date.now();
    let totalDataPoints = 0;
    let qualitySum = 0;
    let qualityCount = 0;

    try {
      reportLogger.info('Starting end-to-end data flow', {
        reportId: config.reportConfig.id,
        tags: config.reportConfig.tags,
        timeRange: config.reportConfig.timeRange
      });

      // Step 1: Retrieve data from AVEVA Historian
      const data = await this.retrieveHistorianData(config.reportConfig);

      // Count data points and calculate quality metrics
      for (const [tagName, tagData] of Object.entries(data)) {
        totalDataPoints += tagData.length;

        // Calculate data quality percentage
        const goodQualityCount = tagData.filter(point => point.quality === QualityCode.Good).length;
        if (tagData.length > 0) {
          qualitySum += (goodQualityCount / tagData.length) * 100;
          qualityCount++;
        }
      }

      // Step 2: Perform statistical analysis if requested
      let statistics: Record<string, StatisticsResult> | undefined;
      if (config.includeStatistics !== false) {
        statistics = await this.performStatisticalAnalysis(data);
      }

      // Step 3: Perform trend analysis if requested
      let trends: Record<string, TrendResult> | undefined;
      if (config.includeTrends !== false) {
        trends = await this.performTrendAnalysis(data);
      }

      // Step 4: Detect anomalies if requested
      let anomalies: Record<string, any[]> | undefined;
      if (config.includeAnomalies) {
        anomalies = await this.detectAnomalies(data);
      }

      // Step 5: Merge with real-time data if provided
      const finalData = this.mergeRealTimeData(data, config.realTimeData);

      // Step 6: Generate charts
      let charts = config.preGeneratedCharts;
      if (!charts || Object.keys(charts).length === 0) {
        charts = await this.generateCharts(finalData, statistics, trends, config.reportConfig.chartTypes, config.reportConfig.timeRange.timezone);
        reportLogger.debug('Generated charts on backend', { count: Object.keys(charts || {}).length });
      } else {
        reportLogger.debug('Using pre-generated frontend charts', { count: Object.keys(charts).length });
      }

      // Step 7: Prepare report data
      const reportData: ReportData = {
        config: config.reportConfig,
        data: finalData,
        statistics: statistics || {},
        trends: trends || {},
        charts,
        generatedAt: new Date(),
        ...(anomalies && { anomalies })
      };

      // Step 8: Generate the report
      const reportResult = await reportGenerationService.generateReport(reportData);

      const processingTime = Date.now() - startTime;
      const averageQuality = qualityCount > 0 ? qualitySum / qualityCount : 0;

      reportLogger.info('End-to-end data flow completed', {
        reportId: config.reportConfig.id,
        success: reportResult.success,
        totalDataPoints,
        tagsProcessed: Object.keys(data).length,
        processingTime,
        dataQuality: averageQuality
      });

      return {
        success: reportResult.success,
        reportResult,
        dataMetrics: {
          totalDataPoints,
          tagsProcessed: Object.keys(data).length,
          processingTime,
          dataQuality: averageQuality
        },
        ...(reportResult.error && { error: reportResult.error })
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      reportLogger.error('End-to-end data flow failed', {
        reportId: config.reportConfig.id,
        error: errorMessage,
        processingTime
      });

      return {
        success: false,
        dataMetrics: {
          totalDataPoints,
          tagsProcessed: 0,
          processingTime,
          dataQuality: 0
        },
        error: errorMessage
      };
    }
  }

  /**
   * Retrieve data from AVEVA Historian for all tags
   */
  private async retrieveHistorianData(reportConfig: ReportConfig): Promise<Record<string, TimeSeriesData[]>> {
    const data: Record<string, TimeSeriesData[]> = {};

    reportLogger.info('Retrieving data from AVEVA Historian', {
      tags: reportConfig.tags,
      timeRange: reportConfig.timeRange
    });

    // Retrieve data for each tag in parallel
    const dataPromises = reportConfig.tags.map(async (tagName) => {
      try {
        const tagData = await dataRetrievalService.getTimeSeriesData(
          tagName,
          reportConfig.timeRange,
          {
            mode: (reportConfig.retrievalMode as any) || undefined
          }
        );

        reportLogger.debug('Retrieved data for tag', {
          tagName,
          dataPoints: tagData.length,
          timeRange: reportConfig.timeRange
        });

        return { tagName, data: tagData };
      } catch (error) {
        reportLogger.warn('Failed to retrieve data for tag', {
          tagName,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return { tagName, data: [] };
      }
    });

    const results = await Promise.all(dataPromises);

    // Organize results by tag name
    results.forEach(({ tagName, data: tagData }) => {
      data[tagName] = tagData;
    });

    return data;
  }

  /**
   * Perform statistical analysis on retrieved data
   */
  private async performStatisticalAnalysis(data: Record<string, TimeSeriesData[]>): Promise<Record<string, StatisticsResult>> {
    const statistics: Record<string, StatisticsResult> = {};

    reportLogger.info('Performing statistical analysis', {
      tags: Object.keys(data)
    });

    for (const [tagName, tagData] of Object.entries(data)) {
      if (tagData.length > 0) {
        try {
          statistics[tagName] = statisticalAnalysisService.calculateStatisticsSync(tagData);

          reportLogger.debug('Calculated statistics for tag', {
            tagName,
            statistics: statistics[tagName]
          });
        } catch (error) {
          reportLogger.warn('Failed to calculate statistics for tag', {
            tagName,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    return statistics;
  }

  /**
   * Perform trend analysis on retrieved data
   */
  private async performTrendAnalysis(data: Record<string, TimeSeriesData[]>): Promise<Record<string, TrendResult>> {
    const trends: Record<string, TrendResult> = {};

    reportLogger.info('Performing trend analysis', {
      tags: Object.keys(data)
    });

    for (const [tagName, tagData] of Object.entries(data)) {
      if (tagData.length >= 3) { // Need at least 3 points for trend analysis
        try {
          trends[tagName] = statisticalAnalysisService.calculateTrendLine(tagData);

          reportLogger.debug('Calculated trends for tag', {
            tagName,
            trend: trends[tagName]
          });
        } catch (error) {
          reportLogger.warn('Failed to calculate trends for tag', {
            tagName,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    return trends;
  }

  /**
   * Detect anomalies in the data
   */
  private async detectAnomalies(data: Record<string, TimeSeriesData[]>): Promise<Record<string, any[]>> {
    const anomalies: Record<string, any[]> = {};

    reportLogger.info('Detecting anomalies', {
      tags: Object.keys(data)
    });

    for (const [tagName, tagData] of Object.entries(data)) {
      if (tagData.length > 10) { // Need sufficient data for anomaly detection
        try {
          anomalies[tagName] = statisticalAnalysisService.detectAnomalies(tagData, 2.0);

          reportLogger.debug('Detected anomalies for tag', {
            tagName,
            anomalyCount: anomalies[tagName].length
          });
        } catch (error) {
          reportLogger.warn('Failed to detect anomalies for tag', {
            tagName,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          anomalies[tagName] = [];
        }
      } else {
        anomalies[tagName] = [];
      }
    }

    return anomalies;
  }

  /**
   * Merge real-time data with historical data
   */
  private mergeRealTimeData(
    historicalData: Record<string, TimeSeriesData[]>,
    realTimeData?: Record<string, TimeSeriesData[]>
  ): Record<string, TimeSeriesData[]> {
    if (!realTimeData) {
      return historicalData;
    }

    const mergedData: Record<string, TimeSeriesData[]> = { ...historicalData };

    reportLogger.info('Merging real-time data', {
      historicalTags: Object.keys(historicalData),
      realTimeTags: Object.keys(realTimeData)
    });

    for (const [tagName, realTimePoints] of Object.entries(realTimeData)) {
      if (mergedData[tagName]) {
        // Merge and sort by timestamp
        const combined = [...mergedData[tagName], ...realTimePoints];
        combined.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        // Remove duplicates based on timestamp
        const unique = combined.filter((point, index, array) => {
          return index === 0 || point.timestamp.getTime() !== array[index - 1]?.timestamp.getTime();
        });

        mergedData[tagName] = unique;

        reportLogger.debug('Merged real-time data for tag', {
          tagName,
          historicalPoints: historicalData[tagName]?.length || 0,
          realTimePoints: realTimePoints.length,
          totalPoints: unique.length
        });
      } else {
        // New tag from real-time data
        mergedData[tagName] = realTimePoints;

        reportLogger.debug('Added new real-time tag', {
          tagName,
          points: realTimePoints.length
        });
      }
    }

    return mergedData;
  }

  /**
   * Generate charts for the report
   */
  private async generateCharts(
    data: Record<string, TimeSeriesData[]>,
    statistics?: Record<string, StatisticsResult>,
    trends?: Record<string, TrendResult>,
    chartTypes: string[] = ['line'],
    timezone?: string
  ): Promise<Record<string, Buffer>> {
    reportLogger.info('Generating charts', {
      chartTypes,
      tags: Object.keys(data)
    });

    try {
      return await chartGenerationService.generateReportCharts(
        data,
        statistics,
        trends,
        chartTypes as any[],
        { timezone }
      );
    } catch (error) {
      reportLogger.error('Failed to generate charts', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {};
    }
  }

  /**
   * Get data flow metrics for monitoring
   */
  async getDataFlowMetrics(timeRange?: { startTime: Date; endTime: Date }): Promise<{
    totalReports: number;
    successRate: number;
    averageProcessingTime: number;
    averageDataQuality: number;
    tagUsageStats: Record<string, number>;
  }> {
    // This would typically query a metrics database
    // For now, return mock data
    return {
      totalReports: 0,
      successRate: 0,
      averageProcessingTime: 0,
      averageDataQuality: 0,
      tagUsageStats: {}
    };
  }

  /**
   * Validate data flow configuration
   */
  validateDataFlowConfig(config: DataFlowConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.reportConfig) {
      errors.push('Report configuration is required');
    } else {
      if (!config.reportConfig.name || config.reportConfig.name.trim().length === 0) {
        errors.push('Report name is required');
      }

      if (!config.reportConfig.tags || config.reportConfig.tags.length === 0) {
        errors.push('At least one tag is required');
      }

      if (!config.reportConfig.timeRange) {
        errors.push('Time range is required');
      } else {
        if (!config.reportConfig.timeRange.startTime || !config.reportConfig.timeRange.endTime) {
          errors.push('Start time and end time are required');
        } else if (config.reportConfig.timeRange.startTime >= config.reportConfig.timeRange.endTime) {
          errors.push('Start time must be before end time');
        }
      }

      if (!config.reportConfig.chartTypes || config.reportConfig.chartTypes.length === 0) {
        errors.push('At least one chart type is required');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const dataFlowService = new DataFlowService();