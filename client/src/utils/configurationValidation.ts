/**
 * Client-side Configuration Validation Utilities
 * Mirrors backend validation for real-time feedback
 */

import { ConfigurationDataType } from '../types/configuration';

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
 * Validate configuration value based on environment variable name
 * This provides specific validation rules for known configurations
 */
export function validateConfigurationValue(
  envVar: string,
  value: string,
  dataType: ConfigurationDataType
): ValidationResult {
  // First validate by data type
  const typeValidation = validateByDataType(value, dataType);
  if (!typeValidation.isValid) {
    return typeValidation;
  }

  // Then apply specific validation rules based on configuration name
  switch (envVar) {
    case 'DB_HOST':
      return validateHostname(value);
    case 'DB_PORT':
      return validatePort(value);
    case 'DB_POOL_MIN':
      return validatePoolSize(value, 1, 50);
    case 'DB_POOL_MAX':
      return validatePoolSize(value, 2, 100);
    case 'DB_TIMEOUT_MS':
      return validateNumber(value, 5000, 300000);
    case 'PORT':
      return validatePort(value);
    case 'JWT_SECRET':
      return validateJwtSecret(value);
    case 'BCRYPT_ROUNDS':
      return validateBcryptRounds(value);
    case 'SMTP_PORT':
      return validatePort(value);
    case 'LOG_LEVEL':
      return validateLogLevel(value);
    case 'NODE_ENV':
      return validateNodeEnvironment(value);
    case 'CHART_WIDTH':
      return validateChartDimension(value, 400, 2000);
    case 'CHART_HEIGHT':
      return validateChartDimension(value, 300, 1500);
    case 'MAX_REPORT_SIZE_MB':
      return validateReportSizeLimit(value);
    case 'REDIS_PORT':
      return validatePort(value);
    case 'CACHE_DEFAULT_TTL':
      return validateNumber(value, 0, 86400);
    case 'SESSION_TIMEOUT_HOURS':
      return validateNumber(value, 1, 168);
    case 'RATE_LIMIT_WINDOW_MS':
      return validateNumber(value, 60000, 3600000);
    case 'RATE_LIMIT_MAX_REQUESTS':
      return validateNumber(value, 10, 1000);
    case 'LOG_MAX_FILES':
      return validateNumber(value, 1, 20);
    case 'MAX_CONCURRENT_REPORTS':
      return validateNumber(value, 1, 20);
    default:
      return { isValid: true };
  }
}
