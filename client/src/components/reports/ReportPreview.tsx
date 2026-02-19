import React, { useEffect, useMemo, useCallback, useReducer } from 'react';
import {
  Eye,
  FileText,
  BarChart3,
  Calendar,
  Clock,
  TrendingUp,
  Activity,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { ReportConfig, TimeSeriesData, StatisticsResult } from '../../types/api';
import { apiService } from '../../services/api';
import { InteractiveChart } from '../charts';
import { getTagColor, getTagIndex, formatYValue } from '../charts/chartUtils';
import { DataPreviewTable } from './DataPreviewTable';

interface ReportPreviewProps {
  config: ReportConfig;
  onEdit?: (config: ReportConfig) => void;
  className?: string;
}

interface PreviewData {
  dataPoints: Record<string, TimeSeriesData[]>;
  statistics: Record<string, StatisticsResult>;
  loading: boolean;
  error: string | null;
  tagDescriptions: Record<string, string>;
  tagUnits: Record<string, string>;
  lastUpdated: Date | null;
}

interface DataQualityInfo {
  totalPoints: number;
  goodQuality: number;
  badQuality: number;
  uncertainQuality: number;
  qualityPercentage: number;
}

type PreviewAction =
  | { type: 'FETCH_START' }
  | {
    type: 'FETCH_SUCCESS'; payload: {
      dataPoints: Record<string, TimeSeriesData[]>;
      statistics: Record<string, StatisticsResult>;
      tagDescriptions: Record<string, string>;
      tagUnits: Record<string, string>;
    }
  }
  | { type: 'FETCH_ERROR'; payload: string }
  | { type: 'CLEAR_DATA' };

const previewReducer = (state: PreviewData, action: PreviewAction): PreviewData => {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        ...action.payload,
        loading: false,
        error: null,
        lastUpdated: new Date()
      };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'CLEAR_DATA':
      return {
        ...state,
        dataPoints: {},
        statistics: {},
        lastUpdated: null
      };
    default:
      return state;
  }
};

export interface ReportPreviewRef {
  getCapturedCharts: () => Promise<Record<string, string>>;
}

export const ReportPreview = React.forwardRef<ReportPreviewRef, ReportPreviewProps>(({
  config,
  onEdit,
  className = ''
}, ref) => {
  const [previewData, dispatch] = useReducer(previewReducer, {
    dataPoints: {},
    statistics: {},
    loading: false,
    error: null,
    tagDescriptions: {},
    tagUnits: {},
    lastUpdated: null
  });

  const { dataPoints, statistics, loading, error, tagDescriptions, tagUnits, lastUpdated } = previewData;

  React.useImperativeHandle(ref, () => ({
    getCapturedCharts: async () => {
      const charts: Record<string, string> = {};
      try {
        if ((window as any).ApexCharts) {
          // Add small delay to ensure rendering is complete
          await new Promise(resolve => setTimeout(resolve, 500));

          if (config.tags && config.tags.length > 1) {
            try {
              const multiTrendDataURI = await (window as any).ApexCharts.exec('multi-trend-chart', 'dataURI');
              if (multiTrendDataURI && multiTrendDataURI.imgURI) {
                charts['Multi-Trend Analysis'] = multiTrendDataURI.imgURI;
              }
            } catch (e) {
              console.warn('Could not capture multi-trend chart', e);
            }
          }

          for (const tag of (config.tags || [])) {
            const chartId = `mini-chart-${tag}`;
            try {
              const dataURI = await (window as any).ApexCharts.exec(chartId, 'dataURI');
              if (dataURI && dataURI.imgURI) {
                charts[tag] = dataURI.imgURI;
              }
            } catch (e) {
              console.warn(`Could not capture chart ${chartId}`, e);
            }
          }
        }
      } catch (e) {
        console.error('Error capturing charts:', e);
      }
      return charts;
    }
  }));

  // Load preview data
  const loadPreviewData = useCallback(async () => {
    if (!config.tags || config.tags.length === 0 || !config.timeRange) {
      dispatch({
        type: 'FETCH_ERROR',
        payload: 'Please select tags and time range before querying data'
      });
      return;
    }

    dispatch({ type: 'FETCH_START' });

    try {
      // Load data for each tag
      const dataPromises = config.tags.map(async (tagName) => {
        try {
          const response = await apiService.getTimeSeriesData(
            tagName,
            config.timeRange.startTime,
            config.timeRange.endTime,
            {
              limit: 500, // Limit for preview
              retrievalMode: config.retrievalMode || 'Cyclic',
              // @ts-ignore - wwResolution might not be in the type definition yet
              wwResolution: 60000
            }
          );
          return { tagName, data: response.success ? response.data : [] };
        } catch (err) {
          console.warn(`Failed to load preview data for tag ${tagName}:`, err);
          return { tagName, data: [] };
        }
      });

      const results = await Promise.all(dataPromises);
      const fetchedDataPoints: Record<string, TimeSeriesData[]> = {};

      results.forEach(({ tagName, data }) => {
        fetchedDataPoints[tagName] = data;
      });

      // Compute statistics locally from already-fetched data (mirrors backend calculateStatisticsSync).
      // This is preferred over a separate API call because:
      //   1. No extra round-trip — data is already in memory.
      //   2. The SQL-based endpoint returns median: 0 (SQL Server lacks MEDIAN aggregate).
      //   3. A failed secondary request would silently leave the stats object empty.
      const fetchedStatistics: Record<string, StatisticsResult> = {};
      const fetchedDescriptions: Record<string, string> = {};
      const fetchedUnits: Record<string, string> = {};

      // --- Local statistics helper ---
      const computeLocalStats = (data: TimeSeriesData[]): StatisticsResult | null => {
        const validValues = data
          .map(p => p.value)
          .filter(v => typeof v === 'number' && isFinite(v));
        if (validValues.length === 0) return null;

        const min = Math.min(...validValues);
        const max = Math.max(...validValues);
        const average = validValues.reduce((s, v) => s + v, 0) / validValues.length;

        // Median
        const sorted = [...validValues].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 === 0
          ? (sorted[mid - 1]! + sorted[mid]!) / 2
          : sorted[mid]!;

        // Population std dev
        const variance = validValues.reduce((s, v) => s + Math.pow(v - average, 2), 0) / validValues.length;
        const standardDeviation = Math.sqrt(variance);

        // Data quality: proportion of Good-quality points (code 192)
        const goodCount = data.filter(p => p.quality === 192 || p.quality === 'Good').length;
        const dataQuality = (goodCount / data.length) * 100;

        return { min, max, average, median, standardDeviation, count: validValues.length, dataQuality };
      };

      // Compute stats for every tag that has data
      for (const tagName of config.tags) {
        const tagData = fetchedDataPoints[tagName];
        if (tagData && tagData.length > 0) {
          const stats = computeLocalStats(tagData);
          if (stats) fetchedStatistics[tagName] = stats;
        }
      }

      // Fetch tag metadata (description, units) in parallel
      const metadataPromises = config.tags.map(async (tagName) => {
        try {
          const response = await apiService.getTags(tagName);
          if (response.success && response.data) {
            const tagInfo = response.data.find(t => t.name === tagName);
            if (tagInfo) {
              fetchedDescriptions[tagName] = tagInfo.description;
              fetchedUnits[tagName] = tagInfo.units;
            }
          }
        } catch (err) {
          console.warn(`Failed to fetch tag info for ${tagName}:`, err);
        }
      });

      await Promise.all(metadataPromises);

      dispatch({
        type: 'FETCH_SUCCESS',
        payload: {
          dataPoints: fetchedDataPoints,
          statistics: fetchedStatistics,
          tagDescriptions: fetchedDescriptions,
          tagUnits: fetchedUnits
        }
      });
    } catch (err) {
      dispatch({
        type: 'FETCH_ERROR',
        payload: err instanceof Error ? err.message : 'Failed to load preview data'
      });
    }
  }, [
    config.tags,
    config.timeRange,
    config.timeRange?.startTime,
    config.timeRange?.endTime,
    config.retrievalMode
  ]);

  // Auto-update preview data when relevant configuration changes
  useEffect(() => {
    if (config.tags && config.tags.length > 0) {
      const timer = setTimeout(() => {
        loadPreviewData();
      }, 1000); // 1 second debounce
      return () => clearTimeout(timer);
    } else {
      dispatch({ type: 'CLEAR_DATA' });
    }
  }, [loadPreviewData, config.tags]);

  // Calculate data quality metrics
  const dataQuality = useMemo((): DataQualityInfo => {
    let totalPoints = 0;
    let goodQuality = 0;
    let badQuality = 0;
    let uncertainQuality = 0;

    Object.values(previewData.dataPoints).forEach(data => {
      data.forEach(point => {
        totalPoints++;
        if (point.quality === 'Good' || point.quality === 192) goodQuality++;
        else if (point.quality === 'Bad' || point.quality === 0) badQuality++;
        else uncertainQuality++;
      });
    });

    return {
      totalPoints,
      goodQuality,
      badQuality,
      uncertainQuality,
      qualityPercentage: totalPoints > 0 ? (goodQuality / totalPoints) * 100 : 0
    };
  }, [previewData.dataPoints]);

  // Calculate estimated file size
  const estimatedFileSize = useMemo(() => {
    const baseSize = 50; // KB base PDF size
    const dataSize = dataQuality.totalPoints * 0.1; // ~0.1KB per data point
    const chartSize = config.chartTypes.length * 200; // ~200KB per chart
    return Math.max(baseSize + dataSize + chartSize, 50);
  }, [dataQuality.totalPoints, config.chartTypes.length]);

  // Master color mapping for tags to ensure perfect synchronization
  const tagColors = useMemo(() => {
    const mapping: Record<string, string | undefined> = {};
    if (!config.tags) return mapping;

    config.tags.forEach((tag) => {
      const tagIndex = getTagIndex(tag, config.tags);
      mapping[tag] = getTagColor(tagIndex);
    });
    return mapping;
  }, [config.tags]);



  const handleRefresh = () => {
    loadPreviewData();
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  };

  const getChartIcon = (chartTypes: string[]) => {
    const primaryType = chartTypes[0] || 'line';
    switch (primaryType) {
      case 'bar':
        return <BarChart3 className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getQualityColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getQualityIcon = (percentage: number) => {
    if (percentage >= 90) return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (percentage >= 70) return <AlertCircle className="w-4 h-4 text-yellow-600" />;
    return <AlertCircle className="w-4 h-4 text-red-600" />;
  };

  return (
    <div className={`bg-white rounded-lg shadow-md border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 w-full">
            <div className="flex items-center space-x-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-900 break-words">
                {config.name}
              </h3>
              {loading && (
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              )}
            </div>

            {config.description && (
              <p className="text-gray-600 text-sm mb-3 line-clamp-2 md:line-clamp-none">
                {config.description}
              </p>
            )}

            {/* Tags */}
            {config.tags && config.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {config.tags.map((tag, index) => {
                  const tagData = dataPoints[tag] || [];
                  const hasData = tagData.length > 0;

                  return (
                    <span
                      key={index}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${hasData
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                        }`}
                    >
                      {tag}
                      {!loading && (
                        <span className="ml-1 opacity-70">
                          ({tagData.length})
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Data Quality Indicator */}
            {!loading && dataQuality.totalPoints > 0 && (
              <div className="flex items-center space-x-2 text-xs sm:text-sm">
                {getQualityIcon(dataQuality.qualityPercentage)}
                <span className={getQualityColor(dataQuality.qualityPercentage)}>
                  {dataQuality.qualityPercentage.toFixed(1)}% quality
                </span>
                <span className="text-gray-500">
                  ({dataQuality.totalPoints} pts)
                </span>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="flex items-center space-x-2 text-xs sm:text-sm text-red-600 mt-2">
                <AlertCircle className="w-3.5 h-3.5" />
                <span className="break-words">{error}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
              onClick={loadPreviewData}
              disabled={loading || !config.tags?.length}
              className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Querying...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                  Query Data
                </>
              )}
            </button>

            {onEdit && (
              <button
                onClick={() => onEdit(config)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Edit
              </button>
            )}

            <button
              onClick={handleRefresh}
              disabled={loading || dataQuality.totalPoints === 0}
              className="px-2.5 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200"
              title="Refresh preview data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Configuration Details */}
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Time Range */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-900 flex items-center">
              <Calendar className="w-4 h-4 mr-1.5" />
              Time Range
            </h4>
            <div className="text-sm text-gray-600 bg-gray-50 p-2.5 rounded-md">
              <div className="flex justify-between sm:block">
                <span className="text-xs text-gray-500 sm:hidden">From:</span>
                <span>{formatDate(new Date(config.timeRange.startTime))}</span>
              </div>
              <div className="flex justify-between sm:block mt-1 sm:mt-0">
                <span className="text-xs text-gray-500 sm:hidden">To:</span>
                <span>{formatDate(new Date(config.timeRange.endTime))}</span>
              </div>
              <div className="text-[10px] text-gray-500 mt-2 pt-2 border-t border-gray-200 sm:border-0 sm:pt-0 sm:mt-1">
                Duration: {Math.ceil((new Date(config.timeRange.endTime).getTime() - new Date(config.timeRange.startTime).getTime()) / (1000 * 60 * 60 * 24))} days
              </div>
            </div>
          </div>

          {/* Chart Configuration */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-900 flex items-center">
              {getChartIcon(config.chartTypes)}
              <span className="ml-2">Chart Types</span>
            </h4>
            <div className="text-sm text-gray-600">
              {config.chartTypes.map(type => type.charAt(0).toUpperCase() + type.slice(1)).join(', ')}
            </div>
          </div>

          {/* Template */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-900 flex items-center">
              <FileText className="w-4 h-4 mr-2" />
              Template & Format
            </h4>
            <div className="text-sm text-gray-600">
              <div className="capitalize">{config.template}</div>
              <div className="uppercase text-xs text-gray-500">PDF</div>
            </div>
          </div>

          {/* Data Summary */}
          {!previewData.loading && dataQuality.totalPoints > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900 flex items-center">
                <Activity className="w-4 h-4 mr-2" />
                Data Summary
              </h4>
              <div className="text-sm text-gray-600">
                <div>{dataQuality.totalPoints} data points</div>
                <div className="text-green-600">{dataQuality.goodQuality} good quality</div>
                {dataQuality.badQuality > 0 && (
                  <div className="text-red-600">{dataQuality.badQuality} bad quality</div>
                )}
                {dataQuality.uncertainQuality > 0 && (
                  <div className="text-yellow-600">{dataQuality.uncertainQuality} uncertain</div>
                )}
              </div>
            </div>
          )}

          {/* Statistics Preview */}
          {!loading && Object.keys(statistics).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2" />
                Statistics
              </h4>
              <div className="text-sm text-gray-600">
                {Object.entries(statistics).slice(0, 2).map(([tagName, stats]) => (
                  <div key={tagName} className="mb-1">
                    <div className="font-medium text-xs text-gray-700">{tagName}:</div>
                    <div className="text-xs">
                      Avg: {typeof stats?.average === 'number' ? formatYValue(stats.average) : 'N/A'},
                      Range: {typeof stats?.min === 'number' ? formatYValue(stats.min) : 'N/A'}-{typeof stats?.max === 'number' ? formatYValue(stats.max) : 'N/A'}
                    </div>
                  </div>
                ))}
                {Object.keys(statistics).length > 2 && (
                  <div className="text-xs text-gray-500">
                    +{Object.keys(statistics).length - 2} more tags
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Estimated Output */}
          {!previewData.loading && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900 flex items-center">
                <Eye className="w-4 h-4 mr-2" />
                Estimated Output
              </h4>
              <div className="text-sm text-gray-600">
                <div>Size: ~{estimatedFileSize.toFixed(0)} KB</div>
                <div className="flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  ~{Math.max(5, Math.ceil(dataQuality.totalPoints / 100))}s generation
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {config.chartTypes.length} chart{config.chartTypes.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Loading State */}
        {previewData.loading && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-center space-x-3">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-sm text-blue-800">Loading preview data...</span>
            </div>
          </div>
        )}

        {/* Statistics Summary Preview - Section II */}
        {config.includeStatsSummary && !loading && Object.keys(statistics).length > 0 && (
          <div className="mt-8 border border-blue-200 rounded-xl overflow-hidden shadow-sm">
            {/* Section header */}
            <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2563eb] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <TrendingUp className="w-5 h-5 text-blue-200" />
                <div>
                  <h4 className="text-base font-semibold text-white">Statistics Summary</h4>
                  <p className="text-xs text-blue-200 mt-0.5">Section II — Conditional (enabled)</p>
                </div>
              </div>
              <span className="text-xs text-blue-100 bg-blue-900/40 px-2.5 py-1 rounded-full font-medium">
                {Object.keys(statistics).length} tag{Object.keys(statistics).length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Tag', 'Mean', 'Median', 'Std Dev', 'Min', 'Max', 'Count', 'Quality'].map(h => (
                      <th
                        key={h}
                        className={`px-3 py-2 font-semibold text-gray-600 ${h === 'Tag' ? 'text-left' : 'text-center'
                          }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(statistics).map(([tagName, stats], idx) => {
                    const qualityPct = stats.dataQuality;
                    const qualityColor =
                      qualityPct >= 90 ? 'bg-green-500'
                        : qualityPct >= 70 ? 'bg-yellow-500'
                          : 'bg-red-500';
                    const tagColor = tagColors[tagName];

                    return (
                      <tr
                        key={tagName}
                        className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                          } hover:bg-blue-50/40 transition-colors`}
                      >
                        {/* Tag name with colour dot */}
                        <td className="px-3 py-2.5 font-medium text-gray-800 max-w-[160px]">
                          <div className="flex items-center space-x-2">
                            <span
                              className="flex-shrink-0 w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: tagColor || '#6b7280' }}
                            />
                            <span className="truncate" title={tagName}>{tagName}</span>
                          </div>
                        </td>

                        {/* Numeric metrics */}
                        <td className="px-3 py-2.5 text-center text-gray-700 tabular-nums">
                          {typeof stats.average === 'number' ? formatYValue(stats.average) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center text-gray-700 tabular-nums">
                          {typeof stats.median === 'number' ? formatYValue(stats.median) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center text-gray-700 tabular-nums">
                          {typeof stats.standardDeviation === 'number' ? formatYValue(stats.standardDeviation) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center text-gray-500 tabular-nums">
                          {typeof stats.min === 'number' ? formatYValue(stats.min) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center text-gray-500 tabular-nums">
                          {typeof stats.max === 'number' ? formatYValue(stats.max) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center text-gray-600 tabular-nums">
                          {typeof stats.count === 'number' ? stats.count.toLocaleString() : '—'}
                        </td>

                        {/* Quality bar */}
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col items-center space-y-1">
                            <div className="w-full max-w-[80px] h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${qualityColor}`}
                                style={{ width: `${Math.min(100, qualityPct)}%` }}
                              />
                            </div>
                            <span className={`text-[10px] font-medium ${qualityPct >= 90 ? 'text-green-700'
                              : qualityPct >= 70 ? 'text-yellow-700'
                                : 'text-red-700'
                              }`}>
                              {qualityPct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer note */}
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
              <p className="text-[10px] text-gray-400">
                Quality %: proportion of readings with Good quality (code 192). Std Dev = population standard deviation.
              </p>
            </div>
          </div>
        )}

        {/* Statistics Summary placeholder when option is enabled but data not yet queried */}
        {config.includeStatsSummary && !loading && Object.keys(statistics).length === 0 && dataQuality.totalPoints === 0 && (
          <div className="mt-6 p-4 border border-dashed border-blue-300 rounded-xl bg-blue-50/40">
            <div className="flex items-center space-x-3 text-blue-700">
              <TrendingUp className="w-4 h-4 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Statistics Summary will appear here</p>
                <p className="text-xs text-blue-600 mt-0.5">Query data first to preview statistics (Section II).</p>
              </div>
            </div>
          </div>
        )}

        {/* Data Visualization Preview */}
        {!previewData.loading && dataQuality.totalPoints > 0 && (
          <div className="mt-8">
            <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center px-1">
              <TrendingUp className="w-4 h-4 mr-2" />
              Trends
            </h4>
            <div className="grid grid-cols-1 gap-6 sm:gap-8">
              {/* Combined Multi-Trend View (only if multiple tags selected) */}
              {Object.keys(dataPoints).filter(tag => dataPoints[tag].length > 0).length > 1 && (
                <InteractiveChart
                  dataPoints={dataPoints}
                  tagDescriptions={tagDescriptions}
                  tags={config.tags}
                  title={config.name}
                  description={config.description}
                  width="100%"
                  height={320}
                  className="mb-4"
                  enableGuideLines={false}
                  displayMode="multi"
                  type={config.chartTypes[0] as any || 'line'}
                  includeTrendLines={config.includeTrendLines}
                />
              )}

              {config.tags
                .filter(tagName => dataPoints[tagName]?.length > 0)
                .slice(0, 4) // Show top 4 tags in large format
                .map((tagName) => {
                  const data = dataPoints[tagName];

                  return (
                    <InteractiveChart
                      key={tagName}
                      dataPoints={{ [tagName]: data }}
                      tagDescriptions={tagDescriptions}
                      tagName={tagName}
                      width="100%"
                      height={320}
                      title={tagName}
                      description={tagDescriptions[tagName]}
                      units={tagUnits[tagName]}
                      statistics={statistics[tagName]}
                      color={tagColors[tagName]}
                      className="shadow-md border-gray-300"
                      enableGuideLines={false}
                      displayMode="single"
                      type={config.chartTypes[0] as any || 'line'}
                      includeTrendLines={config.includeTrendLines}
                    />
                  );
                })}
            </div>
            {Object.keys(dataPoints).length > 6 && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                +{Object.keys(dataPoints).length - 6} more charts will be included in the report
              </p>
            )}

            {/* Data Preview Table */}
            <div className="mt-8">
              <DataPreviewTable
                data={Object.values(dataPoints).flat()}
                loading={loading}
                error={error}
                onRetry={loadPreviewData}
                reportName={config.name}
              />
            </div>
          </div>
        )}

        {/* No Data State - Show when no data has been queried yet */}
        {!loading && dataQuality.totalPoints === 0 && !lastUpdated && (
          <div className="mt-6 p-6 bg-blue-50 border border-blue-200 rounded-lg text-center">
            <div className="flex flex-col items-center space-y-3">
              <BarChart3 className="w-12 h-12 text-blue-400" />
              <div>
                <h4 className="text-sm font-medium text-blue-800">Ready to Query Data</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Select tags and time range, then click "Query Data" to preview your report data.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* No Data Warning - Show when query returned no results */}
        {!loading && dataQuality.totalPoints === 0 && lastUpdated && config.tags.length > 0 && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-yellow-800">No Data Found</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  No data found for the selected tags in the specified time range.
                  Try adjusting the time range or selecting different tags.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center space-x-4">
            <span>Tags: {config.tags?.length || 0}</span>
            <span>Charts: {config.chartTypes?.length || 0}</span>
            {dataQuality.totalPoints > 0 && (
              <span>Data Points: {dataQuality.totalPoints}</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {lastUpdated && (
              <span className="text-xs">
                Updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <div className="flex items-center">
              <Eye className="w-4 h-4 mr-1" />
              Live Preview
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});