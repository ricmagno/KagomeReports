/**
 * Type definitions for report management and configuration
 */

import {
  TimeRange,
  DataFilter,
  TimeSeriesData,
  SpecificationLimits,
  TrendLineResult,
  SPCMetrics,
  SPCMetricsSummary
} from './historian';

// Chart types supported in reports
export type ChartType = 'line' | 'bar' | 'trend' | 'scatter' | 'area';

// Report template types
export type ReportTemplate = 'default' | 'executive' | 'technical' | 'summary';

// Report configuration interface
export interface ReportConfig {
  id?: string;
  name: string;
  description?: string;
  tags: string[];
  timeRange: TimeRange;
  chartTypes: ChartType[];
  template: ReportTemplate;
  format?: 'pdf' | 'docx';
  filters?: DataFilter[];
  branding?: {
    companyName?: string | undefined;
    logo?: string | undefined;
    colors?: {
      primary?: string | undefined;
      secondary?: string | undefined;
    } | undefined;
  } | undefined;
  metadata?: {
    author?: string | undefined;
    subject?: string | undefined;
    keywords?: string[] | undefined;
  } | undefined;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  version?: number;
  parentId?: string; // For version tracking

  // Advanced Chart Analytics fields
  specificationLimits?: Record<string, SpecificationLimits>; // Map of tag name to spec limits
  includeSPCCharts?: boolean;      // Include Statistical Process Control charts
  includeTrendLines?: boolean;     // Include trend lines on standard charts
  includeMultiTrend?: boolean;     // Include Combined Process Trends chart
  includeStatsSummary?: boolean;   // Include statistical summaries on charts

  // Import tracking metadata (for configurations loaded from export files)
  importMetadata?: {
    importedFrom?: string;     // Original filename
    importDate?: Date;         // When the import occurred
    originalExportDate?: Date; // Original export date from the file
    schemaVersion?: string;    // Schema version of the imported file
  };
}

// Saved report with metadata
export interface SavedReport {
  id: string;
  name: string;
  description: string;
  config: ReportConfig;
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isLatestVersion: boolean;
}

// Report version for history tracking
export interface ReportVersion {
  id: string;
  reportId: string; // Links to the base report name
  version: number;
  config: ReportConfig;
  createdAt: Date;
  createdBy: string;
  changeDescription?: string;
  isActive: boolean;
}

// Report version history
export interface ReportVersionHistory {
  reportId: string;
  reportName: string;
  versions: ReportVersion[];
  totalVersions: number;
}

// Report list item for UI display
export interface ReportListItem {
  id: string;
  name: string;
  description: string;
  config: ReportConfig;
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isLatestVersion: boolean;
  totalVersions: number;
}

// Report save request
export interface SaveReportRequest {
  name: string;
  description?: string | undefined;
  config: Omit<ReportConfig, 'id' | 'name' | 'description' | 'createdBy' | 'createdAt' | 'updatedAt' | 'version'>;
  changeDescription?: string | undefined;
}

// Report save response
export interface SaveReportResponse {
  success: boolean;
  reportId: string;
  version: number;
  message: string;
}

// Report validation result
export interface ReportValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Tag classification for analytics
export interface TagClassification {
  tagName: string;
  type: 'analog' | 'digital';
  confidence: number; // 0-1, how confident the classification is
}

// Tag analytics data combining classification and calculated metrics
export interface TagAnalytics {
  tagName: string;
  classification: TagClassification;
  trendLine?: TrendLineResult;
  spcMetrics?: SPCMetrics;
  statistics: {
    min: number;
    max: number;
    mean: number;
    stdDev: number;
  };
}

// Enhanced report data with analytics
export interface EnhancedReportData {
  configuration: ReportConfig;
  timeSeriesData: Record<string, TimeSeriesData[]>; // Map of tag name to time-series data
  tagAnalytics: Record<string, TagAnalytics>;       // Map of tag name to analytics
  spcMetricsSummary: SPCMetricsSummary[];           // Summary table data
}
