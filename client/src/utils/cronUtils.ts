/**
 * Cron Utilities
 * Helper functions for working with cron expressions
 */

/**
 * Cron preset definition
 */
export interface CronPreset {
  label: string;
  value: string;
  description: string;
}

/**
 * Predefined cron expression presets
 */
export const CRON_PRESETS: CronPreset[] = [
  { label: 'Hourly', value: '0 * * * *', description: 'Every hour at minute 0' },
  { label: 'Every 6 Hours', value: '0 */6 * * *', description: 'Every 6 hours' },
  { label: 'Every 8 Hours', value: '0 */8 * * *', description: 'Every 8 hours' },
  { label: 'Every 12 Hours', value: '0 */12 * * *', description: 'Every 12 hours' },
  { label: 'Daily', value: '0 9 * * *', description: 'Every day at 9:00 AM' },
  { label: 'Weekly', value: '0 9 * * 1', description: 'Every Monday at 9:00 AM' },
  { label: 'Monthly', value: '0 9 1 * *', description: 'First day of month at 9:00 AM' },
];

/**
 * Validates a cron expression format
 * @param cronExpression - The cron expression to validate
 * @returns true if valid, false otherwise
 */
export const validateCronExpression = (cronExpression: string): boolean => {
  if (!cronExpression || typeof cronExpression !== 'string') {
    return false;
  }

  const parts = cronExpression.trim().split(/\s+/);
  
  // Cron expression must have exactly 5 parts: minute hour day month weekday
  if (parts.length !== 5) {
    return false;
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Validate minute (0-59)
  if (!isValidCronField(minute, 0, 59)) return false;

  // Validate hour (0-23)
  if (!isValidCronField(hour, 0, 23)) return false;

  // Validate day of month (1-31)
  if (!isValidCronField(dayOfMonth, 1, 31)) return false;

  // Validate month (1-12)
  if (!isValidCronField(month, 1, 12)) return false;

  // Validate day of week (0-7, where 0 and 7 are Sunday)
  if (!isValidCronField(dayOfWeek, 0, 7)) return false;

  return true;
};

/**
 * Validates a single cron field
 * @param field - The cron field to validate
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns true if valid, false otherwise
 */
const isValidCronField = (field: string, min: number, max: number): boolean => {
  // Wildcard
  if (field === '*') return true;

  // Step values (e.g., */5)
  if (field.startsWith('*/')) {
    const step = parseInt(field.substring(2), 10);
    return !isNaN(step) && step > 0 && step <= max;
  }

  // Range (e.g., 1-5)
  if (field.includes('-')) {
    const [start, end] = field.split('-').map(v => parseInt(v, 10));
    return !isNaN(start) && !isNaN(end) && start >= min && end <= max && start <= end;
  }

  // List (e.g., 1,3,5)
  if (field.includes(',')) {
    const values = field.split(',').map(v => parseInt(v, 10));
    return values.every(v => !isNaN(v) && v >= min && v <= max);
  }

  // Single value
  const value = parseInt(field, 10);
  return !isNaN(value) && value >= min && value <= max;
};

/**
 * Converts a cron expression to a human-readable description
 * @param cronExpression - The cron expression to describe
 * @returns Human-readable description
 */
export const getCronDescription = (cronExpression: string): string => {
  if (!validateCronExpression(cronExpression)) {
    return 'Invalid cron expression';
  }

  const parts = cronExpression.trim().split(/\s+/);
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Check for preset matches
  const preset = CRON_PRESETS.find(p => p.value === cronExpression);
  if (preset) {
    return preset.description;
  }

  // Hourly patterns
  if (hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    if (minute === '0') return 'Every hour';
    if (minute === '*') return 'Every minute';
    return `Every hour at minute ${minute}`;
  }

  // Every N hours
  if (hour.startsWith('*/') && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    const hours = hour.substring(2);
    if (minute === '0') return `Every ${hours} hours`;
    return `Every ${hours} hours at minute ${minute}`;
  }

  // Daily patterns
  if (hour !== '*' && !hour.includes('*') && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    const hourNum = parseInt(hour, 10);
    const minuteNum = parseInt(minute, 10);
    const time = formatTime(hourNum, minuteNum);
    return `Daily at ${time}`;
  }

  // Weekly patterns
  if (hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
    const hourNum = parseInt(hour, 10);
    const minuteNum = parseInt(minute, 10);
    const time = formatTime(hourNum, minuteNum);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    if (dayOfWeek.includes(',')) {
      const dayIndices = dayOfWeek.split(',').map(d => parseInt(d, 10));
      const dayNames = dayIndices.map(i => days[i % 7]).join(', ');
      return `Weekly on ${dayNames} at ${time}`;
    }
    
    const dayIndex = parseInt(dayOfWeek, 10);
    return `Weekly on ${days[dayIndex % 7]} at ${time}`;
  }

  // Monthly patterns
  if (hour !== '*' && dayOfMonth !== '*' && month === '*' && dayOfWeek === '*') {
    const hourNum = parseInt(hour, 10);
    const minuteNum = parseInt(minute, 10);
    const time = formatTime(hourNum, minuteNum);
    return `Monthly on day ${dayOfMonth} at ${time}`;
  }

  // Fallback to showing the raw expression
  return cronExpression;
};

/**
 * Formats hour and minute into a readable time string
 * @param hour - Hour (0-23)
 * @param minute - Minute (0-59)
 * @returns Formatted time string (e.g., "9:00 AM")
 */
const formatTime = (hour: number, minute: number): string => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const displayMinute = minute.toString().padStart(2, '0');
  return `${displayHour}:${displayMinute} ${period}`;
};

/**
 * Calculates the next N run times for a cron expression
 * @param cronExpression - The cron expression
 * @param count - Number of future run times to calculate
 * @param fromDate - Starting date (defaults to now)
 * @returns Array of Date objects representing next run times
 */
export const getNextRunTimes = (
  cronExpression: string,
  count: number = 5,
  fromDate: Date = new Date()
): Date[] => {
  if (!validateCronExpression(cronExpression)) {
    return [];
  }

  const parts = cronExpression.trim().split(/\s+/);
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  
  const runs: Date[] = [];
  let currentDate = new Date(fromDate);
  currentDate.setSeconds(0);
  currentDate.setMilliseconds(0);

  // Move to next minute to avoid including current time
  currentDate.setMinutes(currentDate.getMinutes() + 1);

  let attempts = 0;
  const maxAttempts = count * 1000; // Prevent infinite loops

  while (runs.length < count && attempts < maxAttempts) {
    attempts++;

    if (matchesCronExpression(currentDate, minute, hour, dayOfMonth, month, dayOfWeek)) {
      runs.push(new Date(currentDate));
    }

    // Move to next minute
    currentDate.setMinutes(currentDate.getMinutes() + 1);
  }

  return runs;
};

/**
 * Checks if a date matches a cron expression
 * @param date - The date to check
 * @param minute - Cron minute field
 * @param hour - Cron hour field
 * @param dayOfMonth - Cron day of month field
 * @param month - Cron month field
 * @param dayOfWeek - Cron day of week field
 * @returns true if the date matches the cron expression
 */
const matchesCronExpression = (
  date: Date,
  minute: string,
  hour: string,
  dayOfMonth: string,
  month: string,
  dayOfWeek: string
): boolean => {
  const dateMinute = date.getMinutes();
  const dateHour = date.getHours();
  const dateDayOfMonth = date.getDate();
  const dateMonth = date.getMonth() + 1; // JavaScript months are 0-indexed
  const dateDayOfWeek = date.getDay(); // 0 = Sunday

  if (!matchesCronField(dateMinute, minute, 0, 59)) return false;
  if (!matchesCronField(dateHour, hour, 0, 23)) return false;
  if (!matchesCronField(dateDayOfMonth, dayOfMonth, 1, 31)) return false;
  if (!matchesCronField(dateMonth, month, 1, 12)) return false;
  
  // Day of week: both 0 and 7 represent Sunday
  if (!matchesCronField(dateDayOfWeek, dayOfWeek, 0, 7, true)) return false;

  return true;
};

/**
 * Checks if a value matches a cron field pattern
 * @param value - The value to check
 * @param field - The cron field pattern
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param isDayOfWeek - Special handling for day of week (0 and 7 both mean Sunday)
 * @returns true if the value matches the field pattern
 */
const matchesCronField = (
  value: number,
  field: string,
  min: number,
  max: number,
  isDayOfWeek: boolean = false
): boolean => {
  // Wildcard matches everything
  if (field === '*') return true;

  // Normalize day of week (7 -> 0 for Sunday)
  const normalizedValue = isDayOfWeek && value === 7 ? 0 : value;

  // Step values (e.g., */5)
  if (field.startsWith('*/')) {
    const step = parseInt(field.substring(2), 10);
    return normalizedValue % step === 0;
  }

  // Range (e.g., 1-5)
  if (field.includes('-')) {
    const [start, end] = field.split('-').map(v => parseInt(v, 10));
    return normalizedValue >= start && normalizedValue <= end;
  }

  // List (e.g., 1,3,5)
  if (field.includes(',')) {
    const values = field.split(',').map(v => parseInt(v, 10));
    return values.includes(normalizedValue) || (isDayOfWeek && values.includes(7) && normalizedValue === 0);
  }

  // Single value
  const fieldValue = parseInt(field, 10);
  return normalizedValue === fieldValue || (isDayOfWeek && fieldValue === 7 && normalizedValue === 0);
};

/**
 * Gets a cron preset by its value
 * @param cronExpression - The cron expression to find
 * @returns The matching preset or undefined
 */
export const getCronPreset = (cronExpression: string): CronPreset | undefined => {
  return CRON_PRESETS.find(preset => preset.value === cronExpression);
};

/**
 * Checks if a cron expression matches any preset
 * @param cronExpression - The cron expression to check
 * @returns true if it matches a preset
 */
export const isPresetCron = (cronExpression: string): boolean => {
  return CRON_PRESETS.some(preset => preset.value === cronExpression);
};
