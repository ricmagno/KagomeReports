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

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new ApiError(response.status, `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export const apiService = {
  // Health check
  async checkHealth(): Promise<ApiResponse<{ status: string }>> {
    return fetchApi('/health');
  },

  // Tags
  async getTags(filter?: string): Promise<ApiResponse<TagInfo[]>> {
    const params = filter ? `?filter=${encodeURIComponent(filter)}` : '';
    return fetchApi(`/data/tags${params}`);
  },

  // Time-series data
  async getTimeSeriesData(
    tagName: string,
    startTime: Date,
    endTime: Date,
    options?: {
      limit?: number;
      offset?: number;
      quality?: string;
    }
  ): Promise<ApiResponse<TimeSeriesData[]>> {
    const params = new URLSearchParams({
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      ...(options?.limit && { limit: options.limit.toString() }),
      ...(options?.offset && { offset: options.offset.toString() }),
      ...(options?.quality && { quality: options.quality }),
    });

    return fetchApi(`/data/${encodeURIComponent(tagName)}?${params}`);
  },

  // Multiple tags data
  async getMultipleTagsData(
    tags: string[],
    startTime: Date,
    endTime: Date
  ): Promise<ApiResponse<Record<string, TimeSeriesData[]>>> {
    return fetchApi('/data/multiple', {
      method: 'POST',
      body: JSON.stringify({
        tags,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      }),
    });
  },

  // Statistics
  async getStatistics(
    tagName: string,
    startTime: Date,
    endTime: Date
  ): Promise<ApiResponse<StatisticsResult>> {
    const params = new URLSearchParams({
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    });

    return fetchApi(`/data/${encodeURIComponent(tagName)}/statistics?${params}`);
  },

  // Trend analysis
  async getTrend(
    tagName: string,
    startTime: Date,
    endTime: Date
  ): Promise<ApiResponse<TrendResult>> {
    const params = new URLSearchParams({
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    });

    return fetchApi(`/data/${encodeURIComponent(tagName)}/trend?${params}`);
  },

  // Reports
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

    return fetchApi(`/reports?${params}`);
  },

  async getReport(id: string): Promise<ApiResponse<ReportConfig>> {
    return fetchApi(`/reports/${encodeURIComponent(id)}`);
  },

  async saveReport(report: Omit<ReportConfig, 'id'>): Promise<ApiResponse<ReportConfig>> {
    return fetchApi('/reports', {
      method: 'POST',
      body: JSON.stringify(report),
    });
  },

  async updateReport(id: string, report: Partial<ReportConfig>): Promise<ApiResponse<ReportConfig>> {
    return fetchApi(`/reports/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(report),
    });
  },

  async deleteReport(id: string): Promise<ApiResponse<void>> {
    return fetchApi(`/reports/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async generateReport(config: ReportConfig): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/reports/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new ApiError(response.status, `Failed to generate report: ${response.status}`);
    }

    return response.blob();
  },

  async downloadReport(id: string): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/reports/${encodeURIComponent(id)}/download`);

    if (!response.ok) {
      throw new ApiError(response.status, `Failed to download report: ${response.status}`);
    }

    return response.blob();
  },

  // Version control operations
  async getReportVersions(reportId: string): Promise<ApiResponse<ReportVersionHistory>> {
    return fetchApi(`/reports/${encodeURIComponent(reportId)}/versions`);
  },

  async getReportVersion(reportId: string, version: number): Promise<ApiResponse<ReportVersion>> {
    return fetchApi(`/reports/${encodeURIComponent(reportId)}/versions/${version}`);
  },

  async createReportVersion(
    reportId: string, 
    config: ReportConfig, 
    changeDescription?: string
  ): Promise<ApiResponse<ReportVersion>> {
    return fetchApi(`/reports/${encodeURIComponent(reportId)}/versions`, {
      method: 'POST',
      body: JSON.stringify({
        config,
        changeDescription,
      }),
    });
  },

  async rollbackToVersion(reportId: string, version: number): Promise<ApiResponse<ReportConfig>> {
    return fetchApi(`/reports/${encodeURIComponent(reportId)}/rollback/${version}`, {
      method: 'POST',
    });
  },

  async compareVersions(
    reportId: string, 
    version1: number, 
    version2: number
  ): Promise<ApiResponse<{ differences: any; version1: ReportVersion; version2: ReportVersion }>> {
    return fetchApi(`/reports/${encodeURIComponent(reportId)}/compare/${version1}/${version2}`);
  },
};

export { ApiError };