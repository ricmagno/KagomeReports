/**
 * API Error Handler Utilities
 * Provides enhanced error handling, retry logic, and user-friendly error messages
 */

import { ApiError } from '../services/api';

/**
 * Error types for categorization
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  TIMEOUT = 'TIMEOUT',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  VALIDATION = 'VALIDATION',
  NOT_FOUND = 'NOT_FOUND',
  SERVER = 'SERVER',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Categorize error based on status code and error details
 */
export function categorizeError(error: any): ErrorType {
  // Handle ApiError instances
  if (error && typeof error === 'object' && 'status' in error) {
    const status = error.status;

    if (status === 0) return ErrorType.NETWORK;
    if (status === 401) return ErrorType.AUTHENTICATION;
    if (status === 403) return ErrorType.AUTHORIZATION;
    if (status === 404) return ErrorType.NOT_FOUND;
    if (status === 408 || status === 504) return ErrorType.TIMEOUT;
    if (status >= 400 && status < 500) return ErrorType.VALIDATION;
    if (status >= 500) return ErrorType.SERVER;
  }

  if (error?.message?.toLowerCase().includes('network')) {
    return ErrorType.NETWORK;
  }

  if (error?.message?.toLowerCase().includes('timeout')) {
    return ErrorType.TIMEOUT;
  }

  return ErrorType.UNKNOWN;
}

/**
 * Get user-friendly error message based on error type
 */
export function getUserFriendlyMessage(error: any, context?: string): string {
  const errorType = categorizeError(error);
  const contextPrefix = context ? `${context}: ` : '';

  switch (errorType) {
    case ErrorType.NETWORK:
      return `${contextPrefix}Unable to connect to the server. Please check your internet connection and try again.`;

    case ErrorType.TIMEOUT:
      return `${contextPrefix}The request took too long to complete. Please try again.`;

    case ErrorType.AUTHENTICATION:
      return `${contextPrefix}Your session has expired. Please log in again.`;

    case ErrorType.AUTHORIZATION:
      return `${contextPrefix}You don't have permission to perform this action.`;

    case ErrorType.VALIDATION:
      if (error && typeof error === 'object' && error.message) {
        return `${contextPrefix}${error.message}`;
      }
      return `${contextPrefix}The provided information is invalid. Please check your input and try again.`;

    case ErrorType.NOT_FOUND:
      return `${contextPrefix}The requested resource was not found.`;

    case ErrorType.SERVER:
      return `${contextPrefix}A server error occurred. Please try again later.`;

    case ErrorType.UNKNOWN:
    default:
      if (error && typeof error === 'object' && error.message) {
        return `${contextPrefix}${error.message}`;
      }
      if (error?.message) {
        return `${contextPrefix}${error.message}`;
      }
      return `${contextPrefix}An unexpected error occurred. Please try again.`;
  }
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: ErrorType[];
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryableErrors: [
    ErrorType.NETWORK,
    ErrorType.TIMEOUT,
    ErrorType.SERVER,
  ],
};

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: any, config: RetryConfig = DEFAULT_RETRY_CONFIG): boolean {
  const errorType = categorizeError(error);
  return config.retryableErrors.includes(errorType);
}

/**
 * Calculate delay for retry attempt with exponential backoff
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelay);
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (attempt: number, error: any) => void
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if error is not retryable
      if (!isRetryableError(error, config)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === config.maxRetries) {
        throw error;
      }

      // Calculate delay and wait
      const delay = calculateRetryDelay(attempt, config);
      
      // Notify about retry
      if (onRetry) {
        onRetry(attempt, error);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Handle API error with logging and user notification
 */
export function handleApiError(
  error: any,
  context?: string,
  options?: {
    showNotification?: boolean;
    logToConsole?: boolean;
    onError?: (message: string, error: any) => void;
  }
): string {
  const {
    showNotification = true,
    logToConsole = true,
    onError,
  } = options || {};

  const userMessage = getUserFriendlyMessage(error, context);

  // Log to console in development
  if (logToConsole && process.env.NODE_ENV === 'development') {
    console.error(`[API Error] ${context || 'Unknown context'}:`, error);
  }

  // Call error callback if provided
  if (onError) {
    onError(userMessage, error);
  }

  return userMessage;
}

/**
 * Timeout wrapper for promises
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Network status checker
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Wait for network to be online
 */
export function waitForOnline(timeoutMs: number = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isOnline()) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      window.removeEventListener('online', handleOnline);
      reject(new Error('Network connection timeout'));
    }, timeoutMs);

    const handleOnline = () => {
      clearTimeout(timeout);
      window.removeEventListener('online', handleOnline);
      resolve();
    };

    window.addEventListener('online', handleOnline);
  });
}

/**
 * Enhanced fetch with timeout and retry
 */
export async function fetchWithTimeoutAndRetry<T>(
  fetchFn: () => Promise<T>,
  options?: {
    timeout?: number;
    retryConfig?: Partial<RetryConfig>;
    onRetry?: (attempt: number, error: any) => void;
  }
): Promise<T> {
  const {
    timeout = 30000, // 30 seconds default
    retryConfig = {},
    onRetry,
  } = options || {};

  const config: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...retryConfig,
  };

  return retryWithBackoff(
    () => withTimeout(fetchFn(), timeout, 'Request timed out'),
    config,
    onRetry
  );
}
