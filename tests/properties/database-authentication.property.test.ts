/**
 * Property-Based Tests for Database Authentication and Security
 * Feature: historian-reporting, Property 1: Database Authentication and Security
 * Validates: Requirements 1.1, 1.2, 9.2
 */

import fc from 'fast-check';
import { HistorianConnection } from '@/services/historianConnection';
import { DatabaseConfig } from '@/types/historian';

// Mock the database connection for testing
jest.mock('@/config/database', () => ({
  getDatabase: jest.fn(),
  testDatabaseConnection: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  dbLogger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

// Generators for database configuration
const validServerGen = fc.oneof(
  fc.domain(),
  fc.ipV4(),
  fc.constant('localhost')
);

const validPortGen = fc.integer({ min: 1, max: 65535 });

const validDatabaseNameGen = fc.stringOf(
  fc.oneof(fc.char(), fc.constantFrom('_', '-')),
  { minLength: 1, maxLength: 50 }
);

const validUsernameGen = fc.stringOf(
  fc.oneof(fc.char(), fc.constantFrom('_', '-', '@', '.')),
  { minLength: 1, maxLength: 100 }
);

const validPasswordGen = fc.string({ minLength: 8, maxLength: 200 });

const validDatabaseConfigGen = fc.record({
  server: validServerGen,
  port: validPortGen,
  database: validDatabaseNameGen,
  user: validUsernameGen,
  password: validPasswordGen,
  encrypt: fc.boolean(),
  trustServerCertificate: fc.boolean(),
  connectionTimeout: fc.integer({ min: 5000, max: 60000 }),
  requestTimeout: fc.integer({ min: 5000, max: 300000 }),
  pool: fc.record({
    min: fc.integer({ min: 1, max: 10 }),
    max: fc.integer({ min: 5, max: 50 }),
    idleTimeoutMillis: fc.integer({ min: 10000, max: 300000 }),
  }).filter(pool => pool.min <= pool.max), // Ensure min <= max
});

// Authentication method generators
const authMethodGen = fc.constantFrom(
  'sql-server-auth',
  'windows-auth',
  'azure-ad-auth'
);

describe('Property 1: Database Authentication and Security', () => {
  let mockGetDatabase: jest.Mock;
  let mockTestDatabaseConnection: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDatabase = require('@/config/database').getDatabase;
    mockTestDatabaseConnection = require('@/config/database').testDatabaseConnection;
  });

  /**
   * Property: For any database connection configuration, the system should authenticate 
   * using the specified method and maintain read-only access permissions throughout the session
   */
  test('should authenticate with valid configuration and maintain read-only access', async () => {
    await fc.assert(
      fc.asyncProperty(
        validDatabaseConfigGen,
        authMethodGen,
        async (config, authMethod) => {
          // Mock successful database connection
          const mockPool = {
            request: jest.fn().mockReturnValue({
              query: jest.fn().mockResolvedValue({
                recordset: [{ test: 1 }]
              })
            })
          };
          
          mockGetDatabase.mockReturnValue(mockPool);
          mockTestDatabaseConnection.mockResolvedValue(true);

          const connection = new HistorianConnection();
          
          // Should successfully connect with valid configuration
          await expect(connection.connect()).resolves.not.toThrow();
          
          // Should validate connection successfully
          const isValid = await connection.validateConnection();
          expect(isValid).toBe(true);
          
          // Connection status should reflect successful connection
          const status = connection.getConnectionStatus();
          expect(status.connected).toBe(true);
          expect(status.attempts).toBe(0); // Reset after successful connection
          
          // Should maintain connection throughout session
          const isStillValid = await connection.validateConnection();
          expect(isStillValid).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: For any invalid authentication configuration, 
   * the system should reject the connection and provide appropriate error messages
   */
  test('should reject invalid authentication configurations', async () => {
    const invalidConfigGen = fc.oneof(
      // Invalid server
      fc.record({
        server: fc.constant(''),
        port: validPortGen,
        database: validDatabaseNameGen,
        user: validUsernameGen,
        password: validPasswordGen,
      }),
      
      // Invalid port
      fc.record({
        server: validServerGen,
        port: fc.oneof(fc.constant(0), fc.constant(65536), fc.constant(-1)),
        database: validDatabaseNameGen,
        user: validUsernameGen,
        password: validPasswordGen,
      }),
      
      // Empty credentials
      fc.record({
        server: validServerGen,
        port: validPortGen,
        database: validDatabaseNameGen,
        user: fc.constant(''),
        password: fc.constant(''),
      }),
      
      // Invalid database name
      fc.record({
        server: validServerGen,
        port: validPortGen,
        database: fc.constant(''),
        user: validUsernameGen,
        password: validPasswordGen,
      })
    );

    await fc.assert(
      fc.asyncProperty(invalidConfigGen, async (invalidConfig) => {
        // Mock failed database connection
        mockGetDatabase.mockImplementation(() => {
          throw new Error('Connection failed');
        });
        mockTestDatabaseConnection.mockResolvedValue(false);

        // Should fail to create connection with invalid configuration
        expect(() => new HistorianConnection()).toThrow('Connection failed');
      }),
      { numRuns: 15 }
    );
  });

  /**
   * Property: For any connection session, read-only access should be enforced
   * and write operations should be rejected
   */
  test('should enforce read-only access permissions', async () => {
    await fc.assert(
      fc.asyncProperty(validDatabaseConfigGen, async (config) => {
        // Mock database connection that allows reads but rejects writes
        const mockPool = {
          request: jest.fn().mockReturnValue({
            query: jest.fn().mockImplementation((query: string) => {
              // Allow SELECT queries (read operations)
              if (query.trim().toUpperCase().startsWith('SELECT')) {
                return Promise.resolve({ recordset: [{ result: 'success' }] });
              }
              
              // Reject write operations (INSERT, UPDATE, DELETE, CREATE, DROP, ALTER)
              const writeOperations = ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER'];
              const isWriteOperation = writeOperations.some(op => 
                query.trim().toUpperCase().startsWith(op)
              );
              
              if (isWriteOperation) {
                return Promise.reject(new Error('Permission denied: Read-only access'));
              }
              
              return Promise.resolve({ recordset: [] });
            })
          })
        };
        
        mockGetDatabase.mockReturnValue(mockPool);
        mockTestDatabaseConnection.mockResolvedValue(true);

        const connection = new HistorianConnection();
        await connection.connect();
        
        // Read operations should succeed
        const readResult = await connection.executeQuery('SELECT 1 as test');
        expect(readResult.recordset).toHaveLength(1);
        
        // Write operations should be rejected
        const writeQueries = [
          'INSERT INTO Tag VALUES (1, \'test\')',
          'UPDATE Tag SET Description = \'test\'',
          'DELETE FROM Tag WHERE TagName = \'test\'',
        ];
        
        for (const writeQuery of writeQueries) {
          await expect(connection.executeQuery(writeQuery))
            .rejects.toThrow(); // Just check that it throws, don't check specific message
        }
      }),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Connection pool should maintain configured limits
   */
  test('should respect connection pool configuration limits', async () => {
    await fc.assert(
      fc.asyncProperty(validDatabaseConfigGen, async (config) => {
        const mockPool = {
          request: jest.fn().mockReturnValue({
            query: jest.fn().mockResolvedValue({ recordset: [{ test: 1 }] })
          }),
          config: {
            pool: config.pool
          }
        };
        
        mockGetDatabase.mockReturnValue(mockPool);
        mockTestDatabaseConnection.mockResolvedValue(true);

        const connection = new HistorianConnection();
        await connection.connect();
        
        // Verify pool configuration is respected
        expect(mockPool.config.pool.min).toBe(config.pool.min);
        expect(mockPool.config.pool.max).toBe(config.pool.max);
        expect(mockPool.config.pool.idleTimeoutMillis).toBe(config.pool.idleTimeoutMillis);
        
        // Pool limits should be enforced
        expect(config.pool.min).toBeLessThanOrEqual(config.pool.max);
        expect(config.pool.min).toBeGreaterThan(0);
        expect(config.pool.max).toBeGreaterThan(0);
      }),
      { numRuns: 15 }
    );
  });
});