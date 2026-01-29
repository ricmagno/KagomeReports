/**
 * Cron Utilities
 * Helper functions for working with cron expressions on the backend
 */

/**
 * Validates a single cron field
 */
const isValidCronField = (field: string | undefined, min: number, max: number): boolean => {
    if (!field) return false;
    if (field === '*') return true;

    if (field.startsWith('*/')) {
        const step = parseInt(field.substring(2), 10);
        return !isNaN(step) && step > 0 && step <= max;
    }

    if (field.includes('-')) {
        const parts = field.split('-');
        if (parts.length !== 2) return false;
        const startStr = parts[0];
        const endStr = parts[1];
        if (startStr === undefined || endStr === undefined) return false;
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        return !isNaN(start) && !isNaN(end) && start >= min && end <= max && start <= end;
    }

    if (field.includes(',')) {
        const values = field.split(',').map(v => parseInt(v, 10));
        return values.every(v => !isNaN(v) && v >= min && v <= max);
    }

    const value = parseInt(field, 10);
    return !isNaN(value) && value >= min && value <= max;
};

/**
 * Validates a cron expression format (standard 5-part cron)
 * @param cronExpression - The cron expression to validate
 * @returns true if valid, false otherwise
 */
export const validateCronExpression = (cronExpression: string): boolean => {
    if (!cronExpression || typeof cronExpression !== 'string') {
        return false;
    }

    const parts = cronExpression.trim().split(/\s+/);

    // Cron expression must have exactly 5 or 6 parts
    if (parts.length < 5 || parts.length > 6) {
        return false;
    }

    const offset = parts.length === 6 ? 1 : 0;
    const minute = parts[0 + offset];
    const hour = parts[1 + offset];
    const dayOfMonth = parts[2 + offset];
    const month = parts[3 + offset];
    const dayOfWeek = parts[4 + offset];

    // Validate fields
    if (!isValidCronField(minute, 0, 59)) return false;
    if (!isValidCronField(hour, 0, 23)) return false;
    if (!isValidCronField(dayOfMonth, 1, 31)) return false;
    if (!isValidCronField(month, 1, 12)) return false;
    if (!isValidCronField(dayOfWeek, 0, 7)) return false;

    return true;
};

/**
 * Checks if a value matches a cron field pattern
 */
const matchesCronField = (
    value: number,
    field: string,
    min: number,
    max: number,
    isDayOfWeek: boolean = false
): boolean => {
    if (field === '*') return true;

    // Normalize day of week (7 -> 0 for Sunday)
    const normalizedValue = isDayOfWeek && value === 7 ? 0 : value;

    if (field.startsWith('*/')) {
        const step = parseInt(field.substring(2), 10);
        return normalizedValue % step === 0;
    }

    if (field.includes('-')) {
        const parts = field.split('-');
        const startStr = parts[0];
        const endStr = parts[1];
        if (startStr !== undefined && endStr !== undefined) {
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            return normalizedValue >= start && normalizedValue <= end;
        }
        return false;
    }

    if (field.includes(',')) {
        const values = field.split(',').map(v => parseInt(v, 10));
        return values.includes(normalizedValue) || (isDayOfWeek && values.includes(7) && normalizedValue === 0);
    }

    const fieldValue = parseInt(field, 10);
    return normalizedValue === fieldValue || (isDayOfWeek && fieldValue === 7 && normalizedValue === 0);
};

/**
 * Checks if a date matches a cron expression (using UTC to match node-cron configuration)
 */
const matchesCronExpression = (
    date: Date,
    minute: string,
    hour: string,
    dayOfMonth: string,
    month: string,
    dayOfWeek: string
): boolean => {
    const dateMinute = date.getUTCMinutes();
    const dateHour = date.getUTCHours();
    const dateDayOfMonth = date.getUTCDate();
    const dateMonth = date.getUTCMonth() + 1; // JavaScript months are 0-indexed
    const dateDayOfWeek = date.getUTCDay(); // 0 = Sunday

    if (!matchesCronField(dateMinute, minute, 0, 59)) return false;
    if (!matchesCronField(dateHour, hour, 0, 23)) return false;
    if (!matchesCronField(dateDayOfMonth, dayOfMonth, 1, 31)) return false;
    if (!matchesCronField(dateMonth, month, 1, 12)) return false;

    // Day of week: both 0 and 7 represent Sunday
    if (!matchesCronField(dateDayOfWeek, dayOfWeek, 0, 7, true)) return false;

    return true;
};

/**
 * Calculates the next run time for a cron expression
 * @param cronExpression - The cron expression
 * @param fromDate - Starting date (defaults to now)
 * @returns Date object representing the next run time
 */
export const getNextRunTime = (
    cronExpression: string,
    fromDate: Date = new Date()
): Date => {
    if (!validateCronExpression(cronExpression)) {
        // If invalid, return a safe fallback (1 minute from now)
        return new Date(fromDate.getTime() + 60000);
    }

    const parts = cronExpression.trim().split(/\s+/);
    let minute: string = '0', hour: string = '*', dayOfMonth: string = '*', month: string = '*', dayOfWeek: string = '*';

    if (parts.length === 6) {
        // Has seconds, ignore them for next run time calculation to keep it simple
        minute = parts[1] || '0';
        hour = parts[2] || '*';
        dayOfMonth = parts[3] || '*';
        month = parts[4] || '*';
        dayOfWeek = parts[5] || '*';
    } else {
        minute = parts[0] || '0';
        hour = parts[1] || '*';
        dayOfMonth = parts[2] || '*';
        month = parts[3] || '*';
        dayOfWeek = parts[4] || '*';
    }

    let currentDate = new Date(fromDate);
    currentDate.setUTCSeconds(0);
    currentDate.setUTCMilliseconds(0);

    // Move to next minute to avoid including current time
    currentDate.setUTCMinutes(currentDate.getUTCMinutes() + 1);

    let attempts = 0;
    const maxAttempts = 100000; // Prevent infinite loops (approx 70 days of minutes)

    while (attempts < maxAttempts) {
        attempts++;

        if (matchesCronExpression(currentDate, minute, hour, dayOfMonth, month, dayOfWeek)) {
            return new Date(currentDate);
        }

        // Move to next minute
        currentDate.setUTCMinutes(currentDate.getUTCMinutes() + 1);
    }

    // Fallback
    return new Date(fromDate.getTime() + 60000);
};
