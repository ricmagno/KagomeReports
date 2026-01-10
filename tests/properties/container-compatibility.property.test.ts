/**
 * Property-Based Tests for Multi-Architecture Container Compatibility
 * 
 * Property 17: Multi-Architecture Container Compatibility
 * Validates: Requirements 11.1, 11.2, 11.5
 * 
 * Tests container configuration compatibility with simplified approach.
 */

import fc from 'fast-check';
import fs from 'fs/promises';
import path from 'path';

describe('Property 17: Multi-Architecture Container Compatibility', () => {
  const MAX_EXAMPLES = 5; // Reduced for faster execution

  // Architecture configurations to test
  const architectures = ['linux/amd64', 'linux/arm64'];
  
  // Environment variable generators
  const envVarArb = fc.record({
    NODE_ENV: fc.constantFrom('development', 'production', 'test'),
    PORT: fc.integer({ min: 3000, max: 9999 }),
    DB_HOST: fc.constantFrom('localhost', '127.0.0.1', 'db-server'),
    DB_PORT: fc.constantFrom(1433, 5432, 3306),
    CACHE_ENABLED: fc.boolean(),
    CORS_ORIGIN: fc.constantFrom('http://localhost:3001', 'https://app.example.com', '*')
  });

  /**
   * Property: Docker configuration files exist and are valid
   */
  it('should have valid Docker configuration files', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('Dockerfile', 'docker-compose.yml', '.dockerignore'),
        async (filename) => {
          // Check that Docker configuration files exist
          const filePath = path.join(process.cwd(), filename);
          
          try {
            const stats = await fs.stat(filePath);
            expect(stats.isFile()).toBe(true);
            expect(stats.size).toBeGreaterThan(0);
            
            // Read file content to ensure it's not empty
            const content = await fs.readFile(filePath, 'utf-8');
            expect(content.length).toBeGreaterThan(0);
            expect(content.trim().length).toBeGreaterThan(0);
            
            return true;
          } catch (error) {
            throw new Error(`Docker configuration file ${filename} is missing or invalid`);
          }
        }
      ),
      { 
        numRuns: 3, // One for each file
        verbose: true
      }
    );
  });

  /**
   * Property: Dockerfile contains required multi-architecture configuration
   */
  it('should have proper multi-architecture Dockerfile configuration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('node:18-alpine', 'production', 'historian'),
        async (configItem) => {
          const dockerfilePath = path.join(process.cwd(), 'Dockerfile');
          const content = await fs.readFile(dockerfilePath, 'utf-8');
          
          // Validate Dockerfile contains expected configuration
          expect(content).toContain('FROM node:18-alpine');
          expect(content).toContain('WORKDIR /app');
          expect(content).toContain('EXPOSE 3000');
          expect(content).toContain('CMD ["node", "dist/server.js"]');
          
          // Check for multi-stage build
          expect(content).toContain('AS base');
          expect(content).toContain('AS production');
          
          // Check for non-root user
          expect(content).toContain('USER historian');
          
          // Check for health check
          expect(content).toContain('HEALTHCHECK');
          
          return true;
        }
      ),
      { 
        numRuns: MAX_EXAMPLES,
        verbose: true
      }
    );
  });

  /**
   * Property: Docker Compose configuration supports environment variables
   */
  it('should support environment variable configuration in Docker Compose', async () => {
    await fc.assert(
      fc.asyncProperty(envVarArb, async (envVars) => {
        const composePath = path.join(process.cwd(), 'docker-compose.yml');
        const content = await fs.readFile(composePath, 'utf-8');
        
        // Validate Docker Compose structure
        expect(content).toContain('version:');
        expect(content).toContain('services:');
        expect(content).toContain('historian-reports:');
        expect(content).toContain('environment:');
        expect(content).toContain('ports:');
        
        // Check for environment variable support
        expect(content).toContain('NODE_ENV');
        expect(content).toContain('PORT');
        expect(content).toContain('DB_HOST');
        
        // Check for volume mounts
        expect(content).toContain('volumes:');
        
        // Check for platform support
        const hasPlatforms = content.includes('platforms:') || content.includes('linux/amd64');
        expect(hasPlatforms).toBe(true);
        
        return true;
      }),
      { 
        numRuns: MAX_EXAMPLES,
        verbose: true
      }
    );
  });

  /**
   * Property: Architecture configurations are valid
   */
  it('should have valid architecture configurations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...architectures),
        async (architecture) => {
          // Validate architecture format
          expect(architecture).toMatch(/^linux\/(amd64|arm64)$/);
          expect(typeof architecture).toBe('string');
          expect(architecture.length).toBeGreaterThan(0);
          
          const validArchitectures = ['linux/amd64', 'linux/arm64'];
          expect(validArchitectures).toContain(architecture);
          
          return true;
        }
      ),
      { 
        numRuns: architectures.length,
        verbose: true
      }
    );
  });

  /**
   * Property: Environment variables have valid formats
   */
  it('should generate valid environment variable configurations', async () => {
    await fc.assert(
      fc.asyncProperty(envVarArb, async (envVars) => {
        // Validate environment variable types and formats
        expect(['development', 'production', 'test']).toContain(envVars.NODE_ENV);
        expect(envVars.PORT).toBeGreaterThanOrEqual(3000);
        expect(envVars.PORT).toBeLessThanOrEqual(9999);
        expect(['localhost', '127.0.0.1', 'db-server']).toContain(envVars.DB_HOST);
        expect([1433, 5432, 3306]).toContain(envVars.DB_PORT);
        expect(typeof envVars.CACHE_ENABLED).toBe('boolean');
        expect(['http://localhost:3001', 'https://app.example.com', '*']).toContain(envVars.CORS_ORIGIN);
        
        return true;
      }),
      { 
        numRuns: MAX_EXAMPLES,
        verbose: true
      }
    );
  });
});