/**
 * Date and Time Utilities
 * Helper functions for formatting dates, times, and durations
 */

/**
 * Formats a date as a readable timestamp
 * @param date - The date to format
 * @param options - Intl.DateTimeFormatOptions for customization
 * @returns Formatted date string
 */
export const formatTimestamp = (
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string => {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return 'Invalid date';
  }

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  };

  return dateObj.toLocaleString('en-US', defaultOptions);
};

/**
 * Formats a date as a short date string (e.g., "Jan 15, 2026")
 * @param date - The date to format
 * @returns Formatted date string
 */
export const formatDate = (date: Date | string | number): string => {
  return formatTimestamp(date, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Formats a date as a time string (e.g., "09:30 AM")
 * @param date - The date to format
 * @returns Formatted time string
 */
export const formatTime = (date: Date | string | number): string => {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return 'Invalid time';
  }

  return dateObj.toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Formats a date as a relative time string (e.g., "2 hours ago", "in 3 days")
 * @param date - The date to format
 * @param baseDate - The base date to compare against (defaults to now)
 * @returns Relative time string
 */
export const formatRelativeTime = (
  date: Date | string | number,
  baseDate: Date = new Date()
): string => {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return 'Invalid date';
  }

  const diffMs = dateObj.getTime() - baseDate.getTime();
  const diffSeconds = Math.floor(Math.abs(diffMs) / 1000);
  const isPast = diffMs < 0;

  // Less than a minute
  if (diffSeconds < 60) {
    return isPast ? 'just now' : 'in a few seconds';
  }

  // Less than an hour
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    const unit = diffMinutes === 1 ? 'minute' : 'minutes';
    return isPast ? `${diffMinutes} ${unit} ago` : `in ${diffMinutes} ${unit}`;
  }

  // Less than a day
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    const unit = diffHours === 1 ? 'hour' : 'hours';
    return isPast ? `${diffHours} ${unit} ago` : `in ${diffHours} ${unit}`;
  }

  // Less than a week
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    const unit = diffDays === 1 ? 'day' : 'days';
    return isPast ? `${diffDays} ${unit} ago` : `in ${diffDays} ${unit}`;
  }

  // Less than a month
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) {
    const unit = diffWeeks === 1 ? 'week' : 'weeks';
    return isPast ? `${diffWeeks} ${unit} ago` : `in ${diffWeeks} ${unit}`;
  }

  // Less than a year
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    const unit = diffMonths === 1 ? 'month' : 'months';
    return isPast ? `${diffMonths} ${unit} ago` : `in ${diffMonths} ${unit}`;
  }

  // Years
  const diffYears = Math.floor(diffDays / 365);
  const unit = diffYears === 1 ? 'year' : 'years';
  return isPast ? `${diffYears} ${unit} ago` : `in ${diffYears} ${unit}`;
};

/**
 * Calculates and formats a duration between two dates
 * @param startDate - The start date
 * @param endDate - The end date (defaults to now)
 * @returns Formatted duration string (e.g., "2h 30m", "45s")
 */
export const formatDuration = (
  startDate: Date | string | number,
  endDate: Date | string | number = new Date()
): string => {
  const start = typeof startDate === 'string' || typeof startDate === 'number' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' || typeof endDate === 'number' ? new Date(endDate) : endDate;

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 'Invalid duration';
  }

  const durationMs = Math.abs(end.getTime() - start.getTime());
  return formatDurationMs(durationMs);
};

/**
 * Formats a duration in milliseconds to a readable string
 * @param durationMs - Duration in milliseconds
 * @returns Formatted duration string (e.g., "2h 30m", "45s")
 */
export const formatDurationMs = (durationMs: number): string => {
  if (durationMs < 0) {
    return 'Invalid duration';
  }

  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    if (remainingHours > 0) {
      return `${days}d ${remainingHours}h`;
    }
    return `${days}d`;
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    if (remainingMinutes > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${hours}h`;
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    if (remainingSeconds > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${minutes}m`;
  }

  if (seconds > 0) {
    return `${seconds}s`;
  }

  return `${durationMs}ms`;
};

/**
 * Formats a duration in seconds to a readable string
 * @param durationSeconds - Duration in seconds
 * @returns Formatted duration string
 */
export const formatDurationSeconds = (durationSeconds: number): string => {
  return formatDurationMs(durationSeconds * 1000);
};

/**
 * Gets the timezone abbreviation for the current locale
 * @param date - The date to get timezone for (defaults to now)
 * @returns Timezone abbreviation (e.g., "PST", "EST")
 */
export const getTimezoneAbbreviation = (date: Date = new Date()): string => {
  const timeZoneName = date.toLocaleString('en-US', { timeZoneName: 'short' }).split(' ').pop();
  return timeZoneName || 'UTC';
};

/**
 * Gets the timezone offset string (e.g., "UTC-8", "UTC+5:30")
 * @param date - The date to get timezone offset for (defaults to now)
 * @returns Timezone offset string
 */
export const getTimezoneOffset = (date: Date = new Date()): string => {
  const offsetMinutes = -date.getTimezoneOffset();
  const hours = Math.floor(Math.abs(offsetMinutes) / 60);
  const minutes = Math.abs(offsetMinutes) % 60;
  const sign = offsetMinutes >= 0 ? '+' : '-';

  if (minutes === 0) {
    return `UTC${sign}${hours}`;
  }

  return `UTC${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
};

/**
 * Formats a timestamp with timezone information
 * @param date - The date to format
 * @param showOffset - Whether to show offset (UTC+X) or abbreviation (PST)
 * @returns Formatted timestamp with timezone
 */
export const formatTimestampWithTimezone = (
  date: Date | string | number,
  showOffset: boolean = false
): string => {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return 'Invalid date';
  }

  const timestamp = formatTimestamp(dateObj);
  const timezone = showOffset ? getTimezoneOffset(dateObj) : getTimezoneAbbreviation(dateObj);

  return `${timestamp} ${timezone}`;
};

/**
 * Checks if a date is today
 * @param date - The date to check
 * @returns true if the date is today
 */
export const isToday = (date: Date | string | number): boolean => {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  const today = new Date();

  return (
    dateObj.getDate() === today.getDate() &&
    dateObj.getMonth() === today.getMonth() &&
    dateObj.getFullYear() === today.getFullYear()
  );
};

/**
 * Checks if a date is in the past
 * @param date - The date to check
 * @param baseDate - The base date to compare against (defaults to now)
 * @returns true if the date is in the past
 */
export const isPast = (date: Date | string | number, baseDate: Date = new Date()): boolean => {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return dateObj.getTime() < baseDate.getTime();
};

/**
 * Checks if a date is in the future
 * @param date - The date to check
 * @param baseDate - The base date to compare against (defaults to now)
 * @returns true if the date is in the future
 */
export const isFuture = (date: Date | string | number, baseDate: Date = new Date()): boolean => {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return dateObj.getTime() > baseDate.getTime();
};

/**
 * Formats execution timestamps for display in execution history
 * @param startTime - Execution start time
 * @param endTime - Execution end time (optional)
 * @returns Object with formatted start, end, and duration
 */
export const formatExecutionTimes = (
  startTime: Date | string | number,
  endTime?: Date | string | number
) => {
  const start = typeof startTime === 'string' || typeof startTime === 'number' ? new Date(startTime) : startTime;
  const end = endTime ? (typeof endTime === 'string' || typeof endTime === 'number' ? new Date(endTime) : endTime) : undefined;

  return {
    startTime: formatTimestamp(start),
    endTime: end ? formatTimestamp(end) : undefined,
    duration: end ? formatDuration(start, end) : undefined,
    relativeStart: formatRelativeTime(start),
  };
};
