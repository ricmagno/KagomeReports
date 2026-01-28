/**
 * Frontend Type Definitions for Configuration Management
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
  constraints?: string;
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
 * API response for configuration retrieval
 */
export interface ConfigurationResponse {
  success: boolean;
  data?: ConfigurationGroup[];
  error?: string;
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
 * State for tracking revealed sensitive values
 */
export interface RevealedValues {
  [configName: string]: boolean;
}

/**
 * Configuration display state
 */
export interface ConfigurationDisplayState {
  configurations: ConfigurationGroup[];
  expandedCategories: Set<ConfigurationCategory>;
  revealedValues: RevealedValues;
  loading: boolean;
  error: string | null;
}

/**
 * Configuration change for update request
 */
export interface ConfigurationChange {
  name: string;
  oldValue: string;
  newValue: string;
}

/**
 * Configuration update request
 */
export interface ConfigurationUpdateRequest {
  changes: ConfigurationChange[];
}

/**
 * Updated configuration in response
 */
export interface UpdatedConfiguration {
  name: string;
  value: string;
  requiresRestart: boolean;
}

/**
 * Configuration validation error
 */
export interface ConfigurationValidationError {
  name: string;
  error: string;
}

/**
 * Configuration update response
 */
export interface ConfigurationUpdateResponse {
  success: boolean;
  message?: string;
  updatedConfigurations?: UpdatedConfiguration[];
  validationErrors?: ConfigurationValidationError[];
  error?: string;
  backupPath?: string;
}

/**
 * Edit state for a configuration
 */
export interface ConfigurationEditState {
  isEditing: boolean;
  editValue: string;
  validationError?: string;
  isSaving: boolean;
  revealedDuringEdit: boolean;
}

/**
 * Confirmation dialog state
 */
export interface ConfirmationDialogState {
  isOpen: boolean;
  changes: ConfigurationChange[];
  isConfirming: boolean;
}
