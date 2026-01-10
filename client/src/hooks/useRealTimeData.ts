/**
 * Hook for managing real-time data updates with auto-refresh functionality
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../services/api';
import { useServerSentEvents } from './useApi';

interface RealTimeDataConfig {
  tags: string[];
  timeRange: {
    startTime: Date;
    endTime: Date;
  };
  interval: number; // in seconds (30 or 60)
  enabled?: boolean;
}

interface RealTimeDataState {
  data: Record<string, any[]>;
  sessionId: string | null;
  connected: boolean;
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  updateCount: number;
}

export function useRealTimeData(config: RealTimeDataConfig) {
  const [state, setState] = useState<RealTimeDataState>({
    data: {},
    sessionId: null,
    connected: false,
    loading: false,
    error: null,
    lastUpdate: null,
    updateCount: 0,
  });

  const configRef = useRef(config);
  configRef.current = config;

  // Server-Sent Events connection
  const sseUrl = state.sessionId 
    ? `${process.env.REACT_APP_API_URL || 'http://localhost:3000/api'}/auto-update/stream/${state.sessionId}`
    : '';

  const {
    data: sseData,
    connected: sseConnected,
    error: sseError,
    disconnect: sseDisconnect,
  } = useServerSentEvents(sseUrl, { enabled: !!state.sessionId && config.enabled });

  // Start auto-update session
  const startSession = useCallback(async () => {
    if (state.loading || state.sessionId) {
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await apiService.startAutoUpdate({
        interval: configRef.current.interval,
        tags: configRef.current.tags,
        timeRange: configRef.current.timeRange,
      });

      setState(prev => ({
        ...prev,
        sessionId: response.data.sessionId,
        loading: false,
        connected: true,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to start auto-update session',
      }));
    }
  }, [state.loading, state.sessionId]);

  // Stop auto-update session
  const stopSession = useCallback(async () => {
    if (!state.sessionId) {
      return;
    }

    try {
      await apiService.stopAutoUpdate(state.sessionId);
    } catch (error) {
      console.warn('Failed to stop auto-update session:', error);
    }

    sseDisconnect();
    setState(prev => ({
      ...prev,
      sessionId: null,
      connected: false,
      data: {},
      lastUpdate: null,
      updateCount: 0,
    }));
  }, [state.sessionId, sseDisconnect]);

  // Handle SSE data updates
  useEffect(() => {
    if (sseData) {
      setState(prev => ({
        ...prev,
        data: sseData.data || prev.data,
        lastUpdate: new Date(),
        updateCount: prev.updateCount + 1,
        error: null,
      }));
    }
  }, [sseData]);

  // Handle SSE connection status
  useEffect(() => {
    setState(prev => ({
      ...prev,
      connected: sseConnected && !!prev.sessionId,
    }));
  }, [sseConnected]);

  // Handle SSE errors
  useEffect(() => {
    if (sseError) {
      setState(prev => ({
        ...prev,
        error: sseError,
        connected: false,
      }));
    }
  }, [sseError]);

  // Auto-start session when enabled
  useEffect(() => {
    if (config.enabled && !state.sessionId && !state.loading) {
      startSession();
    } else if (!config.enabled && state.sessionId) {
      stopSession();
    }
  }, [config.enabled, state.sessionId, state.loading, startSession, stopSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (state.sessionId) {
        apiService.stopAutoUpdate(state.sessionId).catch(console.warn);
      }
    };
  }, []);

  // Get session status
  const getStatus = useCallback(async () => {
    if (!state.sessionId) {
      return null;
    }

    try {
      const response = await apiService.getAutoUpdateStatus(state.sessionId);
      return response.data;
    } catch (error) {
      console.warn('Failed to get auto-update status:', error);
      return null;
    }
  }, [state.sessionId]);

  return {
    ...state,
    startSession,
    stopSession,
    getStatus,
    isActive: !!state.sessionId && state.connected,
  };
}

// Hook for managing multiple real-time data streams
export function useMultipleRealTimeData(configs: RealTimeDataConfig[]) {
  const [streams, setStreams] = useState<Map<string, RealTimeDataState>>(new Map());

  const createStream = useCallback((id: string, config: RealTimeDataConfig) => {
    // This would need to be implemented with individual useRealTimeData hooks
    // For now, we'll return a placeholder
    console.warn('useMultipleRealTimeData not fully implemented');
  }, []);

  const removeStream = useCallback((id: string) => {
    setStreams(prev => {
      const newStreams = new Map(prev);
      newStreams.delete(id);
      return newStreams;
    });
  }, []);

  return {
    streams: Array.from(streams.entries()),
    createStream,
    removeStream,
  };
}

// Hook for managing data refresh intervals
export function useDataRefresh(
  fetchData: () => Promise<void>,
  interval: number = 30000, // 30 seconds default
  options: { enabled?: boolean; immediate?: boolean } = {}
) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { enabled = true, immediate = true } = options;

  const refresh = useCallback(async () => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    setError(null);

    try {
      await fetchData();
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchData, isRefreshing]);

  // Start/stop interval based on enabled state
  useEffect(() => {
    if (enabled && interval > 0) {
      intervalRef.current = setInterval(refresh, interval);
      
      // Immediate refresh if requested
      if (immediate) {
        refresh();
      }
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, interval, refresh, immediate]);

  const forceRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  return {
    isRefreshing,
    lastRefresh,
    error,
    forceRefresh,
  };
}