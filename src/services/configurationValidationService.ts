/**
 * Configuration Validation Service
 * Handles validation of configuration values based on data type and constraints
 */

import { dbLogger } from '@/utils/logger';
import { ConfigurationDataType } from '@/types/configuration';

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Validation rule for a configuration
 */
export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'enum' | 'minLength' | 'maxLength';
  value?: string | number | string[];
  message: string;
}

/**
 * Configuration validation schema
 */
export interface ValidationSchema {
  dataType: ConfigurationDataType;
  rules?: ValidationRule[];
}

/**
 * Validation schemas for known configurations
 */
const VALIDATION_SCHEMAS: Record<string, ValidationSchema> = {

  // Application Configuration
  NODE_ENV: {
    dataType: 'string',
    rules: [
      { type: 'required', message: 'Node environment is required' },
      { type: 'enum', value: ['development', 'production', 'test'], message: 'Node environment must be development, production, or test' }
    ]
  },
  PORT: {
    dataType: 'number',
    rules: [
      { type: 'required', message: 'Application port is required' },
      { type: 'min', value: 1, message: 'Port must be at least 1' },
      { type: 'max', value: 65535, message: 'Port must be at most 65535' }
    ]
  },
  JWT_SECRET: {
    dataType: 'string',
    rules: [
      { type: 'required', message: 'JWT secret is required' },
      { type: 'minLength', value: 32, message: 'JWT secret must be at least 32 characters' }
    ]
  },
  BCRYPT_ROUNDS: {
    dataType: 'number',
    rules: [
      { type: 'required', message: 'Bcrypt rounds is required' },
      { type: 'min', value: 10, message: 'Bcrypt rounds must be at least 10' },
      { type: 'max', value: 15, message: 'Bcrypt rounds must be at most 15' }
    ]
  },

  // Email Configuration
  SMTP_HOST: {
    dataType: 'string',
    rules: [
      { type: 'required', message: 'SMTP host is required' },
      { type: 'minLength', value: 1, message: 'SMTP host cannot be empty' },
      { type: 'maxLength', value: 255, message: 'SMTP host must be less than 255 characters' }
    ]
  },
  SMTP_PORT: {
    dataType: 'number',
    rules: [
      { type: 'required', message: 'SMTP port is required' },
      { type: 'min', value: 1, message: 'Port must be at least 1' },
      { type: 'max', value: 65535, message: 'Port must be at most 65535' }
    ]
  },
  SMTP_SECURE: {
    dataType: 'boolean',
    rules: [
      { type: 'required', message: 'SMTP secure setting is required' }
    ]
  },
  SMTP_USER: {
    dataType: 'string',
    rules: [
      { type: 'required', message: 'SMTP user is required' },
      { type: 'minLength', value: 1, message: 'SMTP user cannot be empty' },
      { type: 'maxLength', value: 255, message: 'SMTP user must be less than 255 characters' }
    ]
  },
  SMTP_PASSWORD: {
    dataType: 'string',
    rules: [
      { type: 'required', message: 'SMTP password is required' },
      { type: 'minLength', value: 1, message: 'SMTP password cannot be empty' }
    ]
  },

  // Report Configuration
  REPORTS_DIR: {
    dataType: 'string',
    rules: [
      { type: 'required', message: 'Reports directory is required' },
      { type: 'minLength', value: 1, message: 'Reports directory cannot be empty' }
    ]
  },
  TEMP_DIR: {
    dataType: 'string',
    rules: [
      { type: 'required', message: 'Temporary directory is required' },
      { type: 'minLength', value: 1, message: 'Temporary directory cannot be empty' }
    ]
  },
  MAX_REPORT_SIZE_MB: {
    dataType: 'number',
    rules: [
      { type: 'required', message: 'Maximum report size is required' },
      { type: 'min', value: 1, message: 'Maximum report size must be at least 1 MB' },
      { type: 'max', value: 500, message: 'Maximum report size must be at most 500 MB' }
    ]
  },
  CHART_WIDTH: {
    dataType: 'number',
    rules: [
      { type: 'required', message: 'Chart width is required' },
      { type: 'min', value: 400, message: 'Chart width must be at least 400 pixels' },
      { type: 'max', value: 2000, message: 'Chart width must be at most 2000 pixels' }
    ]
  },
  CHART_HEIGHT: {
    dataType: 'number',
    rules: [
      { type: 'required', message: 'Chart height is required' },
      { type: 'min', value: 300, message: 'Chart height must be at least 300 pixels' },
      { type: 'max', value: 1500, message: 'Chart height must be at most 1500 pixels' }
    ]
  },

  // Performance Configuration
  CACHE_ENABLED: {
    dataType: 'boolean',
    rules: [
      { type: 'required', message: 'Cache enabled setting is required' }
    ]
  },
  REDIS_HOST: {
    dataType: 'string',
    rules: [
      { type: 'minLength', value: 0, message: 'Redis host cannot be empty if provided' },
      { type: 'maxLength', value: 255, message: 'Redis host must be less than 255 characters' }
    ]
  },
  REDIS_PORT: {
    dataType: 'number',
    rules: [
      { type: 'min', value: 1, message: 'Port must be at least 1' },
      { type: 'max', value: 65535, message: 'Port must be at most 65535' }
    ]
  },
  REDIS_PASSWORD: {
    dataType: 'string',
    rules: []
  },
  REDIS_DB: {
    dataType: 'number',
    rules: [
      { type: 'min', value: 0, message: 'Redis database must be at least 0' },
      { type: 'max', value: 15, message: 'Redis database must be at most 15' }
    ]
  },
  CACHE_KEY_PREFIX: {
    dataType: 'string',
    rules: [
      { type: 'maxLength', value: 50, message: 'Cache key prefix must be less than 50 characters' }
    ]
  },
  CACHE_DEFAULT_TTL: {
    dataType: 'number',
    rules: [
      { type: 'min', value: 0, message: 'Cache TTL must be at least 0 seconds' }
    ]
  },
  CACHE_TTL_SECONDS: {
    dataType: 'number',
    rules: [
      { type: 'required', message: 'Cache TTL is required' },
      { type: 'min', value: 60, message: 'Cache TTL must be at least 60 seconds' },
      { type: 'max', value: 3600, message: 'Cache TTL must be at most 3600 seconds' }
    ]
  },
  MAX_CONCURRENT_REPORTS: {
    dataType: 'number',
    rules: [
      { type: 'required', message: 'Maximum concurrent reports is required' },
      { type: 'min', value: 1, message: 'Maximum concurrent reports must be at least 1' },
      { type: 'max', value: 20, message: 'Maximum concurrent reports must be at most 20' }
    ]
  },

  // Security Configuration
  CORS_ORIGIN: {
    dataType: 'string',
    rules: [
      { type: 'required', message: 'CORS origin is required' },
      { type: 'minLength', value: 1, message: 'CORS origin cannot be empty' }
    ]
  },
  SESSION_TIMEOUT_HOURS: {
    dataType: 'number',
    rules: [
      { type: 'required', message: 'Session timeout is required' },
      { type: 'min', value: 1, message: 'Session timeout must be at least 1 hour' },
      { type: 'max', value: 168, message: 'Session timeout must be at most 168 hours' }
    ]
  },
  RATE_LIMIT_WINDOW_MS: {
    dataType: 'number',
    rules: [
      { type: 'required', message: 'Rate limit window is required' },
      { type: 'min', value: 60000, message: 'Rate limit window must be at least 60000 ms' },
      { type: 'max', value: 3600000, message: 'Rate limit window must be at most 3600000 ms' }
    ]
  },
  RATE_LIMIT_MAX_REQUESTS: {
    dataType: 'number',
    rules: [
      { type: 'required', message: 'Rate limit max requests is required' },
      { type: 'min', value: 10, message: 'Rate limit max requests must be at least 10' },
      { type: 'max', value: 1000, message: 'Rate limit max requests must be at most 1000' }
    ]
  },

  // Logging Configuration
  LOG_LEVEL: {
    dataType: 'string',
    rules: [
      { type: 'required', message: 'Log level is required' },
      { type: 'enum', value: ['error', 'warn', 'info', 'debug'], message: 'Log level must be error, warn, info, or debug' }
    ]
  },
  LOG_FILE: {
    dataType: 'string',
    rules: [
      { type: 'required', message: 'Log file path is required' },
      { type: 'minLength', value: 1, message: 'Log file path cannot be empty' }
    ]
  },
  LOG_MAX_SIZE: {
    dataType: 'string',
    rules: [
      { type: 'required', message: 'Log max size is required' },
      { type: 'minLength', value: 1, message: 'Log max size cannot be empty' }
    ]
  },
  LOG_MAX_FILES: {
    dataType: 'number',
    rules: [
      { type: 'required', message: 'Log max files is required' },
      { type: 'min', value: 1, message: 'Log max files must be at least 1' },
      { type: 'max', value: 20, message: 'Log max files must be at most 20' }
    ]
  }
};

/**
 * Configuration Validation Service
 */
export class ConfigurationValidationService {
  /**
   * Validate a configuration value
   */
  static validateConfigurationValue(
    configName: string,
    value: string,
    dataType?: ConfigurationDataType
  ): ValidationResult {
    try {
      // Get validation schema for this configuration
      const schema = VALIDATION_SCHEMAS[configName];

      if (!schema) {
        // If no schema defined, perform basic type validation
        return this.validateByDataType(value, dataType || 'string');
      }

      // Validate data type first
      const typeValidation = this.validateByDataType(value, schema.dataType);
      if (!typeValidation.isValid) {
        return typeValidation;
      }

      // Validate against rules
      if (schema.rules && schema.rules.length > 0) {
        return this.validateAgainstRules(value, schema.dataType, schema.rules);
      }

      return { isValid: true };
    } catch (error) {
      dbLogger.error(`Error validating configuration ${configName}`, error);
      return {
        isValid: false,
        error: 'An error occurred during validation'
      };
    }
  }

  /**
   * Validate value by data type
   */
  static validateByDataType(value: string, dataType: ConfigurationDataType): ValidationResult {
    if (!value && value !== '0' && value !== 'false') {
      return { isValid: true }; // Empty values are handled by required rule
    }

    switch (dataType) {
      case 'number':
        return this.validateNumber(value);
      case 'boolean':
        return this.validateBoolean(value);
      case 'string':
        return this.validateString(value);
      case 'array':
        return this.validateArray(value);
      default:
        return { isValid: true };
    }
  }

  /**
   * Validate string value
   */
  static validateString(value: string): ValidationResult {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: 'Value must be a string'
      };
    }
    return { isValid: true };
  }

  /**
   * Validate number value
   */
  static validateNumber(value: string): ValidationResult {
    const num = Number(value);
    if (isNaN(num)) {
      return {
        isValid: false,
        error: 'Value must be a valid number'
      };
    }
    return { isValid: true };
  }

  /**
   * Validate boolean value
   */
  static validateBoolean(value: string): ValidationResult {
    if (value !== 'true' && value !== 'false' && value !== '1' && value !== '0') {
      return {
        isValid: false,
        error: 'Value must be true or false'
      };
    }
    return { isValid: true };
  }

  /**
   * Validate array value
   */
  static validateArray(value: string): ValidationResult {
    try {
      JSON.parse(value);
      return { isValid: true };
    } catch {
      return {
        isValid: false,
        error: 'Value must be a valid JSON array'
      };
    }
  }

  /**
   * Validate against validation rules
   */
  static validateAgainstRules(
    value: string,
    dataType: ConfigurationDataType,
    rules: ValidationRule[]
  ): ValidationResult {
    for (const rule of rules) {
      const result = this.validateRule(value, dataType, rule);
      if (!result.isValid) {
        return result;
      }
    }
    return { isValid: true };
  }

  /**
   * Validate a single rule
   */
  static validateRule(
    value: string,
    dataType: ConfigurationDataType,
    rule: ValidationRule
  ): ValidationResult {
    switch (rule.type) {
      case 'required':
        return this.validateRequired(value, rule);
      case 'min':
        return this.validateMin(value, dataType, rule);
      case 'max':
        return this.validateMax(value, dataType, rule);
      case 'minLength':
        return this.validateMinLength(value, rule);
      case 'maxLength':
        return this.validateMaxLength(value, rule);
      case 'pattern':
        return this.validatePattern(value, rule);
      case 'enum':
        return this.validateEnum(value, rule);
      default:
        return { isValid: true };
    }
  }

  /**
   * Validate required rule
   */
  static validateRequired(value: string, rule: ValidationRule): ValidationResult {
    if (!value || value.trim() === '') {
      return {
        isValid: false,
        error: rule.message
      };
    }
    return { isValid: true };
  }

  /**
   * Validate minimum value rule
   */
  static validateMin(value: string, dataType: ConfigurationDataType, rule: ValidationRule): ValidationResult {
    if (dataType !== 'number') {
      return { isValid: true };
    }

    const num = Number(value);
    const minValue = rule.value as number;

    if (num < minValue) {
      return {
        isValid: false,
        error: rule.message
      };
    }
    return { isValid: true };
  }

  /**
   * Validate maximum value rule
   */
  static validateMax(value: string, dataType: ConfigurationDataType, rule: ValidationRule): ValidationResult {
    if (dataType !== 'number') {
      return { isValid: true };
    }

    const num = Number(value);
    const maxValue = rule.value as number;

    if (num > maxValue) {
      return {
        isValid: false,
        error: rule.message
      };
    }
    return { isValid: true };
  }

  /**
   * Validate minimum length rule
   */
  static validateMinLength(value: string, rule: ValidationRule): ValidationResult {
    const minLength = rule.value as number;

    if (value.length < minLength) {
      return {
        isValid: false,
        error: rule.message
      };
    }
    return { isValid: true };
  }

  /**
   * Validate maximum length rule
   */
  static validateMaxLength(value: string, rule: ValidationRule): ValidationResult {
    const maxLength = rule.value as number;

    if (value.length > maxLength) {
      return {
        isValid: false,
        error: rule.message
      };
    }
    return { isValid: true };
  }

  /**
   * Validate pattern rule
   */
  static validatePattern(value: string, rule: ValidationRule): ValidationResult {
    const pattern = rule.value as string;
    const regex = new RegExp(pattern);

    if (!regex.test(value)) {
      return {
        isValid: false,
        error: rule.message
      };
    }
    return { isValid: true };
  }

  /**
   * Validate enum rule
   */
  static validateEnum(value: string, rule: ValidationRule): ValidationResult {
    const enumValues = rule.value as string[];

    if (!enumValues.includes(value)) {
      return {
        isValid: false,
        error: rule.message
      };
    }
    return { isValid: true };
  }

  /**
   * Get validation schema for a configuration
   */
  static getValidationSchema(configName: string): ValidationSchema | null {
    return VALIDATION_SCHEMAS[configName] || null;
  }

  /**
   * Get all validation schemas
   */
  static getAllValidationSchemas(): Record<string, ValidationSchema> {
    return VALIDATION_SCHEMAS;
  }

  /**
   * Validate multiple configuration values
   */
  static validateMultipleConfigurations(
    configurations: Array<{ name: string; value: string; dataType: ConfigurationDataType }>
  ): Record<string, ValidationResult> {
    const results: Record<string, ValidationResult> = {};

    configurations.forEach(config => {
      results[config.name] = this.validateConfigurationValue(config.name, config.value, config.dataType);
    });

    return results;
  }

  /**
   * Check if all validations pass
   */
  static areAllValid(validationResults: Record<string, ValidationResult>): boolean {
    return Object.values(validationResults).every(result => result.isValid);
  }

  /**
   * Get all validation errors
   */
  static getValidationErrors(validationResults: Record<string, ValidationResult>): Record<string, string> {
    const errors: Record<string, string> = {};

    Object.entries(validationResults).forEach(([configName, result]) => {
      if (!result.isValid && result.error) {
        errors[configName] = result.error;
      }
    });

    return errors;
  }

  /**
   * Validate configuration value with constraints
   */
  static validateWithConstraints(
    configName: string,
    value: string,
    dataType: ConfigurationDataType,
    customRules?: ValidationRule[]
  ): ValidationResult {
    // First validate with standard schema
    const standardValidation = this.validateConfigurationValue(configName, value, dataType);
    if (!standardValidation.isValid) {
      return standardValidation;
    }

    // Then validate with custom rules if provided
    if (customRules && customRules.length > 0) {
      return this.validateAgainstRules(value, dataType, customRules);
    }

    return { isValid: true };
  }
}
