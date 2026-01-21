/**
 * Analytics Error Handler
 * Provides structured error handling and graceful degradation for analytics calculations
 * Requirements: 9.1, 9.3, 9.4, 9.5
 */

import { reportLogger } from './logger';

/**
 * Error types for analytics operations
 */
export type AnalyticsErrorType = 
  | 'insufficient_data'
  | 'invalid_config'
  | 'calculation'
  | 'rendering';

/**
 * Structured error information for analytics operations
 */
export interface AnalyticsError {
  type: AnalyticsErrorType;
  message: string;
  tagName?: string | undefined;
  metric?: string | undefined;
  recoverable: boolean;
  timestamp: Date;
  details?: Record<string, any> | undefined;
}

/**
 * Result of an analytics operation that may have failed gracefully
 */
export interface AnalyticsResult<T> {
  success: boolean;
  data?: T;
  error?: AnalyticsError;
}

/**
 * Error handler for analytics calculations with graceful degradation support
 */
export class AnalyticsErrorHandler {
  private errors: AnalyticsError[] = [];

  /**
   * Handle an error during analytics processing
   * @param error - The error information
   * @throws Error if the error is not recoverable
   */
  handleError(error: AnalyticsError): void {
    // Log error with structured data
    reportLogger.error('Analytics error occurred', {
      type: error.type,
      message: error.message,
      tagName: error.tagName,
      metric: error.metric,
      recoverable: error.recoverable,
      timestamp: error.timestamp.toISOString(),
      details: error.details
    });

    // Store error for reporting
    this.errors.push(error);

    // Throw if not recoverable
    if (!error.recoverable) {
      throw new Error(`Unrecoverable analytics error: ${error.message}`);
    }
  }

  /**
   * Wrap an analytics operation with error handling
   * @param operation - The operation to execute
   * @param errorContext - Context information for error reporting
   * @returns Result with data or error information
   */
  async wrapOperation<T>(
    operation: () => Promise<T> | T,
    errorContext: {
      type: AnalyticsErrorType;
      tagName?: string;
      metric?: string;
      recoverable?: boolean;
    }
  ): Promise<AnalyticsResult<T>> {
    try {
      const data = await operation();
      return {
        success: true,
        data
      };
    } catch (error) {
      const analyticsError: AnalyticsError = {
        type: errorContext.type,
        message: error instanceof Error ? error.message : 'Unknown error',
        tagName: errorContext.tagName,
        metric: errorContext.metric,
        recoverable: errorContext.recoverable ?? true,
        timestamp: new Date(),
        details: {
          originalError: error instanceof Error ? error.stack : String(error)
        }
      };

      this.handleError(analyticsError);

      return {
        success: false,
        error: analyticsError
      };
    }
  }

  /**
   * Create an insufficient data error
   */
  createInsufficientDataError(
    tagName: string,
    analysisType: string,
    dataPoints: number,
    required: number
  ): AnalyticsError {
    return {
      type: 'insufficient_data',
      message: `Insufficient data for ${analysisType}: ${dataPoints} points provided, ${required} required`,
      tagName,
      metric: analysisType,
      recoverable: true,
      timestamp: new Date(),
      details: {
        dataPoints,
        required,
        analysisType
      }
    };
  }

  /**
   * Create an invalid configuration error
   */
  createInvalidConfigError(
    message: string,
    tagName?: string,
    details?: Record<string, any>
  ): AnalyticsError {
    return {
      type: 'invalid_config',
      message,
      tagName,
      recoverable: false,
      timestamp: new Date(),
      details
    };
  }

  /**
   * Create a calculation error
   */
  createCalculationError(
    metric: string,
    message: string,
    tagName?: string,
    details?: Record<string, any>
  ): AnalyticsError {
    return {
      type: 'calculation',
      message,
      tagName,
      metric,
      recoverable: true,
      timestamp: new Date(),
      details
    };
  }

  /**
   * Create a rendering error
   */
  createRenderingError(
    tagName: string,
    chartType: string,
    message: string,
    details?: Record<string, any>
  ): AnalyticsError {
    return {
      type: 'rendering',
      message,
      tagName,
      metric: chartType,
      recoverable: true,
      timestamp: new Date(),
      details
    };
  }

  /**
   * Get all errors that have occurred
   */
  getErrors(): AnalyticsError[] {
    return [...this.errors];
  }

  /**
   * Check if any errors have occurred
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Get errors for a specific tag
   */
  getErrorsForTag(tagName: string): AnalyticsError[] {
    return this.errors.filter(e => e.tagName === tagName);
  }

  /**
   * Get errors by type
   */
  getErrorsByType(type: AnalyticsErrorType): AnalyticsError[] {
    return this.errors.filter(e => e.type === type);
  }

  /**
   * Clear all stored errors
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * Get a summary of errors
   */
  getErrorSummary(): {
    total: number;
    byType: Record<AnalyticsErrorType, number>;
    recoverable: number;
    unrecoverable: number;
  } {
    const byType: Record<AnalyticsErrorType, number> = {
      insufficient_data: 0,
      invalid_config: 0,
      calculation: 0,
      rendering: 0
    };

    let recoverable = 0;
    let unrecoverable = 0;

    for (const error of this.errors) {
      byType[error.type]++;
      if (error.recoverable) {
        recoverable++;
      } else {
        unrecoverable++;
      }
    }

    return {
      total: this.errors.length,
      byType,
      recoverable,
      unrecoverable
    };
  }
}

/**
 * Singleton instance for global error handling
 */
export const analyticsErrorHandler = new AnalyticsErrorHandler();
