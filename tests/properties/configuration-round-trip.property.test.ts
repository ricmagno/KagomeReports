/**
 * Property-based tests for database configuration round-trip operations
 * Tests Property 22: Database Configuration Round-Trip
 * Validates Requirements 9.4
 */

import fc from 'fast-check';
import { databaseConfigService } from '@/services/databaseConfigService';
import { DatabaseConfig } from '@/types/databaseConfig';

describe('Database Configuration Round-Trip Properties', () => {
  /**
   * Property 22: Database Configuration Round-Trip
   * For any valid database configuration, saving then loading the configuration 
   * should produce an equivalent configuration with properly decrypted credentials
   */
  test('Property 22: Configuration save-load round-trip preserves data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          host: fc.oneof(
            fc.constant('localhost'),
            fc.constant('127.0.0.1'),
            fc.string({ minLength: 5, maxLength: 30 }).filter(s => /^[a-zA-Z0-9.-]+$/.test(s))
          ),
          port: fc.integer({ min: 1, max: 65535 }),
          database: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          username: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          password: fc.string({ minLength: 1, maxLength: 50 }),
          encrypt: fc.boolean(),
          trustServerCertificate: fc.boolean(),
          connectionTimeout: fc.integer({ min: 1000, max: 300000 }),
          requestTimeout: fc.integer({ min: 1000, max: 300000 })
        }),
        async (originalConfig) => {
          let configId: string | undefined;

          try {
            // Save the configuration
            configId = await databaseConfigService.saveConfiguration(originalConfig, 'test-user');
            expect(configId).toBeDefined();
            expect(typeof configId).toBe('string');
            expect(configId!.length).toBeGreaterThan(0);

            // Load the configuration back
            const loadedConfig = await databaseConfigService.loadConfiguration(configId!);

            // Verify all fields are preserved exactly
            expect(loadedConfig.id).toBe(configId);
            expect(loadedConfig.name).toBe(originalConfig.name);
            expect(loadedConfig.host).toBe(originalConfig.host);
            expect(loadedConfig.port).toBe(originalConfig.port);
            expect(loadedConfig.database).toBe(originalConfig.database);
            expect(loadedConfig.username).toBe(originalConfig.username);
            expect(loadedConfig.password).toBe(originalConfig.password); // Should be decrypted correctly
            expect(loadedConfig.encrypt).toBe(originalConfig.encrypt);
            expect(loadedConfig.trustServerCertificate).toBe(originalConfig.trustServerCertificate);
            expect(loadedConfig.connectionTimeout).toBe(originalConfig.connectionTimeout);
            expect(loadedConfig.requestTimeout).toBe(originalConfig.requestTimeout);

            // Verify the loaded configuration is functionally equivalent
            expect(loadedConfig).toEqual({
              ...originalConfig,
              id: configId
            });

          } finally {
            // Cleanup
            if (configId) {
              try {
                await databaseConfigService.deleteConfiguration(configId);
              } catch (error) {
                // Ignore cleanup errors
              }
            }
          }
        }
      ),
      { 
        numRuns: 10, // Test multiple configurations
        timeout: 20000 // 20 second timeout per test
      }
    );
  });

  /**
   * Property: Configuration encryption-decryption round-trip
   * Encrypting then decrypting credentials should preserve the original values
   */
  test('Property: Encryption-decryption round-trip preserves credentials', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          host: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          port: fc.integer({ min: 1, max: 65535 }),
          database: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          username: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          password: fc.string({ minLength: 1, maxLength: 100 }), // Test various password lengths
          encrypt: fc.boolean(),
          trustServerCertificate: fc.boolean(),
          connectionTimeout: fc.integer({ min: 1000, max: 300000 }),
          requestTimeout: fc.integer({ min: 1000, max: 300000 })
        }),
        async (config) => {
          // Test direct encryption/decryption methods
          const encryptedConfig = await databaseConfigService.encryptCredentials(config);
          
          // Verify encrypted config has expected structure
          expect(encryptedConfig.id).toBeDefined();
          expect(encryptedConfig.name).toBe(config.name);
          expect(encryptedConfig.host).toBe(config.host);
          expect(encryptedConfig.port).toBe(config.port);
          expect(encryptedConfig.database).toBe(config.database);
          expect(encryptedConfig.username).toBe(config.username);
          expect(encryptedConfig.encryptedPassword).toBeDefined();
          expect(encryptedConfig.encryptedPassword).not.toBe(config.password); // Should be encrypted
          expect(typeof encryptedConfig.encryptedPassword).toBe('string');
          
          // Decrypt the configuration
          const decryptedConfig = await databaseConfigService.decryptCredentials(encryptedConfig);
          
          // Verify decrypted config matches original
          expect(decryptedConfig.name).toBe(config.name);
          expect(decryptedConfig.host).toBe(config.host);
          expect(decryptedConfig.port).toBe(config.port);
          expect(decryptedConfig.database).toBe(config.database);
          expect(decryptedConfig.username).toBe(config.username);
          expect(decryptedConfig.password).toBe(config.password); // Should match original
          expect(decryptedConfig.encrypt).toBe(config.encrypt);
          expect(decryptedConfig.trustServerCertificate).toBe(config.trustServerCertificate);
          expect(decryptedConfig.connectionTimeout).toBe(config.connectionTimeout);
          expect(decryptedConfig.requestTimeout).toBe(config.requestTimeout);
        }
      ),
      { 
        numRuns: 15, // Test more encryption scenarios
        timeout: 15000 // 15 second timeout per test
      }
    );
  });

  /**
   * Property: Multiple save-load cycles preserve data integrity
   * Saving and loading a configuration multiple times should not degrade data
   */
  test('Property: Multiple save-load cycles preserve data integrity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          config: fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            host: fc.constant('localhost'), // Use consistent host for testing
            port: fc.integer({ min: 1433, max: 1435 }),
            database: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
            username: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
            password: fc.string({ minLength: 8, maxLength: 50 }), // Reasonable password length
            encrypt: fc.boolean(),
            trustServerCertificate: fc.boolean(),
            connectionTimeout: fc.integer({ min: 5000, max: 30000 }),
            requestTimeout: fc.integer({ min: 5000, max: 30000 })
          }),
          cycles: fc.integer({ min: 2, max: 5 }) // Test 2-5 cycles
        }),
        async ({ config, cycles }) => {
          const configIds: string[] = [];

          try {
            let currentConfig = config;

            // Perform multiple save-load cycles
            for (let i = 0; i < cycles; i++) {
              // Save configuration
              const configId = await databaseConfigService.saveConfiguration(currentConfig, 'test-user');
              configIds.push(configId);

              // Load configuration back
              const loadedConfig = await databaseConfigService.loadConfiguration(configId);

              // Verify data integrity
              expect(loadedConfig.name).toBe(config.name);
              expect(loadedConfig.host).toBe(config.host);
              expect(loadedConfig.port).toBe(config.port);
              expect(loadedConfig.database).toBe(config.database);
              expect(loadedConfig.username).toBe(config.username);
              expect(loadedConfig.password).toBe(config.password);
              expect(loadedConfig.encrypt).toBe(config.encrypt);
              expect(loadedConfig.trustServerCertificate).toBe(config.trustServerCertificate);
              expect(loadedConfig.connectionTimeout).toBe(config.connectionTimeout);
              expect(loadedConfig.requestTimeout).toBe(config.requestTimeout);

              // Use loaded config for next cycle (without ID to create new config)
              currentConfig = {
                name: `${loadedConfig.name}_cycle_${i + 1}`, // Make name unique
                host: loadedConfig.host,
                port: loadedConfig.port,
                database: loadedConfig.database,
                username: loadedConfig.username,
                password: loadedConfig.password,
                encrypt: loadedConfig.encrypt,
                trustServerCertificate: loadedConfig.trustServerCertificate,
                connectionTimeout: loadedConfig.connectionTimeout,
                requestTimeout: loadedConfig.requestTimeout
              };
            }

          } finally {
            // Cleanup all created configurations
            for (const configId of configIds) {
              try {
                await databaseConfigService.deleteConfiguration(configId);
              } catch (error) {
                // Ignore cleanup errors
              }
            }
          }
        }
      ),
      { 
        numRuns: 5, // Reduced for faster execution
        timeout: 30000 // 30 second timeout per test
      }
    );
  });

  /**
   * Property: Configuration list consistency after save-load operations
   * The configuration list should accurately reflect saved configurations
   */
  test('Property: Configuration list reflects saved configurations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            host: fc.constant('localhost'),
            port: fc.integer({ min: 1433, max: 1435 }),
            database: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
            username: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
            password: fc.string({ minLength: 1, maxLength: 50 }),
            encrypt: fc.boolean(),
            trustServerCertificate: fc.boolean(),
            connectionTimeout: fc.constant(10000),
            requestTimeout: fc.constant(10000)
          }),
          { minLength: 1, maxLength: 3 }
        ).filter(configs => {
          // Ensure all configurations have unique names
          const names = configs.map(c => c.name);
          return new Set(names).size === names.length;
        }),
        async (configs) => {
          const configIds: string[] = [];

          try {
            // Save all configurations
            for (const config of configs) {
              const configId = await databaseConfigService.saveConfiguration(config, 'test-user');
              configIds.push(configId);
            }

            // Get configuration list
            const configList = await databaseConfigService.listConfigurations();

            // Verify all saved configurations appear in the list
            for (let i = 0; i < configIds.length; i++) {
              const configId = configIds[i];
              const originalConfig = configs[i];

              if (!configId || !originalConfig) {
                throw new Error('Invalid configuration data');
              }

              const listEntry = configList.find(c => c.id === configId);
              expect(listEntry).toBeDefined();
              expect(listEntry!.name).toBe(originalConfig.name);
              expect(listEntry!.host).toBe(originalConfig.host);
              expect(listEntry!.database).toBe(originalConfig.database);
              expect(listEntry!.isActive).toBe(false); // Should not be active by default
              expect(['connected', 'disconnected', 'error', 'untested']).toContain(listEntry!.status);
            }

            // Verify we can load each configuration and it matches the list
            for (const configId of configIds) {
              const loadedConfig = await databaseConfigService.loadConfiguration(configId);
              const listEntry = configList.find(c => c.id === configId);

              expect(loadedConfig.id).toBe(listEntry!.id);
              expect(loadedConfig.name).toBe(listEntry!.name);
              expect(loadedConfig.host).toBe(listEntry!.host);
              expect(loadedConfig.database).toBe(listEntry!.database);
            }

          } finally {
            // Cleanup all configurations
            for (const configId of configIds) {
              try {
                await databaseConfigService.deleteConfiguration(configId);
              } catch (error) {
                // Ignore cleanup errors
              }
            }
          }
        }
      ),
      { 
        numRuns: 5, // Reduced for faster execution
        timeout: 25000 // 25 second timeout per test
      }
    );
  });
});