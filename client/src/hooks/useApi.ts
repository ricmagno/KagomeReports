/**
 * Custom hook for managing API calls with loading states and error handling
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ApiError } from '../services/api';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
}

interface UseApiOptions {
  immediate?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: ApiError) => void;
}

export function useApi<T>(
  apiCall: (...args: any[]) => Promise<T>,
  options: UseApiOptions = {}
) {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const { immediate = false, onSuccess, onError } = options;

  const execute = useCallback(async (...args: any[]) => {
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
    }));

    try {
      const result = await apiCall(...args);
      
      // Check if request was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      setState({
        data: result,
        loading: false,
        error: null,
      });

      onSuccess?.(result);
      return result;
    } catch (error) {
      // Check if request was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      const apiError = error instanceof ApiError ? error : new ApiError(0, 'Unknown error');
      
      setState({
        data: null,
        loading: false,
        error: apiError,
      });

      onError?.(apiError);
      throw apiError;
    }
  }, [apiCall, onSuccess, onError]);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setState({
      data: null,
      loading: false,
      error: null,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Execute immediately if requested
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  return {
    ...state,
    execute,
    reset,
  };
}

// Specialized hook for paginated data
export function usePaginatedApi<T>(
  apiCall: (page: number, limit: number, ...args: any[]) => Promise<{ data: T[]; total: number; page: number; limit: number }>,
  initialLimit: number = 10
) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);
  const [allData, setAllData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);

  const {
    data: response,
    loading,
    error,
    execute: executeBase,
    reset: resetBase,
  } = useApi(apiCall);

  const execute = useCallback(async (...args: any[]) => {
    const result = await executeBase(page, limit, ...args);
    
    if (result) {
      setAllData(result.data);
      setTotal(result.total);
    }
    
    return result;
  }, [executeBase, page, limit]);

  const loadMore = useCallback(async (...args: any[]) => {
    if (loading || !response || allData.length >= total) {
      return;
    }

    const nextPage = page + 1;
    const result = await executeBase(nextPage, limit, ...args);
    
    if (result) {
      setAllData(prev => [...prev, ...result.data]);
      setPage(nextPage);
    }
    
    return result;
  }, [executeBase, loading, response, allData.length, total, page, limit]);

  const reset = useCallback(() => {
    setPage(1);
    setAllData([]);
    setTotal(0);
    resetBase();
  }, [resetBase]);

  const changePage = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const changeLimit = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  }, []);

  return {
    data: allData,
    total,
    page,
    limit,
    loading,
    error,
    execute,
    loadMore,
    reset,
    changePage,
    changeLimit,
    hasMore: allData.length < total,
  };
}

// Hook for real-time updates using Server-Sent Events
export function useServerSentEvents(url: string, options: { enabled?: boolean } = {}) {
  const [data, setData] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const { enabled = true } = options;

  useEffect(() => {
    if (!enabled || !url) {
      return;
    }

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data);
        setData(parsedData);
      } catch (err) {
        setData(event.data);
      }
    };

    eventSource.onerror = (event) => {
      setConnected(false);
      setError('Connection error');
      console.error('EventSource error:', event);
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [url, enabled]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setConnected(false);
    }
  }, []);

  return {
    data,
    connected,
    error,
    disconnect,
  };
}

// Hook for managing multiple API calls
export function useMultipleApi<T extends Record<string, any>>(
  apiCalls: { [K in keyof T]: () => Promise<T[K]> }
) {
  const [states, setStates] = useState<{
    [K in keyof T]: UseApiState<T[K]>
  }>(() => {
    const initialState = {} as any;
    Object.keys(apiCalls).forEach(key => {
      initialState[key] = {
        data: null,
        loading: false,
        error: null,
      };
    });
    return initialState;
  });

  const execute = useCallback(async (keys?: (keyof T)[]) => {
    const keysToExecute = keys || Object.keys(apiCalls);
    
    // Set loading state for specified keys
    setStates(prev => {
      const newState = { ...prev };
      keysToExecute.forEach(key => {
        newState[key] = {
          ...newState[key],
          loading: true,
          error: null,
        };
      });
      return newState;
    });

    const results = await Promise.allSettled(
      keysToExecute.map(key => apiCalls[key]())
    );

    // Update states based on results
    setStates(prev => {
      const newState = { ...prev };
      keysToExecute.forEach((key, index) => {
        const result = results[index];
        if (result.status === 'fulfilled') {
          newState[key] = {
            data: result.value,
            loading: false,
            error: null,
          };
        } else {
          const apiError = result.reason instanceof ApiError 
            ? result.reason 
            : new ApiError(0, 'Unknown error');
          
          newState[key] = {
            data: null,
            loading: false,
            error: apiError,
          };
        }
      });
      return newState;
    });

    return results;
  }, [apiCalls]);

  const reset = useCallback((keys?: (keyof T)[]) => {
    const keysToReset = keys || Object.keys(apiCalls);
    
    setStates(prev => {
      const newState = { ...prev };
      keysToReset.forEach(key => {
        newState[key] = {
          data: null,
          loading: false,
          error: null,
        };
      });
      return newState;
    });
  }, [apiCalls]);

  const isLoading = Object.values(states).some((state: any) => state.loading);
  const hasError = Object.values(states).some((state: any) => state.error);

  return {
    states,
    execute,
    reset,
    isLoading,
    hasError,
  };
}