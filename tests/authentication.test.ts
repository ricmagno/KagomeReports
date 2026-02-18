/**
 * Authentication and Authorization Tests
 * Tests authentication flows, JWT tokens, and role-based access control
 * Requirements: 9.1, 9.5
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { authService } from '../src/services/authService';
import { userManagementService } from '../src/services/userManagementService';
import { env } from '../src/config/environment';

describe('Authentication and Authorization', () => {
  beforeAll(async () => {
    // Wait for database initialization
    await authService.waitForInitialization();
    // Seed users
    await userManagementService.seedInitialUsers();
  });

  afterAll(async () => {
    // Clean up
    authService.shutdown();
  });

  describe('User Authentication', () => {
    test('should authenticate valid admin credentials', async () => {
      const result = await authService.authenticate('admin', 'admin123', false);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.expiresIn).toBeDefined();

      if (result.user) {
        expect(result.user.username).toBe('admin');
        expect(result.user.role).toBe('admin');
        expect(result.user.isActive).toBe(true);
      }
    });

    test('should reject invalid credentials', async () => {
      const result = await authService.authenticate('admin', 'wrongpassword', false);

      expect(result.success).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.token).toBeUndefined();
      expect(result.error).toBeDefined();
    });

    test('should reject non-existent user', async () => {
      const result = await authService.authenticate('nonexistent', 'password', false);

      expect(result.success).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.token).toBeUndefined();
      expect(result.error).toBeDefined();
    });

    test('should authenticate admin with case-insensitive username', async () => {
      const result = await authService.authenticate('ADMIN', 'admin123', false);

      expect(result.success).toBe(true);
      if (result.user) {
        expect(result.user.username.toLowerCase()).toBe('admin');
      }
    });

    test('should authenticate Maintenance user', async () => {
      // Allow time for seeding to have completed
      const result = await authService.authenticate('Maintenance', 'maintenance', false);

      expect(result.success).toBe(true);
      if (result.user) {
        expect(result.user.username).toBe('Maintenance');
      }
    });
  });

  describe('JWT Token Management', () => {
    test('should verify valid JWT tokens', async () => {
      // First authenticate to get a valid token
      const authResult = await authService.authenticate('admin', 'admin123', false);
      expect(authResult.success).toBe(true);
      expect(authResult.token).toBeDefined();

      if (!authResult.token) return;

      const verification = await authService.verifyToken(authResult.token);

      expect(verification.valid).toBe(true);
      expect(verification.user).toBeDefined();
      expect(verification.error).toBeUndefined();

      if (verification.user) {
        expect(verification.user.username).toBe('admin');
        expect(verification.user.role).toBe('admin');
      }
    });

    test('should reject invalid JWT tokens', async () => {
      const invalidTokens = [
        'invalid.jwt.token',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        '',
        'random-string'
      ];

      for (const invalidToken of invalidTokens) {
        const verification = await authService.verifyToken(invalidToken);

        expect(verification.valid).toBe(false);
        expect(verification.user).toBeUndefined();
        expect(verification.error).toBeDefined();
      }
    });

    test('should have matching JWT payload and user data', async () => {
      const authResult = await authService.authenticate('admin', 'admin123', false);
      expect(authResult.success).toBe(true);
      expect(authResult.token).toBeDefined();
      expect(authResult.user).toBeDefined();

      if (!authResult.token || !authResult.user) return;

      // Decode token without verification to check payload
      const decoded = jwt.decode(authResult.token) as any;

      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(authResult.user.id);
      expect(decoded.username).toBe(authResult.user.username);
      expect(decoded.email).toBe(authResult.user.email);
      expect(decoded.role).toBe(authResult.user.role);
      expect(decoded.iat).toBeDefined();
    });
  });

  describe('Password Security', () => {
    test('should hash passwords consistently and securely', async () => {
      const password = 'testpassword123';

      // Hash the password twice
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
    });
  });

  describe('Session Management', () => {
    test('should manage sessions consistently', async () => {
      // Authenticate to create session
      const authResult = await authService.authenticate('admin', 'admin123', false);
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
    });
  });

  describe('Role-Based Permissions', () => {
    test('should grant admin users all permissions', async () => {
      const authResult = await authService.authenticate('admin', 'admin123', false);
      expect(authResult.success).toBe(true);
      expect(authResult.user).toBeDefined();

      if (!authResult.user) return;

      const resources = ['reports', 'schedules', 'users', 'system'];
      const actions = ['read', 'write', 'delete'];

      for (const resource of resources) {
        for (const action of actions) {
          const hasPermission = await authService.hasPermission(authResult.user.id, resource, action);
          expect(hasPermission).toBe(true);
        }
      }
    });

    test('should return structured permissions for admin', async () => {
      const authResult = await authService.authenticate('admin', 'admin123', false);
      expect(authResult.success).toBe(true);
      expect(authResult.user).toBeDefined();

      if (!authResult.user) return;

      const permissions = await authService.getUserPermissions(authResult.user.id);
      expect(permissions).toBeDefined();
      expect(Array.isArray(permissions)).toBe(true);
      expect(permissions.length).toBeGreaterThan(0);

      // Check that admin has read permission on reports
      const reportsReadPermission = permissions.find(p =>
        p.resource === 'reports' && p.action === 'read' && p.granted
      );
      expect(reportsReadPermission).toBeDefined();
    });
  });

  describe('Audit Logging', () => {
    test('should log authentication events', async () => {
      const initialLogs = await authService.getAuditLogs(10);
      const initialCount = initialLogs.length;

      // Attempt successful authentication
      const authResult = await authService.authenticate('admin', 'admin123', false);
      expect(authResult.success).toBe(true);

      // Check that audit log was created
      const newLogs = await authService.getAuditLogs(10);
      expect(newLogs.length).toBeGreaterThanOrEqual(initialCount);

      // Find a login success log
      const loginSuccessLog = newLogs.find(log => log.action === 'login_success');
      expect(loginSuccessLog).toBeDefined();

      if (loginSuccessLog) {
        expect(loginSuccessLog.userId).toBeDefined();
        expect(loginSuccessLog.timestamp).toBeDefined();
      }
    });

    test('should log failed authentication attempts', async () => {
      const initialLogs = await authService.getAuditLogs(10);
      const initialCount = initialLogs.length;

      // Attempt failed authentication
      const authResult = await authService.authenticate('admin', 'wrongpassword', false);
      expect(authResult.success).toBe(false);

      // Check that audit log was created
      const newLogs = await authService.getAuditLogs(10);
      expect(newLogs.length).toBeGreaterThanOrEqual(initialCount);

      // Find a login failed log
      const loginFailedLog = newLogs.find(log => log.action === 'login_failed');
      expect(loginFailedLog).toBeDefined();

      if (loginFailedLog) {
        expect(loginFailedLog.timestamp).toBeDefined();
      }
    });
  });

  describe('Token Expiration', () => {
    test('should respect token expiration settings', async () => {
      const expirationTimes = ['1m', '24h', '30d'];

      for (const expiresIn of expirationTimes) {
        const payload = {
          userId: 'test-user',
          username: 'testuser',
          email: 'test@example.com',
          role: 'user',
          iat: Math.floor(Date.now() / 1000)
        };

        const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn } as jwt.SignOptions);

        // Token should be valid immediately
        const decoded = jwt.verify(token, env.JWT_SECRET) as any;
        expect(decoded.userId).toBe('test-user');
        expect(decoded.exp).toBeDefined();
        expect(decoded.iat).toBeDefined();

        // exp should be greater than iat
        expect(decoded.exp).toBeGreaterThan(decoded.iat);
      }
    });
  });
});