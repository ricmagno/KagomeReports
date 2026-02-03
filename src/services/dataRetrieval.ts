/**
 * Data Retrieval Service for AVEVA Historian
 * Handles time-series data queries, tag information, and data filtering
 */

import { getHistorianConnection } from './historianConnection';
import { dbLogger } from '@/utils/logger';
import { createError } from '@/middleware/errorHandler';
import { CacheService } from './cacheService';
import { progressTracker } from '@/middleware/progressTracker';
import { createHash } from 'crypto';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import {
  TimeSeriesData,
  TagInfo,
  TimeRange,
  DataFilter,
  QueryResult,
  HistorianQueryOptions,
  RetrievalMode,
  QualityCode,
  StatisticsResult
} from '@/types/historian';

export class DataRetrievalService {
  private cacheService: CacheService | undefined;
  private readonly STREAM_BATCH_SIZE = 1000;
  private readonly LARGE_DATASET_THRESHOLD = 10000;

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
    options?: HistorianQueryOptions,
    operationId?: string
  ): Promise<TimeSeriesData[]> {
    try {
      dbLogger.info('Retrieving time-series data', { tagName, timeRange, options });

      // Update progress if tracking
      if (operationId) {
        progressTracker.updateProgress(operationId, 'connecting', 5, 'Connecting to database');
      }

      // Validate inputs
      this.validateTimeRange(timeRange);
      this.validateTagName(tagName);

      // Check cache first if caching is enabled
      if (this.cacheService) {
        const cachedData = await this.cacheService.getCachedTimeSeriesData(
          tagName,
          timeRange.startTime,
          timeRange.endTime,
          options
        );

        if (cachedData) {
          dbLogger.debug(`Cache hit for time-series data: ${tagName}`);
          if (operationId) {
            progressTracker.completeOperation(operationId, 'Data retrieved from cache');
          }
          return cachedData;
        }
      }

      // Estimate data size and use streaming for large datasets
      const estimatedSize = await this.estimateDataSize(tagName, timeRange);

      if (estimatedSize > this.LARGE_DATASET_THRESHOLD) {
        dbLogger.info(`Large dataset detected (${estimatedSize} points), using streaming approach`);
        return this.getTimeSeriesDataStreaming(tagName, timeRange, options, operationId);
      }

      if (operationId) {
        progressTracker.updateProgress(operationId, 'querying', 20, 'Executing optimized query');
      }

      // Build optimized query
      const query = this.buildOptimizedTimeSeriesQuery(tagName, timeRange, options);
      const params = this.buildQueryParams(tagName, timeRange, options);

      // Log the query and parameters for debugging
      dbLogger.info('Executing time-series query:', {
        query: query.trim(),
        params: {
          tagName: params.tagName,
          startTime: params.startTime,
          endTime: params.endTime,
          mode: params.mode,
          resolution: params.resolution,
          maxPoints: params.maxPoints
        }
      });

      // Log what the rendered query would look like
      const renderedQuery = query
        .replace('@tagName', `'${params.tagName}'`)
        .replace('@startTime', `'${params.startTime}'`)
        .replace('@endTime', `'${params.endTime}'`);
      dbLogger.info('Rendered SQL query (approximate):', { renderedQuery: renderedQuery.trim() });

      const result = await this.getConnection().executeQuery<any>(query, params);

      // Log raw database results for debugging
      dbLogger.info('Raw database result:', {
        recordCount: result.recordset.length,
        firstRow: result.recordset[0],
        lastRow: result.recordset[result.recordset.length - 1]
      });

      if (operationId) {
        progressTracker.updateProgress(operationId, 'processing', 70, 'Processing query results');
      }

      // Transform raw data to TimeSeriesData format
      const timeSeriesData = result.recordset.map(row => this.transformToTimeSeriesData(row, tagName));

      // Log transformed data for debugging
      dbLogger.info('Transformed data:', {
        count: timeSeriesData.length,
        firstPoint: timeSeriesData[0],
        lastPoint: timeSeriesData[timeSeriesData.length - 1]
      });

      // Cache the result if caching is enabled
      if (this.cacheService && timeSeriesData.length > 0) {
        if (operationId) {
          progressTracker.updateProgress(operationId, 'caching', 90, 'Caching results');
        }
        await this.cacheService.cacheTimeSeriesData(
          tagName,
          timeRange.startTime,
          timeRange.endTime,
          timeSeriesData,
          options
        );
      }

      if (operationId) {
        progressTracker.completeOperation(operationId, `Retrieved ${timeSeriesData.length} data points`);
      }

      dbLogger.info(`Retrieved ${timeSeriesData.length} data points for tag ${tagName}`);
      return timeSeriesData;

    } catch (error) {
      if (operationId) {
        progressTracker.failOperation(operationId, error instanceof Error ? error.message : 'Unknown error');
      }
      dbLogger.error('Failed to retrieve time-series data:', { tagName, timeRange, error });
      throw error;
    }
  }

  /**
   * Get time-series data using streaming for large datasets
   */
  private async getTimeSeriesDataStreaming(
    tagName: string,
    timeRange: TimeRange,
    options?: HistorianQueryOptions,
    operationId?: string
  ): Promise<TimeSeriesData[]> {
    const results: TimeSeriesData[] = [];
    let processedCount = 0;
    let totalEstimated = await this.estimateDataSize(tagName, timeRange);

    // Create streaming query with pagination
    const batchSize = this.STREAM_BATCH_SIZE;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      if (operationId) {
        const progress = Math.min(90, (processedCount / totalEstimated) * 80 + 10);
        progressTracker.updateProgress(
          operationId,
          'querying',
          progress,
          `Processing batch ${Math.floor(offset / batchSize) + 1}, ${processedCount}/${totalEstimated} points`
        );
      }

      const query = this.buildStreamingQuery(tagName, timeRange, options, batchSize, offset);
      const params = this.buildQueryParams(tagName, timeRange, options);
      params.offset = offset;
      params.batchSize = batchSize;

      const result = await this.getConnection().executeQuery<any>(query, params);
      const batch = result.recordset.map(row => this.transformToTimeSeriesData(row, tagName));

      results.push(...batch);
      processedCount += batch.length;
      hasMore = batch.length === batchSize;
      offset += batchSize;

      // Memory management: if results get too large, consider chunked processing
      if (results.length > 50000) {
        dbLogger.warn('Large result set detected, consider using chunked processing', {
          tagName,
          currentSize: results.length
        });
      }
    }

    return results;
  }

  /**
   * Estimate data size for query optimization
   */
  private async estimateDataSize(tagName: string, timeRange: TimeRange): Promise<number> {
    try {
      const query = `
        SELECT COUNT(*) as estimatedCount
        FROM History
        WHERE TagName = @tagName
          AND DateTime >= @startTime
          AND DateTime <= @endTime
      `;

      const params = {
        tagName,
        startTime: this.formatDateForHistorian(timeRange.startTime),
        endTime: this.formatDateForHistorian(timeRange.endTime)
      };

      const result = await this.getConnection().executeQuery<{ estimatedCount: number }>(query + " AND wwTimeZone = 'UTC'", params);
      return result.recordset[0]?.estimatedCount || 0;
    } catch (error) {
      dbLogger.warn('Failed to estimate data size, using default', { error });
      return this.LARGE_DATASET_THRESHOLD;
    }
  }

  /**
   * Get basic statistics using SQL standard aggregates (AVG, MIN, MAX)
   * Requirements: Use SQL to perform the calculation at the database level
   */
  public async getStatistics(
    tagName: string,
    timeRange: TimeRange
  ): Promise<StatisticsResult> {
    try {
      this.validateTimeRange(timeRange);
      this.validateTagName(tagName);

      dbLogger.info('Retrieving statistics via SQL aggregates', { tagName, timeRange });

      // Use a more standard SQL approach that works with History view
      // Removing explicit wwRetrievalMode='Full' to let it use default or whatever is active
      const query = `
        SELECT 
          AVG(CAST(Value as FLOAT)) as average,
          MIN(CAST(Value as FLOAT)) as min,
          MAX(CAST(Value as FLOAT)) as max,
          STDEV(CAST(Value as FLOAT)) as standardDeviation,
          COUNT(*) as count,
          SUM(CASE WHEN Quality >= 192 THEN 1 ELSE 0 END) as goodCount
        FROM History
        WHERE TagName = @tagName
          AND DateTime >= @startTime
          AND DateTime <= @endTime
          AND wwTimeZone = 'UTC'
      `;

      const params = {
        tagName,
        startTime: this.formatDateForHistorian(timeRange.startTime),
        endTime: this.formatDateForHistorian(timeRange.endTime)
      };

      const result = await this.getConnection().executeQuery<any>(query, params);
      const row = result.recordset[0];

      dbLogger.debug('SQL statistics raw result', { tagName, row });

      if (!row || row.count === 0 || row.average === null) {
        // If no data found via aggregates, try a fallback or return empty stats
        dbLogger.warn('No statistics found via SQL aggregates', { tagName });
        return {
          average: 0,
          min: 0,
          max: 0,
          standardDeviation: 0,
          count: 0,
          dataQuality: 0
        };
      }

      const totalCount = parseInt(row.count) || 0;
      const goodCount = parseInt(row.goodCount) || 0;
      const dataQuality = totalCount > 0 ? (goodCount / totalCount) * 100 : 0;

      const stats = {
        average: Number(row.average),
        min: Number(row.min),
        max: Number(row.max),
        standardDeviation: Number(row.standardDeviation) || 0,
        count: totalCount,
        dataQuality
      };

      dbLogger.info('SQL statistics calculated successfully', { tagName, stats });
      return stats;

    } catch (error) {
      dbLogger.error('Failed to retrieve SQL statistics:', { tagName, timeRange, error });
      throw error;
    }
  }

  /**
   * Build optimized time-series query with indexing hints
   */
  private buildOptimizedTimeSeriesQuery(
    tagName: string,
    timeRange: TimeRange,
    options?: HistorianQueryOptions
  ): string {
    const includeQuality = options?.includeQuality !== false;

    const mode = options?.mode || RetrievalMode.Cyclic;
    const isCyclic = mode === RetrievalMode.Cyclic || mode === RetrievalMode.Average;

    let query = `
      SELECT 
        DateTime as timestamp,
        TagName as tagName,
        Value as value,
        ${includeQuality ? 'Quality as quality' : 'NULL as quality'}
      FROM History
      WHERE TagName = @tagName
        AND DateTime >= @startTime
        AND DateTime <= @endTime
        AND wwRetrievalMode = @mode
        ${isCyclic ? 'AND wwResolution = @resolution' : ''}
        AND wwTimeZone = 'UTC'
      ORDER BY DateTime ASC
    `;

    return query;
  }

  /**
   * Build streaming query with pagination
   */
  private buildStreamingQuery(
    tagName: string,
    timeRange: TimeRange,
    options?: HistorianQueryOptions,
    batchSize: number = 1000,
    offset: number = 0
  ): string {
    const mode = options?.mode || RetrievalMode.Full;
    const includeQuality = options?.includeQuality !== false;

    return `
      SELECT 
        DateTime as timestamp,
        Value as value,
        ${includeQuality ? 'Quality as quality,' : ''}
        TagName as tagName
      FROM History
      WHERE TagName = @tagName
        AND DateTime >= @startTime
        AND DateTime <= @endTime
        AND wwRetrievalMode = @mode
        AND wwTimeZone = 'UTC'
      ORDER BY DateTime
      OFFSET @offset ROWS
      FETCH NEXT @batchSize ROWS ONLY
    `;
  }



  /**
   * Create data processing stream for memory-efficient operations
   */
  createDataProcessingStream(): Transform {
    const self = this;
    return new Transform({
      objectMode: true,
      transform(chunk: any, encoding, callback) {
        try {
          // Process data chunk
          const processed = self.processDataChunk(chunk);
          callback(null, processed);
        } catch (error) {
          callback(error instanceof Error ? error : new Error('Processing error'));
        }
      }
    });
  }

  /**
   * Process data chunk for streaming operations
   */
  private processDataChunk(chunk: any): TimeSeriesData {
    return {
      timestamp: new Date(chunk.timestamp),
      value: parseFloat(chunk.value),
      quality: chunk.quality || QualityCode.Good,
      tagName: chunk.tagName
    };
  }
  async getMultipleTimeSeriesData(
    tagNames: string[],
    timeRange: TimeRange,
    options?: HistorianQueryOptions,
    operationId?: string
  ): Promise<Record<string, TimeSeriesData[]>> {
    try {
      dbLogger.info('Retrieving multiple time-series data', { tagNames, timeRange });

      // Validate inputs
      this.validateTimeRange(timeRange);
      if (tagNames.length === 0) {
        throw createError('At least one tag name is required', 400);
      }

      if (operationId) {
        progressTracker.updateProgress(operationId, 'preparation', 5, `Preparing to query ${tagNames.length} tags`);
      }

      // Execute queries with progress tracking
      const promises = tagNames.map((tagName, index) =>
        this.getTimeSeriesData(tagName, timeRange, options)
          .then(data => {
            if (operationId) {
              const progress = 10 + ((index + 1) / tagNames.length) * 80;
              progressTracker.updateProgress(
                operationId,
                'querying',
                progress,
                `Completed ${index + 1}/${tagNames.length} tags`
              );
            }
            return { tagName, data };
          })
          .catch(error => ({ tagName, error }))
      );

      const results = await Promise.all(promises);

      if (operationId) {
        progressTracker.updateProgress(operationId, 'processing', 95, 'Finalizing results');
      }

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

      if (operationId) {
        const successCount = Object.keys(successfulResults).length;
        progressTracker.completeOperation(
          operationId,
          `Retrieved data for ${successCount}/${tagNames.length} tags`
        );
      }

      return successfulResults;

    } catch (error) {
      if (operationId) {
        progressTracker.failOperation(operationId, error instanceof Error ? error.message : 'Unknown error');
      }
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

      // Use the standard AVEVA Historian Tag view joined with AnalogTag and EngineeringUnit
      // to get comprehensive metadata including units and ranges.
      let query = `
        SELECT 
          t.TagName as name,
          t.Description as description,
          eu.Unit as units,
          CASE 
            WHEN t.TagType = 1 THEN 'analog'
            WHEN t.TagType = 2 THEN 'discrete'
            WHEN t.TagType = 3 THEN 'string'
            ELSE 'unknown'
          END as dataType,
          t.DateCreated as lastUpdate,
          at.MinEU as minValue,
          at.MaxEU as maxValue
        FROM Tag t
        LEFT JOIN AnalogTag at ON t.TagName = at.TagName
        LEFT JOIN EngineeringUnit eu ON at.EUKey = eu.EUKey
        WHERE 1=1
      `;

      const params: Record<string, any> = {};

      if (filter) {
        dbLogger.debug(`Applying tag filter: ${filter}`);
        // Use UPPER for case-insensitive search regardless of collation
        // and COALESCE to safely handle NULL descriptions
        query += ` AND (UPPER(t.TagName) LIKE UPPER(@filter) OR UPPER(COALESCE(t.Description, '')) LIKE UPPER(@filter))`;
        params.filter = `%${filter}%`;
      }

      query += ` ORDER BY t.TagName`;

      const result = await this.getConnection().executeQuery<any>(query, params);

      // Transform to TagInfo format
      const tagInfos: TagInfo[] = result.recordset.map(row => ({
        name: row.name,
        description: row.description || '',
        units: row.units || '',
        dataType: row.dataType,
        lastUpdate: new Date(row.lastUpdate),
        minValue: row.minValue,
        maxValue: row.maxValue
      }));

      // Cache the result if caching is enabled
      if (this.cacheService && tagInfos.length > 0) {
        if (filter) {
          await this.cacheService.cacheFilteredTags(filter, tagInfos);
        } else {
          await this.cacheService.cacheTagList(tagInfos);
        }
      }

      dbLogger.info(`Retrieved ${tagInfos.length} tags`);
      return tagInfos;

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
   * Build time-series query based on retrieval mode (legacy fallback)
   */
  private buildTimeSeriesQuery(
    tagName: string,
    timeRange: TimeRange,
    options?: HistorianQueryOptions
  ): string {
    return this.buildOptimizedTimeSeriesQuery(tagName, timeRange, options);
  }

  /**
   * Format date for AVEVA Historian in UTC
   */
  private formatDateForHistorian(date: Date): string {
    // AVEVA Historian expects date format: 'YYYY-MM-DD HH:mm:ss'
    // We use UTC methods to ensure consistency regardless of process timezone
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Build query parameters
   */
  private buildQueryParams(
    tagName: string,
    timeRange: TimeRange,
    options?: HistorianQueryOptions
  ): Record<string, any> {
    const mode = options?.mode || RetrievalMode.Cyclic;
    const params: Record<string, any> = {
      tagName,
      startTime: this.formatDateForHistorian(timeRange.startTime),
      endTime: this.formatDateForHistorian(timeRange.endTime),
      mode: mode
    };

    // Calculate or use provided resolution
    if (options?.resolution) {
      params.resolution = options.resolution;
    } else if (options?.interval) {
      params.resolution = options.interval * 1000; // Convert seconds to milliseconds
    } else if (mode === RetrievalMode.Cyclic || mode === RetrievalMode.Average) {
      // Default resolution: Calculate based on time range to get roughly 100 points if not specified
      const durationMs = timeRange.endTime.getTime() - timeRange.startTime.getTime();
      const defaultPoints = options?.maxPoints || 100;
      params.resolution = Math.max(1000, Math.floor(durationMs / defaultPoints)); // At least 1 second
    }

    if (options?.maxPoints) {
      params.maxPoints = options.maxPoints;
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
        DateTime as timestamp,
        Value as value,
        Quality as quality,
        TagName as tagName
      FROM History
      WHERE DateTime >= @startTime
        AND DateTime <= @endTime
        AND wwRetrievalMode = 'Delta'
        AND wwTimeZone = 'UTC'
    `;

    if (filter.samplingInterval) {
      query += ` AND wwResolution = @resolution`;
    }

    // Add tag name filter
    if (filter.tagNames && filter.tagNames.length > 0) {
      const tagPlaceholders = filter.tagNames.map((_, index) => `@tag${index}`).join(',');
      query += ` AND TagName IN (${tagPlaceholders})`;
    }

    // Add quality filter
    if (filter.qualityFilter && filter.qualityFilter.length > 0) {
      const qualityPlaceholders = filter.qualityFilter.map((_, index) => `@quality${index}`).join(',');
      query += ` AND Quality IN (${qualityPlaceholders})`;
    }

    // Add value range filter
    if (filter.valueRange) {
      if (filter.valueRange.min !== undefined) {
        query += ` AND Value >= @minValue`;
      }
      if (filter.valueRange.max !== undefined) {
        query += ` AND Value <= @maxValue`;
      }
    }

    // Add cursor for pagination
    if (cursor) {
      query += ` AND DateTime > @cursorTime`;
    }

    query += ` ORDER BY DateTime, TagName`;

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
      startTime: this.formatDateForHistorian(timeRange.startTime),
      endTime: this.formatDateForHistorian(timeRange.endTime),
      mode: filter.samplingInterval ? RetrievalMode.Cyclic : RetrievalMode.Full
    };

    if (filter.samplingInterval) {
      params.resolution = filter.samplingInterval;
    }

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
      FROM History
      WHERE DateTime >= @startTime
        AND DateTime <= @endTime
        AND wwTimeZone = 'UTC'
    `;

    // Add same filters as main query (without cursor)
    if (filter.tagNames && filter.tagNames.length > 0) {
      const tagPlaceholders = filter.tagNames.map((_, index) => `@tag${index}`).join(',');
      query += ` AND TagName IN (${tagPlaceholders})`;
    }

    if (filter.qualityFilter && filter.qualityFilter.length > 0) {
      const qualityPlaceholders = filter.qualityFilter.map((_, index) => `@quality${index}`).join(',');
      query += ` AND Quality IN (${qualityPlaceholders})`;
    }

    if (filter.valueRange) {
      if (filter.valueRange.min !== undefined) {
        query += ` AND Value >= @minValue`;
      }
      if (filter.valueRange.max !== undefined) {
        query += ` AND Value <= @maxValue`;
      }
    }

    return query;
  }

  /**
   * Transform raw database row to TimeSeriesData
   */
  private transformToTimeSeriesData(row: any, tagName?: string): TimeSeriesData {
    // Handle null values - convert to NaN to indicate missing data
    const value = row.value !== null && row.value !== undefined ? parseFloat(row.value) : NaN;

    return {
      timestamp: new Date(row.timestamp),
      value: value,
      quality: row.quality || QualityCode.Good,
      tagName: tagName || row.tagName
    };
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