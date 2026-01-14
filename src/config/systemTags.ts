/**
 * System Tag Configuration for AVEVA Historian Status Monitoring
 * 
 * This configuration defines all system tags that are monitored by the
 * Database Status feature, organized by category.
 */

import { SystemTagConfig, StatusCategory } from '@/types/systemStatus';

/**
 * Error Count Tags Configuration
 * Storage rate: 1 minute (60000 ms)
 * All error counts are cumulative since last restart
 */
export const ERROR_COUNT_TAGS: SystemTagConfig = {
  category: StatusCategory.Errors,
  tags: [
    {
      tagName: 'SysCritErrCnt',
      description: 'Number of critical errors',
      dataType: 'analog',
      category: StatusCategory.Errors,
      units: 'count',
      thresholds: {
        warning: 0  // Any value > 0 is a warning
      }
    },
    {
      tagName: 'SysFatalErrCnt',
      description: 'Number of fatal errors',
      dataType: 'analog',
      category: StatusCategory.Errors,
      units: 'count',
      thresholds: {
        warning: 0
      }
    },
    {
      tagName: 'SysErrErrCnt',
      description: 'Number of non-fatal errors',
      dataType: 'analog',
      category: StatusCategory.Errors,
      units: 'count',
      thresholds: {
        warning: 0
      }
    },
    {
      tagName: 'SysWarnErrCnt',
      description: 'Number of warnings',
      dataType: 'analog',
      category: StatusCategory.Errors,
      units: 'count',
      thresholds: {
        warning: 0
      }
    }
  ]
};

/**
 * Service Status Tags Configuration
 * Discrete tags: 0 = Bad, 1 = Good
 */
export const SERVICE_STATUS_TAGS: SystemTagConfig = {
  category: StatusCategory.Services,
  tags: [
    {
      tagName: 'SysStorage',
      description: 'Status of the storage process (aahStorage.exe)',
      dataType: 'discrete',
      category: StatusCategory.Services,
      interpretation: {
        0: 'Bad',
        1: 'Good'
      }
    },
    {
      tagName: 'SysRetrieval',
      description: 'Status of the retrieval service (aahRetSvc.exe)',
      dataType: 'discrete',
      category: StatusCategory.Services,
      interpretation: {
        0: 'Bad',
        1: 'Good'
      }
    },
    {
      tagName: 'SysIndexing',
      description: 'Status of the indexing service (aahIndexSvc.exe)',
      dataType: 'discrete',
      category: StatusCategory.Services,
      interpretation: {
        0: 'Bad',
        1: 'Good'
      }
    },
    {
      tagName: 'SysConfiguration',
      description: 'Status of the configuration service (aahCfgSvc.exe)',
      dataType: 'discrete',
      category: StatusCategory.Services,
      interpretation: {
        0: 'Bad',
        1: 'Good'
      }
    },
    {
      tagName: 'SysReplication',
      description: 'Status of Replication service (aahReplSvc.exe)',
      dataType: 'discrete',
      category: StatusCategory.Services,
      interpretation: {
        0: 'Bad',
        1: 'Good'
      }
    },
    {
      tagName: 'SysEventStorage',
      description: 'Status of the event storage service (aahEventStorage.exe)',
      dataType: 'discrete',
      category: StatusCategory.Services,
      interpretation: {
        0: 'Bad',
        1: 'Good'
      }
    },
    {
      tagName: 'SysStatusMode',
      description: 'Operational state of the Historian',
      dataType: 'analog',
      category: StatusCategory.Services,
      interpretation: {
        0: 'Read-only',
        1: 'Read-write'
      }
    }
  ]
};

/**
 * Storage Space Tags Configuration
 * Storage rate: 5 minutes (300000 ms)
 * Space measured in MB
 */
export const STORAGE_SPACE_TAGS: SystemTagConfig = {
  category: StatusCategory.Storage,
  tags: [
    {
      tagName: 'SysSpaceMain',
      description: 'Space left in the circular storage path',
      dataType: 'analog',
      category: StatusCategory.Storage,
      units: 'MB',
      thresholds: {
        warning: 1000,   // Warning when < 1000 MB
        critical: 500    // Critical when < 500 MB
      }
    },
    {
      tagName: 'SysSpacePerm',
      description: 'Space left in the permanent storage path',
      dataType: 'analog',
      category: StatusCategory.Storage,
      units: 'MB',
      thresholds: {
        warning: 1000,
        critical: 500
      }
    },
    {
      tagName: 'SysSpaceBuffer',
      description: 'Space left in the buffer storage path',
      dataType: 'analog',
      category: StatusCategory.Storage,
      units: 'MB',
      thresholds: {
        warning: 1000,
        critical: 500
      }
    },
    {
      tagName: 'SysSpaceAlt',
      description: 'Space left in the alternate storage path',
      dataType: 'analog',
      category: StatusCategory.Storage,
      units: 'MB',
      thresholds: {
        warning: 1000,
        critical: 500
      }
    }
  ]
};

/**
 * I/O Statistics Tags Configuration
 * Various storage rates (see individual tags)
 */
export const IO_STATISTICS_TAGS: SystemTagConfig = {
  category: StatusCategory.IO,
  tags: [
    {
      tagName: 'SysDataAcqOverallItemsPerSec',
      description: 'Number of items received from all data sources per second',
      dataType: 'analog',
      category: StatusCategory.IO,
      units: 'items/sec'
    },
    {
      tagName: 'SysStatusRxTotalItems',
      description: 'Total number of tag updates received since last startup',
      dataType: 'analog',
      category: StatusCategory.IO,
      units: 'count'
    },
    {
      tagName: 'SysDataAcq0BadValues',
      description: 'Number of data values with bad quality received (MDAS)',
      dataType: 'analog',
      category: StatusCategory.IO,
      units: 'count',
      thresholds: {
        warning: 100  // Warning when > 100 bad values
      }
    },
    {
      tagName: 'SysStatusTopicsRxData',
      description: 'Total number of topics receiving data',
      dataType: 'analog',
      category: StatusCategory.IO,
      units: 'count'
    }
  ]
};

/**
 * Performance Metrics Tags Configuration
 * Storage rate: 5 seconds (cyclic)
 */
export const PERFORMANCE_METRICS_TAGS: SystemTagConfig = {
  category: StatusCategory.Performance,
  tags: [
    {
      tagName: 'SysPerfCPUTotal',
      description: 'Overall processor load as percentage of all cores',
      dataType: 'analog',
      category: StatusCategory.Performance,
      units: '%',
      thresholds: {
        warning: 80  // Warning when > 80%
      }
    },
    {
      tagName: 'SysPerfCPUMax',
      description: 'Highest CPU load of any single core',
      dataType: 'analog',
      category: StatusCategory.Performance,
      units: '%',
      thresholds: {
        warning: 80
      }
    },
    {
      tagName: 'SysPerfAvailableMBytes',
      description: 'Amount of free memory (RAM)',
      dataType: 'analog',
      category: StatusCategory.Performance,
      units: 'MB',
      thresholds: {
        warning: 500  // Warning when < 500 MB
      }
    },
    {
      tagName: 'SysPerfDiskTime',
      description: 'Percentage of elapsed time disk was busy servicing requests',
      dataType: 'analog',
      category: StatusCategory.Performance,
      units: '%'
    }
  ]
};

/**
 * All system tags configuration
 */
export const ALL_SYSTEM_TAGS: SystemTagConfig[] = [
  ERROR_COUNT_TAGS,
  SERVICE_STATUS_TAGS,
  STORAGE_SPACE_TAGS,
  IO_STATISTICS_TAGS,
  PERFORMANCE_METRICS_TAGS
];

/**
 * Get all system tag names
 */
export function getAllSystemTagNames(): string[] {
  return ALL_SYSTEM_TAGS.flatMap(config => config.tags.map(tag => tag.tagName));
}

/**
 * Get system tags by category
 */
export function getSystemTagsByCategory(category: StatusCategory): SystemTagConfig {
  const config = ALL_SYSTEM_TAGS.find(c => c.category === category);
  if (!config) {
    throw new Error(`Unknown category: ${category}`);
  }
  return config;
}

/**
 * Get system tag definition by name
 */
export function getSystemTagDefinition(tagName: string) {
  for (const config of ALL_SYSTEM_TAGS) {
    const tag = config.tags.find(t => t.tagName === tagName);
    if (tag) {
      return tag;
    }
  }
  return undefined;
}

/**
 * Check if a tag name is a system tag
 */
export function isSystemTag(tagName: string): boolean {
  return getAllSystemTagNames().includes(tagName);
}
