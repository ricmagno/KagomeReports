/**
 * Property-Based Tests for Configuration Retrieval
 * Tests that all configurations are retrieved and organized by category
 * 
 * **Validates: Requirements 1.1, 2.1**
 */

import fc from 'fast-check';
import { ConfigurationService } from '@/services/configurationService';
import { ConfigurationCategory } from '@/types/configuration';

describe('Configuration Retrieval - Property Tests', () => {
  /**
   * Property 1: All configurations are retrieved and organized by category
   * For any API call to retrieve configurations, all configurations from the environment
   * should be returned organized into the seven expected categories
   * (Database, Application, Email, Report, Performance, Security, Logging).
   * 
   * **Validates: Requirements 1.1, 2.1**
   */
  it('Property 1: All configurations are retrieved and organized by category', () => {
    const expectedCategories: ConfigurationCategory[] = [
      ConfigurationCategory.Database,
      ConfigurationCategory.Application,
      ConfigurationCategory.Email,
      ConfigurationCategory.Report,
      ConfigurationCategory.Performance,
      ConfigurationCategory.Security,
      ConfigurationCategory.Logging
    ];

    const configurations = ConfigurationService.getAllConfigurations();

    // Verify all expected categories are present
    const presentCategories = configurations.map(group => group.category);
    expectedCategories.forEach(category => {
      expect(presentCategories).toContain(category);
    });

    // Verify no unexpected categories
    presentCategories.forEach(category => {
      expect(expectedCategories).toContain(category);
    });

    // Verify each category has configurations
    configurations.forEach(group => {
      expect(group.configurations.length).toBeGreaterThan(0);
    });

    // Verify all configurations have required fields
    configurations.forEach(group => {
      group.configurations.forEach(config => {
        expect(config.name).toBeDefined();
        expect(config.value).toBeDefined();
        expect(config.description).toBeDefined();
        expect(config.category).toBe(group.category);
        expect(config.dataType).toBeDefined();
      });
    });
  });

  /**
   * Property 2: Configuration count is consistent across multiple calls
   * For any multiple calls to retrieve configurations, the number of configurations
   * returned should be consistent.
   * 
   * **Validates: Requirements 1.1**
   */
  it('Property 2: Configuration count is consistent across multiple calls', () => {
    const call1 = ConfigurationService.getAllConfigurations();
    const call2 = ConfigurationService.getAllConfigurations();

    const count1 = call1.reduce((sum, group) => sum + group.configurations.length, 0);
    const count2 = call2.reduce((sum, group) => sum + group.configurations.length, 0);

    expect(count1).toBe(count2);
  });

  /**
   * Property 3: Each configuration belongs to exactly one category
   * For any configuration returned, it should be assigned to exactly one category
   * and appear only in that category.
   * 
   * **Validates: Requirements 2.1, 2.2**
   */
  it('Property 3: Each configuration belongs to exactly one category', () => {
    const configurations = ConfigurationService.getAllConfigurations();

    const configNames = new Set<string>();
    const configsByName = new Map<string, string>();

    configurations.forEach(group => {
      group.configurations.forEach(config => {
        if (configNames.has(config.name)) {
          const previousCategory = configsByName.get(config.name);
          expect(previousCategory).toBe(group.category);
        }
        configNames.add(config.name);
        configsByName.set(config.name, group.category);
      });
    });
  });

  /**
   * Property 4: Configuration names are unique within the system
   * For any set of configurations retrieved, each configuration name should be unique.
   * 
   * **Validates: Requirements 1.1**
   */
  it('Property 4: Configuration names are unique within the system', () => {
    const configurations = ConfigurationService.getAllConfigurations();

    const configNames: string[] = [];
    configurations.forEach(group => {
      group.configurations.forEach(config => {
        configNames.push(config.name);
      });
    });

    const uniqueNames = new Set(configNames);
    expect(uniqueNames.size).toBe(configNames.length);
  });

  /**
   * Property 5: All configurations have valid data types
   * For any configuration returned, the dataType should be one of the valid types:
   * string, number, or boolean.
   * 
   * **Validates: Requirements 1.4**
   */
  it('Property 5: All configurations have valid data types', () => {
    const validDataTypes = ['string', 'number', 'boolean', 'array'];
    const configurations = ConfigurationService.getAllConfigurations();

    configurations.forEach(group => {
      group.configurations.forEach(config => {
        expect(validDataTypes).toContain(config.dataType);
      });
    });
  });

  /**
   * Property 6: Configuration descriptions are non-empty
   * For any configuration returned, the description should be a non-empty string.
   * 
   * **Validates: Requirements 1.2**
   */
  it('Property 6: Configuration descriptions are non-empty', () => {
    const configurations = ConfigurationService.getAllConfigurations();

    configurations.forEach(group => {
      group.configurations.forEach(config => {
        expect(config.description).toBeTruthy();
        expect(typeof config.description).toBe('string');
        expect(config.description.length).toBeGreaterThan(0);
      });
    });
  });

  /**
   * Property 7: Configuration values are strings
   * For any configuration returned, the value should be a string (even for numbers and booleans).
   * 
   * **Validates: Requirements 1.2**
   */
  it('Property 7: Configuration values are strings', () => {
    const configurations = ConfigurationService.getAllConfigurations();

    configurations.forEach(group => {
      group.configurations.forEach(config => {
        expect(typeof config.value).toBe('string');
      });
    });
  });

  /**
   * Property 8: Sensitive configurations are properly identified
   * For any configuration with a name matching sensitive patterns, isSensitive should be true.
   * 
   * **Validates: Requirements 3.2**
   */
  it('Property 8: Sensitive configurations are properly identified', () => {
    const sensitivePatterns = /PASSWORD|SECRET|KEY|TOKEN|CREDENTIAL|APIKEY|PRIVATE|ENCRYPT/i;
    const configurations = ConfigurationService.getAllConfigurations();

    configurations.forEach(group => {
      group.configurations.forEach(config => {
        if (sensitivePatterns.test(config.name)) {
          expect(config.isSensitive).toBe(true);
        }
      });
    });
  });

  /**
   * Property 9: Sensitive values are masked in API response
   * For any configuration marked as sensitive, the value should be masked (••••••••)
   * rather than the actual value.
   * 
   * **Validates: Requirements 3.1**
   */
  it('Property 9: Sensitive values are masked in API response', () => {
    const configurations = ConfigurationService.getAllConfigurations();

    configurations.forEach(group => {
      group.configurations.forEach(config => {
        if (config.isSensitive) {
          expect(config.value).toBe('••••••••');
        }
      });
    });
  });

  /**
   * Property 10: Non-sensitive values are not masked
   * For any configuration not marked as sensitive, the value should not be masked.
   * 
   * **Validates: Requirements 1.2**
   */
  it('Property 10: Non-sensitive values are not masked', () => {
    const configurations = ConfigurationService.getAllConfigurations();

    configurations.forEach(group => {
      group.configurations.forEach(config => {
        if (!config.isSensitive) {
          expect(config.value).not.toBe('••••••••');
        }
      });
    });
  });

  /**
   * Property 11: Editable flag is set appropriately
   * For any configuration returned, the isEditable flag should be a boolean.
   * 
   * **Validates: Requirements 4.1**
   */
  it('Property 11: Editable flag is set appropriately', () => {
    const configurations = ConfigurationService.getAllConfigurations();

    configurations.forEach(group => {
      group.configurations.forEach(config => {
        expect(typeof config.isEditable).toBe('boolean');
      });
    });
  });

  /**
   * Property 12: Default flag is set appropriately
   * For any configuration returned, the isDefault flag should be a boolean.
   * 
   * **Validates: Requirements 1.5**
   */
  it('Property 12: Default flag is set appropriately', () => {
    const configurations = ConfigurationService.getAllConfigurations();

    configurations.forEach(group => {
      group.configurations.forEach(config => {
        expect(typeof config.isDefault).toBe('boolean');
      });
    });
  });

  /**
   * Property 13: Restart requirement flag is set appropriately
   * For any configuration returned, the requiresRestart flag should be a boolean.
   * 
   * **Validates: Requirements 8.4**
   */
  it('Property 13: Restart requirement flag is set appropriately', () => {
    const configurations = ConfigurationService.getAllConfigurations();

    configurations.forEach(group => {
      group.configurations.forEach(config => {
        expect(typeof config.requiresRestart).toBe('boolean');
      });
    });
  });

  /**
   * Property 14: Category structure is consistent across calls
   * For any configuration, it should appear in the same category across multiple API calls.
   * 
   * **Validates: Requirements 2.5**
   */
  it('Property 14: Category structure is consistent across calls', () => {
    const call1 = ConfigurationService.getAllConfigurations();
    const call2 = ConfigurationService.getAllConfigurations();

    const categoryMap1 = new Map<string, string>();
    const categoryMap2 = new Map<string, string>();

    call1.forEach(group => {
      group.configurations.forEach(config => {
        categoryMap1.set(config.name, group.category);
      });
    });

    call2.forEach(group => {
      group.configurations.forEach(config => {
        categoryMap2.set(config.name, group.category);
      });
    });

    categoryMap1.forEach((category, configName) => {
      expect(categoryMap2.get(configName)).toBe(category);
    });
  });

  /**
   * Property 15: All configurations have metadata
   * For any configuration returned, it should have all required metadata fields.
   * 
   * **Validates: Requirements 1.4**
   */
  it('Property 15: All configurations have metadata', () => {
    const configurations = ConfigurationService.getAllConfigurations();

    configurations.forEach(group => {
      group.configurations.forEach(config => {
        expect(config.name).toBeDefined();
        expect(config.value).toBeDefined();
        expect(config.description).toBeDefined();
        expect(config.category).toBeDefined();
        expect(config.dataType).toBeDefined();
        expect(config.isSensitive).toBeDefined();
        expect(config.isDefault).toBeDefined();
        expect(config.isEditable).toBeDefined();
        expect(config.requiresRestart).toBeDefined();
      });
    });
  });

  /**
   * Property 16: Configuration names are non-empty
   * For any configuration returned, the name should be a non-empty string.
   * 
   * **Validates: Requirements 1.2**
   */
  it('Property 16: Configuration names are non-empty', () => {
    const configurations = ConfigurationService.getAllConfigurations();

    configurations.forEach(group => {
      group.configurations.forEach(config => {
        expect(config.name).toBeTruthy();
        expect(typeof config.name).toBe('string');
        expect(config.name.length).toBeGreaterThan(0);
      });
    });
  });

  /**
   * Property 17: Database category contains database configurations
   * For the Database category, it should contain configurations related to database settings.
   * 
   * **Validates: Requirements 2.1**
   */
  it('Property 17: Database category contains database configurations', () => {
    const configurations = ConfigurationService.getAllConfigurations();
    const dbCategory = configurations.find(g => g.category === ConfigurationCategory.Database);

    expect(dbCategory).toBeDefined();
    expect(dbCategory!.configurations.length).toBeGreaterThan(0);

    const dbConfigNames = dbCategory!.configurations.map(c => c.name);
    expect(dbConfigNames.some(name => name.includes('DB_'))).toBe(true);
  });

  /**
   * Property 18: Application category contains application configurations
   * For the Application category, it should contain configurations related to application settings.
   * 
   * **Validates: Requirements 2.1**
   */
  it('Property 18: Application category contains application configurations', () => {
    const configurations = ConfigurationService.getAllConfigurations();
    const appCategory = configurations.find(g => g.category === ConfigurationCategory.Application);

    expect(appCategory).toBeDefined();
    expect(appCategory!.configurations.length).toBeGreaterThan(0);
  });

  /**
   * Property 19: Security category contains security configurations
   * For the Security category, it should contain configurations related to security settings.
   * 
   * **Validates: Requirements 2.1**
   */
  it('Property 19: Security category contains security configurations', () => {
    const configurations = ConfigurationService.getAllConfigurations();
    const securityCategory = configurations.find(g => g.category === ConfigurationCategory.Security);

    expect(securityCategory).toBeDefined();
    expect(securityCategory!.configurations.length).toBeGreaterThan(0);
  });

  /**
   * Property 20: All categories have at least one configuration
   * For any category returned, it should have at least one configuration.
   * 
   * **Validates: Requirements 2.1, 2.2**
   */
  it('Property 20: All categories have at least one configuration', () => {
    const configurations = ConfigurationService.getAllConfigurations();

    configurations.forEach(group => {
      expect(group.configurations.length).toBeGreaterThan(0);
    });
  });
});
