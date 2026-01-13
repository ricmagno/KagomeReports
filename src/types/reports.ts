/**
 * Type definitions for report management and configuration
 */

import { TimeRange, DataFilter } from './historian';

// Chart types supported in reports
export type ChartType = 'line' | 'bar' | 'trend' | 'scatter' | 'area';

// Report template types
export type ReportTemplate = 'default' | 'executive' | 'technical' | 'summary';

// Report configuration interface
export interface ReportConfig {
  id?: string;
  name: string;
  description: string;
  tags: string[];
  timeRange: TimeRange;
  chartTypes: ChartType[];
  template: ReportTemplate;
  filters?: DataFilter[];
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  version?: number;
  parentId?: string; // For version tracking
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
  description?: string;
  config: Omit<ReportConfig, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'version'>;
  changeDescription?: string;
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