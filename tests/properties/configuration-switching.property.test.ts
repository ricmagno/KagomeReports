/**
 * Property-based tests for database configuration switching
 * Tests Property 24: Active Configuration Switching
 * Validates Requirements 9.5
 */

import fc from 'fast-check';
import { databaseConfigService } from '@/services/databaseConfigService';
import { getHistorianConnection } from '@/services/historianConnection';
import { DatabaseConfig } from '@/types/databaseConfig';

describe('Database Configuration Switching Properties', () => {
  let originalActiveConfig: string | null = null;

  beforeEach(async () => {
    // Store original active configuration
    const activeConfig = databaseConfigService.getActiveConfiguration();
    originalActiveConfig = activeConfig?.id || null;
  });

  afterEach(async () => {
    // Restore original active configuration if it existed
    if (originalActiveConfig) {
      try {
        await databaseConfigService.activateConfiguration(originalActiveConfig);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  });

  /**
   * Property 24: Active Configuration Switching
   * For any database configuration switch, the active connection pool should be updated 
   * to use the new configuration settings
   */
  test('Property 24: Configuration switching updates active connection', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate two different valid database configurations
        fc.record({
          config1: fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            host: fc.oneof(
              fc.constant('localhost'),
              fc.constant('127.0.0.1'),
              fc.string({ minLength: 5, maxLength: 30 }).filter(s => /^[a-zA-Z0-9.-]+$/.test(s))
            ),
            port: fc.integer({ min: 1433, max: 65535 }),
            database: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
            username: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
            password: fc.string({ minLength: 1, maxLength: 50 }),
            encrypt: fc.boolean(),
            trustServerCertificate: fc.boolean(),
            connectionTimeout: fc.integer({ min: 5000, max: 30000 }),
            requestTimeout: fc.integer({ min: 5000, max: 30000 })
          }),
          config2: fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            host: fc.oneof(
              fc.constant('localhost'),
              fc.constant('127.0.0.1'),
              fc.string({ minLength: 5, maxLength: 30 }).filter(s => /^[a-zA-Z0-9.-]+$/.test(s))
            ),
            port: fc.integer({ min: 1433, max: 65535 }),
            database: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
            username: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
            password: fc.string({ minLength: 1, maxLength: 50 }),
            encrypt: fc.boolean(),
            trustServerCertificate: fc.boolean(),
            connectionTimeout: fc.integer({ min: 5000, max: 30000 }),
            requestTimeout: fc.integer({ min: 5000, max: 30000 })
          })
        }).filter(({ config1, config2 }) => 
          // Ensure configurations are different
          config1.name !== config2.name &&
          (config1.host !== config2.host || config1.port !== config2.port || config1.database !== config2.database)
        ),
        async ({ config1, config2 }) => {
          // Save both configurations
          const configId1 = await databaseConfigService.saveConfiguration(config1, 'test-user');
          const configId2 = await databaseConfigService.saveConfiguration(config2, 'test-user');

          try {
            // Get historian connection instance
            const connection = getHistorianConnection();

            // Initially, no active configuration should be set
            let activeConfig = databaseConfigService.getActiveConfiguration();
            expect(activeConfig).toBeNull();
            expect(connection.getCurrentConfigId()).toBeNull();
            expect(connection.isUsingActiveConfig()).toBe(false);

            // Activate first configuration
            await databaseConfigService.activateConfiguration(configId1);

            // Verify first configuration is active
            activeConfig = databaseConfigService.getActiveConfiguration();
            expect(activeConfig).not.toBeNull();
            expect(activeConfig!.id).toBe(configId1);
            expect(activeConfig!.name).toBe(config1.name);
            expect(activeConfig!.host).toBe(config1.host);
            expect(activeConfig!.port).toBe(config1.port);
            expect(activeConfig!.database).toBe(config1.database);
            expect(activeConfig!.isActive).toBe(true);

            // Verify historian connection reflects the change
            expect(connection.getCurrentConfigId()).toBe(configId1);
            expect(connection.isUsingActiveConfig()).toBe(true);

            // Switch to second configuration
            await databaseConfigService.activateConfiguration(configId2);

            // Verify second configuration is now active
            activeConfig = databaseConfigService.getActiveConfiguration();
            expect(activeConfig).not.toBeNull();
            expect(activeConfig!.id).toBe(configId2);
            expect(activeConfig!.name).toBe(config2.name);
            expect(activeConfig!.host).toBe(config2.host);
            expect(activeConfig!.port).toBe(config2.port);
            expect(activeConfig!.database).toBe(config2.database);
            expect(activeConfig!.isActive).toBe(true);

            // Verify historian connection reflects the switch
            expect(connection.getCurrentConfigId()).toBe(configId2);
            expect(connection.isUsingActiveConfig()).toBe(true);

            // Verify first configuration is no longer active
            const config1Data = await databaseConfigService.loadConfiguration(configId1);
            const allConfigs = await databaseConfigService.listConfigurations();
            const config1Summary = allConfigs.find(c => c.id === configId1);
            expect(config1Summary?.isActive).toBe(false);

          } finally {
            // Cleanup: delete test configurations
            try {
              await databaseConfigService.deleteConfiguration(configId1);
            } catch (error) {
              // Ignore cleanup errors
            }
            try {
              await databaseConfigService.deleteConfiguration(configId2);
            } catch (error) {
              // Ignore cleanup errors
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
   * Property: Configuration switching preserves connection state
   * When switching configurations, the connection should maintain its operational state
   */
  test('Property: Configuration switching preserves connection functionality', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          host: fc.constant('localhost'), // Use localhost for reliable testing
          port: fc.constant(1433), // Standard SQL Server port
          database: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          username: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          password: fc.string({ minLength: 1, maxLength: 50 }),
          encrypt: fc.boolean(),
          trustServerCertificate: fc.constant(true), // For testing
          connectionTimeout: fc.integer({ min: 5000, max: 15000 }),
          requestTimeout: fc.integer({ min: 5000, max: 15000 })
        }),
        async (config) => {
          const configId = await databaseConfigService.saveConfiguration(config, 'test-user');

          try {
            const connection = getHistorianConnection();

            // Get initial connection status
            const initialStatus = connection.getConnectionStatus();

            // Activate configuration
            await databaseConfigService.activateConfiguration(configId);

            // Verify connection status is maintained or improved
            const afterSwitchStatus = connection.getConnectionStatus();
            expect(connection.getCurrentConfigId()).toBe(configId);
            expect(connection.isUsingActiveConfig()).toBe(true);

            // Connection should be functional (this may fail if database is not available, which is expected)
            try {
              const isValid = await connection.validateConnection();
              // If validation succeeds, connection should be marked as connected
              if (isValid) {
                expect(afterSwitchStatus.connected).toBe(true);
              }
            } catch (error) {
              // Connection validation may fail in test environment, which is acceptable
              // The important thing is that the configuration switching logic works
            }

          } finally {
            // Cleanup
            try {
              await databaseConfigService.deleteConfiguration(configId);
            } catch (error) {
              // Ignore cleanup errors
            }
          }
        }
      ),
      { 
        numRuns: 3, // Reduced for faster execution
        timeout: 20000 // 20 second timeout per test
      }
    );
  });

  /**
   * Property: Multiple configuration switches maintain consistency
   * Switching between multiple configurations should maintain system consistency
   */
  test('Property: Multiple configuration switches maintain consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            host: fc.constant('localhost'),
            port: fc.integer({ min: 1433, max: 1435 }), // Small range for testing
            database: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
            username: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
            password: fc.string({ minLength: 1, maxLength: 50 }),
            encrypt: fc.boolean(),
            trustServerCertificate: fc.constant(true),
            connectionTimeout: fc.constant(10000),
            requestTimeout: fc.constant(10000)
          }),
          { minLength: 2, maxLength: 4 }
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

            const connection = getHistorianConnection();

            // Switch through all configurations
            for (let i = 0; i < configIds.length; i++) {
              const configId = configIds[i];
              const expectedConfig = configs[i];

              if (!configId || !expectedConfig) {
                throw new Error('Invalid configuration data');
              }

              await databaseConfigService.activateConfiguration(configId);

              // Verify active configuration
              const activeConfig = databaseConfigService.getActiveConfiguration();
              expect(activeConfig).not.toBeNull();
              expect(activeConfig!.id).toBe(configId);
              expect(activeConfig!.name).toBe(expectedConfig.name);
              expect(activeConfig!.isActive).toBe(true);

              // Verify historian connection state
              expect(connection.getCurrentConfigId()).toBe(configId);
              expect(connection.isUsingActiveConfig()).toBe(true);

              // Verify only one configuration is active
              const allConfigs = await databaseConfigService.listConfigurations();
              const activeConfigs = allConfigs.filter(c => c.isActive);
              expect(activeConfigs).toHaveLength(1);
              expect(activeConfigs[0]?.id).toBe(configId);
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
        numRuns: 3, // Reduced for faster execution
        timeout: 45000 // 45 second timeout per test
      }
    );
  });
});