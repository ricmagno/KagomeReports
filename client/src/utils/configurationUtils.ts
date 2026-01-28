/**
 * Configuration Utilities
 * Helper functions for configuration management
 */

import {
  Configuration,
  ConfigurationGroup,
  ConfigurationCategory
} from '../types/configuration';

/**
 * Group configurations by category
 */
export function groupConfigurationsByCategory(
  configurations: Configuration[]
): ConfigurationGroup[] {
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
 * Sort configurations within a group
 */
export function sortConfigurations(configurations: Configuration[]): Configuration[] {
  return [...configurations].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Filter configurations by search term
 */
export function filterConfigurations(
  configurations: Configuration[],
  searchTerm: string
): Configuration[] {
  if (!searchTerm.trim()) {
    return configurations;
  }

  const lowerSearchTerm = searchTerm.toLowerCase();
  return configurations.filter(config =>
    config.name.toLowerCase().includes(lowerSearchTerm) ||
    config.description.toLowerCase().includes(lowerSearchTerm) ||
    config.environmentVariable.toLowerCase().includes(lowerSearchTerm)
  );
}

/**
 * Get all configurations from grouped data
 */
export function flattenConfigurationGroups(groups: ConfigurationGroup[]): Configuration[] {
  return groups.reduce((acc: Configuration[], group) => [...acc, ...group.configurations], []);
}

/**
 * Get configurations for a specific category
 */
export function getConfigurationsByCategory(
  groups: ConfigurationGroup[],
  category: ConfigurationCategory
): Configuration[] {
  const group = groups.find(g => g.category === category);
  return group?.configurations || [];
}

/**
 * Count configurations by category
 */
export function countConfigurationsByCategory(
  groups: ConfigurationGroup[]
): Record<ConfigurationCategory, number> {
  const counts: Record<ConfigurationCategory, number> = {} as any;

  Object.values(ConfigurationCategory).forEach(category => {
    counts[category] = 0;
  });

  groups.forEach(group => {
    counts[group.category] = group.configurations.length;
  });

  return counts;
}

/**
 * Get sensitive configurations
 */
export function getSensitiveConfigurations(
  configurations: Configuration[]
): Configuration[] {
  return configurations.filter(config => config.isSensitive);
}

/**
 * Get non-sensitive configurations
 */
export function getNonSensitiveConfigurations(
  configurations: Configuration[]
): Configuration[] {
  return configurations.filter(config => !config.isSensitive);
}

/**
 * Get default configurations
 */
export function getDefaultConfigurations(
  configurations: Configuration[]
): Configuration[] {
  return configurations.filter(config => config.isDefault);
}

/**
 * Get customized configurations
 */
export function getCustomizedConfigurations(
  configurations: Configuration[]
): Configuration[] {
  return configurations.filter(config => !config.isDefault);
}

/**
 * Format configuration value for display
 */
export function formatConfigurationValue(
  config: Configuration,
  isRevealed: boolean = false
): string {
  if (config.isSensitive && !isRevealed) {
    return config.value; // Already masked by backend
  }
  return config.value;
}

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: ConfigurationCategory): string {
  const displayNames: Record<ConfigurationCategory, string> = {
    [ConfigurationCategory.Database]: 'Database',
    [ConfigurationCategory.Application]: 'Application',
    [ConfigurationCategory.Email]: 'Email',
    [ConfigurationCategory.Report]: 'Report',
    [ConfigurationCategory.Performance]: 'Performance',
    [ConfigurationCategory.Security]: 'Security',
    [ConfigurationCategory.Logging]: 'Logging'
  };

  return displayNames[category] || category;
}

/**
 * Get category icon (for UI purposes)
 */
export function getCategoryIcon(category: ConfigurationCategory): string {
  const icons: Record<ConfigurationCategory, string> = {
    [ConfigurationCategory.Database]: '🗄️',
    [ConfigurationCategory.Application]: '⚙️',
    [ConfigurationCategory.Email]: '📧',
    [ConfigurationCategory.Report]: '📄',
    [ConfigurationCategory.Performance]: '⚡',
    [ConfigurationCategory.Security]: '🔒',
    [ConfigurationCategory.Logging]: '📝'
  };

  return icons[category] || '⚙️';
}

/**
 * Get data type display name
 */
export function getDataTypeDisplayName(dataType: string): string {
  const displayNames: Record<string, string> = {
    string: 'Text',
    number: 'Number',
    boolean: 'Boolean',
    array: 'Array'
  };

  return displayNames[dataType] || dataType;
}

/**
 * Check if configuration is sensitive and should show reveal button
 */
export function shouldShowRevealButton(config: Configuration): boolean {
  return config.isSensitive;
}

/**
 * Get configuration status badge
 */
export function getConfigurationStatusBadge(config: Configuration): string {
  if (config.isDefault) {
    return 'default';
  }
  return 'customized';
}

/**
 * Validate configuration value based on data type
 */
export function validateConfigurationValue(
  value: string,
  dataType: string
): { valid: boolean; error?: string } {
  switch (dataType) {
    case 'number':
      if (isNaN(Number(value))) {
        return { valid: false, error: 'Value must be a number' };
      }
      break;
    case 'boolean':
      if (value !== 'true' && value !== 'false') {
        return { valid: false, error: 'Value must be true or false' };
      }
      break;
    case 'string':
      if (typeof value !== 'string') {
        return { valid: false, error: 'Value must be a string' };
      }
      break;
  }

  return { valid: true };
}
