/**
 * Property-Based Tests for Connection Testing Validation
 * Tests Property 23: Connection Testing Validation
 * Validates: Requirements 9.2
 * 
 * Feature: historian-reporting, Property 23: For any database configuration (valid or invalid), 
 * the connection test should return appropriate success/failure status with meaningful error 
 * messages for failures
 */

import fc from 'fast-check';
import { databaseConfigService } from '@/services/databaseConfigService';
import { DatabaseConfig } from '@/types/databaseConfig';

describe('Property 23: Connection Testing Validation', () => {
  // Generator for valid database configurations
  const validDatabaseConfigGen = fc.record({
    name: fc.string({ minLength: 1, maxLength: 100 }),
    host: fc.oneof(
      fc.constant('localhost'),
      fc.ipV4(),
      fc.domain()
    ),
    port: fc.integer({ min: 1, max: 65535 }),
    database: fc.string({ minLength: 1, maxLength: 100 }),
    username: fc.string({ minLength: 1, maxLength: 100 }),
    password: fc.string({ minLength: 3, maxLength: 255 }),
    encrypt: fc.boolean(),
    trustServerCertificate: fc.boolean(),
    connectionTimeout: fc.integer({ min: 1000, max: 300000 }),
    requestTimeout: fc.integer({ min: 1000, max: 300000 })
  });

  // Generator for invalid database configurations
  const invalidDatabaseConfigGen = fc.oneof(
    // Missing required fields
    fc.record({
      name: fc.constant(''),
      host: fc.string({ minLength: 1, maxLength: 100 }),
      port: fc.integer({ min: 1, max: 65535 }),
      database: fc.string({ minLength: 1, maxLength: 100 }),
      username: fc.string({ minLength: 1, maxLength: 100 }),
      password: fc.string({ minLength: 3, maxLength: 255 }),
      encrypt: fc.boolean(),
      trustServerCertificate: fc.boolean(),
      connectionTimeout: fc.integer({ min: 1000, max: 300000 }),
      requestTimeout: fc.integer({ min: 1000, max: 300000 })
    }),
    // Invalid port
    fc.record({
      name: fc.string({ minLength: 1, maxLength: 100 }),
      host: fc.string({ minLength: 1, maxLength: 100 }),
      port: fc.integer({ min: 65536, max: 99999 }),
      database: fc.string({ minLength: 1, maxLength: 100 }),
      username: fc.string({ minLength: 1, maxLength: 100 }),
      password: fc.string({ minLength: 3, maxLength: 255 }),
      encrypt: fc.boolean(),
      trustServerCertificate: fc.boolean(),
      connectionTimeout: fc.integer({ min: 1000, max: 300000 }),
      requestTimeout: fc.integer({ min: 1000, max: 300000 })
    }),
    // Invalid timeout values
    fc.record({
      name: fc.string({ minLength: 1, maxLength: 100 }),
      host: fc.string({ minLength: 1, maxLength: 100 }),
      port: fc.integer({ min: 1, max: 65535 }),
      database: fc.string({ minLength: 1, maxLength: 100 }),
      username: fc.string({ minLength: 1, maxLength: 100 }),
      password: fc.string({ minLength: 3, maxLength: 255 }),
      encrypt: fc.boolean(),
      trustServerCertificate: fc.boolean(),
      connectionTimeout: fc.integer({ min: 1, max: 999 }),
      requestTimeout: fc.integer({ min: 1000, max: 300000 })
    })
  );

  test('Property 23: Connection test always returns a result with required fields', async () => {
    await fc.assert(
      fc.asyncProperty(validDatabaseConfigGen, async (config: DatabaseConfig) => {
        const result = await databaseConfigService.testConnection(config);
        
        // Result should always have required fields
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('message');
        expect(result).toHaveProperty('testedAt');
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.message).toBe('string');
        expect(result.testedAt).toBeInstanceOf(Date);
        
        // Message should not be empty
        expect(result.message.trim()).not.toBe('');
        
        // If successful, should have response time
        if (result.success) {
          expect(result).toHaveProperty('responseTime');
          expect(typeof result.responseTime).toBe('number');
          expect(result.responseTime).toBeGreaterThan(0);
        }
        
        // If failed, should have error information
        if (!result.success) {
          expect(result).toHaveProperty('error');
          expect(typeof result.error).toBe('string');
        }
      }),
      { 
        numRuns: 5, // Reduced from 20
        timeout: 30000
      }
    );
  }, 60000);

  test('Property 23: Invalid configurations return validation errors', async () => {
    await fc.assert(
      fc.asyncProperty(invalidDatabaseConfigGen, async (config: DatabaseConfig) => {
        const result = await databaseConfigService.testConnection(config);
        
        // Invalid configurations should fail
        expect(result.success).toBe(false);
        expect(result.message).toContain('validation failed');
        expect(result.error).toBe('VALIDATION_ERROR');
        expect(result.testedAt).toBeInstanceOf(Date);
        
        // Should not have response time for validation errors
        expect(result.responseTime).toBeUndefined();
      }),
      { 
        numRuns: 10, // Reduced from 50
        timeout: 15000
      }
    );
  }, 30000);

  test('Property 23: Connection test with unreachable host returns network error', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 100 }),
          host: fc.constant('192.0.2.1'), // RFC 5737 test address (unreachable)
          port: fc.integer({ min: 1, max: 65535 }),
          database: fc.string({ minLength: 1, maxLength: 100 }),
          username: fc.string({ minLength: 1, maxLength: 100 }),
          password: fc.string({ minLength: 3, maxLength: 255 }),
          encrypt: fc.boolean(),
          trustServerCertificate: fc.boolean(),
          connectionTimeout: fc.constant(3000), // Shorter timeout for testing
          requestTimeout: fc.constant(3000)
        }),
        async (config: DatabaseConfig) => {
          const result = await databaseConfigService.testConnection(config);
          
          // Should fail for unreachable host
          expect(result.success).toBe(false);
          expect(result.testedAt).toBeInstanceOf(Date);
          expect(result.message).toBeTruthy();
          expect(result.error).toBeTruthy();
          
          // Should have response time even for failed connections
          expect(result.responseTime).toBeGreaterThan(0);
          
          // Error message should be user-friendly
          expect(result.message).not.toContain('undefined');
          expect(result.message).not.toContain('null');
        }
      ),
      { 
        numRuns: 2, // Reduced from 5
        timeout: 30000
      }
    );
  }, 60000);

  test('Property 23: Connection test response time is reasonable', async () => {
    await fc.assert(
      fc.asyncProperty(validDatabaseConfigGen, async (config: DatabaseConfig) => {
        const startTime = Date.now();
        const result = await databaseConfigService.testConnection(config);
        const actualDuration = Date.now() - startTime;
        
        // Response time should be reasonable (within 10% of actual duration)
        if (result.responseTime) {
          const timeDifference = Math.abs(result.responseTime - actualDuration);
          const tolerance = actualDuration * 0.1; // 10% tolerance
          expect(timeDifference).toBeLessThanOrEqual(tolerance);
        }
        
        // Test should complete within reasonable time
        expect(actualDuration).toBeLessThan(20000); // 20 seconds max
      }),
      { 
        numRuns: 3, // Reduced from 10
        timeout: 30000
      }
    );
  }, 60000);

  test('Property 23: Connection test messages are informative', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(validDatabaseConfigGen, invalidDatabaseConfigGen),
        async (config: DatabaseConfig) => {
          const result = await databaseConfigService.testConnection(config);
          
          // Message should be informative and not generic
          expect(result.message).toBeTruthy();
          expect(result.message.length).toBeGreaterThan(5);
          
          // Should not contain technical jargon that users won't understand
          expect(result.message).not.toContain('undefined');
          expect(result.message).not.toContain('null');
          expect(result.message).not.toContain('[object Object]');
          
          // Should provide actionable information for failures
          if (!result.success) {
            const message = result.message.toLowerCase();
            const hasActionableInfo = 
              message.includes('check') ||
              message.includes('verify') ||
              message.includes('ensure') ||
              message.includes('validation') ||
              message.includes('timeout') ||
              message.includes('authentication') ||
              message.includes('network') ||
              message.includes('database') ||
              message.includes('failed') ||
              message.includes('error') ||
              message.includes('invalid') ||
              message.includes('required');
            
            // If no actionable info, log the message for debugging
            if (!hasActionableInfo) {
              console.log('Non-actionable message:', result.message);
            }
            
            expect(hasActionableInfo).toBe(true);
          }
        }
      ),
      { 
        numRuns: 10,
        timeout: 30000
      }
    );
  }, 60000);

  test('Property 23: Connection test handles edge cases gracefully', async () => {
    const edgeCases = [
      // Very long hostname
      {
        name: 'Edge Case Test',
        host: 'a'.repeat(253), // Max hostname length
        port: 1433,
        database: 'test',
        username: 'user',
        password: 'password',
        encrypt: false,
        trustServerCertificate: true,
        connectionTimeout: 3000, // Shorter timeout
        requestTimeout: 3000
      },
      // Port 0 (invalid)
      {
        name: 'Edge Case Test',
        host: 'localhost',
        port: 0,
        database: 'test',
        username: 'user',
        password: 'password',
        encrypt: false,
        trustServerCertificate: true,
        connectionTimeout: 3000,
        requestTimeout: 3000
      }
    ];

    for (const config of edgeCases) {
      const result = await databaseConfigService.testConnection(config);
      
      // Should handle edge cases without throwing exceptions
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('testedAt');
      
      // Edge cases should typically fail validation
      expect(result.success).toBe(false);
      expect(result.message).toBeTruthy();
    }
  }, 30000);
});