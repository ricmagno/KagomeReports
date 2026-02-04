/**
 * Report Preview Component
 * Displays a preview of the report configuration and generated content with real data
 * Requirements: 5.4
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Eye,
  Download,
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
import { getTagColor, getTagIndex } from '../charts/chartUtils';
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

export const ReportPreview: React.FC<ReportPreviewProps> = ({
  config,
  onEdit,
  className = ''
}) => {

  const [previewData, setPreviewData] = useState<PreviewData>({
    dataPoints: {},
    statistics: {},
    loading: false,
    error: null,
    tagDescriptions: {},
    tagUnits: {},
    lastUpdated: null
  });

  // Load preview data
  const loadPreviewData = React.useCallback(async () => {
    if (!config.tags || config.tags.length === 0 || !config.timeRange) {
      setPreviewData(prev => ({
        ...prev,
        error: 'Please select tags and time range before querying data'
      }));
      return;
    }

    setPreviewData(prev => ({ ...prev, loading: true, error: null }));

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
              // Use wwResolution 60000 (1 minute) as a reasonable default for previews
              // @ts-ignore - wwResolution might not be in the type definition yet
              wwResolution: 60000
            }
          );
          return { tagName, data: response.success ? response.data : [] };
        } catch (error) {
          console.warn(`Failed to load preview data for tag ${tagName}:`, error);
          return { tagName, data: [] };
        }
      });

      const results = await Promise.all(dataPromises);
      const dataPoints: Record<string, TimeSeriesData[]> = {};

      results.forEach(({ tagName, data }) => {
        dataPoints[tagName] = data;
      });

      // Load statistics for tags with data
      const statistics: Record<string, StatisticsResult> = {};
      for (const [tagName, data] of Object.entries(dataPoints)) {
        if (data.length > 0) {
          try {
            const statsResponse = await apiService.getStatistics(
              tagName,
              config.timeRange.startTime,
              config.timeRange.endTime
            );
            if (statsResponse.success) {
              statistics[tagName] = statsResponse.data;
            }
          } catch (error) {
            console.warn(`Failed to load statistics for tag ${tagName}:`, error);
          }
        }
      }

      // Load tag descriptions and units
      const tagDescriptions: Record<string, string> = {};
      const tagUnits: Record<string, string> = {};
      await Promise.all(config.tags.map(async (tagName) => {
        try {
          const response = await apiService.getTags(tagName);
          if (response.success && response.data) {
            // Find exact match
            const tagInfo = response.data.find(t => t.name === tagName);
            if (tagInfo) {
              tagDescriptions[tagName] = tagInfo.description;
              tagUnits[tagName] = tagInfo.units;
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch tag info for ${tagName}:`, error);
        }
      }));

      setPreviewData({
        dataPoints,
        statistics,
        tagDescriptions,
        tagUnits,
        loading: false,
        error: null,
        lastUpdated: new Date()
      });
    } catch (error) {
      setPreviewData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load preview data'
      }));
    }
  }, [config.tags, config.timeRange, config.name, config.description, config.chartTypes, config.template]);

  // Auto-update preview data when report configuration changes
  useEffect(() => {
    // Only auto-update if we have at least one tag (the same condition that enables the Query Data button)
    if (config.tags && config.tags.length > 0) {
      const timer = setTimeout(() => {
        loadPreviewData();
      }, 1000); // 1 second debounce
      return () => clearTimeout(timer);
    }
    // We want to clear data if tags are removed
    else if (config.tags && config.tags.length === 0 && Object.keys(previewData.dataPoints).length > 0) {
      setPreviewData(prev => ({
        ...prev,
        dataPoints: {},
        statistics: {},
        lastUpdated: null
      }));
    }
  }, [loadPreviewData]);

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
              {previewData.loading && (
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
                  const tagData = previewData.dataPoints[tag] || [];
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
                      {!previewData.loading && (
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
            {!previewData.loading && dataQuality.totalPoints > 0 && (
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
            {previewData.error && (
              <div className="flex items-center space-x-2 text-xs sm:text-sm text-red-600 mt-2">
                <AlertCircle className="w-3.5 h-3.5" />
                <span className="break-words">{previewData.error}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
              onClick={loadPreviewData}
              disabled={previewData.loading || !config.tags?.length}
              className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {previewData.loading ? (
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
              disabled={previewData.loading || dataQuality.totalPoints === 0}
              className="px-2.5 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200"
              title="Refresh preview data"
            >
              <RefreshCw className={`w-4 h-4 ${previewData.loading ? 'animate-spin' : ''}`} />
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
          {!previewData.loading && Object.keys(previewData.statistics).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2" />
                Statistics
              </h4>
              <div className="text-sm text-gray-600">
                {Object.entries(previewData.statistics).slice(0, 2).map(([tagName, stats]) => (
                  <div key={tagName} className="mb-1">
                    <div className="font-medium text-xs text-gray-700">{tagName}:</div>
                    <div className="text-xs">
                      Avg: {typeof stats?.average === 'number' ? stats.average.toFixed(2) : 'N/A'},
                      Range: {typeof stats?.min === 'number' ? stats.min.toFixed(2) : 'N/A'}-{typeof stats?.max === 'number' ? stats.max.toFixed(2) : 'N/A'}
                    </div>
                  </div>
                ))}
                {Object.keys(previewData.statistics).length > 2 && (
                  <div className="text-xs text-gray-500">
                    +{Object.keys(previewData.statistics).length - 2} more tags
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

        {/* Data Visualization Preview */}
        {!previewData.loading && dataQuality.totalPoints > 0 && (
          <div className="mt-8">
            <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center px-1">
              <TrendingUp className="w-4 h-4 mr-2" />
              Trends
            </h4>
            <div className="grid grid-cols-1 gap-6 sm:gap-8">
              {/* Combined Multi-Trend View (only if multiple tags selected) */}
              {Object.keys(previewData.dataPoints).filter(tag => previewData.dataPoints[tag].length > 0).length > 1 && (
                <InteractiveChart
                  dataPoints={previewData.dataPoints}
                  tagDescriptions={previewData.tagDescriptions}
                  tags={config.tags}
                  title={config.name}
                  description={config.description}
                  width="100%"
                  height={320}
                  className="mb-4"
                  enableGuideLines={true}
                  displayMode="multi"
                  type={config.chartTypes[0] as any || 'line'}
                  includeTrendLines={config.includeTrendLines}
                />
              )}

              {config.tags
                .filter(tagName => previewData.dataPoints[tagName]?.length > 0)
                .slice(0, 4) // Show top 4 tags in large format
                .map((tagName) => {
                  const data = previewData.dataPoints[tagName];

                  return (
                    <InteractiveChart
                      key={tagName}
                      dataPoints={{ [tagName]: data }}
                      tagDescriptions={previewData.tagDescriptions}
                      tagName={tagName}
                      width="100%"
                      height={320}
                      title={tagName}
                      description={previewData.tagDescriptions[tagName]}
                      units={previewData.tagUnits[tagName]}
                      statistics={previewData.statistics[tagName]}
                      color={tagColors[tagName]}
                      className="shadow-md border-gray-300"
                      enableGuideLines={true}
                      displayMode="single"
                      type={config.chartTypes[0] as any || 'line'}
                      includeTrendLines={config.includeTrendLines}
                    />
                  );
                })}
            </div>
            {Object.keys(previewData.dataPoints).length > 6 && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                +{Object.keys(previewData.dataPoints).length - 6} more charts will be included in the report
              </p>
            )}

            {/* Data Preview Table */}
            <div className="mt-8">
              <DataPreviewTable
                data={Object.values(previewData.dataPoints).flat()}
                loading={previewData.loading}
                error={previewData.error}
                onRetry={loadPreviewData}
                reportName={config.name}
              />
            </div>
          </div>
        )}

        {/* No Data State - Show when no data has been queried yet */}
        {!previewData.loading && dataQuality.totalPoints === 0 && !previewData.lastUpdated && (
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
        {!previewData.loading && dataQuality.totalPoints === 0 && previewData.lastUpdated && config.tags.length > 0 && (
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
            {previewData.lastUpdated && (
              <span className="text-xs">
                Updated: {previewData.lastUpdated.toLocaleTimeString()}
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
};