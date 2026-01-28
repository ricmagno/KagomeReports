/**
 * Type definitions for Application Configuration Management
 * Handles configuration display, masking, and audit logging
 */

/**
 * Configuration categories for organizing settings
 */
export enum ConfigurationCategory {
  Database = 'Database',
  Application = 'Application',
  Email = 'Email',
  Report = 'Report',
  Performance = 'Performance',
  Security = 'Security',
  Logging = 'Logging'
}

/**
 * Data types for configuration values
 */
export type ConfigurationDataType = 'string' | 'number' | 'boolean' | 'array';

/**
 * Individual configuration item
 */
export interface Configuration {
  name: string;
  value: string;
  description: string;
  category: ConfigurationCategory;
  dataType: ConfigurationDataType;
  isSensitive: boolean;
  isDefault: boolean;
  constraints?: string | undefined;
  environmentVariable: string;
  requiresRestart?: boolean;
}

/**
 * Grouped configurations by category
 */
export interface ConfigurationGroup {
  category: ConfigurationCategory;
  configurations: Configuration[];
}

/**
 * Configuration metadata for registry
 */
export interface ConfigurationMetadata {
  name: string;
  description: string;
  category: ConfigurationCategory;
  dataType: ConfigurationDataType;
  isSensitive: boolean;
  defaultValue?: string;
  constraints?: string;
  environmentVariable: string;
}

/**
 * API response for configuration retrieval
 */
export interface ConfigurationResponse {
  success: boolean;
  data?: ConfigurationGroup[];
  error?: string;
}

/**
 * API request for revealing sensitive value
 */
export interface RevealSensitiveRequest {
  configName: string;
}

/**
 * API response for revealing sensitive value
 */
export interface RevealSensitiveResponse {
  success: boolean;
  value?: string;
  error?: string;
}

/**
 * Audit log entry for configuration access
 */
export interface ConfigurationAuditLog {
  id: string;
  userId: string;
  action: 'access' | 'reveal' | 'change';
  configName?: string | undefined;
  oldValue?: string | undefined;
  newValue?: string | undefined;
  timestamp: Date;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

/**
 * Configuration change request
 */
export interface ConfigurationChange {
  name: string;
  oldValue: string;
  newValue: string;
}

/**
 * API request for updating configurations
 */
export interface ConfigurationUpdateRequest {
  changes: ConfigurationChange[];
}

/**
 * Updated configuration response
 */
export interface UpdatedConfiguration {
  name: string;
  value: string;
  requiresRestart: boolean;
}

/**
 * Validation error for a configuration
 */
export interface ConfigurationValidationError {
  name: string;
  error: string;
}

/**
 * API response for configuration update
 */
export interface ConfigurationUpdateResponse {
  success: boolean;
  message?: string;
  updatedConfigurations?: UpdatedConfiguration[];
  validationErrors?: ConfigurationValidationError[];
  backupPath?: string;
  error?: string;
}
