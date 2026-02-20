/**
 * Frontend Type Definitions for System Status Monitoring
 * Mirrors backend types for type-safe API communication
 */

// Status categories
export enum StatusCategory {
  Errors = 'errors',
  Services = 'services',
  Storage = 'storage',
  IO = 'io',
  Performance = 'performance'
}

// Quality codes from AVEVA Historian
export enum QualityCode {
  Good = 192,
  Bad = 0,
  Uncertain = 64
}

export interface ServerTimeInfo {
  utc: string;
  local: string;
  timezone: string;
  offset: number;
}

// System tag value with metadata
export interface SystemTagValue {
  tagName: string;
  value: number | string | null;
  quality: QualityCode;
  timestamp: string; // ISO string from API
  category: StatusCategory;
}

// Error count data
export interface ErrorCountData {
  critical: SystemTagValue;
  fatal: SystemTagValue;
  error: SystemTagValue;
  warning: SystemTagValue;
}

// Service status data
export interface ServiceStatusData {
  storage: SystemTagValue;
  retrieval: SystemTagValue;
  indexing: SystemTagValue;
  configuration: SystemTagValue;
  replication: SystemTagValue;
  eventStorage: SystemTagValue;
  operationalMode: SystemTagValue;
}

// Storage space data
export interface StorageSpaceData {
  main: SystemTagValue;
  permanent: SystemTagValue;
  buffer: SystemTagValue;
  alternate: SystemTagValue;
}

// I/O statistics data
export interface IOStatisticsData {
  itemsPerSecond: SystemTagValue;
  totalItems: SystemTagValue;
  badValues: SystemTagValue;
  activeTopics: SystemTagValue;
}

// Performance metrics data
export interface PerformanceMetricsData {
  cpuTotal: SystemTagValue;
  cpuMax: SystemTagValue;
  availableMemory: SystemTagValue;
  diskTime: SystemTagValue;
}

// Complete system status response from API
export interface SystemStatusResponse {
  success: boolean;
  data: {
    timestamp: string; // ISO string
    categories: {
      errors: ErrorCountData;
      services: ServiceStatusData;
      storage: StorageSpaceData;
      io: IOStatisticsData;
      performance: PerformanceMetricsData;
    };
  };
  serverTime?: ServerTimeInfo;
}

// Category-filtered response
export interface CategoryStatusResponse {
  success: boolean;
  data: SystemTagValue[];
  category: StatusCategory;
  timestamp: string;
}

// Health check response
export interface HealthCheckResponse {
  success: boolean;
  healthy: boolean;
  status: 'operational' | 'degraded' | 'unavailable';
  downServices?: string[];
  error?: string;
  timestamp: string;
  serverTime?: ServerTimeInfo;
}

// Query parameters for status API
export interface StatusQueryParams {
  category?: StatusCategory;
  refresh?: boolean;
}

// Trend time ranges
export type TrendTimeRange = 'hour' | '24hours' | '7days';

// Trend query parameters
export interface TrendsQueryParams {
  tags: string[];
  timeRange: TrendTimeRange;
}

// Export formats
export type ExportFormat = 'csv' | 'json';

// Export query parameters
export interface ExportQueryParams {
  format: ExportFormat;
}
