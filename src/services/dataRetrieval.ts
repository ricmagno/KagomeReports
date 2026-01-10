/**
 * Data Retrieval Service for AVEVA Historian
 * Handles time-series data queries, tag information, and data filtering
 */

import { getHistorianConnection } from './historianConnection';
import { dbLogger } from '@/utils/logger';
import { createError } from '@/middleware/errorHandler';
import { CacheService } from './cacheService';
import { createHash } from 'crypto';
import { 
  TimeSeriesData, 
  TagInfo, 
  TimeRange, 
  DataFilter, 
  QueryResult, 
  HistorianQueryOptions, 
  RetrievalMode, 
  QualityCode 
} from '@/types/historian';

export class DataRetrievalService {
  private cacheService: CacheService | undefined;

  constructor(cacheService?: CacheService) {
    this.cacheService = cacheService;
  }

  private getConnection() {
    return getHistorianConnection();
  }

  private generateQueryHash(query: string, params: Record<string, any>): string {
    const queryString = query + JSON.stringify(params);
    return createHash('md5').update(queryString).digest('hex');
  }

  /**
   * Get time-series data for a specific tag within a time range
   */
  async getTimeSeriesData(
    tagName: string, 
    timeRange: TimeRange, 
    options?: HistorianQueryOptions
  ): Promise<TimeSeriesData[]> {
    try {
      dbLogger.info('Retrieving time-series data', { tagName, timeRange, options });

      // Validate inputs
      this.validateTimeRange(timeRange);
      this.validateTagName(tagName);

      // Check cache first if caching is enabled
      if (this.cacheService) {
        const cachedData = await this.cacheService.getCachedTimeSeriesData(
          tagName, 
          timeRange.startTime, 
          timeRange.endTime
        );
        
        if (cachedData) {
          dbLogger.debug(`Cache hit for time-series data: ${tagName}`);
          return cachedData;
        }
      }

      // Build query based on retrieval mode
      const query = this.buildTimeSeriesQuery(tagName, timeRange, options);
      const params = this.buildQueryParams(tagName, timeRange, options);

      const result = await this.getConnection().executeQuery<any>(query, params);
      
      // Transform raw data to TimeSeriesData format
      const timeSeriesData = result.recordset.map(row => this.transformToTimeSeriesData(row, tagName));

      // Cache the result if caching is enabled
      if (this.cacheService && timeSeriesData.length > 0) {
        await this.cacheService.cacheTimeSeriesData(
          tagName, 
          timeRange.startTime, 
          timeRange.endTime, 
          timeSeriesData
        );
      }

      dbLogger.info(`Retrieved ${timeSeriesData.length} data points for tag ${tagName}`);
      return timeSeriesData;

    } catch (error) {
      dbLogger.error('Failed to retrieve time-series data:', { tagName, timeRange, error });
      throw error;
    }
  }

  /**
   * Get multiple time-series data for multiple tags
   */
  async getMultipleTimeSeriesData(
    tagNames: string[], 
    timeRange: TimeRange, 
    options?: HistorianQueryOptions
  ): Promise<Record<string, TimeSeriesData[]>> {
    try {
      dbLogger.info('Retrieving multiple time-series data', { tagNames, timeRange });

      // Validate inputs
      this.validateTimeRange(timeRange);
      if (tagNames.length === 0) {
        throw createError('At least one tag name is required', 400);
      }

      // Execute queries in parallel for better performance
      const promises = tagNames.map(tagName => 
        this.getTimeSeriesData(tagName, timeRange, options)
          .then(data => ({ tagName, data }))
          .catch(error => ({ tagName, error }))
      );

      const results = await Promise.all(promises);
      
      // Process results and handle errors
      const successfulResults: Record<string, TimeSeriesData[]> = {};
      const errors: string[] = [];

      results.forEach(result => {
        if ('error' in result) {
          errors.push(`${result.tagName}: ${result.error.message}`);
        } else {
          successfulResults[result.tagName] = result.data;
        }
      });

      if (errors.length > 0) {
        dbLogger.warn('Some tag queries failed:', errors);
      }

      return successfulResults;

    } catch (error) {
      dbLogger.error('Failed to retrieve multiple time-series data:', error);
      throw error;
    }
  }

  /**
   * Get available tags with optional filtering
   */
  async getTagList(filter?: string): Promise<TagInfo[]> {
    try {
      dbLogger.info('Retrieving tag list', { filter });

      // Check cache first if caching is enabled
      if (this.cacheService) {
        const cachedTags = filter 
          ? await this.cacheService.getCachedFilteredTags(filter)
          : await this.cacheService.getCachedTagList();
        
        if (cachedTags) {
          dbLogger.debug(`Cache hit for tag list${filter ? ` with filter: ${filter}` : ''}`);
          return cachedTags;
        }
      }

      let query = `
        SELECT 
          TagName as name,
          Description as description,
          EngineeringUnits as units,
          CASE 
            WHEN DataType = 1 THEN 'analog'
            WHEN DataType = 2 THEN 'discrete'
            ELSE 'string'
          END as dataType,
          LastUpdate as lastUpdate,
          MinEU as minValue,
          MaxEU as maxValue,
          EngineeringUnits as engineeringUnits
        FROM Tag
        WHERE 1=1
      `;

      const params: Record<string, any> = {};

      if (filter) {
        query += ` AND (TagName LIKE @filter OR Description LIKE @filter)`;
        params.filter = `%${filter}%`;
      }

      query += ` ORDER BY TagName`;

      const result = await this.getConnection().executeQuery<TagInfo>(query, params);
      
      // Cache the result if caching is enabled
      if (this.cacheService && result.recordset.length > 0) {
        if (filter) {
          await this.cacheService.cacheFilteredTags(filter, result.recordset);
        } else {
          await this.cacheService.cacheTagList(result.recordset);
        }
      }

      dbLogger.info(`Retrieved ${result.recordset.length} tags`);
      return result.recordset;

    } catch (error) {
      dbLogger.error('Failed to retrieve tag list:', error);
      throw error;
    }
  }

  /**
   * Get filtered time-series data with pagination
   */
  async getFilteredData(
    timeRange: TimeRange,
    filter: DataFilter,
    pageSize: number = 1000,
    cursor?: string
  ): Promise<QueryResult<TimeSeriesData>> {
    try {
      dbLogger.info('Retrieving filtered data', { timeRange, filter, pageSize, cursor });

      // Validate inputs
      this.validateTimeRange(timeRange);
      this.validateDataFilter(filter);

      // Build filtered query
      const query = this.buildFilteredQuery(timeRange, filter, pageSize, cursor);
      const params = this.buildFilteredQueryParams(timeRange, filter, cursor);

      const result = await this.getConnection().executeQuery<any>(query, params);
      
      // Transform and paginate results
      const data = result.recordset.map(row => this.transformToTimeSeriesData(row));
      const hasMore = data.length === pageSize;
      const nextCursor = hasMore && data.length > 0 ? this.generateCursor(data[data.length - 1]!) : undefined;

      // Get total count for pagination info
      const countQuery = this.buildCountQuery(timeRange, filter);
      const countResult = await this.getConnection().executeQuery<{ total: number }>(countQuery, params);
      const totalCount = countResult.recordset[0]?.total || 0;

      return {
        data,
        totalCount,
        hasMore,
        ...(nextCursor && { nextCursor })
      };

    } catch (error) {
      dbLogger.error('Failed to retrieve filtered data:', error);
      throw error;
    }
  }

  /**
   * Build time-series query based on retrieval mode
   */
  private buildTimeSeriesQuery(
    tagName: string, 
    timeRange: TimeRange, 
    options?: HistorianQueryOptions
  ): string {
    const mode = options?.mode || RetrievalMode.Full;
    const includeQuality = options?.includeQuality !== false;

    let query = `
      SELECT 
        DateTime as timestamp,
        Value as value,
        ${includeQuality ? 'Quality as quality,' : ''}
        @tagName as tagName
      FROM History
      WHERE TagName = @tagName
        AND DateTime >= @startTime
        AND DateTime <= @endTime
    `;

    // Add mode-specific conditions
    switch (mode) {
      case RetrievalMode.Cyclic:
        if (options?.interval) {
          query += ` AND DATEDIFF(second, @startTime, DateTime) % @interval = 0`;
        }
        break;
      
      case RetrievalMode.Delta:
        // Delta mode would require more complex logic with LAG functions
        query += ` AND Quality = ${QualityCode.Good}`;
        break;
      
      case RetrievalMode.BestFit:
        // Implement sampling logic for large datasets
        if (options?.maxPoints) {
          const sampleRate = this.calculateSampleRate(timeRange, options.maxPoints);
          query += ` AND ROW_NUMBER() OVER (ORDER BY DateTime) % ${sampleRate} = 1`;
        }
        break;
    }

    query += ` ORDER BY DateTime`;

    if (options?.maxPoints) {
      query = `SELECT TOP ${options.maxPoints} * FROM (${query}) AS subquery`;
    }

    return query;
  }

  /**
   * Build query parameters
   */
  private buildQueryParams(
    tagName: string, 
    timeRange: TimeRange, 
    options?: HistorianQueryOptions
  ): Record<string, any> {
    const params: Record<string, any> = {
      tagName,
      startTime: timeRange.startTime,
      endTime: timeRange.endTime
    };

    if (options?.interval) {
      params.interval = options.interval;
    }

    return params;
  }

  /**
   * Build filtered query with multiple conditions
   */
  private buildFilteredQuery(
    timeRange: TimeRange,
    filter: DataFilter,
    pageSize: number,
    cursor?: string
  ): string {
    let query = `
      SELECT TOP ${pageSize + 1}
        h.DateTime as timestamp,
        h.Value as value,
        h.Quality as quality,
        h.TagName as tagName
      FROM History h
      INNER JOIN Tag t ON h.TagName = t.TagName
      WHERE h.DateTime >= @startTime
        AND h.DateTime <= @endTime
    `;

    // Add tag name filter
    if (filter.tagNames && filter.tagNames.length > 0) {
      const tagPlaceholders = filter.tagNames.map((_, index) => `@tag${index}`).join(',');
      query += ` AND h.TagName IN (${tagPlaceholders})`;
    }

    // Add quality filter
    if (filter.qualityFilter && filter.qualityFilter.length > 0) {
      const qualityPlaceholders = filter.qualityFilter.map((_, index) => `@quality${index}`).join(',');
      query += ` AND h.Quality IN (${qualityPlaceholders})`;
    }

    // Add value range filter
    if (filter.valueRange) {
      if (filter.valueRange.min !== undefined) {
        query += ` AND h.Value >= @minValue`;
      }
      if (filter.valueRange.max !== undefined) {
        query += ` AND h.Value <= @maxValue`;
      }
    }

    // Add cursor for pagination
    if (cursor) {
      query += ` AND h.DateTime > @cursorTime`;
    }

    query += ` ORDER BY h.DateTime, h.TagName`;

    return query;
  }

  /**
   * Build parameters for filtered query
   */
  private buildFilteredQueryParams(
    timeRange: TimeRange,
    filter: DataFilter,
    cursor?: string
  ): Record<string, any> {
    const params: Record<string, any> = {
      startTime: timeRange.startTime,
      endTime: timeRange.endTime
    };

    // Add tag name parameters
    if (filter.tagNames) {
      filter.tagNames.forEach((tagName, index) => {
        params[`tag${index}`] = tagName;
      });
    }

    // Add quality parameters
    if (filter.qualityFilter) {
      filter.qualityFilter.forEach((quality, index) => {
        params[`quality${index}`] = quality;
      });
    }

    // Add value range parameters
    if (filter.valueRange) {
      if (filter.valueRange.min !== undefined) {
        params.minValue = filter.valueRange.min;
      }
      if (filter.valueRange.max !== undefined) {
        params.maxValue = filter.valueRange.max;
      }
    }

    // Add cursor parameter
    if (cursor) {
      params.cursorTime = new Date(cursor);
    }

    return params;
  }

  /**
   * Build count query for pagination
   */
  private buildCountQuery(timeRange: TimeRange, filter: DataFilter): string {
    let query = `
      SELECT COUNT(*) as total
      FROM History h
      INNER JOIN Tag t ON h.TagName = t.TagName
      WHERE h.DateTime >= @startTime
        AND h.DateTime <= @endTime
    `;

    // Add same filters as main query (without cursor)
    if (filter.tagNames && filter.tagNames.length > 0) {
      const tagPlaceholders = filter.tagNames.map((_, index) => `@tag${index}`).join(',');
      query += ` AND h.TagName IN (${tagPlaceholders})`;
    }

    if (filter.qualityFilter && filter.qualityFilter.length > 0) {
      const qualityPlaceholders = filter.qualityFilter.map((_, index) => `@quality${index}`).join(',');
      query += ` AND h.Quality IN (${qualityPlaceholders})`;
    }

    if (filter.valueRange) {
      if (filter.valueRange.min !== undefined) {
        query += ` AND h.Value >= @minValue`;
      }
      if (filter.valueRange.max !== undefined) {
        query += ` AND h.Value <= @maxValue`;
      }
    }

    return query;
  }

  /**
   * Transform raw database row to TimeSeriesData
   */
  private transformToTimeSeriesData(row: any, tagName?: string): TimeSeriesData {
    return {
      timestamp: new Date(row.timestamp),
      value: parseFloat(row.value),
      quality: row.quality || QualityCode.Good,
      tagName: tagName || row.tagName
    };
  }

  /**
   * Calculate sample rate for BestFit mode
   */
  private calculateSampleRate(timeRange: TimeRange, maxPoints: number): number {
    const duration = timeRange.endTime.getTime() - timeRange.startTime.getTime();
    const estimatedPoints = duration / (60 * 1000); // Assume 1 point per minute
    return Math.max(1, Math.ceil(estimatedPoints / maxPoints));
  }

  /**
   * Generate cursor for pagination
   */
  private generateCursor(data: TimeSeriesData): string {
    return data.timestamp.toISOString();
  }

  /**
   * Validate time range
   */
  private validateTimeRange(timeRange: TimeRange): void {
    if (!timeRange.startTime || !timeRange.endTime) {
      throw createError('Start time and end time are required', 400);
    }

    if (timeRange.startTime >= timeRange.endTime) {
      throw createError('Start time must be before end time', 400);
    }

    // Check for reasonable time range (not more than 1 year)
    const maxDuration = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    const duration = timeRange.endTime.getTime() - timeRange.startTime.getTime();
    
    if (duration > maxDuration) {
      throw createError('Time range cannot exceed 1 year', 400);
    }
  }

  /**
   * Validate tag name
   */
  private validateTagName(tagName: string): void {
    if (!tagName || tagName.trim().length === 0) {
      throw createError('Tag name is required', 400);
    }

    // Basic validation for tag name format
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(tagName)) {
      throw createError('Invalid tag name format', 400);
    }
  }

  /**
   * Validate data filter
   */
  private validateDataFilter(filter: DataFilter): void {
    if (filter.valueRange) {
      if (filter.valueRange.min !== undefined && filter.valueRange.max !== undefined) {
        if (filter.valueRange.min >= filter.valueRange.max) {
          throw createError('Minimum value must be less than maximum value', 400);
        }
      }
    }

    if (filter.samplingInterval && filter.samplingInterval <= 0) {
      throw createError('Sampling interval must be positive', 400);
    }
  }
}

// Export singleton instance
export const dataRetrievalService = new DataRetrievalService();