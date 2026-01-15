/**
 * Utility functions for Data Preview Table
 */

import { TimeSeriesData } from '../types/api';

/**
 * Format a timestamp to a readable string
 * @param date - Date object or string to format
 * @param format - Format string (default: 'YYYY-MM-DD HH:mm:ss')
 * @returns Formatted timestamp string
 */
export function formatTimestamp(date: Date | string, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
  const d = date instanceof Date ? date : new Date(date);
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Format a numeric value with specified decimal places
 * @param value - Numeric value to format
 * @param decimals - Number of decimal places (default: 4)
 * @returns Formatted value string
 */
export function formatValue(value: number | null | undefined, decimals: number = 4): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  if (!isFinite(value)) {
    return value.toString();
  }
  return value.toFixed(decimals);
}

/**
 * Get quality status from quality code
 * @param qualityCode - Numeric quality code or string
 * @returns Quality status: 'good', 'bad', or 'uncertain'
 */
export function getQualityStatus(qualityCode: number | string): 'good' | 'bad' | 'uncertain' {
  if (qualityCode === 192 || qualityCode === 'Good') return 'good';
  if (qualityCode === 0 || qualityCode === 'Bad') return 'bad';
  return 'uncertain';
}

/**
 * Get quality description from quality code
 * @param qualityCode - Numeric quality code or string
 * @returns Human-readable quality description
 */
export function getQualityDescription(qualityCode: number | string): string {
  if (qualityCode === 'Good' || qualityCode === 192) {
    return 'Good - Data is valid and reliable';
  }
  if (qualityCode === 'Bad' || qualityCode === 0) {
    return 'Bad - Data is invalid or unreliable';
  }
  if (qualityCode === 'Uncertain' || qualityCode === 64) {
    return 'Uncertain - Data quality is questionable';
  }

  const qualityMap: Record<number, string> = {
    4: 'Configuration Error',
    8: 'Not Connected',
    12: 'Device Failure',
    16: 'Sensor Failure',
    20: 'Last Known Value',
    24: 'Communication Failure',
    28: 'Out of Service',
    32: 'Waiting for Initial Data',
  };

  if (typeof qualityCode === 'number' && qualityMap[qualityCode]) {
    return qualityMap[qualityCode];
  }

  return `Unknown quality code: ${qualityCode}`;
}

/**
 * Sort column type
 */
export type SortColumn = 'tagName' | 'timestamp' | 'value' | 'quality';

/**
 * Sort direction type
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort time-series data by specified column and direction
 * @param data - Array of time-series data
 * @param column - Column to sort by
 * @param direction - Sort direction ('asc' or 'desc')
 * @returns Sorted array
 */
export function sortData(
  data: TimeSeriesData[],
  column: SortColumn,
  direction: SortDirection
): TimeSeriesData[] {
  const sorted = [...data].sort((a, b) => {
    let comparison = 0;

    switch (column) {
      case 'tagName':
        comparison = a.tagName.localeCompare(b.tagName);
        break;
      case 'timestamp':
        // Handle both Date objects and string timestamps
        const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
        const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
        comparison = timeA - timeB;
        break;
      case 'value':
        // Handle null values - put them at the end
        if (a.value === null || a.value === undefined) return 1;
        if (b.value === null || b.value === undefined) return -1;
        comparison = a.value - b.value;
        break;
      case 'quality':
        // Convert quality to number for comparison
        const qualityA = typeof a.quality === 'number' ? a.quality : getQualityNumericValue(a.quality);
        const qualityB = typeof b.quality === 'number' ? b.quality : getQualityNumericValue(b.quality);
        comparison = qualityA - qualityB;
        break;
    }

    return direction === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Convert quality string to numeric value for sorting
 * @param quality - Quality string
 * @returns Numeric value
 */
function getQualityNumericValue(quality: string): number {
  switch (quality) {
    case 'Good': return 192;
    case 'Bad': return 0;
    case 'Uncertain': return 64;
    default: return 0;
  }
}

/**
 * Generate CSV content from time-series data
 * @param data - Array of time-series data
 * @returns CSV string
 */
export function generateCSV(data: TimeSeriesData[]): string {
  // CSV header
  const header = 'Tag Name,Timestamp,Value,Quality Code\n';

  // CSV rows
  const rows = data.map(row => {
    const tagName = escapeCSVField(row.tagName);
    const timestamp = formatTimestamp(row.timestamp);
    const value = formatValue(row.value);
    const quality = row.quality;

    return `${tagName},${timestamp},${value},${quality}`;
  }).join('\n');

  return header + rows;
}

/**
 * Escape CSV field if it contains special characters
 * @param field - Field value to escape
 * @returns Escaped field value
 */
function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Download CSV file
 * @param csvContent - CSV content string
 * @param filename - Filename for download
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Generate filename for CSV export
 * @param reportName - Name of the report
 * @returns Filename with timestamp
 */
export function generateCSVFilename(reportName: string = 'data-preview'): string {
  const timestamp = new Date().toISOString().split('T')[0];
  const sanitized = reportName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  return `${sanitized}-${timestamp}.csv`;
}
