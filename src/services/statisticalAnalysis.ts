/**
 * Statistical Analysis Service for Time-Series Data
 * Provides mathematical functions for trend analysis, statistics, and anomaly detection
 */

import { TimeSeriesData, StatisticsResult, TrendResult, AnomalyResult } from '@/types/historian';
import { dbLogger } from '@/utils/logger';
import { createError } from '@/middleware/errorHandler';
import { CacheService } from './cacheService';
import { createHash } from 'crypto';

export class StatisticalAnalysisService {
  private cacheService: CacheService | undefined;

  constructor(cacheService?: CacheService) {
    this.cacheService = cacheService;
  }

  private generateDataHash(data: TimeSeriesData[]): string {
    const dataString = JSON.stringify(data.map(d => ({ timestamp: d.timestamp, value: d.value })));
    return createHash('md5').update(dataString).digest('hex');
  }
  
  /**
   * Calculate basic statistics for time-series data with caching
   */
  async calculateStatistics(
    tagName: string,
    startTime: Date,
    endTime: Date,
    data: TimeSeriesData[]
  ): Promise<StatisticsResult> {
    try {
      // Check cache first if caching is enabled
      if (this.cacheService) {
        const cachedStats = await this.cacheService.getCachedStatistics(tagName, startTime, endTime);
        if (cachedStats) {
          dbLogger.debug(`Cache hit for statistics: ${tagName}`);
          return cachedStats;
        }
      }

      const stats = this.calculateStatisticsSync(data);

      // Cache the result if caching is enabled
      if (this.cacheService) {
        await this.cacheService.cacheStatistics(tagName, startTime, endTime, stats);
      }

      return stats;
    } catch (error) {
      dbLogger.error('Failed to calculate statistics:', error);
      throw error;
    }
  }

  /**
   * Calculate basic statistics for time-series data (synchronous version)
   */
  calculateStatisticsSync(data: TimeSeriesData[]): StatisticsResult {
    if (data.length === 0) {
      throw createError('Cannot calculate statistics for empty dataset', 400);
    }

    const values = data.map(point => point.value);
    const validValues = values.filter(v => !isNaN(v) && isFinite(v));
    
    if (validValues.length === 0) {
      throw createError('No valid numeric values found in dataset', 400);
    }

    const min = Math.min(...validValues);
    const max = Math.max(...validValues);
    const sum = validValues.reduce((acc, val) => acc + val, 0);
    const average = sum / validValues.length;
    
    // Calculate standard deviation
    const variance = validValues.reduce((acc, val) => acc + Math.pow(val - average, 2), 0) / validValues.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Calculate data quality percentage
    const goodQualityCount = data.filter(point => point.quality === 192).length; // Good quality = 192
    const dataQuality = (goodQualityCount / data.length) * 100;

    dbLogger.debug('Statistics calculated', {
      count: validValues.length,
      min,
      max,
      average,
      standardDeviation,
      dataQuality
    });

    return {
      min,
      max,
      average,
      standardDeviation,
      count: validValues.length,
      dataQuality
    };
  }

  /**
   * Calculate linear regression trend line
   */
  calculateTrendLine(data: TimeSeriesData[]): TrendResult {
    if (data.length < 2) {
      throw createError('At least 2 data points required for trend analysis', 400);
    }

    // Filter out invalid values and convert timestamps to numeric values
    const validData = data
      .filter(point => !isNaN(point.value) && isFinite(point.value))
      .map((point, index) => ({
        x: index, // Use index as x-value for simplicity
        y: point.value,
        timestamp: point.timestamp
      }));

    if (validData.length < 2) {
      throw createError('At least 2 valid data points required for trend analysis', 400);
    }

    const n = validData.length;
    const sumX = validData.reduce((sum, point) => sum + point.x, 0);
    const sumY = validData.reduce((sum, point) => sum + point.y, 0);
    const sumXY = validData.reduce((sum, point) => sum + (point.x * point.y), 0);
    const sumXX = validData.reduce((sum, point) => sum + (point.x * point.x), 0);
    const sumYY = validData.reduce((sum, point) => sum + (point.y * point.y), 0);

    // Calculate slope and intercept using least squares method
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate correlation coefficient
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    const correlation = denominator === 0 ? 0 : numerator / denominator;

    // Calculate confidence (R-squared)
    const confidence = Math.pow(correlation, 2);

    // Generate equation string
    const slopeStr = slope.toFixed(4);
    const interceptStr = Math.abs(intercept).toFixed(4);
    const sign = intercept >= 0 ? '+' : '-';
    const equation = `y = ${slopeStr}x ${sign} ${interceptStr}`;

    dbLogger.debug('Trend line calculated', {
      slope,
      intercept,
      correlation,
      confidence,
      dataPoints: n
    });

    return {
      slope,
      intercept,
      correlation,
      equation,
      confidence
    };
  }

  /**
   * Calculate moving average with configurable window size
   */
  calculateMovingAverage(data: TimeSeriesData[], windowSize: number): TimeSeriesData[] {
    if (windowSize <= 0) {
      throw createError('Window size must be positive', 400);
    }

    if (windowSize > data.length) {
      throw createError('Window size cannot be larger than dataset', 400);
    }

    const result: TimeSeriesData[] = [];

    for (let i = windowSize - 1; i < data.length; i++) {
      const window = data.slice(i - windowSize + 1, i + 1);
      const validValues = window
        .map(point => point.value)
        .filter(v => !isNaN(v) && isFinite(v));

      if (validValues.length > 0) {
        const average = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
        
        result.push({
          timestamp: data[i]!.timestamp,
          value: average,
          quality: data[i]!.quality,
          tagName: data[i]!.tagName
        });
      }
    }

    dbLogger.debug('Moving average calculated', {
      originalPoints: data.length,
      resultPoints: result.length,
      windowSize
    });

    return result;
  }

  /**
   * Calculate percentage change between time periods
   */
  calculatePercentageChange(
    startData: TimeSeriesData[], 
    endData: TimeSeriesData[]
  ): number {
    if (startData.length === 0 || endData.length === 0) {
      throw createError('Both datasets must contain data points', 400);
    }

    const startStats = this.calculateStatisticsSync(startData);
    const endStats = this.calculateStatisticsSync(endData);

    if (startStats.average === 0) {
      throw createError('Cannot calculate percentage change with zero starting value', 400);
    }

    const percentageChange = ((endStats.average - startStats.average) / startStats.average) * 100;

    dbLogger.debug('Percentage change calculated', {
      startAverage: startStats.average,
      endAverage: endStats.average,
      percentageChange
    });

    return percentageChange;
  }

  /**
   * Detect anomalies using statistical deviation
   */
  detectAnomalies(data: TimeSeriesData[], threshold: number = 2): AnomalyResult[] {
    if (data.length < 3) {
      throw createError('At least 3 data points required for anomaly detection', 400);
    }

    if (threshold <= 0) {
      throw createError('Threshold must be positive', 400);
    }

    const stats = this.calculateStatisticsSync(data);
    const anomalies: AnomalyResult[] = [];

    for (const point of data) {
      if (!isNaN(point.value) && isFinite(point.value)) {
        const deviation = Math.abs(point.value - stats.average) / stats.standardDeviation;
        
        if (deviation > threshold) {
          let severity: 'low' | 'medium' | 'high';
          if (deviation > threshold * 2) {
            severity = 'high';
          } else if (deviation > threshold * 1.5) {
            severity = 'medium';
          } else {
            severity = 'low';
          }

          anomalies.push({
            timestamp: point.timestamp,
            value: point.value,
            expectedValue: stats.average,
            deviation,
            severity,
            description: `Value deviates ${deviation.toFixed(2)} standard deviations from mean`
          });
        }
      }
    }

    dbLogger.debug('Anomaly detection completed', {
      totalPoints: data.length,
      anomaliesFound: anomalies.length,
      threshold
    });

    return anomalies;
  }

  /**
   * Detect pattern changes in time-series data
   */
  detectPatternChanges(data: TimeSeriesData[], windowSize: number = 10): AnomalyResult[] {
    if (data.length < windowSize * 2) {
      throw createError(`At least ${windowSize * 2} data points required for pattern change detection`, 400);
    }

    const anomalies: AnomalyResult[] = [];
    const movingAverages = this.calculateMovingAverage(data, windowSize);

    for (let i = windowSize; i < movingAverages.length; i++) {
      const currentWindow = movingAverages.slice(i - windowSize, i);
      const previousWindow = movingAverages.slice(i - windowSize * 2, i - windowSize);

      if (currentWindow.length === windowSize && previousWindow.length === windowSize) {
        const currentStats = this.calculateStatisticsSync(currentWindow);
        const previousStats = this.calculateStatisticsSync(previousWindow);

        // Detect significant changes in mean or variance
        const meanChange = Math.abs(currentStats.average - previousStats.average);
        const varianceChange = Math.abs(currentStats.standardDeviation - previousStats.standardDeviation);

        const meanThreshold = previousStats.standardDeviation * 1.5;
        const varianceThreshold = previousStats.standardDeviation * 0.5;

        if (meanChange > meanThreshold || varianceChange > varianceThreshold) {
          const severity: 'low' | 'medium' | 'high' = 
            (meanChange > meanThreshold * 2 || varianceChange > varianceThreshold * 2) ? 'high' :
            (meanChange > meanThreshold * 1.5 || varianceChange > varianceThreshold * 1.5) ? 'medium' : 'low';

          anomalies.push({
            timestamp: movingAverages[i]!.timestamp,
            value: currentStats.average,
            expectedValue: previousStats.average,
            deviation: meanChange / previousStats.standardDeviation,
            severity,
            description: `Pattern change detected: mean shifted by ${meanChange.toFixed(2)}, variance changed by ${varianceChange.toFixed(2)}`
          });
        }
      }
    }

    dbLogger.debug('Pattern change detection completed', {
      totalPoints: data.length,
      patternChanges: anomalies.length,
      windowSize
    });

    return anomalies;
  }

  /**
   * Calculate data quality metrics
   */
  calculateDataQuality(data: TimeSeriesData[]): {
    totalPoints: number;
    goodQuality: number;
    badQuality: number;
    uncertainQuality: number;
    qualityPercentage: number;
    missingDataGaps: number;
  } {
    if (data.length === 0) {
      return {
        totalPoints: 0,
        goodQuality: 0,
        badQuality: 0,
        uncertainQuality: 0,
        qualityPercentage: 0,
        missingDataGaps: 0
      };
    }

    let goodQuality = 0;
    let badQuality = 0;
    let uncertainQuality = 0;
    let missingDataGaps = 0;

    // Count quality types
    for (const point of data) {
      switch (point.quality) {
        case 192: // Good
          goodQuality++;
          break;
        case 0: // Bad
          badQuality++;
          break;
        case 64: // Uncertain
          uncertainQuality++;
          break;
        default:
          badQuality++; // Treat unknown quality as bad
      }
    }

    // Detect missing data gaps (assuming regular intervals)
    if (data.length > 1) {
      const sortedData = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const intervals: number[] = [];
      
      for (let i = 1; i < sortedData.length; i++) {
        const interval = sortedData[i]!.timestamp.getTime() - sortedData[i - 1]!.timestamp.getTime();
        intervals.push(interval);
      }

      // Calculate median interval
      intervals.sort((a, b) => a - b);
      const medianInterval = intervals[Math.floor(intervals.length / 2)]!;
      
      // Count gaps larger than 2x median interval
      missingDataGaps = intervals.filter(interval => interval > medianInterval * 2).length;
    }

    const qualityPercentage = (goodQuality / data.length) * 100;

    return {
      totalPoints: data.length,
      goodQuality,
      badQuality,
      uncertainQuality,
      qualityPercentage,
      missingDataGaps
    };
  }
}

// Export singleton instance
export const statisticalAnalysisService = new StatisticalAnalysisService();