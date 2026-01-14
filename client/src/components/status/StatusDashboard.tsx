/**
 * StatusDashboard Component
 * Main container for database status monitoring
 * Requirements: 2.1, 8.1, 8.2, 8.3, 8.4, 8.5
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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

export const StatusDashboard: React.FC<StatusDashboardProps> = ({
  autoRefresh = true,
  refreshInterval = 30
}) => {
  const [state, setState] = useState<StatusDashboardState>({
    statusData: null,
    loading: true,
    error: null,
    autoRefreshEnabled: autoRefresh,
    countdown: refreshInterval,
    exporting: false,
    showExportMenu: false
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  /**
   * Close export menu when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setState(prev => ({ ...prev, showExportMenu: false }));
      }
    };

    if (state.showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [state.showExportMenu]);

  /**
   * Fetch status data from API
   */
  const fetchStatusData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await apiService.getSystemStatus() as SystemStatusResponse;
      
      setState(prev => ({
        ...prev,
        statusData: response,
        loading: false,
        error: null,
        countdown: refreshInterval
      }));
    } catch (error) {
      console.error('Failed to fetch status data:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load status data'
      }));
    }
  }, [refreshInterval]);

  /**
   * Handle manual refresh
   */
  const handleManualRefresh = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      // Force refresh with cache clear
      const response = await apiService.refreshSystemStatus();
      
      setState(prev => ({
        ...prev,
        statusData: response,
        loading: false,
        error: null,
        countdown: refreshInterval
      }));
    } catch (error) {
      console.error('Failed to refresh status data:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to refresh status data'
      }));
    }
  }, [refreshInterval]);

  /**
   * Start auto-refresh
   */
  const startAutoRefresh = useCallback(() => {
    // Clear existing intervals
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    // Set up refresh interval
    intervalRef.current = setInterval(() => {
      fetchStatusData();
    }, refreshInterval * 1000);

    // Set up countdown timer
    countdownRef.current = setInterval(() => {
      setState(prev => {
        const newCountdown = prev.countdown - 1;
        if (newCountdown <= 0) {
          return { ...prev, countdown: refreshInterval };
        }
        return { ...prev, countdown: newCountdown };
      });
    }, 1000);

    setState(prev => ({ ...prev, autoRefreshEnabled: true, countdown: refreshInterval }));
  }, [fetchStatusData, refreshInterval]);

  /**
   * Stop auto-refresh
   */
  const stopAutoRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    setState(prev => ({ ...prev, autoRefreshEnabled: false }));
  }, []);

  /**
   * Toggle auto-refresh
   */
  const toggleAutoRefresh = useCallback(() => {
    if (state.autoRefreshEnabled) {
      stopAutoRefresh();
    } else {
      startAutoRefresh();
    }
  }, [state.autoRefreshEnabled, startAutoRefresh, stopAutoRefresh]);

  /**
   * Handle export
   */
  const handleExport = useCallback(async (format: 'csv' | 'json') => {
    try {
      setState(prev => ({ ...prev, exporting: true, showExportMenu: false }));

      const blob = await apiService.exportSystemStatus(format);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().split('T')[0];
      link.download = `system-status-${timestamp}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setState(prev => ({ ...prev, exporting: false }));
    } catch (error) {
      console.error('Failed to export status data:', error);
      setState(prev => ({
        ...prev,
        exporting: false,
        error: error instanceof Error ? error.message : 'Failed to export status data'
      }));
    }
  }, []);

  /**
   * Toggle export menu
   */
  const toggleExportMenu = useCallback(() => {
    setState(prev => ({ ...prev, showExportMenu: !prev.showExportMenu }));
  }, []);

  /**
   * Initial data fetch and auto-refresh setup
   */
  useEffect(() => {
    fetchStatusData();

    if (autoRefresh) {
      startAutoRefresh();
    }

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [fetchStatusData, startAutoRefresh, autoRefresh]);

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
                className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
                  state.autoRefreshEnabled
                    ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400'
                }`}
              >
                {state.autoRefreshEnabled ? 'Auto-refresh On' : 'Auto-refresh Off'}
              </button>

              {/* Countdown timer */}
              {state.autoRefreshEnabled && (
                <div className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                  Next refresh in {state.countdown}s
                </div>
              )}

              {/* Export button with dropdown */}
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={toggleExportMenu}
                  disabled={state.exporting || !state.statusData}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">{state.exporting ? 'Exporting...' : 'Export'}</span>
                </button>

                {/* Export dropdown menu */}
                {state.showExportMenu && (
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
                disabled={state.loading}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
              >
                <RefreshCw className={`w-4 h-4 ${state.loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {/* Last update time */}
          {state.statusData && (
            <div className="text-xs sm:text-sm text-gray-500 mt-2">
              Last updated: {new Date(state.statusData.data.timestamp).toLocaleString()}
            </div>
          )}
        </div>

        {/* Error message */}
        {state.error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Error loading status data</h3>
              <p className="text-red-700 text-sm mt-1">{state.error}</p>
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
        {state.loading && !state.statusData && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading status data...</p>
            </div>
          </div>
        )}

        {/* Status cards grid */}
        {state.statusData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <ErrorCountsCard data={state.statusData.data.categories.errors} />
            <ServiceStatusCard services={state.statusData.data.categories.services} />
            <StorageSpaceCard storage={state.statusData.data.categories.storage} />
            <IOStatisticsCard io={state.statusData.data.categories.io} />
            <div className="md:col-span-2">
              <PerformanceMetricsCard performance={state.statusData.data.categories.performance} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusDashboard;
