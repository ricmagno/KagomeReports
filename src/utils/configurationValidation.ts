/**
 * Configuration Validation Utilities
 * Helper functions for validating configuration values
 */

import { ConfigurationDataType } from '@/types/configuration';

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate a string value
 */
export function validateString(value: string, minLength?: number, maxLength?: number): ValidationResult {
  if (typeof value !== 'string') {
    return {
      isValid: false,
      error: 'Value must be a string'
    };
  }

  if (minLength !== undefined && value.length < minLength) {
    return {
      isValid: false,
      error: `Value must be at least ${minLength} characters`
    };
  }

  if (maxLength !== undefined && value.length > maxLength) {
    return {
      isValid: false,
      error: `Value must be at most ${maxLength} characters`
    };
  }

  return { isValid: true };
}

/**
 * Validate a number value
 */
export function validateNumber(value: string, min?: number, max?: number): ValidationResult {
  const num = Number(value);

  if (isNaN(num)) {
    return {
      isValid: false,
      error: 'Value must be a valid number'
    };
  }

  if (min !== undefined && num < min) {
    return {
      isValid: false,
      error: `Value must be at least ${min}`
    };
  }

  if (max !== undefined && num > max) {
    return {
      isValid: false,
      error: `Value must be at most ${max}`
    };
  }

  return { isValid: true };
}

/**
 * Validate a boolean value
 */
export function validateBoolean(value: string): ValidationResult {
  if (value !== 'true' && value !== 'false' && value !== '1' && value !== '0') {
    return {
      isValid: false,
      error: 'Value must be true or false'
    };
  }

  return { isValid: true };
}

/**
 * Validate an enum value
 */
export function validateEnum(value: string, allowedValues: string[]): ValidationResult {
  if (!allowedValues.includes(value)) {
    return {
      isValid: false,
      error: `Value must be one of: ${allowedValues.join(', ')}`
    };
  }

  return { isValid: true };
}

/**
 * Validate a pattern
 */
export function validatePattern(value: string, pattern: string | RegExp): ValidationResult {
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

  if (!regex.test(value)) {
    return {
      isValid: false,
      error: `Value does not match the required pattern: ${pattern}`
    };
  }

  return { isValid: true };
}

/**
 * Validate a value by data type
 */
export function validateByDataType(value: string, dataType: ConfigurationDataType): ValidationResult {
  if (!value && value !== '0' && value !== 'false') {
    return { isValid: true }; // Empty values are handled by required rule
  }

  switch (dataType) {
    case 'number':
      return validateNumber(value);
    case 'boolean':
      return validateBoolean(value);
    case 'string':
      return validateString(value);
    case 'array':
      try {
        JSON.parse(value);
        return { isValid: true };
      } catch {
        return {
          isValid: false,
          error: 'Value must be a valid JSON array'
        };
      }
    default:
      return { isValid: true };
  }
}

/**
 * Validate a required value
 */
export function validateRequired(value: string): ValidationResult {
  if (!value || value.trim() === '') {
    return {
      isValid: false,
      error: 'This field is required'
    };
  }

  return { isValid: true };
}

/**
 * Validate port number
 */
export function validatePort(value: string): ValidationResult {
  const validation = validateNumber(value, 1, 65535);
  if (!validation.isValid) {
    return {
      isValid: false,
      error: 'Port must be a number between 1 and 65535'
    };
  }

  return { isValid: true };
}

/**
 * Validate hostname or IP address
 */
export function validateHostname(value: string): ValidationResult {
  if (!value || value.trim() === '') {
    return {
      isValid: false,
      error: 'Hostname cannot be empty'
    };
  }

  // Simple validation for hostname or IP address
  const hostnamePattern = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$|^(\d{1,3}\.){3}\d{1,3}$/;
  
  if (!hostnamePattern.test(value)) {
    return {
      isValid: false,
      error: 'Invalid hostname or IP address format'
    };
  }

  return { isValid: true };
}

/**
 * Validate email address
 */
export function validateEmail(value: string): ValidationResult {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(value)) {
    return {
      isValid: false,
      error: 'Invalid email address format'
    };
  }

  return { isValid: true };
}

/**
 * Validate URL
 */
export function validateUrl(value: string): ValidationResult {
  try {
    new URL(value);
    return { isValid: true };
  } catch {
    return {
      isValid: false,
      error: 'Invalid URL format'
    };
  }
}

/**
 * Validate file path
 */
export function validateFilePath(value: string): ValidationResult {
  if (!value || value.trim() === '') {
    return {
      isValid: false,
      error: 'File path cannot be empty'
    };
  }

  // Basic validation - check for invalid characters (but allow backslashes for Windows paths)
  const invalidChars = /[<>:"|?*]/;
  if (invalidChars.test(value)) {
    return {
      isValid: false,
      error: 'File path contains invalid characters'
    };
  }

  return { isValid: true };
}

/**
 * Validate directory path
 */
export function validateDirectoryPath(value: string): ValidationResult {
  return validateFilePath(value);
}

/**
 * Validate JWT secret
 */
export function validateJwtSecret(value: string): ValidationResult {
  if (value.length < 32) {
    return {
      isValid: false,
      error: 'JWT secret must be at least 32 characters'
    };
  }

  return { isValid: true };
}

/**
 * Validate database connection string
 */
export function validateDatabaseConnectionString(value: string): ValidationResult {
  if (!value || value.trim() === '') {
    return {
      isValid: false,
      error: 'Database connection string cannot be empty'
    };
  }

  return { isValid: true };
}

/**
 * Validate CORS origin
 */
export function validateCorsOrigin(value: string): ValidationResult {
  if (!value || value.trim() === '') {
    return {
      isValid: false,
      error: 'CORS origin cannot be empty'
    };
  }

  // Allow * or valid URLs
  if (value === '*') {
    return { isValid: true };
  }

  try {
    new URL(value);
    return { isValid: true };
  } catch {
    return {
      isValid: false,
      error: 'CORS origin must be * or a valid URL'
    };
  }
}

/**
 * Validate log level
 */
export function validateLogLevel(value: string): ValidationResult {
  const validLevels = ['error', 'warn', 'info', 'debug'];

  if (!validLevels.includes(value)) {
    return {
      isValid: false,
      error: `Log level must be one of: ${validLevels.join(', ')}`
    };
  }

  return { isValid: true };
}

/**
 * Validate node environment
 */
export function validateNodeEnvironment(value: string): ValidationResult {
  const validEnvs = ['development', 'production', 'test'];

  if (!validEnvs.includes(value)) {
    return {
      isValid: false,
      error: `Node environment must be one of: ${validEnvs.join(', ')}`
    };
  }

  return { isValid: true };
}

/**
 * Validate percentage value
 */
export function validatePercentage(value: string): ValidationResult {
  const validation = validateNumber(value, 0, 100);
  if (!validation.isValid) {
    return {
      isValid: false,
      error: 'Percentage must be a number between 0 and 100'
    };
  }

  return { isValid: true };
}

/**
 * Validate timeout value in milliseconds
 */
export function validateTimeout(value: string, minMs?: number, maxMs?: number): ValidationResult {
  const min = minMs || 0;
  const max = maxMs || 3600000; // 1 hour default max

  return validateNumber(value, min, max);
}

/**
 * Validate memory size in MB
 */
export function validateMemorySize(value: string, minMb?: number, maxMb?: number): ValidationResult {
  const min = minMb || 1;
  const max = maxMb || 10000;

  return validateNumber(value, min, max);
}

/**
 * Validate concurrent connections
 */
export function validateConcurrentConnections(value: string, minConnections?: number, maxConnections?: number): ValidationResult {
  const min = minConnections || 1;
  const max = maxConnections || 1000;

  return validateNumber(value, min, max);
}

/**
 * Validate cache TTL
 */
export function validateCacheTtl(value: string): ValidationResult {
  return validateNumber(value, 0, 86400); // 0 to 24 hours in seconds
}

/**
 * Validate bcrypt rounds
 */
export function validateBcryptRounds(value: string): ValidationResult {
  return validateNumber(value, 10, 15);
}

/**
 * Validate database pool size
 */
export function validatePoolSize(value: string, minSize?: number, maxSize?: number): ValidationResult {
  const min = minSize || 1;
  const max = maxSize || 100;

  return validateNumber(value, min, max);
}

/**
 * Validate rate limit configuration
 */
export function validateRateLimit(value: string): ValidationResult {
  return validateNumber(value, 1, 10000);
}

/**
 * Validate session timeout
 */
export function validateSessionTimeout(value: string): ValidationResult {
  return validateNumber(value, 1, 168); // 1 minute to 1 week in hours
}

/**
 * Validate chart dimensions
 */
export function validateChartDimension(value: string, minPixels?: number, maxPixels?: number): ValidationResult {
  const min = minPixels || 100;
  const max = maxPixels || 5000;

  return validateNumber(value, min, max);
}

/**
 * Validate report size limit
 */
export function validateReportSizeLimit(value: string): ValidationResult {
  return validateNumber(value, 1, 1000); // 1 MB to 1 GB
}

/**
 * Validate configuration value with custom rules
 */
export function validateWithCustomRules(
  value: string,
  dataType: ConfigurationDataType,
  rules: Array<{ type: string; value?: any; message: string }>
): ValidationResult {
  // First validate by data type
  const typeValidation = validateByDataType(value, dataType);
  if (!typeValidation.isValid) {
    return typeValidation;
  }

  // Then validate against custom rules
  for (const rule of rules) {
    switch (rule.type) {
      case 'required':
        if (!value || value.trim() === '') {
          return { isValid: false, error: rule.message };
        }
        break;
      case 'min':
        if (dataType === 'number' && Number(value) < rule.value) {
          return { isValid: false, error: rule.message };
        }
        break;
      case 'max':
        if (dataType === 'number' && Number(value) > rule.value) {
          return { isValid: false, error: rule.message };
        }
        break;
      case 'minLength':
        if (value.length < rule.value) {
          return { isValid: false, error: rule.message };
        }
        break;
      case 'maxLength':
        if (value.length > rule.value) {
          return { isValid: false, error: rule.message };
        }
        break;
      case 'pattern':
        if (!new RegExp(rule.value).test(value)) {
          return { isValid: false, error: rule.message };
        }
        break;
      case 'enum':
        if (!rule.value.includes(value)) {
          return { isValid: false, error: rule.message };
        }
        break;
    }
  }

  return { isValid: true };
}
