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
   * Detect anomalies using statistical deviation with configurable thresholds
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
   * Advanced anomaly detection using multiple algorithms
   */
  detectAdvancedAnomalies(
    data: TimeSeriesData[], 
    options: {
      statisticalThreshold?: number;
      iqrMultiplier?: number;
      enableTrendAnalysis?: boolean;
      enableSeasonalAnalysis?: boolean;
      windowSize?: number;
    } = {}
  ): AnomalyResult[] {
    const {
      statisticalThreshold = 2,
      iqrMultiplier = 1.5,
      enableTrendAnalysis = true,
      enableSeasonalAnalysis = false,
      windowSize = 10
    } = options;

    if (data.length < Math.max(3, windowSize)) {
      throw createError(`At least ${Math.max(3, windowSize)} data points required for advanced anomaly detection`, 400);
    }

    const anomalies: AnomalyResult[] = [];

    // 1. Statistical deviation anomalies
    const statisticalAnomalies = this.detectAnomalies(data, statisticalThreshold);
    anomalies.push(...statisticalAnomalies);

    // 2. IQR-based anomaly detection
    const iqrAnomalies = this.detectIQRAnomalies(data, iqrMultiplier);
    anomalies.push(...iqrAnomalies);

    // 3. Trend-based anomaly detection
    if (enableTrendAnalysis) {
      const trendAnomalies = this.detectTrendAnomalies(data, windowSize);
      anomalies.push(...trendAnomalies);
    }

    // 4. Seasonal anomaly detection (if enabled)
    if (enableSeasonalAnalysis && data.length >= 24) {
      const seasonalAnomalies = this.detectSeasonalAnomalies(data);
      anomalies.push(...seasonalAnomalies);
    }

    // Remove duplicates and sort by timestamp
    const uniqueAnomalies = this.deduplicateAnomalies(anomalies);

    dbLogger.debug('Advanced anomaly detection completed', {
      totalPoints: data.length,
      statisticalAnomalies: statisticalAnomalies.length,
      iqrAnomalies: iqrAnomalies.length,
      trendAnomalies: enableTrendAnalysis ? anomalies.filter(a => a.description.includes('trend')).length : 0,
      totalUniqueAnomalies: uniqueAnomalies.length
    });

    return uniqueAnomalies;
  }

  /**
   * Detect anomalies using Interquartile Range (IQR) method
   */
  private detectIQRAnomalies(data: TimeSeriesData[], multiplier: number = 1.5): AnomalyResult[] {
    const values = data
      .map(point => point.value)
      .filter(v => !isNaN(v) && isFinite(v))
      .sort((a, b) => a - b);

    if (values.length < 4) {
      return [];
    }

    const q1Index = Math.floor(values.length * 0.25);
    const q3Index = Math.floor(values.length * 0.75);
    const q1 = values[q1Index]!;
    const q3 = values[q3Index]!;
    const iqr = q3 - q1;

    const lowerBound = q1 - (multiplier * iqr);
    const upperBound = q3 + (multiplier * iqr);

    const anomalies: AnomalyResult[] = [];

    for (const point of data) {
      if (!isNaN(point.value) && isFinite(point.value)) {
        if (point.value < lowerBound || point.value > upperBound) {
          const expectedValue = point.value < lowerBound ? lowerBound : upperBound;
          const deviation = Math.abs(point.value - expectedValue) / iqr;

          let severity: 'low' | 'medium' | 'high';
          if (deviation > multiplier * 2) {
            severity = 'high';
          } else if (deviation > multiplier * 1.5) {
            severity = 'medium';
          } else {
            severity = 'low';
          }

          anomalies.push({
            timestamp: point.timestamp,
            value: point.value,
            expectedValue,
            deviation,
            severity,
            description: `IQR outlier: value ${point.value < lowerBound ? 'below' : 'above'} expected range [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}]`
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Detect trend-based anomalies using sliding window analysis
   */
  private detectTrendAnomalies(data: TimeSeriesData[], windowSize: number): AnomalyResult[] {
    if (data.length < windowSize * 2) {
      return [];
    }

    const anomalies: AnomalyResult[] = [];

    for (let i = windowSize; i < data.length - windowSize; i++) {
      const beforeWindow = data.slice(i - windowSize, i);
      const afterWindow = data.slice(i, i + windowSize);
      const currentPoint = data[i]!;

      // Calculate trends for before and after windows
      const beforeTrend = this.calculateTrendLine(beforeWindow);
      const afterTrend = this.calculateTrendLine(afterWindow);

      // Detect significant trend changes
      const slopeChange = Math.abs(afterTrend.slope - beforeTrend.slope);
      const correlationDrop = beforeTrend.correlation - afterTrend.correlation;

      // Predict expected value based on before trend
      const expectedValue = beforeTrend.slope * (windowSize - 1) + beforeTrend.intercept;
      const actualValue = currentPoint.value;
      const predictionError = Math.abs(actualValue - expectedValue);

      // Flag as anomaly if trend change is significant
      if (slopeChange > 0.1 || correlationDrop > 0.3 || predictionError > beforeWindow.map(p => p.value).reduce((sum, v) => sum + Math.abs(v - beforeTrend.intercept), 0) / beforeWindow.length) {
        let severity: 'low' | 'medium' | 'high';
        if (slopeChange > 0.3 || correlationDrop > 0.6) {
          severity = 'high';
        } else if (slopeChange > 0.2 || correlationDrop > 0.4) {
          severity = 'medium';
        } else {
          severity = 'low';
        }

        anomalies.push({
          timestamp: currentPoint.timestamp,
          value: actualValue,
          expectedValue,
          deviation: predictionError,
          severity,
          description: `Trend anomaly: slope change ${slopeChange.toFixed(3)}, correlation drop ${correlationDrop.toFixed(3)}`
        });
      }
    }

    return anomalies;
  }

  /**
   * Detect seasonal anomalies (basic implementation)
   */
  private detectSeasonalAnomalies(data: TimeSeriesData[]): AnomalyResult[] {
    // Simple seasonal detection based on hourly patterns
    const hourlyAverages = new Map<number, number[]>();
    
    // Group data by hour of day
    for (const point of data) {
      const hour = point.timestamp.getHours();
      if (!hourlyAverages.has(hour)) {
        hourlyAverages.set(hour, []);
      }
      hourlyAverages.get(hour)!.push(point.value);
    }

    // Calculate average and standard deviation for each hour
    const hourlyStats = new Map<number, { average: number; stdDev: number }>();
    for (const [hour, values] of hourlyAverages) {
      if (values.length > 1) {
        const average = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - average, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        hourlyStats.set(hour, { average, stdDev });
      }
    }

    const anomalies: AnomalyResult[] = [];

    // Check each point against its hourly pattern
    for (const point of data) {
      const hour = point.timestamp.getHours();
      const stats = hourlyStats.get(hour);
      
      if (stats && stats.stdDev > 0) {
        const deviation = Math.abs(point.value - stats.average) / stats.stdDev;
        
        if (deviation > 2) {
          let severity: 'low' | 'medium' | 'high';
          if (deviation > 4) {
            severity = 'high';
          } else if (deviation > 3) {
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
            description: `Seasonal anomaly: value deviates ${deviation.toFixed(2)} standard deviations from hour ${hour} pattern`
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Remove duplicate anomalies and merge similar ones
   */
  private deduplicateAnomalies(anomalies: AnomalyResult[]): AnomalyResult[] {
    const uniqueAnomalies = new Map<string, AnomalyResult>();

    for (const anomaly of anomalies) {
      const key = `${anomaly.timestamp.getTime()}_${anomaly.value}`;
      const existing = uniqueAnomalies.get(key);

      if (!existing || anomaly.severity === 'high' || 
          (anomaly.severity === 'medium' && existing.severity === 'low')) {
        uniqueAnomalies.set(key, anomaly);
      }
    }

    return Array.from(uniqueAnomalies.values())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Detect significant pattern changes in time-series data with configurable thresholds
   */
  detectPatternChanges(
    data: TimeSeriesData[], 
    options: {
      windowSize?: number;
      sensitivityThreshold?: number;
      minChangePercent?: number;
    } = {}
  ): AnomalyResult[] {
    const { windowSize = 10, sensitivityThreshold = 1.5, minChangePercent = 10 } = options;

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

        // Detect significant changes in mean, variance, and trend
        const meanChange = Math.abs(currentStats.average - previousStats.average);
        const varianceChange = Math.abs(currentStats.standardDeviation - previousStats.standardDeviation);
        const meanChangePercent = previousStats.average !== 0 ? (meanChange / Math.abs(previousStats.average)) * 100 : 0;

        // Calculate trend changes
        const currentTrend = this.calculateTrendLine(currentWindow);
        const previousTrend = this.calculateTrendLine(previousWindow);
        const slopeChange = Math.abs(currentTrend.slope - previousTrend.slope);
        const correlationChange = Math.abs(currentTrend.correlation - previousTrend.correlation);

        // Thresholds for pattern change detection
        const meanThreshold = previousStats.standardDeviation * sensitivityThreshold;
        const varianceThreshold = previousStats.standardDeviation * 0.5;
        const slopeThreshold = 0.1;
        const correlationThreshold = 0.3;

        // Check if any significant changes occurred
        const significantMeanChange = meanChange > meanThreshold && meanChangePercent > minChangePercent;
        const significantVarianceChange = varianceChange > varianceThreshold;
        const significantSlopeChange = slopeChange > slopeThreshold;
        const significantCorrelationChange = correlationChange > correlationThreshold;

        if (significantMeanChange || significantVarianceChange || significantSlopeChange || significantCorrelationChange) {
          // Determine severity based on multiple factors
          let severity: 'low' | 'medium' | 'high';
          const severityScore = 
            (significantMeanChange ? 1 : 0) +
            (significantVarianceChange ? 1 : 0) +
            (significantSlopeChange ? 1 : 0) +
            (significantCorrelationChange ? 1 : 0);

          if (severityScore >= 3 || meanChangePercent > 50) {
            severity = 'high';
          } else if (severityScore >= 2 || meanChangePercent > 25) {
            severity = 'medium';
          } else {
            severity = 'low';
          }

          // Create detailed description
          const changes: string[] = [];
          if (significantMeanChange) changes.push(`mean shifted by ${meanChangePercent.toFixed(1)}%`);
          if (significantVarianceChange) changes.push(`variance changed by ${varianceChange.toFixed(2)}`);
          if (significantSlopeChange) changes.push(`trend slope changed by ${slopeChange.toFixed(3)}`);
          if (significantCorrelationChange) changes.push(`correlation changed by ${correlationChange.toFixed(3)}`);

          anomalies.push({
            timestamp: movingAverages[i]!.timestamp,
            value: currentStats.average,
            expectedValue: previousStats.average,
            deviation: meanChange / (previousStats.standardDeviation || 1),
            severity,
            description: `Pattern change detected: ${changes.join(', ')}`
          });
        }
      }
    }

    dbLogger.debug('Pattern change detection completed', {
      totalPoints: data.length,
      patternChanges: anomalies.length,
      windowSize,
      sensitivityThreshold
    });

    return anomalies;
  }

  /**
   * Detect significant trend changes using multiple algorithms
   */
  detectSignificantTrendChanges(
    data: TimeSeriesData[],
    options: {
      windowSize?: number;
      trendThreshold?: number;
      volatilityThreshold?: number;
    } = {}
  ): AnomalyResult[] {
    const { windowSize = 20, trendThreshold = 0.05, volatilityThreshold = 2.0 } = options;

    if (data.length < windowSize * 3) {
      throw createError(`At least ${windowSize * 3} data points required for trend change detection`, 400);
    }

    const anomalies: AnomalyResult[] = [];

    // Sliding window analysis for trend changes
    for (let i = windowSize; i < data.length - windowSize; i += Math.floor(windowSize / 2)) {
      const beforeWindow = data.slice(i - windowSize, i);
      const afterWindow = data.slice(i, i + windowSize);

      if (beforeWindow.length === windowSize && afterWindow.length === windowSize) {
        const beforeTrend = this.calculateTrendLine(beforeWindow);
        const afterTrend = this.calculateTrendLine(afterWindow);
        const beforeStats = this.calculateStatisticsSync(beforeWindow);
        const afterStats = this.calculateStatisticsSync(afterWindow);

        // Detect trend direction changes
        const slopeChange = Math.abs(afterTrend.slope - beforeTrend.slope);
        const directionChange = (beforeTrend.slope > 0) !== (afterTrend.slope > 0);
        
        // Detect volatility changes
        const volatilityChange = Math.abs(afterStats.standardDeviation - beforeStats.standardDeviation);
        const volatilityRatio = beforeStats.standardDeviation > 0 ? 
          afterStats.standardDeviation / beforeStats.standardDeviation : 1;

        // Detect level shifts
        const levelShift = Math.abs(afterStats.average - beforeStats.average);
        const levelShiftPercent = beforeStats.average !== 0 ? 
          (levelShift / Math.abs(beforeStats.average)) * 100 : 0;

        // Check for significant changes
        const significantSlopeChange = slopeChange > trendThreshold;
        const significantDirectionChange = directionChange && Math.abs(beforeTrend.slope) > trendThreshold;
        const significantVolatilityChange = volatilityRatio > volatilityThreshold || volatilityRatio < (1 / volatilityThreshold);
        const significantLevelShift = levelShiftPercent > 15;

        if (significantSlopeChange || significantDirectionChange || significantVolatilityChange || significantLevelShift) {
          let severity: 'low' | 'medium' | 'high';
          
          if ((significantDirectionChange && Math.abs(beforeTrend.slope) > trendThreshold * 2) ||
              levelShiftPercent > 50 || volatilityRatio > volatilityThreshold * 2) {
            severity = 'high';
          } else if (significantDirectionChange || levelShiftPercent > 25 || volatilityRatio > volatilityThreshold * 1.5) {
            severity = 'medium';
          } else {
            severity = 'low';
          }

          const changePoint = data[i]!;
          const changes: string[] = [];
          
          if (significantSlopeChange) changes.push(`slope change: ${slopeChange.toFixed(4)}`);
          if (significantDirectionChange) changes.push('trend direction reversal');
          if (significantVolatilityChange) changes.push(`volatility change: ${volatilityRatio.toFixed(2)}x`);
          if (significantLevelShift) changes.push(`level shift: ${levelShiftPercent.toFixed(1)}%`);

          anomalies.push({
            timestamp: changePoint.timestamp,
            value: changePoint.value,
            expectedValue: beforeStats.average,
            deviation: levelShift / (beforeStats.standardDeviation || 1),
            severity,
            description: `Significant trend change: ${changes.join(', ')}`
          });
        }
      }
    }

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

  /**
   * Comprehensive anomaly flagging system with configurable thresholds
   */
  flagAnomalies(
    data: TimeSeriesData[],
    thresholds: {
      statisticalDeviation?: number;
      iqrMultiplier?: number;
      trendSensitivity?: number;
      patternSensitivity?: number;
      enableAdvanced?: boolean;
      enableSeasonal?: boolean;
      windowSize?: number;
    } = {}
  ): {
    anomalies: AnomalyResult[];
    summary: {
      totalAnomalies: number;
      highSeverity: number;
      mediumSeverity: number;
      lowSeverity: number;
      anomalyRate: number;
      detectionMethods: string[];
    };
  } {
    const {
      statisticalDeviation = 2.5,
      iqrMultiplier = 1.5,
      trendSensitivity = 1.5,
      patternSensitivity = 1.5,
      enableAdvanced = true,
      enableSeasonal = false,
      windowSize = 15
    } = thresholds;

    if (data.length < 3) {
      throw createError('At least 3 data points required for anomaly flagging', 400);
    }

    let allAnomalies: AnomalyResult[] = [];
    const detectionMethods: string[] = [];

    try {
      // 1. Basic statistical anomaly detection
      const statisticalAnomalies = this.detectAnomalies(data, statisticalDeviation);
      allAnomalies.push(...statisticalAnomalies);
      if (statisticalAnomalies.length > 0) {
        detectionMethods.push('statistical-deviation');
      }

      // 2. Advanced multi-algorithm detection
      if (enableAdvanced) {
        const advancedAnomalies = this.detectAdvancedAnomalies(data, {
          statisticalThreshold: statisticalDeviation,
          iqrMultiplier,
          enableTrendAnalysis: true,
          enableSeasonalAnalysis: enableSeasonal,
          windowSize
        });
        allAnomalies.push(...advancedAnomalies);
        detectionMethods.push('advanced-multi-algorithm');
      }

      // 3. Pattern change detection
      if (data.length >= windowSize * 2) {
        const patternAnomalies = this.detectPatternChanges(data, {
          windowSize,
          sensitivityThreshold: patternSensitivity,
          minChangePercent: 10
        });
        allAnomalies.push(...patternAnomalies);
        if (patternAnomalies.length > 0) {
          detectionMethods.push('pattern-change');
        }
      }

      // 4. Significant trend changes
      if (data.length >= windowSize * 3) {
        const trendAnomalies = this.detectSignificantTrendChanges(data, {
          windowSize,
          trendThreshold: 0.05 / trendSensitivity,
          volatilityThreshold: 2.0 * trendSensitivity
        });
        allAnomalies.push(...trendAnomalies);
        if (trendAnomalies.length > 0) {
          detectionMethods.push('trend-change');
        }
      }

      // Remove duplicates and sort
      const uniqueAnomalies = this.deduplicateAnomalies(allAnomalies);

      // Calculate summary statistics
      const highSeverity = uniqueAnomalies.filter(a => a.severity === 'high').length;
      const mediumSeverity = uniqueAnomalies.filter(a => a.severity === 'medium').length;
      const lowSeverity = uniqueAnomalies.filter(a => a.severity === 'low').length;
      const anomalyRate = (uniqueAnomalies.length / data.length) * 100;

      const summary = {
        totalAnomalies: uniqueAnomalies.length,
        highSeverity,
        mediumSeverity,
        lowSeverity,
        anomalyRate,
        detectionMethods
      };

      dbLogger.info('Comprehensive anomaly flagging completed', {
        dataPoints: data.length,
        ...summary,
        thresholds
      });

      return {
        anomalies: uniqueAnomalies,
        summary
      };

    } catch (error) {
      dbLogger.error('Error in anomaly flagging:', error);
      throw error;
    }
  }

  /**
   * Statistical deviation analysis with multiple methods
   */
  performStatisticalDeviationAnalysis(
    data: TimeSeriesData[],
    methods: ('zscore' | 'modified-zscore' | 'grubbs' | 'dixon')[] = ['zscore', 'modified-zscore']
  ): {
    method: string;
    anomalies: AnomalyResult[];
    statistics: {
      mean: number;
      median: number;
      standardDeviation: number;
      mad: number; // Median Absolute Deviation
    };
  }[] {
    if (data.length < 3) {
      throw createError('At least 3 data points required for statistical deviation analysis', 400);
    }

    const results: {
      method: string;
      anomalies: AnomalyResult[];
      statistics: {
        mean: number;
        median: number;
        standardDeviation: number;
        mad: number;
      };
    }[] = [];

    const values = data.map(p => p.value).filter(v => !isNaN(v) && isFinite(v));
    const sortedValues = [...values].sort((a, b) => a - b);
    
    // Calculate basic statistics
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const median = sortedValues[Math.floor(sortedValues.length / 2)]!;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Calculate Median Absolute Deviation (MAD)
    const deviationsFromMedian = values.map(v => Math.abs(v - median));
    const mad = deviationsFromMedian.sort((a, b) => a - b)[Math.floor(deviationsFromMedian.length / 2)]!;

    const baseStats = { mean, median, standardDeviation, mad };

    for (const method of methods) {
      let anomalies: AnomalyResult[] = [];

      switch (method) {
        case 'zscore':
          anomalies = this.detectZScoreAnomalies(data, baseStats, 2.5);
          break;
        case 'modified-zscore':
          anomalies = this.detectModifiedZScoreAnomalies(data, baseStats, 3.5);
          break;
        case 'grubbs':
          if (data.length >= 7) {
            anomalies = this.detectGrubbsAnomalies(data, baseStats);
          }
          break;
        case 'dixon':
          if (data.length >= 8 && data.length <= 30) {
            anomalies = this.detectDixonAnomalies(data, baseStats);
          }
          break;
      }

      results.push({
        method,
        anomalies,
        statistics: baseStats
      });
    }

    return results;
  }

  private detectZScoreAnomalies(
    data: TimeSeriesData[], 
    stats: { mean: number; standardDeviation: number }, 
    threshold: number
  ): AnomalyResult[] {
    const anomalies: AnomalyResult[] = [];

    for (const point of data) {
      if (!isNaN(point.value) && isFinite(point.value) && stats.standardDeviation > 0) {
        const zScore = Math.abs(point.value - stats.mean) / stats.standardDeviation;
        
        if (zScore > threshold) {
          anomalies.push({
            timestamp: point.timestamp,
            value: point.value,
            expectedValue: stats.mean,
            deviation: zScore,
            severity: zScore > threshold * 1.5 ? 'high' : zScore > threshold * 1.2 ? 'medium' : 'low',
            description: `Z-score anomaly: ${zScore.toFixed(2)} (threshold: ${threshold})`
          });
        }
      }
    }

    return anomalies;
  }

  private detectModifiedZScoreAnomalies(
    data: TimeSeriesData[], 
    stats: { median: number; mad: number }, 
    threshold: number
  ): AnomalyResult[] {
    const anomalies: AnomalyResult[] = [];

    for (const point of data) {
      if (!isNaN(point.value) && isFinite(point.value) && stats.mad > 0) {
        const modifiedZScore = 0.6745 * (point.value - stats.median) / stats.mad;
        
        if (Math.abs(modifiedZScore) > threshold) {
          anomalies.push({
            timestamp: point.timestamp,
            value: point.value,
            expectedValue: stats.median,
            deviation: Math.abs(modifiedZScore),
            severity: Math.abs(modifiedZScore) > threshold * 1.5 ? 'high' : 
                     Math.abs(modifiedZScore) > threshold * 1.2 ? 'medium' : 'low',
            description: `Modified Z-score anomaly: ${modifiedZScore.toFixed(2)} (threshold: ${threshold})`
          });
        }
      }
    }

    return anomalies;
  }

  private detectGrubbsAnomalies(
    data: TimeSeriesData[], 
    stats: { mean: number; standardDeviation: number }
  ): AnomalyResult[] {
    // Simplified Grubbs test implementation
    const anomalies: AnomalyResult[] = [];
    const n = data.length;
    
    // Critical values for Grubbs test (approximate)
    const criticalValue = n > 30 ? 3.0 : 2.5 + (30 - n) * 0.02;

    for (const point of data) {
      if (!isNaN(point.value) && isFinite(point.value) && stats.standardDeviation > 0) {
        const grubbsStatistic = Math.abs(point.value - stats.mean) / stats.standardDeviation;
        
        if (grubbsStatistic > criticalValue) {
          anomalies.push({
            timestamp: point.timestamp,
            value: point.value,
            expectedValue: stats.mean,
            deviation: grubbsStatistic,
            severity: grubbsStatistic > criticalValue * 1.3 ? 'high' : 'medium',
            description: `Grubbs test anomaly: ${grubbsStatistic.toFixed(2)} (critical: ${criticalValue.toFixed(2)})`
          });
        }
      }
    }

    return anomalies;
  }

  private detectDixonAnomalies(
    data: TimeSeriesData[], 
    stats: { mean: number; standardDeviation: number }
  ): AnomalyResult[] {
    // Simplified Dixon Q-test implementation
    const anomalies: AnomalyResult[] = [];
    const values = data.map(p => p.value).filter(v => !isNaN(v) && isFinite(v));
    const sortedValues = [...values].sort((a, b) => a - b);
    const n = sortedValues.length;

    if (n < 8 || n > 30) return anomalies;

    // Critical Q values (approximate)
    const criticalQ = n <= 10 ? 0.41 : n <= 20 ? 0.37 : 0.35;

    // Test lowest value
    if (n >= 3) {
      const qLow = (sortedValues[1]! - sortedValues[0]!) / (sortedValues[n-1]! - sortedValues[0]!);
      if (qLow > criticalQ) {
        const point = data.find(p => p.value === sortedValues[0]!);
        if (point) {
          anomalies.push({
            timestamp: point.timestamp,
            value: point.value,
            expectedValue: stats.mean,
            deviation: qLow,
            severity: qLow > criticalQ * 1.2 ? 'high' : 'medium',
            description: `Dixon Q-test anomaly (low): Q=${qLow.toFixed(3)} (critical: ${criticalQ})`
          });
        }
      }
    }

    // Test highest value
    if (n >= 3) {
      const qHigh = (sortedValues[n-1]! - sortedValues[n-2]!) / (sortedValues[n-1]! - sortedValues[0]!);
      if (qHigh > criticalQ) {
        const point = data.find(p => p.value === sortedValues[n-1]!);
        if (point) {
          anomalies.push({
            timestamp: point.timestamp,
            value: point.value,
            expectedValue: stats.mean,
            deviation: qHigh,
            severity: qHigh > criticalQ * 1.2 ? 'high' : 'medium',
            description: `Dixon Q-test anomaly (high): Q=${qHigh.toFixed(3)} (critical: ${criticalQ})`
          });
        }
      }
    }

    return anomalies;
  }
}

// Export singleton instance
export const statisticalAnalysisService = new StatisticalAnalysisService();