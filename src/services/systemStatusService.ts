/**
 * System Status Service for AVEVA Historian
 * Handles retrieval and processing of system tag data for status monitoring
 * 
 * Query Optimization Strategy:
 * 1. Batch Queries: All system tags are queried in a single batch operation
 *    to minimize database round trips
 * 2. Latest Value Only: Uses wwCycleCount=1 (maxPoints: 1) to retrieve only
 *    the most recent value, avoiding unnecessary data transfer
 * 3. Cyclic Mode: Uses Cyclic retrieval mode which is optimized for
 *    time-based sampling in AVEVA Historian
 * 4. Short Time Window: Queries only the last minute of data to ensure
 *    we get the latest value without scanning large time ranges
 * 5. Connection Pooling: Leverages existing connection pool from
 *    DataRetrievalService for efficient database connections
 */

import { DataRetrievalService } from './dataRetrieval';
import { CacheService } from './cacheService';
import { dbLogger } from '@/utils/logger';
import { createError } from '@/middleware/errorHandler';
import {
  SystemStatusData,
  SystemTagValue,
  StatusCategory,
  ErrorCountData,
  ServiceStatusData,
  StorageSpaceData,
  IOStatisticsData,
  PerformanceMetricsData
} from '@/types/systemStatus';
import {
  ALL_SYSTEM_TAGS,
  getSystemTagsByCategory,
  getAllSystemTagNames,
  getSystemTagDefinition
} from '@/config/systemTags';
import { TimeRange, QualityCode, RetrievalMode } from '@/types/historian';

export class SystemStatusService {
  private dataRetrievalService: DataRetrievalService;
  private cacheService: CacheService | undefined;
  private readonly CACHE_TTL = 10; // 10 seconds cache TTL
  private readonly QUERY_TIMEOUT = 30000; // 30 seconds timeout for queries

  constructor(dataRetrievalService?: DataRetrievalService, cacheService?: CacheService) {
    this.dataRetrievalService = dataRetrievalService || new DataRetrievalService(cacheService);
    this.cacheService = cacheService;
  }

  /**
   * Get current values for all monitored system tags
   * Optimized with batch queries and latest value retrieval
   * @returns Complete system status data organized by category
   */
  async getSystemTagValues(): Promise<SystemStatusData> {
    try {
      dbLogger.info('Retrieving all system tag values');

      // Note: Caching will be added in future enhancement
      // For now, always fetch fresh data

      // Get all system tag names
      const tagNames = getAllSystemTagNames();
      
      // Query all system tags with latest value using optimized settings
      // Use Cyclic mode with wwCycleCount=1 to get only the most recent value
      // This is much more efficient than retrieving full history
      const timeRange: TimeRange = {
        startTime: new Date(Date.now() - 60000), // Last minute window
        endTime: new Date()
      };

      const queryOptions = {
        mode: RetrievalMode.Cyclic,
        maxPoints: 1, // wwCycleCount=1 - Get only the latest value
        includeQuality: true
      };

      // Batch query all tags in a single operation for efficiency
      // This reduces round trips to the database
      dbLogger.debug(`Batch querying ${tagNames.length} system tags`);
      const tagDataMap = await this.dataRetrievalService.getMultipleTimeSeriesData(
        tagNames,
        timeRange,
        queryOptions
      );

      // Transform to SystemTagValue format
      const systemTagValues: SystemTagValue[] = [];
      
      for (const tagName of tagNames) {
        const tagData = tagDataMap[tagName];
        const tagDefinition = getSystemTagDefinition(tagName);
        
        if (!tagDefinition) {
          dbLogger.warn(`Tag definition not found for: ${tagName}`);
          continue;
        }

        // Get the latest value (should be only one due to maxPoints: 1)
        const latestValue = tagData && tagData.length > 0 ? tagData[tagData.length - 1] : null;

        systemTagValues.push({
          tagName,
          value: latestValue?.value ?? null,
          quality: latestValue?.quality ?? QualityCode.Bad,
          timestamp: latestValue?.timestamp ?? new Date(),
          category: tagDefinition.category
        });
      }

      // Organize by category
      const statusData = this.organizeByCategory(systemTagValues);

      // Note: Caching will be added in future enhancement

      dbLogger.info(`Retrieved ${systemTagValues.length} system tag values`);
      return statusData;

    } catch (error) {
      dbLogger.error('Failed to retrieve system tag values:', error);
      throw createError('Failed to retrieve system status data', 500);
    }
  }

  /**
   * Get system tags filtered by category
   * Optimized with batch queries for category-specific tags
   * @param category - Category filter
   * @returns Filtered system tag values
   */
  async getSystemTagsByCategory(category: StatusCategory): Promise<SystemTagValue[]> {
    try {
      dbLogger.info('Retrieving system tags by category', { category });

      // Validate category
      if (!Object.values(StatusCategory).includes(category)) {
        throw createError(`Invalid category: ${category}`, 400);
      }

      // Note: Caching will be added in future enhancement

      // Get tags for this category
      const categoryConfig = getSystemTagsByCategory(category);
      const tagNames = categoryConfig.tags.map(tag => tag.tagName);

      // Query tags with optimized settings
      const timeRange: TimeRange = {
        startTime: new Date(Date.now() - 60000), // Last minute window
        endTime: new Date()
      };

      const queryOptions = {
        mode: RetrievalMode.Cyclic,
        maxPoints: 1, // wwCycleCount=1 - Latest value only
        includeQuality: true
      };

      dbLogger.debug(`Batch querying ${tagNames.length} tags for category: ${category}`);
      const tagDataMap = await this.dataRetrievalService.getMultipleTimeSeriesData(
        tagNames,
        timeRange,
        queryOptions
      );

      // Transform to SystemTagValue format
      const systemTagValues: SystemTagValue[] = [];

      for (const tagName of tagNames) {
        const tagData = tagDataMap[tagName];
        const latestValue = tagData && tagData.length > 0 ? tagData[tagData.length - 1] : null;

        systemTagValues.push({
          tagName,
          value: latestValue?.value ?? null,
          quality: latestValue?.quality ?? QualityCode.Bad,
          timestamp: latestValue?.timestamp ?? new Date(),
          category
        });
      }

      // Note: Caching will be added in future enhancement

      dbLogger.info(`Retrieved ${systemTagValues.length} system tags for category: ${category}`);
      return systemTagValues;

    } catch (error) {
      dbLogger.error('Failed to retrieve system tags by category:', { category, error });
      throw error;
    }
  }

  /**
   * Organize system tag values by category into structured data
   * @param tagValues - Array of system tag values
   * @returns Organized system status data
   */
  private organizeByCategory(tagValues: SystemTagValue[]): SystemStatusData {
    const timestamp = new Date();

    // Helper to find tag value
    const findTag = (tagName: string): SystemTagValue => {
      return tagValues.find(tv => tv.tagName === tagName) || {
        tagName,
        value: null,
        quality: QualityCode.Bad,
        timestamp,
        category: StatusCategory.Errors // Default category
      };
    };

    // Error counts
    const errors: ErrorCountData = {
      critical: findTag('SysCritErrCnt'),
      fatal: findTag('SysFatalErrCnt'),
      error: findTag('SysErrErrCnt'),
      warning: findTag('SysWarnErrCnt')
    };

    // Service status
    const services: ServiceStatusData = {
      storage: findTag('SysStorage'),
      retrieval: findTag('SysRetrieval'),
      indexing: findTag('SysIndexing'),
      configuration: findTag('SysConfiguration'),
      replication: findTag('SysReplication'),
      eventStorage: findTag('SysEventStorage'),
      operationalMode: findTag('SysStatusMode')
    };

    // Storage space
    const storage: StorageSpaceData = {
      main: findTag('SysSpaceMain'),
      permanent: findTag('SysSpacePerm'),
      buffer: findTag('SysSpaceBuffer'),
      alternate: findTag('SysSpaceAlt')
    };

    // I/O statistics
    const io: IOStatisticsData = {
      itemsPerSecond: findTag('SysDataAcqOverallItemsPerSec'),
      totalItems: findTag('SysStatusRxTotalItems'),
      badValues: findTag('SysDataAcq0BadValues'),
      activeTopics: findTag('SysStatusTopicsRxData')
    };

    // Performance metrics
    const performance: PerformanceMetricsData = {
      cpuTotal: findTag('SysPerfCPUTotal'),
      cpuMax: findTag('SysPerfCPUMax'),
      availableMemory: findTag('SysPerfAvailableMBytes'),
      diskTime: findTag('SysPerfDiskTime')
    };

    return {
      timestamp,
      errors,
      services,
      storage,
      io,
      performance
    };
  }

  /**
   * Clear cached system status data
   * Note: Caching not yet implemented
   */
  async clearCache(): Promise<void> {
    // Placeholder for future caching implementation
    dbLogger.debug('Cache clearing not yet implemented');
  }

  /**
   * Export current status data in CSV format
   * @returns CSV formatted string with all system tag data
   */
  async exportStatusDataCSV(): Promise<string> {
    try {
      dbLogger.info('Exporting system status data as CSV');

      const statusData = await this.getSystemTagValues();
      const exportTimestamp = new Date().toISOString();

      // CSV header
      const header = 'Category,Tag Name,Value,Quality,Timestamp,Description\n';

      // Helper to format CSV row
      const formatRow = (category: string, tagName: string, tagValue: SystemTagValue): string => {
        const tagDef = getSystemTagDefinition(tagName);
        const description = tagDef?.description || '';
        const value = tagValue.value !== null ? String(tagValue.value) : 'N/A';
        const quality = tagValue.quality;
        const timestamp = tagValue.timestamp.toISOString();
        
        // Escape values that might contain commas
        const escapeCSV = (val: string) => val.includes(',') ? `"${val}"` : val;
        
        return `${category},${escapeCSV(tagName)},${value},${quality},${timestamp},${escapeCSV(description)}\n`;
      };

      // Build CSV content
      let csv = header;

      // Add metadata as comments
      csv += `# Export Timestamp: ${exportTimestamp}\n`;
      csv += `# Server: AVEVA Historian\n`;
      csv += `# Total Tags: ${getAllSystemTagNames().length}\n`;
      csv += '\n';

      // Error counts
      csv += formatRow('Errors', 'SysCritErrCnt', statusData.errors.critical);
      csv += formatRow('Errors', 'SysFatalErrCnt', statusData.errors.fatal);
      csv += formatRow('Errors', 'SysErrErrCnt', statusData.errors.error);
      csv += formatRow('Errors', 'SysWarnErrCnt', statusData.errors.warning);

      // Services
      csv += formatRow('Services', 'SysStorage', statusData.services.storage);
      csv += formatRow('Services', 'SysRetrieval', statusData.services.retrieval);
      csv += formatRow('Services', 'SysIndexing', statusData.services.indexing);
      csv += formatRow('Services', 'SysConfiguration', statusData.services.configuration);
      csv += formatRow('Services', 'SysReplication', statusData.services.replication);
      csv += formatRow('Services', 'SysEventStorage', statusData.services.eventStorage);
      csv += formatRow('Services', 'SysStatusMode', statusData.services.operationalMode);

      // Storage
      csv += formatRow('Storage', 'SysSpaceMain', statusData.storage.main);
      csv += formatRow('Storage', 'SysSpacePerm', statusData.storage.permanent);
      csv += formatRow('Storage', 'SysSpaceBuffer', statusData.storage.buffer);
      csv += formatRow('Storage', 'SysSpaceAlt', statusData.storage.alternate);

      // I/O
      csv += formatRow('IO', 'SysDataAcqOverallItemsPerSec', statusData.io.itemsPerSecond);
      csv += formatRow('IO', 'SysStatusRxTotalItems', statusData.io.totalItems);
      csv += formatRow('IO', 'SysDataAcq0BadValues', statusData.io.badValues);
      csv += formatRow('IO', 'SysStatusTopicsRxData', statusData.io.activeTopics);

      // Performance
      csv += formatRow('Performance', 'SysPerfCPUTotal', statusData.performance.cpuTotal);
      csv += formatRow('Performance', 'SysPerfCPUMax', statusData.performance.cpuMax);
      csv += formatRow('Performance', 'SysPerfAvailableMBytes', statusData.performance.availableMemory);
      csv += formatRow('Performance', 'SysPerfDiskTime', statusData.performance.diskTime);

      dbLogger.info('Successfully exported system status data as CSV');
      return csv;

    } catch (error) {
      dbLogger.error('Failed to export system status data as CSV:', error);
      throw createError('Failed to export status data as CSV', 500);
    }
  }

  /**
   * Export current status data in JSON format
   * @returns JSON formatted string with all system tag data and metadata
   */
  async exportStatusDataJSON(): Promise<string> {
    try {
      dbLogger.info('Exporting system status data as JSON');

      const statusData = await this.getSystemTagValues();
      const exportTimestamp = new Date().toISOString();

      // Build export object with metadata
      const exportData = {
        metadata: {
          exportTimestamp,
          server: 'AVEVA Historian',
          totalTags: getAllSystemTagNames().length,
          dataTimestamp: statusData.timestamp.toISOString()
        },
        categories: {
          errors: {
            critical: this.formatTagForExport(statusData.errors.critical),
            fatal: this.formatTagForExport(statusData.errors.fatal),
            error: this.formatTagForExport(statusData.errors.error),
            warning: this.formatTagForExport(statusData.errors.warning)
          },
          services: {
            storage: this.formatTagForExport(statusData.services.storage),
            retrieval: this.formatTagForExport(statusData.services.retrieval),
            indexing: this.formatTagForExport(statusData.services.indexing),
            configuration: this.formatTagForExport(statusData.services.configuration),
            replication: this.formatTagForExport(statusData.services.replication),
            eventStorage: this.formatTagForExport(statusData.services.eventStorage),
            operationalMode: this.formatTagForExport(statusData.services.operationalMode)
          },
          storage: {
            main: this.formatTagForExport(statusData.storage.main),
            permanent: this.formatTagForExport(statusData.storage.permanent),
            buffer: this.formatTagForExport(statusData.storage.buffer),
            alternate: this.formatTagForExport(statusData.storage.alternate)
          },
          io: {
            itemsPerSecond: this.formatTagForExport(statusData.io.itemsPerSecond),
            totalItems: this.formatTagForExport(statusData.io.totalItems),
            badValues: this.formatTagForExport(statusData.io.badValues),
            activeTopics: this.formatTagForExport(statusData.io.activeTopics)
          },
          performance: {
            cpuTotal: this.formatTagForExport(statusData.performance.cpuTotal),
            cpuMax: this.formatTagForExport(statusData.performance.cpuMax),
            availableMemory: this.formatTagForExport(statusData.performance.availableMemory),
            diskTime: this.formatTagForExport(statusData.performance.diskTime)
          }
        }
      };

      const json = JSON.stringify(exportData, null, 2);

      dbLogger.info('Successfully exported system status data as JSON');
      return json;

    } catch (error) {
      dbLogger.error('Failed to export system status data as JSON:', error);
      throw createError('Failed to export status data as JSON', 500);
    }
  }

  /**
   * Format a system tag value for export with additional metadata
   * @param tagValue - System tag value to format
   * @returns Formatted tag data for export
   */
  private formatTagForExport(tagValue: SystemTagValue): any {
    const tagDef = getSystemTagDefinition(tagValue.tagName);
    
    return {
      tagName: tagValue.tagName,
      value: tagValue.value,
      quality: tagValue.quality,
      timestamp: tagValue.timestamp.toISOString(),
      description: tagDef?.description || '',
      units: tagDef?.units || null,
      dataType: tagDef?.dataType || 'unknown'
    };
  }
}

// Export singleton instance
export const systemStatusService = new SystemStatusService();
