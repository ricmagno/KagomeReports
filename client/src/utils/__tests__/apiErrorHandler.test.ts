import {
  categorizeError,
  getUserFriendlyMessage,
  isRetryableError,
  calculateRetryDelay,
  ErrorType,
  DEFAULT_RETRY_CONFIG,
} from '../apiErrorHandler';
import { ApiError } from '../../services/api';

describe('apiErrorHandler', () => {
  describe('categorizeError', () => {
    it('should categorize network errors', () => {
      const error = new ApiError(0, 'Network error');
      expect(categorizeError(error)).toBe(ErrorType.NETWORK);
    });

    it('should categorize authentication errors', () => {
      const error = new ApiError(401, 'Unauthorized');
      expect(categorizeError(error)).toBe(ErrorType.AUTHENTICATION);
    });

    it('should categorize authorization errors', () => {
      const error = new ApiError(403, 'Forbidden');
      expect(categorizeError(error)).toBe(ErrorType.AUTHORIZATION);
    });

    it('should categorize not found errors', () => {
      const error = new ApiError(404, 'Not found');
      expect(categorizeError(error)).toBe(ErrorType.NOT_FOUND);
    });

    it('should categorize timeout errors', () => {
      const error = new ApiError(408, 'Request timeout');
      expect(categorizeError(error)).toBe(ErrorType.TIMEOUT);
    });

    it('should categorize validation errors', () => {
      const error = new ApiError(400, 'Bad request');
      expect(categorizeError(error)).toBe(ErrorType.VALIDATION);
    });

    it('should categorize server errors', () => {
      const error = new ApiError(500, 'Internal server error');
      expect(categorizeError(error)).toBe(ErrorType.SERVER);
    });

    it('should categorize unknown errors', () => {
      const error = new Error('Unknown error');
      expect(categorizeError(error)).toBe(ErrorType.UNKNOWN);
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('should return user-friendly message for network errors', () => {
      const error = new ApiError(0, 'Network error');
      const message = getUserFriendlyMessage(error);
      expect(message).toContain('Unable to connect');
    });

    it('should return user-friendly message for timeout errors', () => {
      const error = new ApiError(408, 'Timeout');
      const message = getUserFriendlyMessage(error);
      expect(message).toContain('took too long');
    });

    it('should return user-friendly message for authentication errors', () => {
      const error = new ApiError(401, 'Unauthorized');
      const message = getUserFriendlyMessage(error);
      expect(message).toContain('session has expired');
    });

    it('should include context in error message', () => {
      const error = new ApiError(500, 'Server error');
      const message = getUserFriendlyMessage(error, 'Loading schedules');
      expect(message).toContain('Loading schedules');
    });

    it('should use API error message for validation errors', () => {
      const error = new ApiError(400, 'Invalid cron expression');
      const message = getUserFriendlyMessage(error);
      expect(message).toContain('Invalid cron expression');
    });
  });

  describe('isRetryableError', () => {
    it('should identify network errors as retryable', () => {
      const error = new ApiError(0, 'Network error');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify timeout errors as retryable', () => {
      const error = new ApiError(408, 'Timeout');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify server errors as retryable', () => {
      const error = new ApiError(500, 'Server error');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should not retry authentication errors', () => {
      const error = new ApiError(401, 'Unauthorized');
      expect(isRetryableError(error)).toBe(false);
    });

    it('should not retry validation errors', () => {
      const error = new ApiError(400, 'Bad request');
      expect(isRetryableError(error)).toBe(false);
    });

    it('should not retry not found errors', () => {
      const error = new ApiError(404, 'Not found');
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('calculateRetryDelay', () => {
    it('should calculate exponential backoff delay', () => {
      const delay1 = calculateRetryDelay(1);
      const delay2 = calculateRetryDelay(2);
      const delay3 = calculateRetryDelay(3);

      expect(delay1).toBe(1000); // 1 second
      expect(delay2).toBe(2000); // 2 seconds
      expect(delay3).toBe(4000); // 4 seconds
    });

    it('should not exceed max delay', () => {
      const delay = calculateRetryDelay(10);
      expect(delay).toBeLessThanOrEqual(DEFAULT_RETRY_CONFIG.maxDelay);
    });

    it('should use custom config', () => {
      const customConfig = {
        ...DEFAULT_RETRY_CONFIG,
        initialDelay: 500,
        backoffMultiplier: 3,
      };
      const delay = calculateRetryDelay(2, customConfig);
      expect(delay).toBe(1500); // 500 * 3^1
    });
  });
});
