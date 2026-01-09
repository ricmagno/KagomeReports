/**
 * Data Filtering Service
 * Provides advanced filtering capabilities for time-series data
 */

import { TimeSeriesData, DataFilter, QualityCode, QueryResult } from '@/types/historian';
import { dbLogger } from '@/utils/logger';
import { createError } from '@/middleware/errorHandler';

export class DataFilteringService {

  /**
   * Apply comprehensive filters to time-series data
   */
  applyFilters(data: TimeSeriesData[], filter: DataFilter): TimeSeriesData[] {
    let filteredData = [...data];

    // Apply tag name filter
    if (filter.tagNames && filter.tagNames.length > 0) {
      filteredData = filteredData.filter(point => 
        filter.tagNames!.includes(point.tagName)
      );
    }

    // Apply quality filter
    if (filter.qualityFilter && filter.qualityFilter.length > 0) {
      filteredData = filteredData.filter(point => 
        filter.qualityFilter!.includes(point.quality)
      );
    }

    // Apply value range filter
    if (filter.valueRange) {
      if (filter.valueRange.min !== undefined) {
        filteredData = filteredData.filter(point => 
          point.value >= filter.valueRange!.min!
        );
      }
      if (filter.valueRange.max !== undefined) {
        filteredData = filteredData.filter(point => 
          point.value <= filter.valueRange!.max!
        );
      }
    }

    dbLogger.debug('Data filtering applied', {
      originalCount: data.length,
      filteredCount: filteredData.length,
      filter
    });

    return filteredData;
  }

  /**
   * Filter data by quality codes with detailed quality analysis
   */
  filterByQuality(
    data: TimeSeriesData[], 
    allowedQualities: QualityCode[] = [QualityCode.Good]
  ): {
    filteredData: TimeSeriesData[];
    qualityReport: {
      total: number;
      good: number;
      bad: number;
      uncertain: number;
      other: number;
      filteredOut: number;
    };
  } {
    const qualityReport = {
      total: data.length,
      good: 0,
      bad: 0,
      uncertain: 0,
      other: 0,
      filteredOut: 0
    };

    const filteredData: TimeSeriesData[] = [];

    for (const point of data) {
      // Count quality types
      switch (point.quality) {
        case QualityCode.Good:
          qualityReport.good++;
          break;
        case QualityCode.Bad:
          qualityReport.bad++;
          break;
        case QualityCode.Uncertain:
          qualityReport.uncertain++;
          break;
        default:
          qualityReport.other++;
      }

      // Include point if quality is allowed
      if (allowedQualities.includes(point.quality)) {
        filteredData.push(point);
      } else {
        qualityReport.filteredOut++;
      }
    }

    dbLogger.debug('Quality filtering completed', qualityReport);

    return { filteredData, qualityReport };
  }

  /**
   * Apply sampling to reduce data density
   */
  applySampling(
    data: TimeSeriesData[], 
    samplingInterval: number,
    method: 'uniform' | 'average' | 'max' | 'min' = 'uniform'
  ): TimeSeriesData[] {
    if (samplingInterval <= 0) {
      throw createError('Sampling interval must be positive', 400);
    }

    if (data.length === 0) {
      return [];
    }

    const sortedData = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const sampledData: TimeSeriesData[] = [];

    switch (method) {
      case 'uniform':
        // Take every nth point
        for (let i = 0; i < sortedData.length; i += samplingInterval) {
          sampledData.push(sortedData[i]!);
        }
        break;

      case 'average':
      case 'max':
      case 'min':
        // Group by intervals and apply aggregation
        for (let i = 0; i < sortedData.length; i += samplingInterval) {
          const group = sortedData.slice(i, i + samplingInterval);
          const validValues = group
            .map(p => p.value)
            .filter(v => !isNaN(v) && isFinite(v));

          if (validValues.length > 0) {
            let aggregatedValue: number;
            switch (method) {
              case 'average':
                aggregatedValue = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
                break;
              case 'max':
                aggregatedValue = Math.max(...validValues);
                break;
              case 'min':
                aggregatedValue = Math.min(...validValues);
                break;
            }

            sampledData.push({
              timestamp: group[Math.floor(group.length / 2)]!.timestamp, // Use middle timestamp
              value: aggregatedValue,
              quality: group[0]!.quality, // Use first quality
              tagName: group[0]!.tagName
            });
          }
        }
        break;
    }

    dbLogger.debug('Sampling applied', {
      originalCount: data.length,
      sampledCount: sampledData.length,
      interval: samplingInterval,
      method
    });

    return sampledData;
  }

  /**
   * Remove outliers using statistical methods
   */
  removeOutliers(
    data: TimeSeriesData[], 
    method: 'iqr' | 'zscore' = 'iqr',
    threshold: number = 1.5
  ): {
    cleanedData: TimeSeriesData[];
    outliers: TimeSeriesData[];
    statistics: {
      originalCount: number;
      cleanedCount: number;
      outliersCount: number;
      outliersPercentage: number;
    };
  } {
    if (data.length === 0) {
      return {
        cleanedData: [],
        outliers: [],
        statistics: {
          originalCount: 0,
          cleanedCount: 0,
          outliersCount: 0,
          outliersPercentage: 0
        }
      };
    }

    const values = data.map(point => point.value).filter(v => !isNaN(v) && isFinite(v));
    const cleanedData: TimeSeriesData[] = [];
    const outliers: TimeSeriesData[] = [];

    if (method === 'iqr') {
      // Interquartile Range method
      const sortedValues = [...values].sort((a, b) => a - b);
      const q1Index = Math.floor(sortedValues.length * 0.25);
      const q3Index = Math.floor(sortedValues.length * 0.75);
      const q1 = sortedValues[q1Index]!;
      const q3 = sortedValues[q3Index]!;
      const iqr = q3 - q1;
      const lowerBound = q1 - threshold * iqr;
      const upperBound = q3 + threshold * iqr;

      for (const point of data) {
        if (point.value >= lowerBound && point.value <= upperBound) {
          cleanedData.push(point);
        } else {
          outliers.push(point);
        }
      }
    } else {
      // Z-score method
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      for (const point of data) {
        const zScore = Math.abs(point.value - mean) / stdDev;
        if (zScore <= threshold) {
          cleanedData.push(point);
        } else {
          outliers.push(point);
        }
      }
    }

    const statistics = {
      originalCount: data.length,
      cleanedCount: cleanedData.length,
      outliersCount: outliers.length,
      outliersPercentage: (outliers.length / data.length) * 100
    };

    dbLogger.debug('Outlier removal completed', { method, threshold, statistics });

    return { cleanedData, outliers, statistics };
  }

  /**
   * Interpolate missing data points
   */
  interpolateMissingData(
    data: TimeSeriesData[],
    method: 'linear' | 'forward' | 'backward' = 'linear'
  ): TimeSeriesData[] {
    if (data.length < 2) {
      return [...data];
    }

    const sortedData = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const interpolatedData: TimeSeriesData[] = [];

    for (let i = 0; i < sortedData.length; i++) {
      const currentPoint = sortedData[i]!;
      interpolatedData.push(currentPoint);

      // Check if we need to interpolate between this point and the next
      if (i < sortedData.length - 1) {
        const nextPoint = sortedData[i + 1]!;
        const timeDiff = nextPoint.timestamp.getTime() - currentPoint.timestamp.getTime();
        
        // If there's a significant gap (more than 2x expected interval), interpolate
        if (i > 0) {
          const prevInterval = currentPoint.timestamp.getTime() - sortedData[i - 1]!.timestamp.getTime();
          if (timeDiff > prevInterval * 2) {
            const interpolatedPoints = this.generateInterpolatedPoints(
              currentPoint,
              nextPoint,
              method,
              Math.floor(timeDiff / prevInterval) - 1
            );
            interpolatedData.push(...interpolatedPoints);
          }
        }
      }
    }

    dbLogger.debug('Data interpolation completed', {
      originalCount: data.length,
      interpolatedCount: interpolatedData.length,
      method
    });

    return interpolatedData;
  }

  /**
   * Generate interpolated points between two data points
   */
  private generateInterpolatedPoints(
    startPoint: TimeSeriesData,
    endPoint: TimeSeriesData,
    method: 'linear' | 'forward' | 'backward',
    count: number
  ): TimeSeriesData[] {
    const interpolatedPoints: TimeSeriesData[] = [];
    const timeDiff = endPoint.timestamp.getTime() - startPoint.timestamp.getTime();
    const timeStep = timeDiff / (count + 1);

    for (let i = 1; i <= count; i++) {
      const timestamp = new Date(startPoint.timestamp.getTime() + timeStep * i);
      let value: number;

      switch (method) {
        case 'linear':
          const ratio = i / (count + 1);
          value = startPoint.value + (endPoint.value - startPoint.value) * ratio;
          break;
        case 'forward':
          value = startPoint.value;
          break;
        case 'backward':
          value = endPoint.value;
          break;
      }

      interpolatedPoints.push({
        timestamp,
        value,
        quality: QualityCode.Uncertain, // Mark interpolated data as uncertain
        tagName: startPoint.tagName
      });
    }

    return interpolatedPoints;
  }

  /**
   * Validate filter parameters
   */
  validateFilter(filter: DataFilter): void {
    if (filter.valueRange) {
      if (filter.valueRange.min !== undefined && filter.valueRange.max !== undefined) {
        if (filter.valueRange.min >= filter.valueRange.max) {
          throw createError('Minimum value must be less than maximum value', 400);
        }
      }
    }

    if (filter.samplingInterval !== undefined && filter.samplingInterval <= 0) {
      throw createError('Sampling interval must be positive', 400);
    }

    if (filter.tagNames && filter.tagNames.length === 0) {
      throw createError('Tag names array cannot be empty', 400);
    }

    if (filter.qualityFilter && filter.qualityFilter.length === 0) {
      throw createError('Quality filter array cannot be empty', 400);
    }
  }
}

// Export singleton instance
export const dataFilteringService = new DataFilteringService();