/**
 * Database Configuration Validation Tests
 * Feature: historian-reporting, Property 26: Database Configuration Validation
 * Validates: Requirements 9.7
 */

import fc from 'fast-check';
import { DatabaseConfigService } from '@/services/databaseConfigService';
import { DatabaseConfig, ValidationResult } from '@/types/databaseConfig';

describe('Database Configuration Validation Tests', () => {
  let databaseConfigService: DatabaseConfigService;

  beforeEach(() => {
    databaseConfigService = new DatabaseConfigService();
  });

  /**
   * Property 26: Database Configuration Validation
   * For any invalid database configuration (missing required fields, invalid ports, 
   * malformed hostnames), the system should prevent saving and return specific 
   * validation error messages
   */
  describe('Property 26: Database Configuration Validation', () => {
    
    it('should reject configurations with missing required fields', () => {
      fc.assert(fc.property(
        fc.record({
          name: fc.option(fc.string(), { nil: undefined }),
          host: fc.option(fc.string(), { nil: undefined }),
          database: fc.option(fc.string(), { nil: undefined }),
          username: fc.option(fc.string(), { nil: undefined }),
          password: fc.option(fc.string(), { nil: undefined }),
          port: fc.integer({ min: 1, max: 65535 }),
          encrypt: fc.boolean(),
          trustServerCertificate: fc.boolean(),
          connectionTimeout: fc.integer({ min: 1000, max: 300000 }),
          requestTimeout: fc.integer({ min: 1000, max: 300000 })
        }),
        (configData) => {
          const config: DatabaseConfig = {
            name: configData.name || '',
            host: configData.host || '',
            database: configData.database || '',
            username: configData.username || '',
            password: configData.password || '',
            port: configData.port,
            encrypt: configData.encrypt,
            trustServerCertificate: configData.trustServerCertificate,
            connectionTimeout: configData.connectionTimeout,
            requestTimeout: configData.requestTimeout
          };

          const result = databaseConfigService.validateConfiguration(config);

          // If any required field is missing or empty, validation should fail
          const hasEmptyRequiredField = !config.name.trim() || 
                                       !config.host.trim() || 
                                       !config.database.trim() || 
                                       !config.username.trim() || 
                                       !config.password.trim();

          if (hasEmptyRequiredField) {
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            
            // Check that REQUIRED errors exist for empty fields
            const requiredErrors = result.errors.filter(e => e.code === 'REQUIRED');
            expect(requiredErrors.length).toBeGreaterThan(0);
            
            requiredErrors.forEach(error => {
              expect(error.field).toBeDefined();
              expect(error.message).toBeDefined();
              expect(error.message).toContain('required');
            });
          }
        }
      ), { numRuns: 100 });
    });

    it('should reject configurations with invalid port ranges', () => {
      fc.assert(fc.property(
        fc.record({
          name: fc.string({ minLength: 1 }),
          host: fc.string({ minLength: 1 }),
          database: fc.string({ minLength: 1 }),
          username: fc.string({ minLength: 1 }),
          password: fc.string({ minLength: 1 }),
          port: fc.oneof(
            fc.integer({ max: 0 }),
            fc.integer({ min: 65536 })
          ),
          encrypt: fc.boolean(),
          trustServerCertificate: fc.boolean(),
          connectionTimeout: fc.integer({ min: 1000, max: 300000 }),
          requestTimeout: fc.integer({ min: 1000, max: 300000 })
        }),
        (config) => {
          const result = databaseConfigService.validateConfiguration(config);

          // Invalid port should cause validation failure
          expect(result.isValid).toBe(false);
          
          const portError = result.errors.find(e => e.field === 'port');
          expect(portError).toBeDefined();
          expect(portError?.code).toBe('INVALID_RANGE');
          expect(portError?.message).toContain('Port must be between 1 and 65535');
        }
      ), { numRuns: 20 });
    });

    it('should reject configurations with invalid timeout values', () => {
      fc.assert(fc.property(
        fc.record({
          name: fc.string({ minLength: 1 }),
          host: fc.string({ minLength: 1 }),
          database: fc.string({ minLength: 1 }),
          username: fc.string({ minLength: 1 }),
          password: fc.string({ minLength: 1 }),
          port: fc.integer({ min: 1, max: 65535 }),
          encrypt: fc.boolean(),
          trustServerCertificate: fc.boolean(),
          connectionTimeout: fc.oneof(
            fc.integer({ max: 999 }),
            fc.integer({ min: 300001 })
          ),
          requestTimeout: fc.oneof(
            fc.integer({ max: 999 }),
            fc.integer({ min: 300001 })
          )
        }),
        (config) => {
          const result = databaseConfigService.validateConfiguration(config);

          // Invalid timeout should cause validation failure
          expect(result.isValid).toBe(false);
          
          const timeoutErrors = result.errors.filter(e => 
            e.field === 'connectionTimeout' || e.field === 'requestTimeout'
          );
          expect(timeoutErrors.length).toBeGreaterThan(0);
          
          timeoutErrors.forEach(error => {
            expect(error.code).toBe('INVALID_RANGE');
            expect(error.message).toContain('must be between 1000ms and 300000ms');
          });
        }
      ), { numRuns: 20 });
    });

    it('should reject configurations with malformed hostnames', () => {
      fc.assert(fc.property(
        fc.record({
          name: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          host: fc.oneof(
            // Invalid hostnames
            fc.string().filter(s => s.includes(' ')), // Contains spaces
            fc.string().filter(s => s.includes('_')), // Contains underscores
            fc.string().filter(s => s.startsWith('-')), // Starts with hyphen
            fc.string().filter(s => s.endsWith('-')), // Ends with hyphen
            fc.string().filter(s => s.includes('..')), // Double dots
            fc.constant('256.256.256.256'), // Invalid IP
            fc.constant('999.999.999.999') // Invalid IP
          ),
          database: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          username: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          password: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          port: fc.integer({ min: 1, max: 65535 }),
          encrypt: fc.boolean(),
          trustServerCertificate: fc.boolean(),
          connectionTimeout: fc.integer({ min: 1000, max: 300000 }),
          requestTimeout: fc.integer({ min: 1000, max: 300000 })
        }),
        (config) => {
          const result = databaseConfigService.validateConfiguration(config);

          // Should fail validation due to invalid hostname
          expect(result.isValid).toBe(false);
          
          const hostError = result.errors.find(e => e.field === 'host');
          expect(hostError).toBeDefined();
          expect(hostError?.code).toBe('INVALID_FORMAT');
          expect(hostError?.message).toContain('Invalid hostname format');
        }
      ), { numRuns: 100 });
    });

    it('should accept valid configurations', () => {
      fc.assert(fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          host: fc.oneof(
            fc.constant('localhost'),
            fc.constant('127.0.0.1'),
            fc.constant('192.168.1.100'),
            fc.constant('server.domain.com'),
            fc.constant('my-server'),
            fc.constant('historian-db')
          ),
          database: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          username: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          password: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          port: fc.integer({ min: 1, max: 65535 }),
          encrypt: fc.boolean(),
          trustServerCertificate: fc.boolean(),
          connectionTimeout: fc.integer({ min: 1000, max: 300000 }),
          requestTimeout: fc.integer({ min: 1000, max: 300000 })
        }),
        (config) => {
          const result = databaseConfigService.validateConfiguration(config);

          // Valid configuration should pass validation
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      ), { numRuns: 100 });
    });

    it('should provide specific error codes for different validation failures', () => {
      const testCases = [
        {
          config: { name: '', host: 'localhost', database: 'test', username: 'user', password: 'pass', port: 1433, encrypt: true, trustServerCertificate: false, connectionTimeout: 30000, requestTimeout: 30000 },
          expectedErrorCode: 'REQUIRED',
          expectedField: 'name'
        },
        {
          config: { name: 'test', host: '', database: 'test', username: 'user', password: 'pass', port: 1433, encrypt: true, trustServerCertificate: false, connectionTimeout: 30000, requestTimeout: 30000 },
          expectedErrorCode: 'REQUIRED',
          expectedField: 'host'
        },
        {
          config: { name: 'test', host: 'localhost', database: 'test', username: 'user', password: 'pass', port: 0, encrypt: true, trustServerCertificate: false, connectionTimeout: 30000, requestTimeout: 30000 },
          expectedErrorCode: 'INVALID_RANGE',
          expectedField: 'port'
        },
        {
          config: { name: 'test', host: 'invalid..hostname', database: 'test', username: 'user', password: 'pass', port: 1433, encrypt: true, trustServerCertificate: false, connectionTimeout: 30000, requestTimeout: 30000 },
          expectedErrorCode: 'INVALID_FORMAT',
          expectedField: 'host'
        },
        {
          config: { name: 'test', host: 'localhost', database: 'test', username: 'user', password: 'pass', port: 1433, encrypt: true, trustServerCertificate: false, connectionTimeout: 500, requestTimeout: 30000 },
          expectedErrorCode: 'INVALID_RANGE',
          expectedField: 'connectionTimeout'
        }
      ];

      testCases.forEach(({ config, expectedErrorCode, expectedField }) => {
        const result = databaseConfigService.validateConfiguration(config);
        
        expect(result.isValid).toBe(false);
        
        const specificError = result.errors.find(e => e.field === expectedField);
        expect(specificError).toBeDefined();
        expect(specificError?.code).toBe(expectedErrorCode);
        expect(specificError?.field).toBe(expectedField);
        expect(specificError?.message).toBeDefined();
      });
    });

    it('should validate all fields simultaneously and return multiple errors', () => {
      const invalidConfig: DatabaseConfig = {
        name: '', // Missing required field
        host: 'invalid..hostname', // Invalid format
        database: '', // Missing required field
        username: 'user',
        password: 'pass',
        port: 70000, // Invalid range
        encrypt: true,
        trustServerCertificate: false,
        connectionTimeout: 500, // Invalid range
        requestTimeout: 400000 // Invalid range
      };

      const result = databaseConfigService.validateConfiguration(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(5);

      // Check that all expected errors are present
      const errorFields = result.errors.map(e => e.field);
      expect(errorFields).toContain('name');
      expect(errorFields).toContain('host');
      expect(errorFields).toContain('database');
      expect(errorFields).toContain('port');
      expect(errorFields).toContain('connectionTimeout');
      expect(errorFields).toContain('requestTimeout');

      // Verify error codes are appropriate
      const nameError = result.errors.find(e => e.field === 'name');
      expect(nameError?.code).toBe('REQUIRED');

      const hostError = result.errors.find(e => e.field === 'host');
      expect(hostError?.code).toBe('INVALID_FORMAT');

      const portError = result.errors.find(e => e.field === 'port');
      expect(portError?.code).toBe('INVALID_RANGE');
    });

    it('should handle edge cases in hostname validation', () => {
      const validHostnames = [
        'localhost',
        '127.0.0.1',
        '192.168.1.1',
        '10.0.0.1',
        'server',
        'my-server',
        'server.domain.com',
        'sub.domain.example.org',
        'a.b.c.d.e.f.g'
      ];

      const invalidHostnames = [
        'server with spaces',
        'server_with_underscores',
        '-server',
        'server-',
        'server..domain',
        '256.256.256.256',
        '192.168.1.256',
        'server.',
        '.server'
      ];

      validHostnames.forEach(hostname => {
        const config: DatabaseConfig = {
          name: 'test',
          host: hostname,
          database: 'test',
          username: 'user',
          password: 'pass',
          port: 1433,
          encrypt: true,
          trustServerCertificate: false,
          connectionTimeout: 30000,
          requestTimeout: 30000
        };

        const result = databaseConfigService.validateConfiguration(config);
        expect(result.isValid).toBe(true);
      });

      invalidHostnames.forEach(hostname => {
        const config: DatabaseConfig = {
          name: 'test',
          host: hostname,
          database: 'test',
          username: 'user',
          password: 'pass',
          port: 1433,
          encrypt: true,
          trustServerCertificate: false,
          connectionTimeout: 30000,
          requestTimeout: 30000
        };

        const result = databaseConfigService.validateConfiguration(config);
        expect(result.isValid).toBe(false);
        
        const hostError = result.errors.find(e => e.field === 'host');
        expect(hostError).toBeDefined();
        expect(hostError?.code).toBe('INVALID_FORMAT');
      });
    });
  });

  describe('Validation Error Message Quality', () => {
    it('should provide user-friendly error messages', () => {
      const config: DatabaseConfig = {
        name: '',
        host: 'invalid..host',
        database: '',
        username: '',
        password: '',
        port: -1,
        encrypt: true,
        trustServerCertificate: false,
        connectionTimeout: 100,
        requestTimeout: 500000
      };

      const result = databaseConfigService.validateConfiguration(config);

      expect(result.isValid).toBe(false);
      
      result.errors.forEach(error => {
        // All error messages should be user-friendly
        expect(error.message).toBeDefined();
        expect(error.message.length).toBeGreaterThan(0);
        expect(error.message).not.toContain('undefined');
        expect(error.message).not.toContain('null');
        
        // Messages should be descriptive
        if (error.code === 'REQUIRED') {
          expect(error.message.toLowerCase()).toContain('required');
        } else if (error.code === 'INVALID_RANGE') {
          expect(error.message.toLowerCase()).toContain('between');
        } else if (error.code === 'INVALID_FORMAT') {
          expect(error.message.toLowerCase()).toContain('invalid');
        }
      });
    });

    it('should provide consistent error structure', () => {
      fc.assert(fc.property(
        fc.record({
          name: fc.option(fc.string(), { nil: undefined }),
          host: fc.option(fc.string(), { nil: undefined }),
          database: fc.option(fc.string(), { nil: undefined }),
          username: fc.option(fc.string(), { nil: undefined }),
          password: fc.option(fc.string(), { nil: undefined }),
          port: fc.integer(),
          encrypt: fc.boolean(),
          trustServerCertificate: fc.boolean(),
          connectionTimeout: fc.integer(),
          requestTimeout: fc.integer()
        }),
        (configData) => {
          const config: DatabaseConfig = {
            name: configData.name || '',
            host: configData.host || '',
            database: configData.database || '',
            username: configData.username || '',
            password: configData.password || '',
            port: configData.port,
            encrypt: configData.encrypt,
            trustServerCertificate: configData.trustServerCertificate,
            connectionTimeout: configData.connectionTimeout,
            requestTimeout: configData.requestTimeout
          };

          const result = databaseConfigService.validateConfiguration(config);

          // All errors should have consistent structure
          result.errors.forEach(error => {
            expect(error).toHaveProperty('field');
            expect(error).toHaveProperty('message');
            expect(error).toHaveProperty('code');
            
            expect(typeof error.field).toBe('string');
            expect(typeof error.message).toBe('string');
            expect(typeof error.code).toBe('string');
            
            expect(error.field.length).toBeGreaterThan(0);
            expect(error.message.length).toBeGreaterThan(0);
            expect(error.code.length).toBeGreaterThan(0);
            
            // Valid error codes
            expect(['REQUIRED', 'INVALID_RANGE', 'INVALID_FORMAT', 'DUPLICATE']).toContain(error.code);
          });
        }
      ), { numRuns: 50 });
    });
  });
});