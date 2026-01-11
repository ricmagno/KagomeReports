/**
 * Property-Based Tests for Database Configuration Encryption
 * Tests Property 21: Database Configuration Encryption
 * Validates: Requirements 9.3
 * 
 * Feature: historian-reporting, Property 21: For any database configuration with credentials, 
 * the stored version should have encrypted passwords while the original plaintext passwords 
 * should be recoverable through decryption
 */

import fc from 'fast-check';
import { databaseConfigService } from '@/services/databaseConfigService';
import { DatabaseConfig } from '@/types/databaseConfig';

describe('Property 21: Database Configuration Encryption', () => {
  // Generator for valid database configurations
  const databaseConfigGen = fc.record({
    name: fc.string({ minLength: 1, maxLength: 100 }),
    host: fc.oneof(
      fc.constant('localhost'),
      fc.ipV4(),
      fc.domain()
    ),
    port: fc.integer({ min: 1, max: 65535 }),
    database: fc.string({ minLength: 1, maxLength: 100 }),
    username: fc.string({ minLength: 1, maxLength: 100 }),
    password: fc.string({ minLength: 3, maxLength: 255 }), // Minimum 3 characters to avoid false positives
    encrypt: fc.boolean(),
    trustServerCertificate: fc.boolean(),
    connectionTimeout: fc.integer({ min: 1000, max: 300000 }),
    requestTimeout: fc.integer({ min: 1000, max: 300000 })
  });

  test('Property 21: Database configuration encryption round-trip preserves credentials', async () => {
    await fc.assert(
      fc.asyncProperty(databaseConfigGen, async (config: DatabaseConfig) => {
        // Encrypt the configuration
        const encryptedConfig = await databaseConfigService.encryptCredentials(config);
        
        // Verify password is encrypted (should not match original)
        expect(encryptedConfig.encryptedPassword).not.toBe(config.password);
        expect(encryptedConfig.encryptedPassword).toMatch(/^{.*}$/); // Should be JSON string
        
        // Verify other fields are preserved
        expect(encryptedConfig.name).toBe(config.name);
        expect(encryptedConfig.host).toBe(config.host);
        expect(encryptedConfig.port).toBe(config.port);
        expect(encryptedConfig.database).toBe(config.database);
        expect(encryptedConfig.username).toBe(config.username);
        expect(encryptedConfig.encrypt).toBe(config.encrypt);
        expect(encryptedConfig.trustServerCertificate).toBe(config.trustServerCertificate);
        expect(encryptedConfig.connectionTimeout).toBe(config.connectionTimeout);
        expect(encryptedConfig.requestTimeout).toBe(config.requestTimeout);
        
        // Decrypt the configuration
        const decryptedConfig = await databaseConfigService.decryptCredentials(encryptedConfig);
        
        // Verify decrypted password matches original
        expect(decryptedConfig.password).toBe(config.password);
        
        // Verify all other fields are preserved
        expect(decryptedConfig.name).toBe(config.name);
        expect(decryptedConfig.host).toBe(config.host);
        expect(decryptedConfig.port).toBe(config.port);
        expect(decryptedConfig.database).toBe(config.database);
        expect(decryptedConfig.username).toBe(config.username);
        expect(decryptedConfig.encrypt).toBe(config.encrypt);
        expect(decryptedConfig.trustServerCertificate).toBe(config.trustServerCertificate);
        expect(decryptedConfig.connectionTimeout).toBe(config.connectionTimeout);
        expect(decryptedConfig.requestTimeout).toBe(config.requestTimeout);
      }),
      { 
        numRuns: 100,
        timeout: 30000,
        verbose: true
      }
    );
  }, 60000);

  test('Property 21: Encrypted passwords are not readable as plaintext', async () => {
    await fc.assert(
      fc.asyncProperty(databaseConfigGen, async (config: DatabaseConfig) => {
        // Skip very short passwords that might appear in hex data by coincidence
        fc.pre(config.password.length >= 3);
        
        const encryptedConfig = await databaseConfigService.encryptCredentials(config);
        
        // Encrypted password should be a valid JSON string containing encrypted data
        const encryptedData = JSON.parse(encryptedConfig.encryptedPassword);
        expect(encryptedData).toHaveProperty('data');
        expect(encryptedData).toHaveProperty('iv');
        expect(encryptedData).toHaveProperty('tag');
        expect(encryptedData).toHaveProperty('algorithm');
        
        // The encrypted data fields should not contain the original password
        // (for passwords longer than 2 characters to avoid false positives with hex data)
        expect(encryptedData.data).not.toContain(config.password);
        expect(encryptedData.iv).not.toContain(config.password);
        expect(encryptedData.tag).not.toContain(config.password);
      }),
      { 
        numRuns: 100,
        timeout: 30000
      }
    );
  }, 60000);

  test('Property 21: Different passwords produce different encrypted results', async () => {
    await fc.assert(
      fc.asyncProperty(
        databaseConfigGen,
        databaseConfigGen,
        async (config1: DatabaseConfig, config2: DatabaseConfig) => {
          // Skip if passwords are the same
          fc.pre(config1.password !== config2.password);
          
          const encrypted1 = await databaseConfigService.encryptCredentials(config1);
          const encrypted2 = await databaseConfigService.encryptCredentials(config2);
          
          // Different passwords should produce different encrypted results
          expect(encrypted1.encryptedPassword).not.toBe(encrypted2.encryptedPassword);
        }
      ),
      { 
        numRuns: 50,
        timeout: 30000
      }
    );
  }, 60000);

  test('Property 21: Same password encrypted multiple times produces different ciphertext', async () => {
    await fc.assert(
      fc.asyncProperty(databaseConfigGen, async (config: DatabaseConfig) => {
        const encrypted1 = await databaseConfigService.encryptCredentials(config);
        const encrypted2 = await databaseConfigService.encryptCredentials(config);
        
        // Same password encrypted multiple times should produce different ciphertext
        // (due to random IV generation)
        expect(encrypted1.encryptedPassword).not.toBe(encrypted2.encryptedPassword);
        
        // But both should decrypt to the same original password
        const decrypted1 = await databaseConfigService.decryptCredentials(encrypted1);
        const decrypted2 = await databaseConfigService.decryptCredentials(encrypted2);
        
        expect(decrypted1.password).toBe(config.password);
        expect(decrypted2.password).toBe(config.password);
        expect(decrypted1.password).toBe(decrypted2.password);
      }),
      { 
        numRuns: 50,
        timeout: 30000
      }
    );
  }, 60000);

  test('Property 21: Encryption preserves non-sensitive configuration fields', async () => {
    await fc.assert(
      fc.asyncProperty(databaseConfigGen, async (config: DatabaseConfig) => {
        const encryptedConfig = await databaseConfigService.encryptCredentials(config);
        
        // All non-password fields should be preserved exactly
        expect(encryptedConfig.name).toBe(config.name);
        expect(encryptedConfig.host).toBe(config.host);
        expect(encryptedConfig.port).toBe(config.port);
        expect(encryptedConfig.database).toBe(config.database);
        expect(encryptedConfig.username).toBe(config.username);
        expect(encryptedConfig.encrypt).toBe(config.encrypt);
        expect(encryptedConfig.trustServerCertificate).toBe(config.trustServerCertificate);
        expect(encryptedConfig.connectionTimeout).toBe(config.connectionTimeout);
        expect(encryptedConfig.requestTimeout).toBe(config.requestTimeout);
        
        // Only the password should be encrypted
        expect(encryptedConfig.encryptedPassword).not.toBe(config.password);
      }),
      { 
        numRuns: 100,
        timeout: 30000
      }
    );
  }, 60000);

  test('Property 21: Malformed encrypted data cannot be decrypted', async () => {
    await fc.assert(
      fc.asyncProperty(databaseConfigGen, async (config: DatabaseConfig) => {
        const encryptedConfig = await databaseConfigService.encryptCredentials(config);
        
        // Corrupt the encrypted data
        const corruptedConfig = {
          ...encryptedConfig,
          encryptedPassword: JSON.stringify({
            data: 'corrupted_data',
            iv: 'corrupted_iv',
            tag: 'corrupted_tag',
            algorithm: 'aes-256-cbc'
          })
        };
        
        // Attempting to decrypt corrupted data should throw an error
        await expect(
          databaseConfigService.decryptCredentials(corruptedConfig)
        ).rejects.toThrow();
      }),
      { 
        numRuns: 20,
        timeout: 30000
      }
    );
  }, 60000);
});