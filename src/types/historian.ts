/**
 * Type definitions for AVEVA Historian database operations
 */

// Time-series data point from AVEVA Historian
export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  quality: QualityCode;
  tagName: string;
}

// AVEVA Historian quality codes
export enum QualityCode {
  Good = 192,           // Good quality data
  Bad = 0,              // Bad quality data
  Uncertain = 64,       // Uncertain quality data
  ConfigError = 4,      // Configuration error
  NotConnected = 8,     // Not connected
  DeviceFailure = 12,   // Device failure
  SensorFailure = 16,   // Sensor failure
  LastKnownValue = 20,  // Last known value
  CommFailure = 24,     // Communication failure
  OutOfService = 28,    // Out of service
  WaitingForInitialData = 32, // Waiting for initial data
}

// Tag information from AVEVA Historian
export interface TagInfo {
  name: string;
  description: string;
  units: string;
  dataType: 'analog' | 'discrete' | 'string';
  lastUpdate: Date;
  minValue?: number;
  maxValue?: number;
  engineeringUnits?: string;
}

// Time range for data queries
export interface TimeRange {
  startTime: Date;
  endTime: Date;
  relativeRange?: 'last1h' | 'last24h' | 'last7d' | 'last30d';
}

// Data filter options
export interface DataFilter {
  tagNames?: string[] | undefined;
  qualityFilter?: QualityCode[] | undefined;
  valueRange?: {
    min?: number | undefined;
    max?: number | undefined;
  } | undefined;
  samplingInterval?: number | undefined;
}

// Query result with pagination
export interface QueryResult<T = any> {
  data: T[];
  totalCount: number;
  hasMore: boolean;
  nextCursor?: string;
}

// Database connection configuration
export interface DatabaseConfig {
  server: string;
  port: number;
  database: string;
  user: string;
  password: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
  connectionTimeout: number;
  requestTimeout: number;
  pool: {
    min: number;
    max: number;
    idleTimeoutMillis: number;
  };
}

// Statistical analysis results
export interface StatisticsResult {
  min: number;
  max: number;
  average: number;
  standardDeviation: number;
  count: number;
  dataQuality: number; // Percentage of good quality data
}

// Trend analysis result
export interface TrendResult {
  slope: number;
  intercept: number;
  correlation: number;
  equation: string;
  confidence: number;
}

// Anomaly detection result
export interface AnomalyResult {
  timestamp: Date;
  value: number;
  expectedValue: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

// AVEVA Historian retrieval modes
export enum RetrievalMode {
  Cyclic = 'Cyclic',       // Fixed time intervals
  Delta = 'Delta',         // Value change based
  Full = 'Full',           // All data points
  BestFit = 'BestFit',     // Optimized sampling
}

// Query options for AVEVA Historian
export interface HistorianQueryOptions {
  mode: RetrievalMode;
  interval?: number;        // For Cyclic mode (seconds)
  tolerance?: number;       // For Delta mode (percentage)
  maxPoints?: number;       // Maximum points to return
  includeQuality?: boolean; // Include quality information
}