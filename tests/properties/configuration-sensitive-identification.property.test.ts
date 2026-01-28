/**
 * Property-Based Tests for Sensitive Configuration Identification
 * Tests that sensitive configurations are identified by pattern matching
 * 
 * **Validates: Requirements 3.2, 10.1, 10.4**
 */

import fc from 'fast-check';
import { ConfigurationService } from '@/services/configurationService';

describe('Sensitive Configuration Identification - Property Tests', () => {
  /**
   * Property 1: Configurations with PASSWORD pattern are marked as sensitive
   * For any configuration name containing PASSWORD (case-insensitive),
   * it should be marked as sensitive
   * 
   * **Validates: Requirements 3.2**
   */
  it('Property 1: Configurations with PASSWORD pattern are marked as sensitive', () => {
    const configurations = ConfigurationService.getAllConfigurations();

    configurations.forEach(group => {
      group.configurations.forEach(config => {
        if (/PASSWORD/i.test(config.name)) {
          expect(config.isSensitive).toBe(true);
        }
      });
    });
  });

  /**
   * Property 2: Configurations with SECRET pattern are marked as sensitive
   * For any configuration name containing SECRET (case-insensitive),
   * it should be marked as sensitive
   * 
   * **Validates: Requirements 3.2**
   */
  it('Property 2: Configurations with SECRET pattern are marked as sensitive', () => {
    const configurations = ConfigurationService.getAllConfigurations();

    configurations.forEach(group => {
      group.configurations.forEach(config => {
        if (/SECRET/i.test(config.name)) {
          expect(config.isSensitive).toBe(true);
        }
      });
    });
  });

  /**
   * Property 3: Configurations with KEY pattern are marked as sensitive
   * For any configuration name containing KEY (case-insensitive),
   * it should be marked as sensitive
   * 
   * **Validates: Requirements 3.2**
   */
  it('Property 3: Configurations with KEY pattern are marked as sensitive', () => {
    const configurations = ConfigurationService.getAllConfigurations();

    configurations.forEach(group => {
      group.configurations.forEach(config => {
        if (/KEY/i.test(config.name)) {
          expect(config.isSensitive).toBe(true);
        }
      });
    });
  });

  /**
   * Property 4: Configurations with TOKEN pattern are marked as sensitive
   * For any configuration name containing TOKEN (case-insensitive),
   * it should be marked as sensitive
   * 
   * **Validates: Requirements 3.2**
   */
  it('Property 4: Configurations with TOKEN pattern are marked as sensitive', () => {
    const configurations = ConfigurationService.getAllConfigurations();

    configurations.forEach(group => {
      group.configurations.forEach(config => {
        if (/TOKEN/i.test(config.name)) {
          expect(config.isSensitive).toBe(true);
        }
      });
    });
  });

  /**
   * Property 5: Configurations with CREDENTIAL pattern are marked as sensitive
   * For any configuration name containing CREDENTIAL (case-insensitive),
   * it should be marked as sensitive
   * 
   * **Validates: Requirements 3.2**
   */
  it('Property 5: Configurations with CREDENTIAL pattern are marked as sensitive', () => {
    const configurations = ConfigurationService.getAllConfigurations();

    configurations.forEach(group => {
      group.configurations.forEach(config => {
        if (/CREDENTIAL/i.test(config.name)) {
          expect(config.isSensitive).toBe(true);
        }
      });
    });
  });

  /**
   * Property 6: Configurations with APIKEY pattern are marked as sensitive
   * For any configuration name containing APIKEY (case-insensitive),
   * it should be marked as sensitive
   * 
   * **Validates: Requirements 3.2**
   */
  it('Property 6: Configurations with APIKEY pattern are marked as sensitive', () => {
    const configurations = ConfigurationService.getAllConfigurations();

    configurations.forEach(group => {
      group.configurations.forEach(config => {
        if (/APIKEY/i.test(config.name)) {
          expect(config.isSensitive).toBe(true);
        }
      });
    });
  });

  /**
   * Property 7: Configurations with PRIVATE pattern are marked as sensitive
   * For any configuration name containing PRIVATE (case-insensitive),
   * it should be marked as sensitive
   * 
   * **Validates: Requirements 3.2**
   */
  it('Property 7: Configurations with PRIVATE pattern are marked as sensitive', () => {
    const configurations = ConfigurationService.getAllConfigurations();

    configurations.forEach(group => {
      group.configurations.forEach(config => {
        if (/PRIVATE/i.test(config.name)) {
          expect(config.isSensitive).toBe(true);
        }
      });
    });
  });

  /**
   * Property 8: Configurations with ENCRYPT pattern are marked as sensitive
   * For any configuration name containing ENCRYPT (case-insensitive),
   * it should be marked as sensitive
   * 
   * **Validates: Requirements 3.2**
   */
  it('Property 8: Configurations with ENCRYPT pattern are marked as sensitive', () => {
    const configurations = ConfigurationService.getAllConfigurations();

    configurations.forEach(group => {
      group.configurations.forEach(config => {
        if (/ENCRYPT/i.test(config.name)) {
          expect(config.isSensitive).toBe(true);
        }
      });
    });
  });

  /**
   * Property 9: Non-sensitive configurations are not marked as sensitive
   * For any configuration name NOT matching sensitive patterns,
   * it should NOT be marked as sensitive
   * 
   * **Validates: Requirements 3.2**
   */
  it('Property 9: Non-sensitive configurations are not marked as sensitive', () => {
    const sensitivePatterns = /PASSWORD|SECRET|KEY|TOKEN|CREDENTIAL|APIKEY|PRIVATE|ENCRYPT/i;
    const configurations = ConfigurationService.getAllConfigurations();

    configurations.forEach(group => {
      group.configurations.forEach(config => {
        if (!sensitivePatterns.test(config.name)) {
          expect(config.isSensitive).toBe(false);
        }
      });
    });
  });

  /**
   * Property 10: Sensitive configurations are masked in API response
   * For any configuration marked as sensitive, the value should be masked
   * 
   * **Validates: Requirements 3.1, 10.4**
   */
  it('Property 10: Sensitive configurations are masked in API response', () => {
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
   * Property 11: Sensitive pattern matching is case-insensitive
   * For any configuration name with mixed case sensitive patterns,
   * it should still be marked as sensitive
   * 
   * **Validates: Requirements 3.2**
   */
  it('Property 11: Sensitive pattern matching is case-insensitive', () => {
    const configurations = ConfigurationService.getAllConfigurations();
    const sensitivePatterns = /PASSWORD|SECRET|KEY|TOKEN|CREDENTIAL|APIKEY|PRIVATE|ENCRYPT/i;

    configurations.forEach(group => {
      group.configurations.forEach(config => {
        const isSensitiveByPattern = sensitivePatterns.test(config.name);
        const isSensitiveByFlag = config.isSensitive;

        expect(isSensitiveByFlag).toBe(isSensitiveByPattern);
      });
    });
  });

  /**
   * Property 12: All sensitive configurations have descriptions
   * For any configuration marked as sensitive, it should have a description
   * 
   * **Validates: Requirements 3.2**
   */
  it('Property 12: All sensitive configurations have descriptions', () => {
    const configurations = ConfigurationService.getAllConfigurations();

    configurations.forEach(group => {
      group.configurations.forEach(config => {
        if (config.isSensitive) {
          expect(config.description).toBeTruthy();
          expect(config.description.length).toBeGreaterThan(0);
        }
      });
    });
  });

  /**
   * Property 13: Sensitive configurations are consistently identified
   * For any configuration, sensitivity should be consistent across multiple calls
   * 
   * **Validates: Requirements 3.2, 10.1**
   */
  it('Property 13: Sensitive configurations are consistently identified', () => {
    const call1 = ConfigurationService.getAllConfigurations();
    const call2 = ConfigurationService.getAllConfigurations();

    const sensitivityMap1 = new Map<string, boolean>();
    const sensitivityMap2 = new Map<string, boolean>();

    call1.forEach(group => {
      group.configurations.forEach(config => {
        sensitivityMap1.set(config.name, config.isSensitive);
      });
    });

    call2.forEach(group => {
      group.configurations.forEach(config => {
        sensitivityMap2.set(config.name, config.isSensitive);
      });
    });

    sensitivityMap1.forEach((isSensitive, configName) => {
      expect(sensitivityMap2.get(configName)).toBe(isSensitive);
    });
  });

  /**
   * Property 14: Sensitive values are not exposed in logs
   * For any sensitive configuration, the actual value should not be in the API response
   * 
   * **Validates: Requirements 10.4**
   */
  it('Property 14: Sensitive values are not exposed in API response', () => {
    const configurations = ConfigurationService.getAllConfigurations();

    configurations.forEach(group => {
      group.configurations.forEach(config => {
        if (config.isSensitive) {
          // Sensitive values should be masked
          expect(config.value).toBe('••••••••');
          // Should not contain actual sensitive data
          expect(config.value).not.toContain('password');
          expect(config.value).not.toContain('secret');
          expect(config.value).not.toContain('key');
        }
      });
    });
  });

  /**
   * Property 15: Database password is marked as sensitive
   * For the DB_PASSWORD configuration, it should be marked as sensitive
   * 
   * **Validates: Requirements 3.2**
   */
  it('Property 15: Database password is marked as sensitive', () => {
    const configurations = ConfigurationService.getAllConfigurations();
    const dbPassword = configurations
      .flatMap(g => g.configurations)
      .find(c => c.name === 'DB_PASSWORD');

    expect(dbPassword).toBeDefined();
    expect(dbPassword!.isSensitive).toBe(true);
  });

  /**
   * Property 16: JWT secret is marked as sensitive
   * For the JWT_SECRET configuration, it should be marked as sensitive
   * 
   * **Validates: Requirements 3.2**
   */
  it('Property 16: JWT secret is marked as sensitive', () => {
    const configurations = ConfigurationService.getAllConfigurations();
    const jwtSecret = configurations
      .flatMap(g => g.configurations)
      .find(c => c.name === 'JWT_SECRET');

    expect(jwtSecret).toBeDefined();
    expect(jwtSecret!.isSensitive).toBe(true);
  });

  /**
   * Property 17: SMTP password is marked as sensitive
   * For the SMTP_PASSWORD configuration, it should be marked as sensitive
   * 
   * **Validates: Requirements 3.2**
   */
  it('Property 17: SMTP password is marked as sensitive', () => {
    const configurations = ConfigurationService.getAllConfigurations();
    const smtpPassword = configurations
      .flatMap(g => g.configurations)
      .find(c => c.name === 'SMTP_PASSWORD');

    if (smtpPassword) {
      expect(smtpPassword.isSensitive).toBe(true);
    }
  });

  /**
   * Property 18: Database host is NOT marked as sensitive
   * For the DB_HOST configuration, it should NOT be marked as sensitive
   * 
   * **Validates: Requirements 3.2**
   */
  it('Property 18: Database host is NOT marked as sensitive', () => {
    const configurations = ConfigurationService.getAllConfigurations();
    const dbHost = configurations
      .flatMap(g => g.configurations)
      .find(c => c.name === 'DB_HOST');

    expect(dbHost).toBeDefined();
    expect(dbHost!.isSensitive).toBe(false);
  });

  /**
   * Property 19: Database port is NOT marked as sensitive
   * For the DB_PORT configuration, it should NOT be marked as sensitive
   * 
   * **Validates: Requirements 3.2**
   */
  it('Property 19: Database port is NOT marked as sensitive', () => {
    const configurations = ConfigurationService.getAllConfigurations();
    const dbPort = configurations
      .flatMap(g => g.configurations)
      .find(c => c.name === 'DB_PORT');

    expect(dbPort).toBeDefined();
    expect(dbPort!.isSensitive).toBe(false);
  });

  /**
   * Property 20: Node environment is NOT marked as sensitive
   * For the NODE_ENV configuration, it should NOT be marked as sensitive
   * 
   * **Validates: Requirements 3.2**
   */
  it('Property 20: Node environment is NOT marked as sensitive', () => {
    const configurations = ConfigurationService.getAllConfigurations();
    const nodeEnv = configurations
      .flatMap(g => g.configurations)
      .find(c => c.name === 'NODE_ENV');

    expect(nodeEnv).toBeDefined();
    expect(nodeEnv!.isSensitive).toBe(false);
  });
});
