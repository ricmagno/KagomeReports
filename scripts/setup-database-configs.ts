#!/usr/bin/env ts-node

/**
 * Script to set up database configurations for AVEVA Historian servers
 * This script adds the three database configurations provided by the user
 */

import { DatabaseConfigService } from '../src/services/databaseConfigService';
import { DatabaseConfig } from '../src/types/databaseConfig';
import { apiLogger } from '../src/utils/logger';

async function setupDatabaseConfigurations() {
  const configService = new DatabaseConfigService();
  const userId = 'admin'; // Default admin user for setup

  // Database configurations to add
  const configurations: DatabaseConfig[] = [
    {
      name: 'AVEVA Historian - Primary (192.168.235.17)',
      host: '192.168.235.17',
      port: 1433,
      database: 'Runtime',
      username: 'historian',
      password: '8&(@Zb7RETf2fw8O21*!Ok^1@%GaI2jy',
      encrypt: true,
      trustServerCertificate: true,
      connectionTimeout: 30000,
      requestTimeout: 30000
    },
    {
      name: 'AVEVA Historian - Secondary (192.168.1.17)',
      host: '192.168.1.17',
      port: 1433,
      database: 'Runtime',
      username: 'historian',
      password: '8&(@Zb7RETf2fw8O21*!Ok^1@%GaI2jy',
      encrypt: true,
      trustServerCertificate: true,
      connectionTimeout: 30000,
      requestTimeout: 30000
    },
    {
      name: 'AVEVA Historian - KAGHISTORIAN01',
      host: 'KAGHISTORIAN01',
      port: 1433,
      database: 'Runtime',
      username: 'historian',
      password: '8&(@Zb7RETf2fw8O21*!Ok^1@%GaI2jy',
      encrypt: true,
      trustServerCertificate: true,
      connectionTimeout: 30000,
      requestTimeout: 30000
    }
  ];

  console.log('Setting up database configurations...');

  try {
    for (const config of configurations) {
      console.log(`Adding configuration: ${config.name}`);
      
      try {
        const configId = await configService.saveConfiguration(config, userId);
        console.log(`✓ Successfully added configuration: ${config.name} (ID: ${configId})`);
        
        // Test the connection
        console.log(`Testing connection to ${config.name}...`);
        const testResult = await configService.testConnection({
          id: configId, // Include the ID to avoid validation issues
          name: config.name,
          host: config.host,
          port: config.port,
          database: config.database,
          username: config.username,
          password: config.password,
          encrypt: config.encrypt,
          trustServerCertificate: config.trustServerCertificate,
          connectionTimeout: config.connectionTimeout,
          requestTimeout: config.requestTimeout
        });
        
        if (testResult.success) {
          console.log(`✓ Connection test successful: ${testResult.message}`);
          if (testResult.responseTime) {
            console.log(`  Response time: ${testResult.responseTime}ms`);
          }
          if (testResult.serverVersion) {
            console.log(`  Server version: ${testResult.serverVersion}`);
          }
        } else {
          console.log(`✗ Connection test failed: ${testResult.message}`);
          if (testResult.error) {
            console.log(`  Error: ${testResult.error}`);
          }
        }
        
      } catch (error) {
        console.error(`✗ Failed to add configuration ${config.name}:`, error);
      }
      
      console.log(''); // Empty line for readability
    }

    // Set the first configuration as active if connection test passed
    const configs = await configService.listConfigurations();
    const primaryConfig = configs.find(c => c.host === '192.168.235.17');
    
    if (primaryConfig && primaryConfig.status === 'connected') {
      console.log('Setting primary configuration as active...');
      await configService.switchActiveConfiguration(primaryConfig.id);
      console.log('✓ Primary configuration set as active');
    }

    console.log('\nDatabase configuration setup completed!');
    console.log('You can now use the web interface to manage these configurations.');

  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

// Run the setup if this script is executed directly
if (require.main === module) {
  setupDatabaseConfigurations()
    .then(() => {
      console.log('Setup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}

export { setupDatabaseConfigurations };