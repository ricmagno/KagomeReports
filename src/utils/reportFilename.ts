/**
 * Report Filename Utility
 * Generates standardized filenames for reports
 */

/**
 * Sanitize a report name for use in filenames
 * Removes special characters and replaces spaces with underscores
 */
function sanitizeReportName(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9_\-\s]/g, '') // Remove special characters except spaces, hyphens, underscores
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
}

/**
 * Format date for filename in YYYY_MM_DD_HHmm format
 * @param date - Date to format (defaults to current date)
 * @param timezone - Optional timezone (e.g. 'Australia/Sydney')
 * @returns Formatted date string
 */
function formatDateForFilename(date: Date = new Date(), timezone?: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone || undefined
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';

    // Extract parts ensuring we get the expected digits
    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    const hour = getPart('hour');
    const minute = getPart('minute');

    return `${year}_${month}_${day}_${hour}${minute}`;
  } catch (error) {
    // Fallback if timezone is invalid or Intl fails
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}_${month}_${day}_${hours}${minutes}`;
  }
}

/**
 * Generate a standardized report filename
 * Format: {ReportName}_{YYYY_MM_DD_HHmm}.{extension}
 * 
 * Example:
 * - Report name: "DL_L2_TC11 - Dice line 2 TC 11 sterilizer"
 * - Date: January 21, 2026 at 08:07 PM
 * - Result: "DL_L2_TC11_2026_01_21_2007.pdf"
 * 
 * @param reportName - The name of the report (not description)
 * @param extension - File extension (default: 'pdf')
 * @param date - Date of generation (defaults to current date)
 * @param timezone - Optional timezone for the filename timestamp
 * @returns Standardized filename
 */
export function generateReportFilename(
  reportName: string,
  extension: string = 'pdf',
  date: Date = new Date(),
  timezone?: string
): string {
  const sanitizedName = sanitizeReportName(reportName);
  const dateStr = formatDateForFilename(date, timezone);

  // Ensure extension doesn't have a leading dot
  const ext = extension.startsWith('.') ? extension.slice(1) : extension;

  return `${sanitizedName}_${dateStr}.${ext}`;
}

/**
 * Extract report name from config
 * Uses the report name, not the description
 * 
 * @param config - Report configuration object
 * @returns Report name
 */
export function getReportNameFromConfig(config: any): string {
  // Use the name field, not description
  return config.name || config.id || 'report';
}
