/**
 * StatusDashboard Component
 * Main container for database status monitoring
 * Requirements: 2.1, 8.1, 8.2, 8.3, 8.4, 8.5
 */

import React, { useState, useEffect, useCallback, useRef, useReducer } from 'react';
import { apiService } from '../../services/api';
import { SystemStatusResponse } from '../../types/systemStatus';
import { RefreshCw, AlertCircle, Download } from 'lucide-react';
import { ErrorCountsCard } from './ErrorCountsCard';
import { ServiceStatusCard } from './ServiceStatusCard';
import { StorageSpaceCard } from './StorageSpaceCard';
import { IOStatisticsCard } from './IOStatisticsCard';
import { PerformanceMetricsCard } from './PerformanceMetricsCard';

interface StatusDashboardProps {
  autoRefresh?: boolean;
  refreshInterval?: number; // seconds, default 30
}

interface StatusDashboardState {
  statusData: SystemStatusResponse | null;
  loading: boolean;
  error: string | null;
  autoRefreshEnabled: boolean;
  countdown: number;
  exporting: boolean;
  showExportMenu: boolean;
}

type StatusAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: SystemStatusResponse; refreshInterval: number }
  | { type: 'FETCH_ERROR'; payload: string }
  | { type: 'TOGGLE_AUTO_REFRESH'; payload?: boolean }
  | { type: 'TICK'; refreshInterval: number }
  | { type: 'SET_EXPORTING'; payload: boolean }
  | { type: 'TOGGLE_EXPORT_MENU' }
  | { type: 'CLOSE_EXPORT_MENU' };

const statusReducer = (state: StatusDashboardState, action: StatusAction): StatusDashboardState => {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        loading: false,
        statusData: action.payload,
        error: null,
        countdown: action.refreshInterval
      };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'TOGGLE_AUTO_REFRESH':
      return {
        ...state,
        autoRefreshEnabled: action.payload !== undefined ? action.payload : !state.autoRefreshEnabled
      };
    case 'TICK':
      if (state.countdown <= 1) {
        return { ...state, countdown: action.refreshInterval };
      }
      return { ...state, countdown: state.countdown - 1 };
    case 'SET_EXPORTING':
      return { ...state, exporting: action.payload };
    case 'TOGGLE_EXPORT_MENU':
      return { ...state, showExportMenu: !state.showExportMenu };
    case 'CLOSE_EXPORT_MENU':
      return { ...state, showExportMenu: false };
    default:
      return state;
  }
};

export const StatusDashboard: React.FC<StatusDashboardProps> = ({
  autoRefresh = true,
  refreshInterval = 30
}) => {
  const [state, dispatch] = useReducer(statusReducer, {
    statusData: null,
    loading: true,
    error: null,
    autoRefreshEnabled: autoRefresh,
    countdown: refreshInterval,
    exporting: false,
    showExportMenu: false
  });

  const { statusData, loading, error, autoRefreshEnabled, countdown, exporting, showExportMenu } = state;
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  /**
   * Fetch status data from API
   */
  const fetchStatusData = useCallback(async (isManual = false) => {
    try {
      dispatch({ type: 'FETCH_START' });

      const response = isManual
        ? await apiService.refreshSystemStatus()
        : await apiService.getSystemStatus() as SystemStatusResponse;

      dispatch({ type: 'FETCH_SUCCESS', payload: response, refreshInterval });
    } catch (err) {
      console.error('Failed to fetch status data:', err);
      dispatch({
        type: 'FETCH_ERROR',
        payload: err instanceof Error ? err.message : 'Failed to load status data'
      });
    }
  }, [refreshInterval]);

  /**
   * Handle manual refresh
   */
  const handleManualRefresh = useCallback(() => {
    fetchStatusData(true);
  }, [fetchStatusData]);

  /**
   * Close export menu when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        dispatch({ type: 'CLOSE_EXPORT_MENU' });
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportMenu]);

  /**
   * Initial data fetch
   */
  useEffect(() => {
    fetchStatusData();
  }, [fetchStatusData]);

  /**
   * Auto-refresh Timer Effect
   */
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const timer = setInterval(() => {
      dispatch({ type: 'TICK', refreshInterval });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefreshEnabled, refreshInterval]);

  /**
   * Trigger refresh when countdown resets
   */
  useEffect(() => {
    if (autoRefreshEnabled && countdown === refreshInterval && !loading) {
      fetchStatusData();
    }
  }, [countdown, autoRefreshEnabled, refreshInterval, loading, fetchStatusData]);

  /**
   * Toggle auto-refresh
   */
  const toggleAutoRefresh = useCallback(() => {
    dispatch({ type: 'TOGGLE_AUTO_REFRESH' });
  }, []);

  /**
   * Handle export
   */
  const handleExport = useCallback(async (format: 'csv' | 'json') => {
    try {
      dispatch({ type: 'SET_EXPORTING', payload: true });
      dispatch({ type: 'CLOSE_EXPORT_MENU' });

      const blob = await apiService.exportSystemStatus(format);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().split('T')[0];
      link.download = `system-status-${timestamp}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      dispatch({ type: 'SET_EXPORTING', payload: false });
    } catch (err) {
      console.error('Failed to export status data:', err);
      dispatch({ type: 'SET_EXPORTING', payload: false });
      dispatch({
        type: 'FETCH_ERROR',
        payload: err instanceof Error ? err.message : 'Failed to export status data'
      });
    }
  }, []);

  /**
   * Toggle export menu
   */
  const toggleExportMenu = useCallback(() => {
    dispatch({ type: 'TOGGLE_EXPORT_MENU' });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Database Status</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                Real-time monitoring of AVEVA Historian system
              </p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              {/* Auto-refresh toggle */}
              <button
                onClick={toggleAutoRefresh}
                className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors touch-manipulation ${autoRefreshEnabled
                  ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400'
                  }`}
              >
                {autoRefreshEnabled ? 'Auto-refresh On' : 'Auto-refresh Off'}
              </button>

              {/* Countdown timer */}
              {autoRefreshEnabled && (
                <div className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                  Next refresh in {countdown}s
                </div>
              )}

              {/* Export button with dropdown */}
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={toggleExportMenu}
                  disabled={exporting || !statusData}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">{exporting ? 'Exporting...' : 'Export'}</span>
                </button>

                {/* Export dropdown menu */}
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                    <button
                      onClick={() => handleExport('json')}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 active:bg-gray-100 rounded-t-lg transition-colors touch-manipulation"
                    >
                      Export as JSON
                    </button>
                    <button
                      onClick={() => handleExport('csv')}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 active:bg-gray-100 rounded-b-lg transition-colors touch-manipulation"
                    >
                      Export as CSV
                    </button>
                  </div>
                )}
              </div>

              {/* Manual refresh button */}
              <button
                onClick={handleManualRefresh}
                disabled={loading}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {/* Last update time */}
          {statusData && (
            <div className="text-xs sm:text-sm text-gray-500 mt-2">
              Last updated: {new Date(statusData.data.timestamp).toLocaleString()}
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Error loading status data</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
              <button
                onClick={handleManualRefresh}
                className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && !statusData && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading status data...</p>
            </div>
          </div>
        )}

        {/* Status cards grid */}
        {statusData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <ErrorCountsCard data={statusData.data.categories.errors} />
            <ServiceStatusCard services={statusData.data.categories.services} />
            <StorageSpaceCard storage={statusData.data.categories.storage} />
            <IOStatisticsCard io={statusData.data.categories.io} />
            <div className="md:col-span-2">
              <PerformanceMetricsCard performance={statusData.data.categories.performance} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusDashboard;
