/**
 * Tests for Utility Functions
 * Validates cron, date/time, and validation utilities
 */

import {
  validateCronExpression,
  getCronDescription,
  getNextRunTimes,
  CRON_PRESETS,
} from '../cronUtils';

import {
  formatTimestamp,
  formatDuration,
  formatRelativeTime,
  formatDurationMs,
  isToday,
  isPast,
  isFuture,
} from '../dateTimeUtils';

import {
  validateEmail,
  validateEmails,
  validateScheduleName,
  validateScheduleDescription,
  validateRequired,
  validateLength,
} from '../validationUtils';

describe('Cron Utilities', () => {
  describe('validateCronExpression', () => {
    it('should validate correct cron expressions', () => {
      expect(validateCronExpression('0 9 * * *')).toBe(true);
      expect(validateCronExpression('*/5 * * * *')).toBe(true);
      expect(validateCronExpression('0 */6 * * *')).toBe(true);
      expect(validateCronExpression('0 9 1 * *')).toBe(true);
    });

    it('should reject invalid cron expressions', () => {
      expect(validateCronExpression('')).toBe(false);
      expect(validateCronExpression('invalid')).toBe(false);
      expect(validateCronExpression('0 9 * *')).toBe(false); // Too few parts
      expect(validateCronExpression('0 9 * * * *')).toBe(false); // Too many parts
      expect(validateCronExpression('60 9 * * *')).toBe(false); // Invalid minute
      expect(validateCronExpression('0 25 * * *')).toBe(false); // Invalid hour
    });
  });

  describe('getCronDescription', () => {
    it('should describe preset cron expressions', () => {
      expect(getCronDescription('0 * * * *')).toBe('Every hour at minute 0');
      expect(getCronDescription('0 9 * * *')).toBe('Every day at 9:00 AM');
      expect(getCronDescription('0 9 * * 1')).toBe('Every Monday at 9:00 AM');
    });

    it('should return error for invalid expressions', () => {
      expect(getCronDescription('invalid')).toBe('Invalid cron expression');
    });
  });

  describe('getNextRunTimes', () => {
    it('should calculate next run times for hourly schedule', () => {
      const runs = getNextRunTimes('0 * * * *', 3);
      expect(runs).toHaveLength(3);
      expect(runs[0]).toBeInstanceOf(Date);
    });

    it('should return empty array for invalid expression', () => {
      const runs = getNextRunTimes('invalid', 3);
      expect(runs).toHaveLength(0);
    });
  });

  describe('CRON_PRESETS', () => {
    it('should have all expected presets', () => {
      expect(CRON_PRESETS).toHaveLength(7);
      expect(CRON_PRESETS.find(p => p.label === 'Hourly')).toBeDefined();
      expect(CRON_PRESETS.find(p => p.label === 'Daily')).toBeDefined();
      expect(CRON_PRESETS.find(p => p.label === 'Weekly')).toBeDefined();
    });
  });
});

describe('Date/Time Utilities', () => {
  describe('formatTimestamp', () => {
    it('should format dates correctly', () => {
      const date = new Date('2024-01-15T09:30:00Z');
      const formatted = formatTimestamp(date);
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('15');
      expect(formatted).toContain('2024');
    });

    it('should handle invalid dates', () => {
      expect(formatTimestamp('invalid')).toBe('Invalid date');
    });
  });

  describe('formatDuration', () => {
    it('should format durations correctly', () => {
      const start = new Date('2024-01-15T09:00:00Z');
      const end = new Date('2024-01-15T09:05:30Z');
      const duration = formatDuration(start, end);
      expect(duration).toContain('5m');
      expect(duration).toContain('30s');
    });
  });

  describe('formatDurationMs', () => {
    it('should format milliseconds to readable duration', () => {
      expect(formatDurationMs(1000)).toBe('1s');
      expect(formatDurationMs(60000)).toBe('1m');
      expect(formatDurationMs(3600000)).toBe('1h');
      expect(formatDurationMs(90000)).toBe('1m 30s');
    });
  });

  describe('formatRelativeTime', () => {
    it('should format relative times', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 3600000); // 1 hour ago
      const future = new Date(now.getTime() + 3600000); // 1 hour from now

      expect(formatRelativeTime(past, now)).toContain('hour');
      expect(formatRelativeTime(past, now)).toContain('ago');
      expect(formatRelativeTime(future, now)).toContain('in');
    });
  });

  describe('isToday', () => {
    it('should correctly identify today', () => {
      const today = new Date();
      expect(isToday(today)).toBe(true);

      const yesterday = new Date(today.getTime() - 86400000);
      expect(isToday(yesterday)).toBe(false);
    });
  });

  describe('isPast', () => {
    it('should correctly identify past dates', () => {
      const past = new Date('2020-01-01');
      const future = new Date('2030-01-01');

      expect(isPast(past)).toBe(true);
      expect(isPast(future)).toBe(false);
    });
  });

  describe('isFuture', () => {
    it('should correctly identify future dates', () => {
      const past = new Date('2020-01-01');
      const future = new Date('2030-01-01');

      expect(isFuture(past)).toBe(false);
      expect(isFuture(future)).toBe(true);
    });
  });
});

describe('Validation Utilities', () => {
  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      expect(validateEmail('user@example.com').isValid).toBe(true);
      expect(validateEmail('test.user@domain.co.uk').isValid).toBe(true);
      expect(validateEmail('user+tag@example.com').isValid).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validateEmail('').isValid).toBe(false);
      expect(validateEmail('invalid').isValid).toBe(false);
      expect(validateEmail('user@').isValid).toBe(false);
      expect(validateEmail('@example.com').isValid).toBe(false);
      expect(validateEmail('user..name@example.com').isValid).toBe(false);
    });
  });

  describe('validateEmails', () => {
    it('should validate multiple email addresses', () => {
      const result = validateEmails(['user1@example.com', 'user2@example.com']);
      expect(result.isValid).toBe(true);
    });

    it('should reject if any email is invalid', () => {
      const result = validateEmails(['user1@example.com', 'invalid']);
      expect(result.isValid).toBe(false);
    });

    it('should reject duplicate emails', () => {
      const result = validateEmails(['user@example.com', 'user@example.com']);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Duplicate');
    });
  });

  describe('validateScheduleName', () => {
    it('should validate correct schedule names', () => {
      expect(validateScheduleName('Daily Report').isValid).toBe(true);
      expect(validateScheduleName('Report-123').isValid).toBe(true);
    });

    it('should reject invalid schedule names', () => {
      expect(validateScheduleName('').isValid).toBe(false);
      expect(validateScheduleName('a'.repeat(101)).isValid).toBe(false);
    });
  });

  describe('validateScheduleDescription', () => {
    it('should validate correct descriptions', () => {
      expect(validateScheduleDescription('A valid description').isValid).toBe(true);
      expect(validateScheduleDescription(undefined).isValid).toBe(true); // Optional
    });

    it('should reject descriptions that are too long', () => {
      const longDescription = 'a'.repeat(501);
      expect(validateScheduleDescription(longDescription).isValid).toBe(false);
    });
  });

  describe('validateRequired', () => {
    it('should validate required fields', () => {
      expect(validateRequired('value', 'Field').isValid).toBe(true);
      expect(validateRequired(123, 'Field').isValid).toBe(true);
    });

    it('should reject empty values', () => {
      expect(validateRequired('', 'Field').isValid).toBe(false);
      expect(validateRequired(null, 'Field').isValid).toBe(false);
      expect(validateRequired(undefined, 'Field').isValid).toBe(false);
    });
  });

  describe('validateLength', () => {
    it('should validate string length', () => {
      expect(validateLength('test', 1, 10, 'Field').isValid).toBe(true);
    });

    it('should reject strings outside length range', () => {
      expect(validateLength('', 1, 10, 'Field').isValid).toBe(false);
      expect(validateLength('a'.repeat(11), 1, 10, 'Field').isValid).toBe(false);
    });
  });
});
