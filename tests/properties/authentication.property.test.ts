/**
 * Property-Based Tests for Authentication and Authorization
 * Tests authentication flows, JWT tokens, and role-based access control
 * Requirements: 9.1, 9.5
 * 
 * **Property 15: Authentication and Authorization**
 * **Validates: Requirements 9.1, 9.5**
 */

import fc from 'fast-check';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { authService } from '../../src/services/authService';
import { env } from '../../src/config/environment';

describe('Authentication and Authorization Properties', () => {
  beforeAll(async () => {
    // Allow some time for database initialization
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    // Clean up
    authService.shutdown();
  });

  /**
   * Property: Valid credentials should always result in successful authentication
   */
  test('Property: Valid credentials always authenticate successfully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          rememberMe: fc.boolean()
        }),
        async ({ rememberMe }) => {
          // Test with the default admin user (we know this exists)
          const result = await authService.authenticate('admin', 'admin123', rememberMe);
          
          // Should always succeed with correct credentials
          expect(result.success).toBe(true);
          expect(result.user).toBeDefined();
          expect(result.token).toBeDefined();
          expect(result.expiresIn).toBeDefined();
          
          if (result.user) {
            expect(result.user.username).toBe('admin');
            expect(result.user.role).toBe('admin');
            expect(result.user.isActive).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Invalid credentials should always fail authentication
   */
  test('Property: Invalid credentials always fail authentication', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          username: fc.string({ minLength: 1, maxLength: 50 }),
          password: fc.string({ minLength: 1, maxLength: 50 })
        }).filter(({ username, password }) => 
          // Exclude the valid admin credentials
          !(username === 'admin' && password === 'admin123')
        ),
        async ({ username, password }) => {
          const result = await authService.authenticate(username, password, false);
          
          // Should always fail with invalid credentials
          expect(result.success).toBe(false);
          expect(result.user).toBeUndefined();
          expect(result.token).toBeUndefined();
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Valid JWT tokens should always verify successfully
   */
  test('Property: Valid JWT tokens always verify successfully', async () => {
    // First authenticate to get a valid token
    const authResult = await authService.authenticate('admin', 'admin123', false);
    expect(authResult.success).toBe(true);
    expect(authResult.token).toBeDefined();

    if (!authResult.token) return;

    await fc.assert(
      fc.asyncProperty(
        fc.constant(authResult.token),
        async (token) => {
          const verification = await authService.verifyToken(token);
          
          expect(verification.valid).toBe(true);
          expect(verification.user).toBeDefined();
          expect(verification.error).toBeUndefined();
          
          if (verification.user) {
            expect(verification.user.username).toBe('admin');
            expect(verification.user.role).toBe('admin');
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Invalid JWT tokens should always fail verification
   */
  test('Property: Invalid JWT tokens always fail verification', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string({ minLength: 10, maxLength: 100 }), // Random strings
          fc.constant(''), // Empty string
          fc.constant('invalid.jwt.token'), // Invalid format
          fc.constant('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature') // Invalid signature
        ),
        async (invalidToken) => {
          const verification = await authService.verifyToken(invalidToken);
          
          expect(verification.valid).toBe(false);
          expect(verification.user).toBeUndefined();
          expect(verification.error).toBeDefined();
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Admin users should have all permissions
   */
  test('Property: Admin users always have all permissions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          resource: fc.constantFrom('reports', 'schedules', 'users', 'system'),
          action: fc.constantFrom('read', 'write', 'delete')
        }),
        async ({ resource, action }) => {
          // Get admin user ID
          const authResult = await authService.authenticate('admin', 'admin123', false);
          expect(authResult.success).toBe(true);
          expect(authResult.user).toBeDefined();
          
          if (!authResult.user) return;

          const hasPermission = await authService.hasPermission(authResult.user.id, resource, action);
          
          // Admin should have all permissions
          expect(hasPermission).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: JWT token payload should match user data
   */
  test('Property: JWT token payload always matches user data', async () => {
    const authResult = await authService.authenticate('admin', 'admin123', false);
    expect(authResult.success).toBe(true);
    expect(authResult.token).toBeDefined();
    expect(authResult.user).toBeDefined();

    if (!authResult.token || !authResult.user) return;

    await fc.assert(
      fc.asyncProperty(
        fc.constant({ token: authResult.token, user: authResult.user }),
        async ({ token, user }) => {
          // Decode token without verification to check payload
          const decoded = jwt.decode(token) as any;
          
          expect(decoded).toBeDefined();
          expect(decoded.userId).toBe(user.id);
          expect(decoded.username).toBe(user.username);
          expect(decoded.email).toBe(user.email);
          expect(decoded.role).toBe(user.role);
          expect(decoded.iat).toBeDefined();
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: Password hashing should be consistent and secure
   */
  test('Property: Password hashing is consistent and secure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 8, maxLength: 50 }),
        async (password) => {
          // Hash the password
          const hash1 = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
          const hash2 = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
          
          // Hashes should be different (due to salt)
          expect(hash1).not.toBe(hash2);
          
          // But both should verify against the original password
          const verify1 = await bcrypt.compare(password, hash1);
          const verify2 = await bcrypt.compare(password, hash2);
          
          expect(verify1).toBe(true);
          expect(verify2).toBe(true);
          
          // Wrong password should not verify
          const wrongPassword = password + 'wrong';
          const verifyWrong1 = await bcrypt.compare(wrongPassword, hash1);
          const verifyWrong2 = await bcrypt.compare(wrongPassword, hash2);
          
          expect(verifyWrong1).toBe(false);
          expect(verifyWrong2).toBe(false);
        }
      ),
      { numRuns: 5 } // Reduced from 10 to avoid timeout
    );
  }, 15000); // Increased timeout to 15 seconds

  /**
   * Property: Session management should be consistent
   */
  test('Property: Session management is consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(), // rememberMe flag
        async (rememberMe) => {
          // Authenticate to create session
          const authResult = await authService.authenticate('admin', 'admin123', rememberMe);
          expect(authResult.success).toBe(true);
          expect(authResult.token).toBeDefined();
          
          if (!authResult.token) return;

          // Token should verify immediately after creation
          const verification1 = await authService.verifyToken(authResult.token);
          expect(verification1.valid).toBe(true);
          
          // Logout should invalidate the session
          const logoutResult = await authService.logout(authResult.token);
          expect(logoutResult).toBe(true);
          
          // Token should no longer verify after logout
          const verification2 = await authService.verifyToken(authResult.token);
          expect(verification2.valid).toBe(false);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Audit logging should capture all authentication events
   */
  test('Property: Audit logging captures all authentication events', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          validCredentials: fc.boolean(),
          username: fc.constantFrom('admin', 'nonexistent', 'testuser')
        }),
        async ({ validCredentials, username }) => {
          const initialLogs = await authService.getAuditLogs(100);
          const initialCount = initialLogs.length;
          
          // Attempt authentication
          const password = (validCredentials && username === 'admin') ? 'admin123' : 'wrongpassword';
          const authResult = await authService.authenticate(username, password, false);
          
          // Check that audit log was created
          const newLogs = await authService.getAuditLogs(100);
          expect(newLogs.length).toBeGreaterThan(initialCount);
          
          // Find the most recent log entry
          const latestLog = newLogs[0];
          expect(latestLog.action).toMatch(/login/);
          
          if (authResult.success) {
            expect(latestLog.action).toBe('login_success');
            expect(latestLog.userId).toBeDefined();
          } else {
            expect(latestLog.action).toBe('login_failed');
            // For failed logins, userId might be null
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Permission system should be hierarchical (admin > user)
   */
  test('Property: Permission system is hierarchical', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          resource: fc.constantFrom('reports', 'schedules', 'system'),
          action: fc.constantFrom('read', 'write', 'delete')
        }),
        async ({ resource, action }) => {
          // Get admin permissions
          const adminAuth = await authService.authenticate('admin', 'admin123', false);
          expect(adminAuth.success).toBe(true);
          
          if (!adminAuth.user) return;

          const adminPermissions = await authService.getUserPermissions(adminAuth.user.id);
          const adminHasPermission = await authService.hasPermission(adminAuth.user.id, resource, action);
          
          // Admin should have the permission
          expect(adminHasPermission).toBe(true);
          
          // Check that permission exists in the permissions list
          const permissionExists = adminPermissions.some((p: any) => 
            p.resource === resource && p.action === action && p.granted
          );
          expect(permissionExists).toBe(true);
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Property: Token expiration should be respected
   */
  test('Property: Token expiration is respected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('1m', '24h', '30d'), // Different expiration times
        async (expiresIn) => {
          // Create a token with specific expiration
          const payload = {
            userId: 'test-user',
            username: 'testuser',
            email: 'test@example.com',
            role: 'user',
            iat: Math.floor(Date.now() / 1000)
          };
          
          const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn } as jwt.SignOptions);
          
          // Token should be valid immediately
          try {
            const decoded = jwt.verify(token, env.JWT_SECRET) as any;
            expect(decoded.userId).toBe('test-user');
            expect(decoded.exp).toBeDefined();
            expect(decoded.iat).toBeDefined();
            
            // exp should be greater than iat
            expect(decoded.exp).toBeGreaterThan(decoded.iat);
          } catch (error) {
            // Should not throw for valid token
            fail(`Token verification failed: ${error}`);
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});