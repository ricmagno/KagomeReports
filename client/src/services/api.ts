import { 
  ApiResponse, 
  PaginatedResponse, 
  TagInfo, 
  TimeSeriesData, 
  ReportConfig, 
  ReportVersion,
  ReportVersionHistory,
  StatisticsResult, 
  TrendResult 
} from '../types/api';
import { 
  DatabaseConfig, 
  DatabaseConfigSummary, 
  ConnectionTestResult 
} from '../types/databaseConfig';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

class ApiError extends Error {
  constructor(public status: number, message: string, public response?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

// Request interceptor for authentication
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

// Enhanced fetch with retry logic and better error handling
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add authentication header if token exists (but don't require it for public endpoints)
  if (authToken) {
    defaultHeaders['Authorization'] = `Bearer ${authToken}`;
  }

  const requestOptions: RequestInit = {
    headers: {
      ...defaultHeaders,
      ...options?.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, requestOptions);

    // Handle different response types
    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      let errorResponse: any = null;

      try {
        errorResponse = await response.json();
        errorMessage = errorResponse.message || errorResponse.error || errorMessage;
      } catch {
        // If response is not JSON, use status text
        errorMessage = response.statusText || errorMessage;
      }

      throw new ApiError(response.status, errorMessage, errorResponse);
    }

    // Handle different content types
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return await response.json();
    } else if (contentType?.includes('text/')) {
      return await response.text() as unknown as T;
    } else {
      // For binary data like PDFs
      return await response.blob() as unknown as T;
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Retry wrapper for failed requests
async function fetchWithRetry<T>(
  endpoint: string, 
  options?: RequestInit, 
  maxRetries: number = 3
): Promise<T> {
  let lastError: ApiError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchApi<T>(endpoint, options);
    } catch (error) {
      lastError = error as ApiError;
      
      // Don't retry on client errors (4xx) except 408 (timeout) and 429 (rate limit)
      if (lastError.status >= 400 && lastError.status < 500 && 
          lastError.status !== 408 && lastError.status !== 429) {
        throw lastError;
      }
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

export const apiService = {
  // Health check endpoints
  async checkHealth(): Promise<ApiResponse<{ status: string }>> {
    return fetchWithRetry('/health');
  },

  async getDetailedHealth(): Promise<ApiResponse<any>> {
    return fetchWithRetry('/health/detailed');
  },

  async getDatabaseHealth(): Promise<ApiResponse<any>> {
    return fetchWithRetry('/health/database');
  },

  async getHistorianHealth(): Promise<ApiResponse<any>> {
    return fetchWithRetry('/health/historian');
  },

  async getCacheHealth(): Promise<ApiResponse<any>> {
    return fetchWithRetry('/health/cache');
  },

  // Authentication endpoints
  async login(credentials: { username: string; password: string }): Promise<ApiResponse<{ token: string; user: any }>> {
    const response = await fetchApi<ApiResponse<{ token: string; user: any }>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    
    // Set auth token for future requests
    if (response.success && response.data?.token) {
      setAuthToken(response.data.token);
    }
    
    return response;
  },

  async logout(): Promise<ApiResponse<void>> {
    const response = await fetchApi<ApiResponse<void>>('/auth/logout', {
      method: 'POST',
    });
    
    // Clear auth token
    setAuthToken(null);
    
    return response;
  },

  async refreshToken(): Promise<ApiResponse<{ token: string }>> {
    const response = await fetchApi<ApiResponse<{ token: string }>>('/auth/refresh', {
      method: 'POST',
    });
    
    if (response.data?.token) {
      setAuthToken(response.data.token);
    }
    
    return response;
  },

  async getCurrentUser(): Promise<ApiResponse<any>> {
    return fetchWithRetry('/auth/me');
  },

  // Tags endpoints
  async getTags(filter?: string): Promise<ApiResponse<TagInfo[]>> {
    const params = filter ? `?filter=${encodeURIComponent(filter)}` : '';
    return fetchWithRetry(`/data/tags${params}`);
  },

  async getTagInfo(tagName: string): Promise<ApiResponse<TagInfo>> {
    return fetchWithRetry(`/data/tags/${encodeURIComponent(tagName)}`);
  },

  // Time-series data endpoints
  async getTimeSeriesData(
    tagName: string,
    startTime: Date,
    endTime: Date,
    options?: {
      limit?: number;
      offset?: number;
      quality?: string;
      retrievalMode?: string;
    }
  ): Promise<ApiResponse<TimeSeriesData[]>> {
    const params = new URLSearchParams({
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      ...(options?.limit && { limit: options.limit.toString() }),
      ...(options?.offset && { offset: options.offset.toString() }),
      ...(options?.quality && { quality: options.quality }),
      ...(options?.retrievalMode && { retrievalMode: options.retrievalMode }),
    });

    return fetchWithRetry(`/data/${encodeURIComponent(tagName)}?${params}`);
  },

  // Multiple tags data
  async getMultipleTagsData(
    tags: string[],
    startTime: Date,
    endTime: Date,
    options?: {
      retrievalMode?: string;
      quality?: string;
    }
  ): Promise<ApiResponse<Record<string, TimeSeriesData[]>>> {
    return fetchWithRetry('/data/query', {
      method: 'POST',
      body: JSON.stringify({
        tags,
        timeRange: {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
        ...options,
      }),
    });
  },

  // Statistics endpoints
  async getStatistics(
    tagName: string,
    startTime: Date,
    endTime: Date
  ): Promise<ApiResponse<StatisticsResult>> {
    const params = new URLSearchParams({
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    });

    return fetchWithRetry(`/data/${encodeURIComponent(tagName)}/statistics?${params}`);
  },

  // Trend analysis endpoints
  async getTrend(
    tagName: string,
    startTime: Date,
    endTime: Date,
    options?: {
      windowSize?: number;
      sensitivityThreshold?: number;
    }
  ): Promise<ApiResponse<TrendResult>> {
    const params = new URLSearchParams({
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      ...(options?.windowSize && { windowSize: options.windowSize.toString() }),
      ...(options?.sensitivityThreshold && { sensitivityThreshold: options.sensitivityThreshold.toString() }),
    });

    return fetchWithRetry(`/data/${encodeURIComponent(tagName)}/trend?${params}`);
  },

  // Anomaly detection endpoints
  async getAnomalies(
    tagName: string,
    startTime: Date,
    endTime: Date,
    options?: {
      method?: string;
      threshold?: number;
    }
  ): Promise<ApiResponse<any[]>> {
    const params = new URLSearchParams({
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      ...(options?.method && { method: options.method }),
      ...(options?.threshold && { threshold: options.threshold.toString() }),
    });

    return fetchWithRetry(`/data/${encodeURIComponent(tagName)}/anomalies?${params}`);
  },

  // Reports endpoints
  async getReports(options?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
  }): Promise<PaginatedResponse<ReportConfig>> {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', options.page.toString());
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.search) params.set('search', options.search);
    if (options?.category) params.set('category', options.category);

    return fetchWithRetry(`/reports?${params}`);
  },

  async getReport(id: string): Promise<ApiResponse<ReportConfig>> {
    return fetchWithRetry(`/reports/${encodeURIComponent(id)}`);
  },

  async saveReport(report: Omit<ReportConfig, 'id'>): Promise<ApiResponse<ReportConfig>> {
    return fetchWithRetry('/reports', {
      method: 'POST',
      body: JSON.stringify(report),
    });
  },

  async updateReport(id: string, report: Partial<ReportConfig>): Promise<ApiResponse<ReportConfig>> {
    return fetchWithRetry(`/reports/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(report),
    });
  },

  async deleteReport(id: string): Promise<ApiResponse<void>> {
    return fetchWithRetry(`/reports/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async generateReport(config: ReportConfig): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/reports/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new ApiError(response.status, `Failed to generate report: ${response.status}`);
    }

    return response.blob();
  },

  async downloadReport(id: string): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/reports/${encodeURIComponent(id)}/download`, {
      headers: {
        ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      },
    });

    if (!response.ok) {
      throw new ApiError(response.status, `Failed to download report: ${response.status}`);
    }

    return response.blob();
  },

  // Schedule endpoints
  async getSchedules(): Promise<ApiResponse<any[]>> {
    return fetchWithRetry('/schedules');
  },

  async getSchedule(id: string): Promise<ApiResponse<any>> {
    return fetchWithRetry(`/schedules/${encodeURIComponent(id)}`);
  },

  async createSchedule(schedule: any): Promise<ApiResponse<any>> {
    return fetchWithRetry('/schedules', {
      method: 'POST',
      body: JSON.stringify(schedule),
    });
  },

  async updateSchedule(id: string, schedule: any): Promise<ApiResponse<any>> {
    return fetchWithRetry(`/schedules/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(schedule),
    });
  },

  async deleteSchedule(id: string): Promise<ApiResponse<void>> {
    return fetchWithRetry(`/schedules/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async getScheduleExecutions(id: string): Promise<ApiResponse<any[]>> {
    return fetchWithRetry(`/schedules/${encodeURIComponent(id)}/executions`);
  },

  // Auto-update endpoints
  async startAutoUpdate(config: {
    interval: number;
    tags: string[];
    timeRange: { startTime: Date; endTime: Date };
  }): Promise<ApiResponse<{ sessionId: string }>> {
    return fetchWithRetry('/auto-update/start', {
      method: 'POST',
      body: JSON.stringify({
        ...config,
        timeRange: {
          startTime: config.timeRange.startTime.toISOString(),
          endTime: config.timeRange.endTime.toISOString(),
        },
      }),
    });
  },

  async stopAutoUpdate(sessionId: string): Promise<ApiResponse<void>> {
    return fetchWithRetry(`/auto-update/stop/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
    });
  },

  async getAutoUpdateStatus(sessionId: string): Promise<ApiResponse<any>> {
    return fetchWithRetry(`/auto-update/status/${encodeURIComponent(sessionId)}`);
  },

  // Server-Sent Events for real-time updates
  createEventSource(sessionId: string): EventSource {
    const url = `${API_BASE_URL}/auto-update/stream/${encodeURIComponent(sessionId)}`;
    return new EventSource(url);
  },

  // System endpoints
  async getSystemInfo(): Promise<ApiResponse<any>> {
    return fetchWithRetry('/system/info');
  },

  async getSystemMetrics(): Promise<ApiResponse<any>> {
    return fetchWithRetry('/system/metrics');
  },

  // Cache endpoints
  async getCacheStats(): Promise<ApiResponse<any>> {
    return fetchWithRetry('/cache/stats');
  },

  async clearCache(pattern?: string): Promise<ApiResponse<void>> {
    const params = pattern ? `?pattern=${encodeURIComponent(pattern)}` : '';
    return fetchWithRetry(`/cache/clear${params}`, {
      method: 'POST',
    });
  },

  // Progress tracking endpoints
  async getProgress(operationId: string): Promise<ApiResponse<any>> {
    return fetchWithRetry(`/progress/${encodeURIComponent(operationId)}`);
  },

  // Version control operations
  async getReportVersions(reportId: string): Promise<ApiResponse<ReportVersionHistory>> {
    return fetchWithRetry(`/reports/${encodeURIComponent(reportId)}/versions`);
  },

  async getReportVersion(reportId: string, version: number): Promise<ApiResponse<ReportVersion>> {
    return fetchWithRetry(`/reports/${encodeURIComponent(reportId)}/versions/${version}`);
  },

  async createReportVersion(
    reportId: string, 
    config: ReportConfig, 
    changeDescription?: string
  ): Promise<ApiResponse<ReportVersion>> {
    return fetchWithRetry(`/reports/${encodeURIComponent(reportId)}/versions`, {
      method: 'POST',
      body: JSON.stringify({
        config,
        changeDescription,
      }),
    });
  },

  async rollbackToVersion(reportId: string, version: number): Promise<ApiResponse<ReportConfig>> {
    return fetchWithRetry(`/reports/${encodeURIComponent(reportId)}/rollback/${version}`, {
      method: 'POST',
    });
  },

  async compareVersions(
    reportId: string, 
    version1: number, 
    version2: number
  ): Promise<ApiResponse<{ differences: any; version1: ReportVersion; version2: ReportVersion }>> {
    return fetchWithRetry(`/reports/${encodeURIComponent(reportId)}/compare/${version1}/${version2}`);
  },

  // Database configuration endpoints
  async getDatabaseConfigurations(): Promise<ApiResponse<DatabaseConfigSummary[]>> {
    return fetchWithRetry('/database/configs');
  },

  async getDatabaseConfiguration(id: string): Promise<ApiResponse<DatabaseConfig>> {
    return fetchWithRetry(`/database/configs/${encodeURIComponent(id)}`);
  },

  async saveDatabaseConfiguration(config: Omit<DatabaseConfig, 'id'>): Promise<ApiResponse<{ id: string }>> {
    return fetchWithRetry('/database/configs', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  async updateDatabaseConfiguration(id: string, config: Partial<DatabaseConfig>): Promise<ApiResponse<DatabaseConfig>> {
    return fetchWithRetry(`/database/configs/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },

  async deleteDatabaseConfiguration(id: string): Promise<ApiResponse<void>> {
    return fetchWithRetry(`/database/configs/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async testDatabaseConnection(config: Omit<DatabaseConfig, 'id'>): Promise<ApiResponse<ConnectionTestResult>> {
    return fetchWithRetry('/database/test', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  async activateDatabaseConfiguration(id: string): Promise<ApiResponse<void>> {
    return fetchWithRetry(`/database/activate/${encodeURIComponent(id)}`, {
      method: 'POST',
    });
  },

  async getActiveDatabaseConfiguration(): Promise<ApiResponse<DatabaseConfigSummary | null>> {
    return fetchWithRetry('/database/active');
  },
};

export { ApiError };