#!/usr/bin/env ts-node

/**
 * Script to test existing database configurations
 */

import { DatabaseConfigService } from '../src/services/databaseConfigService';
import { apiLogger } from '../src/utils/logger';

async function testDatabaseConnections() {
  const configService = new DatabaseConfigService();

  // Wait a moment for the configurations to load
  await new Promise(resolve => setTimeout(resolve, 100));

  console.log('Testing existing database configurations...\n');

  try {
    // Get all configurations
    const configurations = await configService.listConfigurations();
    
    if (configurations.length === 0) {
      console.log('No database configurations found.');
      return;
    }

    console.log(`Found ${configurations.length} database configuration(s):\n`);

    for (const configSummary of configurations) {
      console.log(`Testing: ${configSummary.name}`);
      console.log(`  Host: ${configSummary.host}`);
      console.log(`  Database: ${configSummary.database}`);
      console.log(`  Status: ${configSummary.status}`);
      
      try {
        // Load the full configuration
        const fullConfig = await configService.loadConfiguration(configSummary.id);
        
        // Test the connection
        console.log('  Testing connection...');
        const testResult = await configService.testConnection(fullConfig);
        
        if (testResult.success) {
          console.log(`  ✓ Connection successful: ${testResult.message}`);
          if (testResult.responseTime) {
            console.log(`    Response time: ${testResult.responseTime}ms`);
          }
          if (testResult.serverVersion) {
            console.log(`    Server version: ${testResult.serverVersion}`);
          }
        } else {
          console.log(`  ✗ Connection failed: ${testResult.message}`);
          if (testResult.error) {
            console.log(`    Error: ${testResult.error}`);
          }
        }
        
      } catch (error) {
        console.error(`  ✗ Test failed with error:`, error);
      }
      
      console.log(''); // Empty line for readability
    }

    // Try to set the first successful connection as active
    console.log('Checking for active configuration...');
    const activeConfig = await configService.getActiveConfiguration();
    
    if (activeConfig) {
      console.log(`Active configuration: ${activeConfig.name} (${activeConfig.host})`);
    } else {
      console.log('No active configuration set.');
      
      // Find the first configuration that might work and try to activate it
      const primaryConfig = configurations.find(c => c.host === '192.168.235.17');
      if (primaryConfig) {
        console.log('Attempting to set primary configuration as active...');
        try {
          await configService.activateConfiguration(primaryConfig.id);
          console.log('✓ Primary configuration set as active');
        } catch (error) {
          console.log('✗ Failed to set active configuration:', error);
        }
      }
    }

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testDatabaseConnections()
    .then(() => {
      console.log('\nConnection testing completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testDatabaseConnections };