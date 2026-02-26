/**
 * Configuration Service
 * Handles loading, organizing, and masking application configurations
 */

import { dbLogger } from '@/utils/logger';
import {
  Configuration,
  ConfigurationGroup,
  ConfigurationCategory,
  ConfigurationMetadata,
  ConfigurationDataType
} from '@/types/configuration';

/**
 * Patterns to identify sensitive configurations
 */
const SENSITIVE_PATTERNS = [
  /PASSWORD/i,
  /SECRET/i,
  /KEY/i,
  /TOKEN/i,
  /CREDENTIAL/i,
  /APIKEY/i,
  /PRIVATE/i,
  /ENCRYPT/i
];

/**
 * Configuration metadata registry
 * Defines all known configurations with descriptions, categories, and constraints
 */
const CONFIGURATION_METADATA: Record<string, ConfigurationMetadata> = {

  // Application Configuration
  NODE_ENV: {
    name: 'Node Environment',
    description: 'Application runtime environment (development, production, test)',
    category: ConfigurationCategory.Application,
    dataType: 'string',
    isSensitive: false,
    constraints: 'development, production, or test',
    environmentVariable: 'NODE_ENV'
  },
  PORT: {
    name: 'Application Port',
    description: 'Port number for the application server',
    category: ConfigurationCategory.Application,
    dataType: 'number',
    isSensitive: false,
    constraints: 'Valid port number (1-65535)',
    environmentVariable: 'PORT'
  },
  JWT_SECRET: {
    name: 'JWT Secret',
    description: 'Secret key for JWT token signing and verification',
    category: ConfigurationCategory.Security,
    dataType: 'string',
    isSensitive: true,
    constraints: 'Minimum 32 characters',
    environmentVariable: 'JWT_SECRET'
  },
  BCRYPT_ROUNDS: {
    name: 'Bcrypt Rounds',
    description: 'Number of rounds for bcrypt password hashing',
    category: ConfigurationCategory.Security,
    dataType: 'number',
    isSensitive: false,
    constraints: '10-15 rounds recommended',
    environmentVariable: 'BCRYPT_ROUNDS'
  },

  // Email Configuration
  SMTP_HOST: {
    name: 'SMTP Host',
    description: 'Hostname of the SMTP server for email delivery',
    category: ConfigurationCategory.Email,
    dataType: 'string',
    isSensitive: false,
    environmentVariable: 'SMTP_HOST'
  },
  SMTP_PORT: {
    name: 'SMTP Port',
    description: 'Port number for SMTP server connection',
    category: ConfigurationCategory.Email,
    dataType: 'number',
    isSensitive: false,
    constraints: 'Valid port number (1-65535)',
    environmentVariable: 'SMTP_PORT'
  },
  SMTP_SECURE: {
    name: 'SMTP Secure',
    description: 'Use TLS/SSL for SMTP connection',
    category: ConfigurationCategory.Email,
    dataType: 'boolean',
    isSensitive: false,
    environmentVariable: 'SMTP_SECURE'
  },
  SMTP_USER: {
    name: 'SMTP User',
    description: 'Email address for SMTP authentication',
    category: ConfigurationCategory.Email,
    dataType: 'string',
    isSensitive: false,
    environmentVariable: 'SMTP_USER'
  },
  SMTP_PASSWORD: {
    name: 'SMTP Password',
    description: 'Password for SMTP authentication',
    category: ConfigurationCategory.Email,
    dataType: 'string',
    isSensitive: true,
    environmentVariable: 'SMTP_PASSWORD'
  },

  // Report Configuration
  REPORTS_DIR: {
    name: 'Reports Directory',
    description: 'Directory path for storing generated reports',
    category: ConfigurationCategory.Report,
    dataType: 'string',
    isSensitive: false,
    environmentVariable: 'REPORTS_DIR'
  },
  TEMP_DIR: {
    name: 'Temporary Directory',
    description: 'Directory path for temporary files during report generation',
    category: ConfigurationCategory.Report,
    dataType: 'string',
    isSensitive: false,
    environmentVariable: 'TEMP_DIR'
  },
  MAX_REPORT_SIZE_MB: {
    name: 'Maximum Report Size',
    description: 'Maximum size for generated reports in megabytes',
    category: ConfigurationCategory.Report,
    dataType: 'number',
    isSensitive: false,
    constraints: '1-500 MB',
    environmentVariable: 'MAX_REPORT_SIZE_MB'
  },
  CHART_WIDTH: {
    name: 'Chart Width',
    description: 'Default width for generated charts in pixels',
    category: ConfigurationCategory.Report,
    dataType: 'number',
    isSensitive: false,
    constraints: '400-2000 pixels',
    environmentVariable: 'CHART_WIDTH'
  },
  CHART_HEIGHT: {
    name: 'Chart Height',
    description: 'Default height for generated charts in pixels',
    category: ConfigurationCategory.Report,
    dataType: 'number',
    isSensitive: false,
    constraints: '300-1500 pixels',
    environmentVariable: 'CHART_HEIGHT'
  },

  // Performance Configuration
  CACHE_ENABLED: {
    name: 'Cache Enabled',
    description: 'Enable caching for improved performance',
    category: ConfigurationCategory.Performance,
    dataType: 'boolean',
    isSensitive: false,
    environmentVariable: 'CACHE_ENABLED'
  },
  REDIS_HOST: {
    name: 'Redis Host',
    description: 'Hostname of the Redis cache server',
    category: ConfigurationCategory.Performance,
    dataType: 'string',
    isSensitive: false,
    environmentVariable: 'REDIS_HOST'
  },
  REDIS_PORT: {
    name: 'Redis Port',
    description: 'Port number for Redis server connection',
    category: ConfigurationCategory.Performance,
    dataType: 'number',
    isSensitive: false,
    constraints: 'Valid port number (1-65535)',
    environmentVariable: 'REDIS_PORT'
  },
  REDIS_PASSWORD: {
    name: 'Redis Password',
    description: 'Password for Redis authentication',
    category: ConfigurationCategory.Performance,
    dataType: 'string',
    isSensitive: true,
    environmentVariable: 'REDIS_PASSWORD'
  },
  REDIS_DB: {
    name: 'Redis Database',
    description: 'Redis database number',
    category: ConfigurationCategory.Performance,
    dataType: 'number',
    isSensitive: false,
    environmentVariable: 'REDIS_DB'
  },
  CACHE_KEY_PREFIX: {
    name: 'Cache Key Prefix',
    description: 'Prefix for all cache keys',
    category: ConfigurationCategory.Performance,
    dataType: 'string',
    isSensitive: false,
    environmentVariable: 'CACHE_KEY_PREFIX'
  },
  CACHE_DEFAULT_TTL: {
    name: 'Cache Default TTL',
    description: 'Default time-to-live for cached items in seconds',
    category: ConfigurationCategory.Performance,
    dataType: 'number',
    isSensitive: false,
    constraints: 'Seconds',
    environmentVariable: 'CACHE_DEFAULT_TTL'
  },
  CACHE_TTL_SECONDS: {
    name: 'Cache TTL',
    description: 'Cache time-to-live in seconds',
    category: ConfigurationCategory.Performance,
    dataType: 'number',
    isSensitive: false,
    constraints: '60-3600 seconds',
    environmentVariable: 'CACHE_TTL_SECONDS'
  },
  MAX_CONCURRENT_REPORTS: {
    name: 'Maximum Concurrent Reports',
    description: 'Maximum number of reports that can be generated concurrently',
    category: ConfigurationCategory.Performance,
    dataType: 'number',
    isSensitive: false,
    constraints: '1-20 reports',
    environmentVariable: 'MAX_CONCURRENT_REPORTS'
  },

  // Security Configuration
  CORS_ORIGIN: {
    name: 'CORS Origin',
    description: 'Allowed origin for Cross-Origin Resource Sharing',
    category: ConfigurationCategory.Security,
    dataType: 'string',
    isSensitive: false,
    environmentVariable: 'CORS_ORIGIN'
  },
  SESSION_TIMEOUT_HOURS: {
    name: 'Session Timeout',
    description: 'Session timeout duration in hours',
    category: ConfigurationCategory.Security,
    dataType: 'number',
    isSensitive: false,
    constraints: '1-168 hours',
    environmentVariable: 'SESSION_TIMEOUT_HOURS'
  },
  RATE_LIMIT_WINDOW_MS: {
    name: 'Rate Limit Window',
    description: 'Time window for rate limiting in milliseconds',
    category: ConfigurationCategory.Security,
    dataType: 'number',
    isSensitive: false,
    constraints: '60000-3600000 ms',
    environmentVariable: 'RATE_LIMIT_WINDOW_MS'
  },
  RATE_LIMIT_MAX_REQUESTS: {
    name: 'Rate Limit Max Requests',
    description: 'Maximum requests allowed within the rate limit window',
    category: ConfigurationCategory.Security,
    dataType: 'number',
    isSensitive: false,
    constraints: '10-1000 requests',
    environmentVariable: 'RATE_LIMIT_MAX_REQUESTS'
  },

  // Logging Configuration
  LOG_LEVEL: {
    name: 'Log Level',
    description: 'Logging level (error, warn, info, debug)',
    category: ConfigurationCategory.Logging,
    dataType: 'string',
    isSensitive: false,
    constraints: 'error, warn, info, or debug',
    environmentVariable: 'LOG_LEVEL'
  },
  LOG_FILE: {
    name: 'Log File',
    description: 'Path to the application log file',
    category: ConfigurationCategory.Logging,
    dataType: 'string',
    isSensitive: false,
    environmentVariable: 'LOG_FILE'
  },
  LOG_MAX_SIZE: {
    name: 'Log Max Size',
    description: 'Maximum size for log files before rotation',
    category: ConfigurationCategory.Logging,
    dataType: 'string',
    isSensitive: false,
    environmentVariable: 'LOG_MAX_SIZE'
  },
  LOG_MAX_FILES: {
    name: 'Log Max Files',
    description: 'Maximum number of log files to retain',
    category: ConfigurationCategory.Logging,
    dataType: 'number',
    isSensitive: false,
    constraints: '1-20 files',
    environmentVariable: 'LOG_MAX_FILES'
  }
};

/**
 * Check if a configuration name matches sensitive patterns
 */
function isSensitiveConfiguration(name: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(name));
}

/**
 * Get default value for a configuration
 */
function getDefaultValue(name: string): string | undefined {
  const metadata = CONFIGURATION_METADATA[name];
  return metadata?.defaultValue;
}

/**
 * Check if current value is the default
 */
function isDefaultValue(name: string, value: string): boolean {
  const defaultValue = getDefaultValue(name);
  return defaultValue !== undefined && defaultValue === value;
}

/**
 * Check if a configuration requires restart
 */
function requiresRestart(envVar: string): boolean {
  const requiresRestartConfigs = [
    'NODE_ENV',
    'PORT',
    'JWT_SECRET',
    'BCRYPT_ROUNDS',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_SECURE',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'REPORTS_DIR',
    'TEMP_DIR',
    'REDIS_HOST',
    'REDIS_PORT',
    'REDIS_PASSWORD',
    'REDIS_DB',
    'LOG_LEVEL',
    'LOG_FILE'
  ];

  return requiresRestartConfigs.includes(envVar);
}

/**
 * Mask a sensitive value
 */
function maskSensitiveValue(value: string): string {
  if (!value) return '••••••••';
  // Show first and last character if value is long enough, otherwise just mask
  if (value.length > 4) {
    return value.charAt(0) + '•'.repeat(value.length - 2) + value.charAt(value.length - 1);
  }
  return '••••••••';
}

/**
 * Configuration Service
 */
export class ConfigurationService {
  /**
   * Get all configurations organized by category
   */
  static getAllConfigurations(): ConfigurationGroup[] {
    try {
      dbLogger.info('Retrieving all configurations');

      const configurations: Configuration[] = [];

      // Load all environment variables
      for (const [envVar, value] of Object.entries(process.env)) {
        const metadata = CONFIGURATION_METADATA[envVar];

        if (!metadata) {
          // Skip unknown environment variables
          continue;
        }

        const isSensitive = isSensitiveConfiguration(envVar);
        const isDefault = isDefaultValue(envVar, value || '');
        const displayValue = isSensitive ? maskSensitiveValue(value || '') : (value || '');

        configurations.push({
          name: metadata.name,
          value: displayValue,
          description: metadata.description,
          category: metadata.category,
          dataType: metadata.dataType,
          isSensitive,
          isDefault,
          constraints: metadata.constraints,
          environmentVariable: envVar,
          requiresRestart: requiresRestart(envVar)
        });
      }

      // Group by category
      const groups = this.groupByCategory(configurations);

      dbLogger.info(`Retrieved ${configurations.length} configurations in ${groups.length} categories`);
      return groups;
    } catch (error) {
      dbLogger.error('Error retrieving configurations', error);
      throw error;
    }
  }

  /**
   * Get configurations by category
   */
  static getConfigurationsByCategory(category: ConfigurationCategory): Configuration[] {
    try {
      const allConfigs = this.getAllConfigurations();
      const categoryGroup = allConfigs.find(g => g.category === category);
      return categoryGroup?.configurations || [];
    } catch (error) {
      dbLogger.error(`Error retrieving configurations for category ${category}`, error);
      throw error;
    }
  }

  /**
   * Get a specific configuration by environment variable name
   */
  static getConfiguration(envVar: string): Configuration | null {
    try {
      const metadata = CONFIGURATION_METADATA[envVar];
      if (!metadata) {
        return null;
      }

      const value = process.env[envVar] || '';
      const isSensitive = isSensitiveConfiguration(envVar);
      const isDefault = isDefaultValue(envVar, value);
      const displayValue = isSensitive ? maskSensitiveValue(value) : value;

      return {
        name: metadata.name,
        value: displayValue,
        description: metadata.description,
        category: metadata.category,
        dataType: metadata.dataType,
        isSensitive,
        isDefault,
        constraints: metadata.constraints,
        environmentVariable: envVar,
        requiresRestart: requiresRestart(envVar)
      };
    } catch (error) {
      dbLogger.error(`Error retrieving configuration ${envVar}`, error);
      throw error;
    }
  }

  /**
   * Get actual value of a sensitive configuration (for reveal functionality)
   */
  static getSensitiveValue(envVar: string): string | null {
    try {
      const metadata = CONFIGURATION_METADATA[envVar];
      if (!metadata || !metadata.isSensitive) {
        return null;
      }

      const value = process.env[envVar];
      if (!value) {
        return null;
      }

      dbLogger.info(`Sensitive value accessed for ${envVar}`);
      return value;
    } catch (error) {
      dbLogger.error(`Error retrieving sensitive value for ${envVar}`, error);
      throw error;
    }
  }

  /**
   * Check if a configuration is sensitive
   */
  static isSensitive(envVar: string): boolean {
    const metadata = CONFIGURATION_METADATA[envVar];
    return metadata?.isSensitive || false;
  }

  /**
   * Get all known configuration names
   */
  static getAllConfigurationNames(): string[] {
    return Object.keys(CONFIGURATION_METADATA);
  }

  /**
   * Group configurations by category
   */
  private static groupByCategory(configurations: Configuration[]): ConfigurationGroup[] {
    const groups: Map<ConfigurationCategory, Configuration[]> = new Map();

    // Initialize all categories
    Object.values(ConfigurationCategory).forEach(category => {
      groups.set(category, []);
    });

    // Group configurations
    configurations.forEach(config => {
      const categoryConfigs = groups.get(config.category) || [];
      categoryConfigs.push(config);
      groups.set(config.category, categoryConfigs);
    });

    // Convert to array and sort by category order
    const categoryOrder = Object.values(ConfigurationCategory);
    return Array.from(groups.entries())
      .sort((a, b) => categoryOrder.indexOf(a[0]) - categoryOrder.indexOf(b[0]))
      .map(([category, configurations]) => ({
        category,
        configurations: configurations.sort((a, b) => a.name.localeCompare(b.name))
      }))
      .filter(group => group.configurations.length > 0);
  }

  /**
   * Validate category consistency
   * Ensures that configurations are assigned to the correct categories
   */
  static validateCategoryConsistency(configurations: ConfigurationGroup[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check that all configurations are in valid categories
    configurations.forEach(group => {
      if (!Object.values(ConfigurationCategory).includes(group.category)) {
        errors.push(`Invalid category: ${group.category}`);
      }

      group.configurations.forEach(config => {
        // Verify that the configuration's category matches the group's category
        if (config.category !== group.category) {
          errors.push(
            `Configuration ${config.environmentVariable} has mismatched category: ` +
            `expected ${group.category}, got ${config.category}`
          );
        }

        // Verify that the configuration is in the metadata registry
        const metadata = CONFIGURATION_METADATA[config.environmentVariable];
        if (!metadata) {
          errors.push(
            `Configuration ${config.environmentVariable} not found in metadata registry`
          );
        } else if (metadata.category !== config.category) {
          errors.push(
            `Configuration ${config.environmentVariable} category mismatch: ` +
            `metadata says ${metadata.category}, but got ${config.category}`
          );
        }
      });
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get category for a configuration
   */
  static getConfigurationCategory(envVar: string): ConfigurationCategory | null {
    const metadata = CONFIGURATION_METADATA[envVar];
    return metadata?.category || null;
  }

  /**
   * Verify that a configuration is in the correct category
   */
  static isConfigurationInCorrectCategory(envVar: string, category: ConfigurationCategory): boolean {
    const metadata = CONFIGURATION_METADATA[envVar];
    return metadata?.category === category;
  }
}
