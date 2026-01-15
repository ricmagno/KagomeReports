// API types matching the backend interfaces
export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  quality: 'Good' | 'Bad' | 'Uncertain' | number;
  tagName: string;
}

export interface TagInfo {
  name: string;
  description: string;
  units: string;
  dataType: 'analog' | 'discrete' | 'string';
  lastUpdate: Date;
}

export interface ReportConfig {
  id?: string;
  name: string;
  description: string;
  tags: string[];
  timeRange: TimeRange;
  chartTypes: ChartType[];
  template: string;
  retrievalMode?: 'Delta' | 'Cyclic' | 'AVG' | 'RoundTrip';
  filters?: DataFilter[];
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  version?: number;
  parentId?: string; // For version tracking
}

export interface ReportVersion {
  id: string;
  reportId: string;
  version: number;
  config: ReportConfig;
  createdAt: Date;
  createdBy?: string;
  changeDescription?: string;
  isActive: boolean;
}

export interface ReportVersionHistory {
  reportId: string;
  reportName: string;
  versions: ReportVersion[];
  totalVersions: number;
}

export interface TimeRange {
  startTime: Date;
  endTime: Date;
  relativeRange?: 'last1h' | 'last2h' | 'last6h' | 'last12h' | 'last24h' | 'last7d' | 'last30d';
}

export interface DataFilter {
  type: 'quality' | 'value' | 'tag';
  operator: 'equals' | 'greater' | 'less' | 'contains';
  value: string | number;
}

export type ChartType = 'line' | 'bar' | 'trend';

export interface StatisticsResult {
  min: number;
  max: number;
  average: number;
  standardDeviation: number;
  count: number;
  dataQuality: number;
  trend?: TrendResult;
}

export interface TrendResult {
  slope: number;
  intercept: number;
  correlation: number;
  equation: string;
  confidence: number;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}