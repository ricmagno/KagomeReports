import { useState, useCallback } from 'react';
import {
  handleApiError,
  fetchWithTimeoutAndRetry,
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
} from '../utils/apiErrorHandler';

/**
 * Options for API call with error handling
 */
export interface UseApiOptions {
  timeout?: number;
  retryConfig?: Partial<RetryConfig>;
  onSuccess?: (data: any) => void;
  onError?: (message: string, error: any) => void;
  showNotification?: boolean;
  context?: string;
}

/**
 * State for API call
 */
export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook for API calls with error handling and retry logic
 */
export function useApiWithErrorHandling<T = any>() {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const [retryCount, setRetryCount] = useState(0);

  /**
   * Execute API call with error handling
   */
  const execute = useCallback(
    async (
      apiCall: () => Promise<T>,
      options?: UseApiOptions
    ): Promise<T | null> => {
      const {
        timeout = 30000,
        retryConfig = {},
        onSuccess,
        onError,
        showNotification = true,
        context,
      } = options || {};

      setState({
        data: null,
        loading: true,
        error: null,
      });

      setRetryCount(0);

      try {
        const result = await fetchWithTimeoutAndRetry(
          apiCall,
          {
            timeout,
            retryConfig: {
              ...DEFAULT_RETRY_CONFIG,
              ...retryConfig,
            },
            onRetry: (attempt, error) => {
              setRetryCount(attempt);
              console.log(`Retry attempt ${attempt} after error:`, error);
            },
          }
        );

        setState({
          data: result,
          loading: false,
          error: null,
        });

        if (onSuccess) {
          onSuccess(result);
        }

        return result;
      } catch (error) {
        const errorMessage = handleApiError(error, context, {
          showNotification,
          onError,
        });

        setState({
          data: null,
          loading: false,
          error: errorMessage,
        });

        return null;
      }
    },
    []
  );

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    });
    setRetryCount(0);
  }, []);

  return {
    ...state,
    execute,
    reset,
    retryCount,
  };
}

/**
 * Custom hook for multiple API calls with error handling
 */
export function useMultipleApiCalls() {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * Execute multiple API calls in parallel
   */
  const executeAll = useCallback(
    async <T extends Record<string, () => Promise<any>>>(
      apiCalls: T,
      options?: {
        timeout?: number;
        retryConfig?: Partial<RetryConfig>;
        onSuccess?: (results: { [K in keyof T]: any }) => void;
        onError?: (errors: Record<string, string>) => void;
      }
    ): Promise<{ [K in keyof T]: any } | null> => {
      const {
        timeout = 30000,
        retryConfig = {},
        onSuccess,
        onError,
      } = options || {};

      setLoading(true);
      setErrors({});

      const results: any = {};
      const errorMap: Record<string, string> = {};

      await Promise.all(
        Object.entries(apiCalls).map(async ([key, apiCall]) => {
          try {
            const result = await fetchWithTimeoutAndRetry(
              apiCall as () => Promise<any>,
              {
                timeout,
                retryConfig: {
                  ...DEFAULT_RETRY_CONFIG,
                  ...retryConfig,
                },
              }
            );
            results[key] = result;
          } catch (error) {
            const errorMessage = handleApiError(error, key, {
              showNotification: false,
            });
            errorMap[key] = errorMessage;
          }
        })
      );

      setLoading(false);

      if (Object.keys(errorMap).length > 0) {
        setErrors(errorMap);
        if (onError) {
          onError(errorMap);
        }
        return null;
      }

      if (onSuccess) {
        onSuccess(results);
      }

      return results;
    },
    []
  );

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setLoading(false);
    setErrors({});
  }, []);

  return {
    loading,
    errors,
    executeAll,
    reset,
  };
}
