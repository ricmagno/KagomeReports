/**
 * Format Preference Storage Utility
 * 
 * Manages user preferences for export format selection using localStorage.
 * Provides functions to get and set the last selected export format,
 * with graceful error handling for localStorage failures.
 * 
 * Requirements: 4.5 - Format preference persistence
 */

import { ExportFormat } from '../../../src/types/reportExportImport';

/**
 * localStorage key for storing format preference
 */
const FORMAT_PREFERENCE_KEY = 'reportExportFormatPreference';

/**
 * Default export format when no preference exists
 */
const DEFAULT_FORMAT: ExportFormat = 'json';

/**
 * Get the user's last selected export format preference
 * 
 * @returns The last selected format, or 'json' if no preference exists
 * 
 * @example
 * ```typescript
 * const format = getFormatPreference(); // Returns 'json' or 'powerbi'
 * ```
 */
export function getFormatPreference(): ExportFormat {
  try {
    const stored = localStorage.getItem(FORMAT_PREFERENCE_KEY);
    
    if (stored === 'json' || stored === 'powerbi') {
      return stored;
    }
    
    // If stored value is invalid or doesn't exist, return default
    return DEFAULT_FORMAT;
  } catch (error) {
    // localStorage might be unavailable (private browsing, quota exceeded, etc.)
    console.warn('Failed to read format preference from localStorage:', error);
    return DEFAULT_FORMAT;
  }
}

/**
 * Set the user's export format preference
 * 
 * @param format - The export format to save as preference ('json' or 'powerbi')
 * 
 * @example
 * ```typescript
 * setFormatPreference('powerbi'); // Saves preference for future exports
 * ```
 */
export function setFormatPreference(format: ExportFormat): void {
  try {
    localStorage.setItem(FORMAT_PREFERENCE_KEY, format);
  } catch (error) {
    // localStorage might be unavailable or quota exceeded
    // This is not a critical error - the feature will still work,
    // just without persistence across sessions
    console.warn('Failed to save format preference to localStorage:', error);
  }
}

/**
 * Clear the user's export format preference
 * 
 * This is useful for testing or resetting to default behavior.
 * 
 * @example
 * ```typescript
 * clearFormatPreference(); // Next call to getFormatPreference() will return 'json'
 * ```
 */
export function clearFormatPreference(): void {
  try {
    localStorage.removeItem(FORMAT_PREFERENCE_KEY);
  } catch (error) {
    console.warn('Failed to clear format preference from localStorage:', error);
  }
}

/**
 * Check if a format preference has been set
 * 
 * @returns true if a preference exists, false otherwise
 * 
 * @example
 * ```typescript
 * if (hasFormatPreference()) {
 *   console.log('User has a saved preference');
 * }
 * ```
 */
export function hasFormatPreference(): boolean {
  try {
    const stored = localStorage.getItem(FORMAT_PREFERENCE_KEY);
    return stored === 'json' || stored === 'powerbi';
  } catch (error) {
    console.warn('Failed to check format preference in localStorage:', error);
    return false;
  }
}
