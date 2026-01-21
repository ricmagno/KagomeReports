/**
 * Unit tests for Analytics Error Handler
 * Tests error categorization, logging, and graceful degradation
 */

import { 
  AnalyticsErrorHandler, 
  analyticsErrorHandler,
  AnalyticsError,
  AnalyticsErrorType 
} from '../../src/utils/analyticsErrorHandler';

describe('AnalyticsErrorHandler', () => {
  let handler: AnalyticsErrorHandler;

  beforeEach(() => {
    handler = new AnalyticsErrorHandler();
  });

  describe('Error Creation', () => {
    it('should create insufficient data error with correct properties', () => {
      const error = handler.createInsufficientDataError('TAG001', 'trend line', 2, 3);

      expect(error.type).toBe('insufficient_data');
      expect(error.message).toContain('Insufficient data');
      expect(error.message).toContain('trend line');
      expect(error.message).toContain('2 points provided');
      expect(error.message).toContain('3 required');
      expect(error.tagName).toBe('TAG001');
      expect(error.metric).toBe('trend line');
      expect(error.recoverable).toBe(true);
      expect(error.details).toEqual({
        dataPoints: 2,
        required: 3,
        analysisType: 'trend line'
      });
    });

    it('should create invalid config error with correct properties', () => {
      const error = handler.createInvalidConfigError(
        'USL must be greater than LSL',
        'TAG002',
        { usl: 50, lsl: 100 }
      );

      expect(error.type).toBe('invalid_config');
      expect(error.message).toBe('USL must be greater than LSL');
      expect(error.tagName).toBe('TAG002');
      expect(error.recoverable).toBe(false);
      expect(error.details).toEqual({ usl: 50, lsl: 100 });
    });

    it('should create calculation error with correct properties', () => {
      const error = handler.createCalculationError(
        'Cp',
        'Division by zero',
        'TAG003',
        { stdDev: 0 }
      );

      expect(error.type).toBe('calculation');
      expect(error.message).toBe('Division by zero');
      expect(error.tagName).toBe('TAG003');
      expect(error.metric).toBe('Cp');
      expect(error.recoverable).toBe(true);
      expect(error.details).toEqual({ stdDev: 0 });
    });

    it('should create rendering error with correct properties', () => {
      const error = handler.createRenderingError(
        'TAG004',
        'SPC Chart',
        'Chart.js rendering failed',
        { chartType: 'line' }
      );

      expect(error.type).toBe('rendering');
      expect(error.message).toBe('Chart.js rendering failed');
      expect(error.tagName).toBe('TAG004');
      expect(error.metric).toBe('SPC Chart');
      expect(error.recoverable).toBe(true);
      expect(error.details).toEqual({ chartType: 'line' });
    });
  });

  describe('Error Handling', () => {
    it('should store recoverable errors without throwing', () => {
      const error: AnalyticsError = {
        type: 'insufficient_data',
        message: 'Test error',
        recoverable: true,
        timestamp: new Date()
      };

      expect(() => handler.handleError(error)).not.toThrow();
      expect(handler.hasErrors()).toBe(true);
      expect(handler.getErrors()).toHaveLength(1);
    });

    it('should throw for unrecoverable errors', () => {
      const error: AnalyticsError = {
        type: 'invalid_config',
        message: 'Invalid configuration',
        recoverable: false,
        timestamp: new Date()
      };

      expect(() => handler.handleError(error)).toThrow('Unrecoverable analytics error');
    });

    it('should store multiple errors', () => {
      const error1 = handler.createInsufficientDataError('TAG001', 'trend', 1, 3);
      const error2 = handler.createCalculationError('Cp', 'Error', 'TAG002');

      handler.handleError(error1);
      handler.handleError(error2);

      expect(handler.getErrors()).toHaveLength(2);
    });
  });

  describe('Error Retrieval', () => {
    beforeEach(() => {
      const error1 = handler.createInsufficientDataError('TAG001', 'trend', 1, 3);
      const error2 = handler.createCalculationError('Cp', 'Error', 'TAG001');
      const error3 = handler.createRenderingError('TAG002', 'chart', 'Failed');

      handler.handleError(error1);
      handler.handleError(error2);
      handler.handleError(error3);
    });

    it('should get errors for specific tag', () => {
      const tag1Errors = handler.getErrorsForTag('TAG001');
      expect(tag1Errors).toHaveLength(2);
      expect(tag1Errors.every(e => e.tagName === 'TAG001')).toBe(true);
    });

    it('should get errors by type', () => {
      const insufficientDataErrors = handler.getErrorsByType('insufficient_data');
      expect(insufficientDataErrors).toHaveLength(1);
      expect(insufficientDataErrors[0]?.type).toBe('insufficient_data');
    });

    it('should generate error summary', () => {
      const summary = handler.getErrorSummary();

      expect(summary.total).toBe(3);
      expect(summary.byType.insufficient_data).toBe(1);
      expect(summary.byType.calculation).toBe(1);
      expect(summary.byType.rendering).toBe(1);
      expect(summary.byType.invalid_config).toBe(0);
      expect(summary.recoverable).toBe(3);
      expect(summary.unrecoverable).toBe(0);
    });
  });

  describe('Error Clearing', () => {
    it('should clear all errors', () => {
      const error = handler.createInsufficientDataError('TAG001', 'trend', 1, 3);
      handler.handleError(error);

      expect(handler.hasErrors()).toBe(true);

      handler.clearErrors();

      expect(handler.hasErrors()).toBe(false);
      expect(handler.getErrors()).toHaveLength(0);
    });
  });

  describe('Wrap Operation', () => {
    it('should return success result for successful operation', async () => {
      const result = await handler.wrapOperation(
        () => Promise.resolve(42),
        { type: 'calculation', tagName: 'TAG001', metric: 'test' }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe(42);
      expect(result.error).toBeUndefined();
    });

    it('should return error result for failed operation', async () => {
      const result = await handler.wrapOperation(
        () => { throw new Error('Test error'); },
        { type: 'calculation', tagName: 'TAG001', metric: 'test', recoverable: true }
      );

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Test error');
      expect(result.error?.type).toBe('calculation');
    });

    it('should handle synchronous operations', async () => {
      const result = await handler.wrapOperation(
        () => 'sync result',
        { type: 'calculation', tagName: 'TAG001' }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('sync result');
    });
  });

  describe('Singleton Instance', () => {
    it('should provide global singleton instance', () => {
      expect(analyticsErrorHandler).toBeInstanceOf(AnalyticsErrorHandler);
    });

    it('should maintain state across references', () => {
      const error = analyticsErrorHandler.createInsufficientDataError('TAG001', 'test', 1, 3);
      analyticsErrorHandler.handleError(error);

      expect(analyticsErrorHandler.hasErrors()).toBe(true);

      // Clean up
      analyticsErrorHandler.clearErrors();
    });
  });

  describe('Edge Cases', () => {
    it('should handle errors without tag name', () => {
      const error: AnalyticsError = {
        type: 'calculation',
        message: 'Generic error',
        recoverable: true,
        timestamp: new Date()
      };

      handler.handleError(error);
      expect(handler.getErrors()).toHaveLength(1);
    });

    it('should handle errors without metric', () => {
      const error = handler.createCalculationError('test', 'Error message');

      expect(error.tagName).toBeUndefined();
      expect(error.metric).toBe('test');
    });

    it('should handle empty error summary', () => {
      const summary = handler.getErrorSummary();

      expect(summary.total).toBe(0);
      expect(summary.recoverable).toBe(0);
      expect(summary.unrecoverable).toBe(0);
    });
  });
});
