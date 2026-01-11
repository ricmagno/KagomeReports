/**
 * Retry Handler Utility
 * Implements exponential backoff and retry logic for database operations
 */

import { dbLogger } from './logger';

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffFactor: number;
  jitter: boolean;
  retryCondition?: (error: Error) => boolean;
  logCountdown?: boolean;
  onRetry?: (attempt: number, delay: number) => void;
}

export interface RetryResult<T> {
  result?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
}

export class RetryHandler {
  private static defaultOptions: RetryOptions = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    jitter: true,
    logCountdown: false,
    retryCondition: (error: Error) => {
      // Retry on connection errors, timeouts, and temporary failures
      const retryableErrors = [
        'connection',
        'timeout',
        'network',
        'temporary',
        'unavailable',
        'busy',
        'deadlock'
      ];

      return retryableErrors.some(keyword =>
        error.message.toLowerCase().includes(keyword)
      );
    }
  };

  /**
   * Execute a function with retry logic and exponential backoff
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {},
    operationName: string = 'operation'
  ): Promise<T> {
    const config = { ...this.defaultOptions, ...options };
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        dbLogger.debug(`Executing ${operationName}, attempt ${attempt}/${config.maxAttempts}`);

        const result = await operation();

        if (attempt > 1) {
          const duration = Date.now() - startTime;
          dbLogger.info(`${operationName} succeeded after ${attempt} attempts in ${duration}ms`);
        }

        return result;

      } catch (error) {
        lastError = error as Error;

        dbLogger.warn(`${operationName} failed on attempt ${attempt}:`, {
          error: lastError.message,
          attempt,
          maxAttempts: config.maxAttempts
        });

        // Check if we should retry this error
        if (!config.retryCondition || !config.retryCondition(lastError)) {
          dbLogger.error(`${operationName} failed with non-retryable error:`, lastError);
          throw lastError;
        }

        // Don't wait after the last attempt
        if (attempt === config.maxAttempts) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt, config);

        if (config.onRetry) {
          config.onRetry(attempt, delay);
        }

        dbLogger.info(`Retrying ${operationName} in ${delay}ms...`);
        await this.sleep(delay, config.logCountdown);
      }
    }

    const totalDuration = Date.now() - startTime;
    if (lastError) {
      dbLogger.error(`${operationName} failed after ${config.maxAttempts} attempts in ${totalDuration}ms:`, lastError);
      throw lastError;
    }

    throw new Error(`${operationName} failed after ${config.maxAttempts} attempts`);
  }

  /**
   * Execute with retry and return detailed result information
   */
  static async executeWithRetryDetails<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {},
    operationName: string = 'operation'
  ): Promise<RetryResult<T>> {
    const config = { ...this.defaultOptions, ...options };
    const startTime = Date.now();
    let attempts = 0;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      attempts = attempt;
      try {
        const result = await operation();
        return {
          result,
          attempts,
          totalDuration: Date.now() - startTime
        };
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry this error
        if (!config.retryCondition || !config.retryCondition(lastError)) {
          break;
        }

        // Don't wait after the last attempt
        if (attempt === config.maxAttempts) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt, config);

        if (config.onRetry) {
          config.onRetry(attempt, delay);
        }

        await this.sleep(delay, config.logCountdown);
      }
    }

    return {
      error: lastError || new Error(`${operationName} failed after ${config.maxAttempts} attempts`),
      attempts,
      totalDuration: Date.now() - startTime
    };
  }

  /**
   * Calculate delay for exponential backoff with optional jitter
   */
  private static calculateDelay(attempt: number, options: RetryOptions): number {
    // Calculate exponential backoff delay
    let delay = options.baseDelay * Math.pow(options.backoffFactor, attempt - 1);

    // Apply maximum delay limit
    delay = Math.min(delay, options.maxDelay);

    // Add jitter to prevent thundering herd
    if (options.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }

    return Math.max(0, Math.round(delay));
  }

  /**
   * Sleep for specified milliseconds with optional countdown logging
   */
  private static async sleep(ms: number, logCountdown: boolean = false): Promise<void> {
    if (!logCountdown || ms < 1000) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    const totalSeconds = Math.ceil(ms / 1000);

    for (let i = totalSeconds; i > 0; i--) {
      // Log countdown every 5 seconds, or every second for the last 5 seconds
      if (i % 5 === 0 || i <= 5) {
        dbLogger.info(`Next retry attempt in ${i} seconds...`);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Create a retry condition for specific error types
   */
  static createRetryCondition(retryableErrorPatterns: string[]): (error: Error) => boolean {
    return (error: Error) => {
      return retryableErrorPatterns.some(pattern =>
        error.message.toLowerCase().includes(pattern.toLowerCase())
      );
    };
  }

  /**
   * Create retry options for database operations
   */
  static createDatabaseRetryOptions(overrides: Partial<RetryOptions> = {}): RetryOptions {
    return {
      ...this.defaultOptions,
      retryCondition: this.createRetryCondition([
        'connection',
        'timeout',
        'network',
        'temporary',
        'unavailable',
        'busy',
        'deadlock',
        'lock timeout',
        'transport-level error'
      ]),
      ...overrides
    };
  }

  /**
   * Create retry options for network operations
   */
  static createNetworkRetryOptions(overrides: Partial<RetryOptions> = {}): RetryOptions {
    return {
      ...this.defaultOptions,
      maxAttempts: 5,
      baseDelay: 500,
      maxDelay: 10000,
      retryCondition: this.createRetryCondition([
        'network',
        'timeout',
        'connection',
        'econnreset',
        'enotfound',
        'econnrefused'
      ]),
      ...overrides
    };
  }
}