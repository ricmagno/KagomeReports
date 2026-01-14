/**
 * Type definitions for AVEVA Historian System Status Monitoring
 */

import { QualityCode } from './historian';

// Status categories for system tags
export enum StatusCategory {
  Errors = 'errors',
  Services = 'services',
  Storage = 'storage',
  IO = 'io',
  Performance = 'performance'
}

// System tag value with metadata
export interface SystemTagValue {
  tagName: string;
  value: number | string | null;
  quality: QualityCode;
  timestamp: Date;
  category: StatusCategory;
}

// System tag definition with configuration
export interface SystemTagDefinition {
  tagName: string;
  description: string;
  dataType: 'analog' | 'discrete';
  category: StatusCategory;
  units?: string;
  thresholds?: {
    warning?: number;
    critical?: number;
  };
  interpretation?: {
    0?: string;  // e.g., "Bad"
    1?: string;  // e.g., "Good"
  };
}

// System tag configuration by category
export interface SystemTagConfig {
  category: StatusCategory;
  tags: SystemTagDefinition[];
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

// Complete system status data
export interface SystemStatusData {
  timestamp: Date;
  errors: ErrorCountData;
  services: ServiceStatusData;
  storage: StorageSpaceData;
  io: IOStatisticsData;
  performance: PerformanceMetricsData;
}

// API response format
export interface SystemStatusResponse {
  timestamp: Date;
  categories: {
    errors: ErrorCountData;
    services: ServiceStatusData;
    storage: StorageSpaceData;
    io: IOStatisticsData;
    performance: PerformanceMetricsData;
  };
}

// Query parameters for status API
export interface StatusQueryParams {
  category?: StatusCategory;
  refresh?: boolean;
}

// Trend query parameters
export interface TrendsQueryParams {
  tags: string[];
  timeRange: 'hour' | '24hours' | '7days';
}

// Export query parameters
export interface ExportQueryParams {
  format: 'csv' | 'json';
}

// Export metadata
export interface ExportMetadata {
  exportTimestamp: Date;
  serverName: string;
  exportedBy: string;
}

// Export data structure
export interface ExportData {
  metadata: ExportMetadata;
  data: SystemTagValue[];
}
