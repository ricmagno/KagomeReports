/**
 * Cache Service
 * Implements Redis caching for frequently accessed data with TTL and invalidation strategies
 * Requirements: 10.5
 */

import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';
import { TimeSeriesData, TagInfo, StatisticsResult, TrendResult, HistorianQueryOptions } from '../types/historian';

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix: string;
  defaultTTL: number; // seconds
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class CacheService {
  private client: RedisClientType;
  private config: CacheConfig;
  private isConnected: boolean = false;
  private cacheLogger = logger.child({ service: 'CacheService' });

  // Cache TTL configurations (in seconds)
  private readonly TTL_CONFIG = {
    tags: 300, // 5 minutes - tag lists change infrequently
    timeSeriesData: 60, // 1 minute - time-series data for recent queries
    statistics: 180, // 3 minutes - statistical calculations
    trends: 300, // 5 minutes - trend analysis results
    reports: 1800, // 30 minutes - generated report metadata
    queries: 120, // 2 minutes - database query results
  };

  constructor(config: CacheConfig) {
    this.config = config;
    const clientConfig: any = {
      socket: {
        host: config.host,
        port: config.port,
        connectTimeout: 5000, // 5 second timeout
        lazyConnect: true, // Don't connect immediately
      },
      database: config.db || 0,
    };

    if (config.password) {
      clientConfig.password = config.password;
    }

    this.client = createClient(clientConfig);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.cacheLogger.info('Redis client connecting...');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      this.cacheLogger.info('Redis client connected and ready');
    });

    this.client.on('error', (error) => {
      this.isConnected = false;
      this.cacheLogger.error('Redis client error:', error);
    });

    this.client.on('end', () => {
      this.isConnected = false;
      this.cacheLogger.info('Redis client connection ended');
    });
  }

  async connect(): Promise<void> {
    try {
      if (!this.isConnected) {
        // Set a timeout for the connection attempt
        const connectPromise = this.client.connect();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Redis connection timeout')), 5000);
        });

        await Promise.race([connectPromise, timeoutPromise]);
        this.cacheLogger.info('Cache service connected to Redis');
      }
    } catch (error) {
      this.cacheLogger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.quit();
        this.cacheLogger.info('Cache service disconnected from Redis');
      }
    } catch (error) {
      this.cacheLogger.error('Error disconnecting from Redis:', error);
    }
  }

  private generateKey(type: string, identifier: string, options?: any): string {
    let key = `${this.config.keyPrefix}:${type}:${identifier}`;
    if (options) {
      const optionsHash = typeof options === 'string' ? options : JSON.stringify(options);
      key += `:opt:${Buffer.from(optionsHash).toString('hex').slice(0, 16)}`;
    }
    return key;
  }

  private async setWithTTL<T>(key: string, data: T, ttl: number): Promise<void> {
    if (!this.isConnected) {
      this.cacheLogger.warn('Cache not connected, skipping set operation');
      return;
    }

    try {
      const cacheEntry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      };

      await this.client.setEx(key, ttl, JSON.stringify(cacheEntry));
      this.cacheLogger.debug(`Cached data with key: ${key}, TTL: ${ttl}s`);
    } catch (error) {
      this.cacheLogger.error(`Failed to cache data with key ${key}:`, error);
    }
  }

  private async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      this.cacheLogger.warn('Cache not connected, skipping get operation');
      return null;
    }

    try {
      const cached = await this.client.get(key);
      if (!cached) {
        return null;
      }

      const cacheEntry: CacheEntry<T> = JSON.parse(cached);

      // Check if cache entry is still valid
      const age = Date.now() - cacheEntry.timestamp;
      if (age > cacheEntry.ttl * 1000) {
        // Entry expired, remove it
        await this.client.del(key);
        return null;
      }

      this.cacheLogger.debug(`Cache hit for key: ${key}`);
      return cacheEntry.data;
    } catch (error) {
      this.cacheLogger.error(`Failed to get cached data with key ${key}:`, error);
      return null;
    }
  }

  // Tag caching methods
  async cacheTagList(tags: TagInfo[]): Promise<void> {
    const key = this.generateKey('tags', 'all');
    await this.setWithTTL(key, tags, this.TTL_CONFIG.tags);
  }

  async getCachedTagList(): Promise<TagInfo[] | null> {
    const key = this.generateKey('tags', 'all');
    return this.get<TagInfo[]>(key);
  }

  async cacheFilteredTags(filter: string, tags: TagInfo[]): Promise<void> {
    const key = this.generateKey('tags', `filter:${filter}`);
    await this.setWithTTL(key, tags, this.TTL_CONFIG.tags);
  }

  async getCachedFilteredTags(filter: string): Promise<TagInfo[] | null> {
    const key = this.generateKey('tags', `filter:${filter}`);
    return this.get<TagInfo[]>(key);
  }

  // Time-series data caching methods
  async cacheTimeSeriesData(
    tagName: string,
    startTime: Date,
    endTime: Date,
    data: TimeSeriesData[],
    options?: HistorianQueryOptions
  ): Promise<void> {
    const timeKey = `${startTime.getTime()}-${endTime.getTime()}`;
    const key = this.generateKey('timeseries', `${tagName}:${timeKey}`, options);
    await this.setWithTTL(key, data, this.TTL_CONFIG.timeSeriesData);
  }

  async getCachedTimeSeriesData(
    tagName: string,
    startTime: Date,
    endTime: Date,
    options?: HistorianQueryOptions
  ): Promise<TimeSeriesData[] | null> {
    const timeKey = `${startTime.getTime()}-${endTime.getTime()}`;
    const key = this.generateKey('timeseries', `${tagName}:${timeKey}`, options);
    return this.get<TimeSeriesData[]>(key);
  }

  // Statistics caching methods
  async cacheStatistics(
    tagName: string,
    startTime: Date,
    endTime: Date,
    stats: StatisticsResult
  ): Promise<void> {
    const timeKey = `${startTime.getTime()}-${endTime.getTime()}`;
    const key = this.generateKey('statistics', `${tagName}:${timeKey}`);
    await this.setWithTTL(key, stats, this.TTL_CONFIG.statistics);
  }

  async getCachedStatistics(
    tagName: string,
    startTime: Date,
    endTime: Date
  ): Promise<StatisticsResult | null> {
    const timeKey = `${startTime.getTime()}-${endTime.getTime()}`;
    const key = this.generateKey('statistics', `${tagName}:${timeKey}`);
    return this.get<StatisticsResult>(key);
  }

  // Trend analysis caching methods
  async cacheTrendAnalysis(
    tagName: string,
    startTime: Date,
    endTime: Date,
    trend: TrendResult
  ): Promise<void> {
    const timeKey = `${startTime.getTime()}-${endTime.getTime()}`;
    const key = this.generateKey('trends', `${tagName}:${timeKey}`);
    await this.setWithTTL(key, trend, this.TTL_CONFIG.trends);
  }

  async getCachedTrendAnalysis(
    tagName: string,
    startTime: Date,
    endTime: Date
  ): Promise<TrendResult | null> {
    const timeKey = `${startTime.getTime()}-${endTime.getTime()}`;
    const key = this.generateKey('trends', `${tagName}:${timeKey}`);
    return this.get<TrendResult>(key);
  }

  // Query result caching methods
  async cacheQueryResult(queryHash: string, result: any): Promise<void> {
    const key = this.generateKey('queries', queryHash);
    await this.setWithTTL(key, result, this.TTL_CONFIG.queries);
  }

  async getCachedQueryResult(queryHash: string): Promise<any | null> {
    const key = this.generateKey('queries', queryHash);
    return this.get<any>(key);
  }

  // Report metadata caching methods
  async cacheReportMetadata(reportId: string, metadata: any): Promise<void> {
    const key = this.generateKey('reports', reportId);
    await this.setWithTTL(key, metadata, this.TTL_CONFIG.reports);
  }

  async getCachedReportMetadata(reportId: string): Promise<any | null> {
    const key = this.generateKey('reports', reportId);
    return this.get<any>(key);
  }

  // Cache invalidation methods
  async invalidateTagCache(): Promise<void> {
    if (!this.isConnected) return;

    try {
      const pattern = this.generateKey('tags', '*');
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        this.cacheLogger.info(`Invalidated ${keys.length} tag cache entries`);
      }
    } catch (error) {
      this.cacheLogger.error('Failed to invalidate tag cache:', error);
    }
  }

  async invalidateTimeSeriesCache(tagName?: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      const pattern = tagName
        ? this.generateKey('timeseries', `${tagName}:*`)
        : this.generateKey('timeseries', '*');

      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        this.cacheLogger.info(`Invalidated ${keys.length} time-series cache entries`);
      }
    } catch (error) {
      this.cacheLogger.error('Failed to invalidate time-series cache:', error);
    }
  }

  async invalidateStatisticsCache(tagName?: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      const pattern = tagName
        ? this.generateKey('statistics', `${tagName}:*`)
        : this.generateKey('statistics', '*');

      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        this.cacheLogger.info(`Invalidated ${keys.length} statistics cache entries`);
      }
    } catch (error) {
      this.cacheLogger.error('Failed to invalidate statistics cache:', error);
    }
  }

  async invalidateAllCache(): Promise<void> {
    if (!this.isConnected) return;

    try {
      const pattern = `${this.config.keyPrefix}:*`;
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        this.cacheLogger.info(`Invalidated all cache entries (${keys.length} keys)`);
      }
    } catch (error) {
      this.cacheLogger.error('Failed to invalidate all cache:', error);
    }
  }

  // Cache statistics and monitoring
  async getCacheStats(): Promise<{
    connected: boolean;
    totalKeys: number;
    memoryUsage: string;
    hitRate?: number;
  }> {
    if (!this.isConnected) {
      return {
        connected: false,
        totalKeys: 0,
        memoryUsage: '0B',
      };
    }

    try {
      const info = await this.client.info('memory');
      const keyCount = await this.client.dbSize();

      // Extract memory usage from Redis info
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memoryUsage = memoryMatch?.[1]?.trim() || '0B';

      return {
        connected: true,
        totalKeys: keyCount,
        memoryUsage,
      };
    } catch (error) {
      this.cacheLogger.error('Failed to get cache stats:', error);
      return {
        connected: false,
        totalKeys: 0,
        memoryUsage: '0B',
      };
    }
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      this.cacheLogger.error('Cache health check failed:', error);
      return false;
    }
  }
}

// Create and export cache service instance
export const createCacheService = (config: CacheConfig): CacheService => {
  return new CacheService(config);
};