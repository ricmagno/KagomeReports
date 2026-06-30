/**
 * Cache Manager Service
 * Coordinates cache initialization, health monitoring, and service integration
 * Requirements: 10.5
 */

import { CacheService, createCacheService, CacheConfig } from './cacheService';
import { dataRetrievalService } from './dataRetrieval';
import { statisticalAnalysisService } from './statisticalAnalysis';
import { env } from '../config/environment';
import { logger } from '../utils/logger';
import { opcuaService, OpcuaService } from './opcuaService';
import { opcuaConfigService, OpcuaConfigService } from './opcuaConfigService';

export class CacheManager {
  private cacheService?: CacheService;
  private opcuaService: OpcuaService = opcuaService;
  private opcuaConfigService: OpcuaConfigService = opcuaConfigService;
  private cacheLogger = logger.child({ service: 'CacheManager' });
  private isInitialized = false;

  constructor() {
    // Initialize cache service only if explicitly enabled
    if (env.CACHE_ENABLED) {
      this.cacheLogger.info('Cache is enabled, initializing Redis connection');
      this.initializeCacheService();
    } else {
      this.cacheLogger.info('Caching is disabled - running without Redis');
    }
  }

  private initializeCacheService(): void {
    try {
      const cacheConfig: CacheConfig = {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        db: env.REDIS_DB,
        keyPrefix: env.CACHE_KEY_PREFIX,
        defaultTTL: env.CACHE_DEFAULT_TTL,
      };

      // Only add password if it exists
      if (env.REDIS_PASSWORD) {
        cacheConfig.password = env.REDIS_PASSWORD;
      }

      this.cacheService = createCacheService(cacheConfig);
      this.cacheLogger.info('Cache service initialized', { config: cacheConfig });
    } catch (error) {
      this.cacheLogger.error('Failed to initialize cache service:', error);
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Connect to cache if enabled (non-blocking)
      if (this.cacheService) {
        try {
          await this.cacheService.connect();
          this.cacheLogger.info('Cache service connected');
        } catch (error) {
          this.cacheLogger.warn('Cache connection failed, continuing without cache:', error);
        }
      }

      // Inject cache into existing module singletons so all route imports benefit
      if (this.cacheService) {
        dataRetrievalService.setCacheService(this.cacheService);
        statisticalAnalysisService.setCacheService(this.cacheService);
      }

      this.isInitialized = true;
      this.cacheLogger.info('Cache manager initialized successfully');
    } catch (error) {
      this.cacheLogger.error('Failed to initialize cache manager:', error);
      this.isInitialized = true;
    }
  }

  async shutdown(): Promise<void> {
    try {
      if (this.cacheService) {
        await this.cacheService.disconnect();
        this.cacheLogger.info('Cache service disconnected');
      }
      this.isInitialized = false;
    } catch (error) {
      this.cacheLogger.error('Error during cache manager shutdown:', error);
    }
  }

  // Service getters
  getDataRetrievalService() {
    return dataRetrievalService;
  }

  getStatisticalAnalysisService() {
    return statisticalAnalysisService;
  }

  getCacheService(): CacheService | undefined {
    return this.cacheService;
  }

  getOpcuaService(): OpcuaService {
    return this.opcuaService;
  }

  getOpcuaConfigService(): OpcuaConfigService {
    return this.opcuaConfigService;
  }

  // Cache management methods
  async invalidateAllCache(): Promise<void> {
    if (this.cacheService) {
      await this.cacheService.invalidateAllCache();
      this.cacheLogger.info('All cache invalidated');
    }
  }

  async invalidateTagCache(): Promise<void> {
    if (this.cacheService) {
      await this.cacheService.invalidateTagCache();
      this.cacheLogger.info('Tag cache invalidated');
    }
  }

  async invalidateTimeSeriesCache(tagName?: string): Promise<void> {
    if (this.cacheService) {
      await this.cacheService.invalidateTimeSeriesCache(tagName);
      this.cacheLogger.info(`Time-series cache invalidated${tagName ? ` for tag: ${tagName}` : ''}`);
    }
  }

  async invalidateStatisticsCache(tagName?: string): Promise<void> {
    if (this.cacheService) {
      await this.cacheService.invalidateStatisticsCache(tagName);
      this.cacheLogger.info(`Statistics cache invalidated${tagName ? ` for tag: ${tagName}` : ''}`);
    }
  }

  // Health and monitoring
  async getCacheStats(): Promise<{
    enabled: boolean;
    connected: boolean;
    totalKeys: number;
    memoryUsage: string;
    hitRate?: number;
  }> {
    if (!this.cacheService) {
      return {
        enabled: false,
        connected: false,
        totalKeys: 0,
        memoryUsage: '0B',
      };
    }

    const stats = await this.cacheService.getCacheStats();
    return {
      enabled: true,
      ...stats,
    };
  }

  async healthCheck(): Promise<{
    cacheEnabled: boolean;
    cacheHealthy: boolean;
    servicesInitialized: boolean;
  }> {
    const cacheHealthy = this.cacheService ? await this.cacheService.healthCheck() : true;

    return {
      cacheEnabled: !!this.cacheService,
      cacheHealthy,
      servicesInitialized: this.isInitialized,
    };
  }

  // Cache warming methods
  async warmCache(): Promise<void> {
    if (!this.cacheService) {
      this.cacheLogger.warn('Cache warming skipped - cache not available');
      return;
    }

    try {
      this.cacheLogger.info('Starting cache warming...');

      // Warm tag list cache
      await dataRetrievalService.getTagList();
      this.cacheLogger.debug('Tag list cache warmed');

      // You can add more cache warming logic here for frequently accessed data

      this.cacheLogger.info('Cache warming completed');
    } catch (error) {
      this.cacheLogger.error('Cache warming failed:', error);
    }
  }

  // Cache metrics for monitoring
  async getCacheMetrics(): Promise<{
    enabled: boolean;
    connected: boolean;
    stats: any;
    health: boolean;
  }> {
    const health = await this.healthCheck();
    const stats = await this.getCacheStats();

    return {
      enabled: health.cacheEnabled,
      connected: health.cacheHealthy,
      stats,
      health: health.cacheHealthy && health.servicesInitialized,
    };
  }
}

// Create and export singleton instance
export const cacheManager = new CacheManager();