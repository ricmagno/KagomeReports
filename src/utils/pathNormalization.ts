/**
 * Path Normalization Utilities
 * 
 * Provides cross-platform path handling for export/import functionality.
 * Ensures paths work correctly across Windows, macOS, and Linux.
 * 
 * Key Features:
 * - Normalize paths to forward slashes for platform-independent storage
 * - Convert paths to platform-specific format for local use
 * - Handle both absolute and relative paths
 * - Preserve path semantics across platforms
 */

import * as path from 'path';

/**
 * Normalize a path to use forward slashes (/) for platform-independent storage.
 * This format is used in exported configurations to ensure cross-platform compatibility.
 * 
 * Examples:
 * - Windows: "C:\\Users\\John\\reports" → "C:/Users/John/reports"
 * - Unix: "/home/john/reports" → "/home/john/reports"
 * - Mixed: "C:\\Users/John\\reports/data" → "C:/Users/John/reports/data"
 * 
 * @param filePath - Path to normalize (can use any separator)
 * @returns Path with forward slashes
 */
export function normalizePathToForwardSlashes(filePath: string): string {
  if (!filePath) {
    return filePath;
  }

  // Replace all backslashes with forward slashes
  let normalized = filePath.replace(/\\/g, '/');

  // Remove duplicate slashes (but preserve protocol slashes like file://)
  normalized = normalized.replace(/([^:])\/+/g, '$1/');

  // Remove trailing slash (unless it's the root)
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Convert a path to the current platform's native format.
 * This is used when importing configurations to ensure paths work on the local system.
 * 
 * Examples:
 * - On Windows: "C:/Users/John/reports" → "C:\\Users\\John\\reports"
 * - On Unix: "C:/Users/John/reports" → "C:/Users/John/reports"
 * - On Windows: "/home/john/reports" → "\\home\\john\\reports"
 * 
 * @param filePath - Path to convert (typically with forward slashes)
 * @returns Path with platform-specific separators
 */
export function convertToPlatformPath(filePath: string): string {
  if (!filePath) {
    return filePath;
  }

  // First normalize to forward slashes
  const normalized = normalizePathToForwardSlashes(filePath);

  // Split by forward slash and rejoin with platform separator
  const segments = normalized.split('/');
  
  // Use path.join to create platform-specific path
  // Handle absolute paths correctly
  if (segments[0] === '') {
    // Unix absolute path (starts with /)
    return path.sep + path.join(...segments.slice(1));
  } else if (segments[0] && segments[0].match(/^[A-Za-z]:$/)) {
    // Windows absolute path with drive letter
    return path.join(...segments);
  } else {
    // Relative path
    return path.join(...segments);
  }
}

/**
 * Normalize a path object containing multiple path fields.
 * Applies forward slash normalization to all path fields in the object.
 * 
 * This is useful for normalizing configuration objects that contain multiple paths.
 * 
 * @param obj - Object containing path fields
 * @param pathFields - Array of field names that contain paths
 * @returns New object with normalized paths
 */
export function normalizePathsInObject<T extends Record<string, any>>(
  obj: T,
  pathFields: (keyof T)[]
): T {
  const normalized = { ...obj };

  for (const field of pathFields) {
    const value = normalized[field];
    if (typeof value === 'string') {
      normalized[field] = normalizePathToForwardSlashes(value) as any;
    } else if (Array.isArray(value)) {
      // Handle arrays of paths
      normalized[field] = value.map((item: any) =>
        typeof item === 'string' ? normalizePathToForwardSlashes(item) : item
      ) as any;
    }
  }

  return normalized;
}

/**
 * Convert paths in an object to platform-specific format.
 * Applies platform conversion to all path fields in the object.
 * 
 * This is useful for converting imported configuration objects to use local paths.
 * 
 * @param obj - Object containing path fields
 * @param pathFields - Array of field names that contain paths
 * @returns New object with platform-specific paths
 */
export function convertPathsInObject<T extends Record<string, any>>(
  obj: T,
  pathFields: (keyof T)[]
): T {
  const converted = { ...obj };

  for (const field of pathFields) {
    const value = converted[field];
    if (typeof value === 'string') {
      converted[field] = convertToPlatformPath(value) as any;
    } else if (Array.isArray(value)) {
      // Handle arrays of paths
      converted[field] = value.map((item: any) =>
        typeof item === 'string' ? convertToPlatformPath(item) : item
      ) as any;
    }
  }

  return converted;
}

/**
 * Check if a path is absolute.
 * Works across platforms (Windows and Unix).
 * 
 * @param filePath - Path to check
 * @returns True if path is absolute, false otherwise
 */
export function isAbsolutePath(filePath: string): boolean {
  if (!filePath) {
    return false;
  }

  // Check for Unix absolute path (starts with /)
  if (filePath.startsWith('/')) {
    return true;
  }

  // Check for Windows absolute path (starts with drive letter)
  if (filePath.match(/^[A-Za-z]:[/\\]/)) {
    return true;
  }

  // Check for UNC path (starts with \\)
  if (filePath.startsWith('\\\\')) {
    return true;
  }

  return false;
}

/**
 * Ensure a path is relative by removing any absolute path indicators.
 * This is useful for security when storing paths in configurations.
 * 
 * @param filePath - Path to make relative
 * @returns Relative path
 */
export function ensureRelativePath(filePath: string): string {
  if (!filePath) {
    return filePath;
  }

  let relativePath = filePath;

  // Remove leading slash (Unix)
  if (relativePath.startsWith('/')) {
    relativePath = relativePath.slice(1);
  }

  // Remove drive letter (Windows)
  if (relativePath.match(/^[A-Za-z]:[/\\]/)) {
    relativePath = relativePath.slice(3);
  }

  // Remove UNC prefix
  if (relativePath.startsWith('\\\\')) {
    relativePath = relativePath.slice(2);
  }

  return relativePath;
}

/**
 * Join path segments using forward slashes (platform-independent).
 * This is useful for building paths in exported configurations.
 * 
 * @param segments - Path segments to join
 * @returns Joined path with forward slashes
 */
export function joinPathsWithForwardSlashes(...segments: string[]): string {
  // Filter out empty segments
  const filtered = segments.filter(s => s && s.length > 0);

  if (filtered.length === 0) {
    return '';
  }

  // Normalize each segment and join with forward slash
  const normalized = filtered.map(s => normalizePathToForwardSlashes(s));

  // Join segments
  let joined = normalized.join('/');

  // Clean up double slashes (but preserve protocol slashes)
  joined = joined.replace(/([^:])\/+/g, '$1/');

  return joined;
}
