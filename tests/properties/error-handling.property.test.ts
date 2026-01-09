/**
 * Property-Based Tests for Error Handling and Retry Logic
 * Feature: historian-reporting, Property 12: Error Handling and Retry Logic
 * Validates: Requirements 1.4, 7.4, 8.4
 */

import fc from 'fast-check';
import { RetryHandler, RetryOptions } from '@/utils/retryHandler';

// Mock logger to avoid noise in tests
jest.mock('@/utils/logger', () => ({
  dbLogger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

// Generators for retry configuration
const retryOptionsGen = fc.record({
  maxAttempts: fc.integer({ min: 1, max: 3 }),
  baseDelay: fc.integer({ min: 10, max: 50 }),
  maxDelay: fc.integer({ min: 100, max: 500 }),
  backoffFactor: fc.float({ min: Math.fround(1.1), max: Math.fround(2.0) }),
  jitter: fc.boolean(),
});

// Error type generators
const retryableErrorGen = fc.oneof(
  fc.constant(new Error('Connection timeout')),
  fc.constant(new Error('Network error occurred')),
  fc.constant(new Error('Temporary service unavailable')),
  fc.constant(new Error('Database connection lost')),
  fc.constant(new Error('Lock timeout expired')),
  fc.constant(new Error('Deadlock detected')),
);

const nonRetryableErrorGen = fc.oneof(
  fc.constant(new Error('Authentication failed')),
  fc.constant(new Error('Permission denied')),
  fc.constant(new Error('Invalid syntax')),
  fc.constant(new Error('Table does not exist')),
  fc.constant(new Error('Constraint violation')),
);

describe('Property 12: Error Handling and Retry Logic', () => {
  /**
   * Property: For any system component that encounters failures, 
   * retry attempts should follow exponential backoff patterns with configured maximum retry limits
   */
  test('should implement exponential backoff with configured retry limits', async () => {
    await fc.assert(
      fc.asyncProperty(
        retryOptionsGen,
        retryableErrorGen,
        async (options, error) => {
          let attemptCount = 0;
          const attemptTimes: number[] = [];
          
          const failingOperation = async () => {
            attemptCount++;
            attemptTimes.push(Date.now());
            throw error;
          };

          const startTime = Date.now();
          
          // Should fail after max attempts
          await expect(
            RetryHandler.executeWithRetry(failingOperation, options, 'test-operation')
          ).rejects.toThrow(error.message);
          
          // Should have attempted exactly maxAttempts times
          expect(attemptCount).toBe(options.maxAttempts);
          
          // Verify exponential backoff pattern (if multiple attempts)
          if (attemptTimes.length > 1) {
            for (let i = 1; i < attemptTimes.length; i++) {
              const actualDelay = attemptTimes[i]! - attemptTimes[i - 1]!;
              const expectedBaseDelay = options.baseDelay * Math.pow(options.backoffFactor, i - 1);
              const expectedDelay = Math.min(expectedBaseDelay, options.maxDelay);
              
              // Allow for timing variations and jitter (±70% tolerance for test stability)
              const tolerance = options.jitter ? 0.7 : 0.5;
              const minExpectedDelay = expectedDelay * (1 - tolerance);
              
              expect(actualDelay).toBeGreaterThanOrEqual(Math.max(0, minExpectedDelay));
            }
          }
          
          // Total execution time should be reasonable
          const totalTime = Date.now() - startTime;
          const maxExpectedTime = options.maxDelay * options.maxAttempts * 2; // Conservative upper bound
          expect(totalTime).toBeLessThan(maxExpectedTime);
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: Retryable errors should be retried according to configuration,
   * while non-retryable errors should fail immediately
   */
  test('should distinguish between retryable and non-retryable errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        retryOptionsGen,
        fc.oneof(retryableErrorGen, nonRetryableErrorGen),
        async (options, error) => {
          let attemptCount = 0;
          
          const failingOperation = async () => {
            attemptCount++;
            throw error;
          };

          const isRetryableError = ['connection', 'timeout', 'network', 'temporary', 'unavailable', 'busy', 'deadlock']
            .some(keyword => error.message.toLowerCase().includes(keyword));

          await expect(
            RetryHandler.executeWithRetry(failingOperation, options, 'test-operation')
          ).rejects.toThrow(error.message);

          if (isRetryableError) {
            // Should retry retryable errors up to maxAttempts
            expect(attemptCount).toBe(options.maxAttempts);
          } else {
            // Should fail immediately for non-retryable errors
            expect(attemptCount).toBe(1);
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Successful operations should not be retried and should return immediately
   */
  test('should not retry successful operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        retryOptionsGen,
        fc.anything(),
        async (options, expectedResult) => {
          let attemptCount = 0;
          
          const successfulOperation = async () => {
            attemptCount++;
            return expectedResult;
          };

          const startTime = Date.now();
          const result = await RetryHandler.executeWithRetry(
            successfulOperation, 
            options, 
            'test-operation'
          );
          const duration = Date.now() - startTime;

          // Should succeed on first attempt
          expect(attemptCount).toBe(1);
          expect(result).toBe(expectedResult);
          
          // Should complete quickly (no retry delays)
          expect(duration).toBeLessThan(100); // Allow for execution overhead
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: Operations that succeed after initial failures should return correct results
   */
  test('should succeed after initial failures and return correct results', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 2 }), // Number of failures before success
        retryOptionsGen,
        fc.anything(), // Expected result
        async (failuresBeforeSuccess, options, expectedResult) => {
          // Ensure we have enough retry attempts
          const adjustedOptions = {
            ...options,
            maxAttempts: Math.max(options.maxAttempts, failuresBeforeSuccess + 1)
          };
          
          let attemptCount = 0;
          
          const eventuallySuccessfulOperation = async () => {
            attemptCount++;
            
            if (attemptCount <= failuresBeforeSuccess) {
              throw new Error('Temporary connection failure'); // Retryable error
            }
            
            return expectedResult;
          };

          const result = await RetryHandler.executeWithRetry(
            eventuallySuccessfulOperation,
            adjustedOptions,
            'test-operation'
          );

          // Should have attempted exactly failuresBeforeSuccess + 1 times
          expect(attemptCount).toBe(failuresBeforeSuccess + 1);
          expect(result).toBe(expectedResult);
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: Retry delay should respect maximum delay configuration
   */
  test('should respect maximum delay configuration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          maxAttempts: fc.integer({ min: 2, max: 3 }),
          baseDelay: fc.integer({ min: 10, max: 50 }),
          maxDelay: fc.integer({ min: 100, max: 300 }),
          backoffFactor: fc.float({ min: Math.fround(1.5), max: Math.fround(2.0) }),
          jitter: fc.constant(false), // Disable jitter for precise timing
        }),
        async (options) => {
          let attemptCount = 0;
          const attemptTimes: number[] = [];
          
          const failingOperation = async () => {
            attemptCount++;
            attemptTimes.push(Date.now());
            throw new Error('Connection timeout'); // Retryable error
          };

          await expect(
            RetryHandler.executeWithRetry(failingOperation, options, 'test-operation')
          ).rejects.toThrow();

          // Check that delays don't exceed maxDelay
          if (attemptTimes.length > 1) {
            for (let i = 1; i < attemptTimes.length; i++) {
              const actualDelay = attemptTimes[i]! - attemptTimes[i - 1]!;
              
              // Allow for execution overhead but delay should not significantly exceed maxDelay
              expect(actualDelay).toBeLessThanOrEqual(options.maxDelay + 100);
            }
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: Custom retry conditions should be respected
   */
  test('should respect custom retry conditions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 3, maxLength: 10 }), { minLength: 1, maxLength: 3 }),
        fc.string({ minLength: 5, maxLength: 20 }),
        async (retryablePatterns, errorMessage) => {
          const customRetryCondition = (error: Error) => {
            return retryablePatterns.some(pattern => 
              error.message.toLowerCase().includes(pattern.toLowerCase())
            );
          };

          const options: Partial<RetryOptions> = {
            maxAttempts: 3,
            baseDelay: 10,
            retryCondition: customRetryCondition
          };

          let attemptCount = 0;
          const failingOperation = async () => {
            attemptCount++;
            throw new Error(errorMessage);
          };

          await expect(
            RetryHandler.executeWithRetry(failingOperation, options, 'test-operation')
          ).rejects.toThrow(errorMessage);

          const shouldRetry = retryablePatterns.some(pattern => 
            errorMessage.toLowerCase().includes(pattern.toLowerCase())
          );

          if (shouldRetry) {
            expect(attemptCount).toBe(3); // Should retry
          } else {
            expect(attemptCount).toBe(1); // Should not retry
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Retry handler should provide accurate execution details
   */
  test('should provide accurate retry execution details', async () => {
    await fc.assert(
      fc.asyncProperty(
        retryOptionsGen,
        fc.integer({ min: 0, max: 1 }), // Failures before success (0 = immediate success, 1 = one failure then success)
        async (options, failuresBeforeSuccess) => {
          let attemptCount = 0;
          const startTime = Date.now();
          
          const operation = async () => {
            attemptCount++;
            
            if (attemptCount <= failuresBeforeSuccess) {
              throw new Error('Temporary failure');
            }
            
            return 'success';
          };

          // Ensure we have enough attempts to succeed
          const adjustedOptions = {
            ...options,
            maxAttempts: Math.max(options.maxAttempts, failuresBeforeSuccess + 1)
          };

          const result = await RetryHandler.executeWithRetryDetails(
            operation,
            adjustedOptions,
            'test-operation'
          );

          const endTime = Date.now();

          // Should always succeed with adjusted options
          expect(result.result).toBe('success');
          expect(result.error).toBeUndefined();
          expect(result.attempts).toBe(failuresBeforeSuccess + 1);

          // Verify timing
          expect(result.totalDuration).toBeGreaterThanOrEqual(0);
          expect(result.totalDuration).toBeLessThanOrEqual(endTime - startTime + 100); // Allow for execution overhead
        }
      ),
      { numRuns: 5 }
    );
  });
});