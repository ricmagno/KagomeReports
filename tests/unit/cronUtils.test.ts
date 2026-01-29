/**
 * Unit Tests for Cron Utilities
 */

import { getNextRunTime, validateCronExpression } from '../../src/utils/cronUtils';

describe('Cron Utilities', () => {
    describe('validateCronExpression', () => {
        it('should return true for valid 5-part cron expressions', () => {
            expect(validateCronExpression('0 9 * * *')).toBe(true);
            expect(validateCronExpression('*/5 * * * *')).toBe(true);
            expect(validateCronExpression('0 0 1 1 *')).toBe(true);
            expect(validateCronExpression('0 0 1 1 1')).toBe(true);
            expect(validateCronExpression('0,15,30,45 * * * *')).toBe(true);
        });

        it('should return true for valid 6-part cron expressions', () => {
            expect(validateCronExpression('0 0 9 * * *')).toBe(true);
        });

        it('should return false for invalid cron expressions', () => {
            expect(validateCronExpression('invalid')).toBe(false);
            expect(validateCronExpression('* * * *')).toBe(false); // only 4 parts
            expect(validateCronExpression('60 * * * *')).toBe(false); // minute > 59
            expect(validateCronExpression('0 24 * * *')).toBe(false); // hour > 23
            expect(validateCronExpression('0 0 32 * *')).toBe(false); // day > 31
            expect(validateCronExpression('0 0 1 13 *')).toBe(false); // month > 12
            expect(validateCronExpression('0 0 1 1 8')).toBe(false); // weekday > 7
        });
    });

    describe('getNextRunTime', () => {
        // We'll use a fixed start date for consistent tests
        const fromDate = new Date('2026-01-01T12:00:00Z');

        it('should calculate next hourly run', () => {
            const nextRun = getNextRunTime('0 * * * *', fromDate);
            expect(nextRun.toISOString()).toBe('2026-01-01T13:00:00.000Z');
        });

        it('should calculate next daily run', () => {
            const nextRun = getNextRunTime('0 9 * * *', fromDate);
            // Next day because 9 AM is in the past relative to 12 PM
            expect(nextRun.toISOString()).toBe('2026-01-02T09:00:00.000Z');
        });

        it('should calculate next daily run (later today)', () => {
            const earlierDate = new Date('2026-01-01T08:00:00Z');
            const nextRun = getNextRunTime('0 9 * * *', earlierDate);
            expect(nextRun.toISOString()).toBe('2026-01-01T09:00:00.000Z');
        });

        it('should calculate next weekly run', () => {
            // 2026-01-01 is a Thursday (4)
            // Next Monday (1) is 2026-01-05
            const nextRun = getNextRunTime('0 9 * * 1', fromDate);
            expect(nextRun.toISOString()).toBe('2026-01-05T09:00:00.000Z');
        });

        it('should calculate next monthly run', () => {
            const nextRun = getNextRunTime('0 9 1 * *', fromDate);
            // Next 1st of the month is Feb 1st
            expect(nextRun.toISOString()).toBe('2026-02-01T09:00:00.000Z');
        });

        it('should handle step values', () => {
            const nextRun = getNextRunTime('*/15 * * * *', fromDate);
            expect(nextRun.toISOString()).toBe('2026-01-01T12:15:00.000Z');
        });

        it('should handle 6-part cron by ignoring first part', () => {
            const nextRun = getNextRunTime('0 0 13 * * *', fromDate);
            expect(nextRun.toISOString()).toBe('2026-01-01T13:00:00.000Z');
        });
    });
});
