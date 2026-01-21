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
  relativeRange?: 'last1h' | 'last2h' | 'last6h' | 'last12h' | 'last24h' | 'last7d' | 'last30d' | undefined;
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

// Advanced trend line result with R² value
export interface TrendLineResult {
  slope: number;        // m in y = mx + b
  intercept: number;    // b in y = mx + b
  rSquared: number;     // Coefficient of determination (0-1)
  equation: string;     // Formatted equation string
}

// Trend line calculator interface
export interface TrendLineCalculator {
  /**
   * Calculate linear regression trend line
   */
  calculateTrendLine(data: TimeSeriesData[]): TrendLineResult;
  
  /**
   * Format trend line equation for display
   */
  formatEquation(slope: number, intercept: number): string;
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
  Average = 'Average',     // Time-weighted average
  Minimum = 'Minimum',     // Minimum value in period
  Maximum = 'Maximum',     // Maximum value in period
  Interpolated = 'Interpolated', // Linear interpolation
  ValueState = 'ValueState', // State-based retrieval
}

// Query options for AVEVA Historian
export interface HistorianQueryOptions {
  mode: RetrievalMode;
  interval?: number | undefined;        // For Cyclic mode (seconds)
  resolution?: number | undefined;      // For specific frequency (milliseconds)
  tolerance?: number | undefined;       // For Delta mode (percentage)
  maxPoints?: number | undefined;       // Maximum points to return (maps to wwCycleCount)
  includeQuality?: boolean | undefined; // Include quality information
}

// Specification limits for SPC analysis
export interface SpecificationLimits {
  lsl?: number;  // Lower Specification Limit
  usl?: number;  // Upper Specification Limit
}

// Statistical Process Control metrics
export interface SPCMetrics {
  mean: number;              // X̄ - Process average
  stdDev: number;            // σest - Estimated standard deviation
  ucl: number;               // Upper Control Limit (X̄ + 3σ)
  lcl: number;               // Lower Control Limit (X̄ - 3σ)
  cp: number | null;         // Process Capability Index
  cpk: number | null;        // Process Performance Index
  outOfControlPoints: number[]; // Indices of points outside control limits
}

// SPC calculator interface
export interface SPCCalculator {
  /**
   * Calculate SPC metrics for a dataset
   */
  calculateSPCMetrics(
    data: TimeSeriesData[], 
    specLimits?: SpecificationLimits
  ): SPCMetrics;
  
  /**
   * Identify out-of-control points
   */
  identifyOutOfControlPoints(
    data: TimeSeriesData[], 
    ucl: number, 
    lcl: number
  ): number[];
  
  /**
   * Assess process capability
   */
  assessCapability(cp: number | null, cpk: number | null): 'Capable' | 'Marginal' | 'Not Capable' | 'N/A';
}

// SPC metrics summary for table display
export interface SPCMetricsSummary {
  tagName: string;
  mean: number;
  stdDev: number;
  lsl: number | null;
  usl: number | null;
  cp: number | null;
  cpk: number | null;
  capability: 'Capable' | 'Marginal' | 'Not Capable' | 'N/A';
}

// Tag classification for determining tag type
export interface TagClassification {
  tagName: string;
  type: 'analog' | 'digital';
  confidence: number; // 0-1, how confident the classification is
}

// Tag classification service interface
export interface TagClassificationService {
  /**
   * Classify a tag based on its data characteristics
   */
  classifyTag(data: TimeSeriesData[]): TagClassification;
  
  /**
   * Classify multiple tags in batch
   */
  classifyTags(tagData: Record<string, TimeSeriesData[]>): Record<string, TagClassification>;
}
