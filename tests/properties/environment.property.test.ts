/**
 * Property-Based Tests for Environment Configuration
 * Feature: historian-reporting, Property 18: Environment Configuration
 * Validates: Requirements 11.3
 */

import fc from 'fast-check';
import { z } from 'zod';

// Mock environment validation schema (simplified version of the real one)
const envSchema = z.object({
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  JWT_SECRET: z.string().min(32),
});

// Generators for valid environment values
const validDbHostGen = fc.oneof(
  fc.domain(),
  fc.ipV4(),
  fc.constant('localhost')
);

const validPortGen = fc.integer({ min: 1, max: 65535 });

const validDbNameGen = fc.stringOf(
  fc.oneof(fc.char(), fc.constantFrom('_', '-')),
  { minLength: 1, maxLength: 50 }
);

const validUserGen = fc.stringOf(
  fc.oneof(fc.char(), fc.constantFrom('_', '-', '@', '.')),
  { minLength: 1, maxLength: 100 }
);

const validPasswordGen = fc.string({ minLength: 1, maxLength: 200 });

const validJwtSecretGen = fc.string({ minLength: 32, maxLength: 256 });

const validNodeEnvGen = fc.constantFrom('development', 'production', 'test');

// Generator for valid environment configuration
const validEnvironmentGen = fc.record({
  DB_HOST: validDbHostGen,
  DB_PORT: validPortGen.map(String),
  DB_NAME: validDbNameGen,
  DB_USER: validUserGen,
  DB_PASSWORD: validPasswordGen,
  NODE_ENV: validNodeEnvGen,
  PORT: validPortGen.map(String),
  JWT_SECRET: validJwtSecretGen,
});

describe('Property 18: Environment Configuration', () => {
  /**
   * Property: For any valid environment variable configuration, 
   * the application should use the provided values for database connections and system settings
   */
  test('should accept and parse valid environment configurations', () => {
    fc.assert(
      fc.property(validEnvironmentGen, (envVars) => {
        // Save original environment
        const originalEnv = { ...process.env };
        
        try {
          // Set test environment variables
          Object.assign(process.env, envVars);
          
          // Parse environment with schema
          const result = envSchema.safeParse(process.env);
          
          // Should successfully parse valid configuration
          expect(result.success).toBe(true);
          
          if (result.success) {
            // Verify values are correctly parsed and typed
            expect(result.data.DB_HOST).toBe(envVars.DB_HOST);
            expect(result.data.DB_PORT).toBe(parseInt(envVars.DB_PORT));
            expect(result.data.DB_NAME).toBe(envVars.DB_NAME);
            expect(result.data.DB_USER).toBe(envVars.DB_USER);
            expect(result.data.DB_PASSWORD).toBe(envVars.DB_PASSWORD);
            expect(result.data.NODE_ENV).toBe(envVars.NODE_ENV);
            expect(result.data.PORT).toBe(parseInt(envVars.PORT));
            expect(result.data.JWT_SECRET).toBe(envVars.JWT_SECRET);
            
            // Verify type coercion works correctly
            expect(typeof result.data.DB_PORT).toBe('number');
            expect(typeof result.data.PORT).toBe('number');
            expect(typeof result.data.DB_HOST).toBe('string');
          }
        } finally {
          // Restore original environment
          process.env = originalEnv;
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any invalid environment configuration,
   * the validation should fail with descriptive error messages
   */
  test('should reject invalid environment configurations', () => {
    const invalidEnvironmentGen = fc.oneof(
      // Missing required fields
      fc.record({
        DB_HOST: fc.constant(''),
        DB_PORT: validPortGen.map(String),
        DB_NAME: validDbNameGen,
        DB_USER: validUserGen,
        DB_PASSWORD: validPasswordGen,
        JWT_SECRET: validJwtSecretGen,
      }),
      
      // Invalid port numbers
      fc.record({
        DB_HOST: validDbHostGen,
        DB_PORT: fc.oneof(
          fc.constant('0'),
          fc.constant('65536'),
          fc.constant('-1'),
          fc.constant('not-a-number')
        ),
        DB_NAME: validDbNameGen,
        DB_USER: validUserGen,
        DB_PASSWORD: validPasswordGen,
        JWT_SECRET: validJwtSecretGen,
      }),
      
      // JWT secret too short
      fc.record({
        DB_HOST: validDbHostGen,
        DB_PORT: validPortGen.map(String),
        DB_NAME: validDbNameGen,
        DB_USER: validUserGen,
        DB_PASSWORD: validPasswordGen,
        JWT_SECRET: fc.string({ minLength: 1, maxLength: 31 }),
      }),
      
      // Invalid NODE_ENV
      fc.record({
        DB_HOST: validDbHostGen,
        DB_PORT: validPortGen.map(String),
        DB_NAME: validDbNameGen,
        DB_USER: validUserGen,
        DB_PASSWORD: validPasswordGen,
        JWT_SECRET: validJwtSecretGen,
        NODE_ENV: fc.string().filter(s => !['development', 'production', 'test'].includes(s)),
      })
    );

    fc.assert(
      fc.property(invalidEnvironmentGen, (envVars) => {
        // Save original environment
        const originalEnv = { ...process.env };
        
        try {
          // Set test environment variables
          Object.assign(process.env, envVars);
          
          // Parse environment with schema
          const result = envSchema.safeParse(process.env);
          
          // Should fail to parse invalid configuration
          expect(result.success).toBe(false);
          
          if (!result.success) {
            // Should provide error details
            expect(result.error.errors.length).toBeGreaterThan(0);
            expect(result.error.errors[0]).toHaveProperty('message');
            expect(result.error.errors[0]).toHaveProperty('path');
          }
        } finally {
          // Restore original environment
          process.env = originalEnv;
        }
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Default values should be applied when optional environment variables are missing
   */
  test('should apply default values for optional configuration', () => {
    const minimalEnvironmentGen = fc.record({
      DB_HOST: validDbHostGen,
      DB_PORT: validPortGen.map(String),
      DB_NAME: validDbNameGen,
      DB_USER: validUserGen,
      DB_PASSWORD: validPasswordGen,
      JWT_SECRET: validJwtSecretGen,
      // NODE_ENV and PORT are optional with defaults
    });

    fc.assert(
      fc.property(minimalEnvironmentGen, (envVars) => {
        // Save original environment
        const originalEnv = { ...process.env };
        
        try {
          // Clear environment and set only required variables
          process.env = { ...envVars };
          
          // Parse environment with schema
          const result = envSchema.safeParse(process.env);
          
          // Should successfully parse with defaults applied
          expect(result.success).toBe(true);
          
          if (result.success) {
            // Verify defaults are applied
            expect(result.data.NODE_ENV).toBe('development');
            expect(result.data.PORT).toBe(3000);
            
            // Verify required values are preserved
            expect(result.data.DB_HOST).toBe(envVars.DB_HOST);
            expect(result.data.JWT_SECRET).toBe(envVars.JWT_SECRET);
          }
        } finally {
          // Restore original environment
          process.env = originalEnv;
        }
      }),
      { numRuns: 50 }
    );
  });
});