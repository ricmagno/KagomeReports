/**
 * Property-Based Tests for Audit Logging
 * Tests audit logging completeness, encryption, and data integrity
 * Requirements: 9.4, 7.5
 * 
 * **Property 16: Audit Logging Completeness**
 * **Validates: Requirements 9.4, 7.5**
 */

import fc from 'fast-check';
import { authService } from '../../src/services/authService';

describe('Audit Logging Properties', () => {
  beforeAll(async () => {
    // Allow time for services to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, 15000); // 15 second timeout

  afterAll(async () => {
    // Clean up
    try {
      authService.shutdown();
    } catch (error) {
      // Ignore cleanup errors
    }
  }, 10000); // 10 second timeout

  /**
   * Property: All audit events should be logged with complete information
   */
  test('Property: Audit event completeness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 50 }),
          action: fc.constantFrom('login', 'logout', 'create', 'update', 'delete', 'read'),
          resource: fc.constantFrom('user', 'report', 'schedule', 'system', 'auth'),
          details: fc.string({ minLength: 1, maxLength: 200 }),
          ipAddress: fc.ipV4(),
          userAgent: fc.string({ minLength: 10, maxLength: 100 })
        }),
        async ({ userId, action, resource, details, ipAddress, userAgent }) => {
          // Create a unique identifier for this test
          const testId = `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          const uniqueUserId = `${userId}-${testId}`;
          const uniqueDetails = `${details}-${testId}`;
          
          // Log audit event
          await authService.logAuditEvent(
            uniqueUserId,
            action,
            resource,
            uniqueDetails,
            ipAddress,
            userAgent
          );
          
          // Retrieve audit logs for this specific user
          const logs = await authService.getAuditLogs(50, 0, uniqueUserId);
          expect(logs.length).toBeGreaterThan(0);
          
          // Find our specific log by details (should be the most recent one for this user)
          const latestLog = logs.find(log => log.details === uniqueDetails);
          expect(latestLog).toBeDefined();
          
          // Verify all required fields are present and correct
          expect(latestLog!.userId).toBe(uniqueUserId);
          expect(latestLog!.action).toBe(action);
          expect(latestLog!.resource).toBe(resource);
          expect(latestLog!.details).toBe(uniqueDetails);
          expect(latestLog!.ipAddress).toBe(ipAddress);
          expect(latestLog!.userAgent).toBe(userAgent);
          
          // Verify log has required metadata
          expect(latestLog!.id).toBeDefined();
          expect(latestLog!.timestamp).toBeDefined();
          expect(latestLog!.timestamp).toBeInstanceOf(Date);
          
          // Verify timestamp is reasonable (not in the future)
          const logTime = new Date(latestLog!.timestamp);
          const now = new Date();
          expect(logTime.getTime()).toBeLessThanOrEqual(now.getTime());
        }
      ),
      { numRuns: 5 }
    );
  }, 30000); // 30 second timeout

  /**
   * Property: Audit logs should be retrievable with filtering
   */
  test('Property: Audit log filtering consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 50 }),
          action: fc.constantFrom('login', 'logout', 'create', 'update', 'delete'),
          resource: fc.constantFrom('user', 'report', 'schedule', 'system'),
          details: fc.string({ minLength: 1, maxLength: 100 })
        }),
        async ({ userId, action, resource, details }) => {
          // Log multiple audit events
          await authService.logAuditEvent(userId, action, resource, details);
          await authService.logAuditEvent(userId, 'read', resource, 'different details');
          await authService.logAuditEvent('different-user', action, resource, details);
          
          // Test filtering by userId
          const userLogs = await authService.getAuditLogs(10, 0, userId);
          userLogs.forEach(log => {
            expect(log.userId).toBe(userId);
          });
          
          // Test filtering by action
          const actionLogs = await authService.getAuditLogs(10, 0, undefined, action);
          actionLogs.forEach(log => {
            expect(log.action).toBe(action);
          });
          
          // Verify logs are ordered by timestamp (most recent first)
          const allLogs = await authService.getAuditLogs(10);
          for (let i = 1; i < allLogs.length; i++) {
            const prevTime = new Date(allLogs[i - 1].timestamp).getTime();
            const currTime = new Date(allLogs[i].timestamp).getTime();
            expect(prevTime).toBeGreaterThanOrEqual(currTime);
          }
        }
      ),
      { numRuns: 3 }
    );
  }, 45000); // 45 second timeout

  /**
   * Property: Audit logs should handle null user IDs for system events
   */
  test('Property: System audit events with null user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          action: fc.constantFrom('system_start', 'system_stop', 'backup', 'maintenance'),
          resource: fc.constantFrom('system', 'database', 'scheduler'),
          details: fc.string({ minLength: 1, maxLength: 100 }),
          ipAddress: fc.constantFrom('127.0.0.1', '::1', 'localhost')
        }),
        async ({ action, resource, details, ipAddress }) => {
          // Create a unique identifier for this test
          const testId = `system-test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          const uniqueDetails = `${details}-${testId}`;
          
          // Log system event with null user ID
          await authService.logAuditEvent(
            null, // System events have no user
            action,
            resource,
            uniqueDetails,
            ipAddress
          );
          
          // Retrieve all audit logs and find our specific one
          const logs = await authService.getAuditLogs(50, 0, undefined);
          expect(logs.length).toBeGreaterThan(0);
          
          // Find our specific log by details
          const latestLog = logs.find(log => log.details === uniqueDetails && log.userId === null);
          expect(latestLog).toBeDefined();
          
          // Verify system event is logged correctly
          expect(latestLog!.userId).toBeNull();
          expect(latestLog!.action).toBe(action);
          expect(latestLog!.resource).toBe(resource);
          expect(latestLog!.details).toBe(uniqueDetails);
          expect(latestLog!.ipAddress).toBe(ipAddress);
          
          // System events should still have timestamps and IDs
          expect(latestLog!.id).toBeDefined();
          expect(latestLog!.timestamp).toBeDefined();
        }
      ),
      { numRuns: 3 }
    );
  }, 30000); // 30 second timeout

  /**
   * Property: Audit log pagination should work consistently
   */
  test('Property: Audit log pagination consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        async (numEvents) => {
          // Log multiple events
          const testUserId = `test-user-${Date.now()}`;
          for (let i = 0; i < numEvents; i++) {
            await authService.logAuditEvent(
              testUserId,
              'test_action',
              'test_resource',
              `Test event ${i}`,
              '127.0.0.1'
            );
          }
          
          // Test pagination
          const pageSize = 2;
          const firstPage = await authService.getAuditLogs(pageSize, 0, testUserId);
          const secondPage = await authService.getAuditLogs(pageSize, pageSize, testUserId);
          
          // Verify page sizes
          expect(firstPage.length).toBeLessThanOrEqual(pageSize);
          expect(secondPage.length).toBeLessThanOrEqual(pageSize);
          
          // Verify no overlap between pages
          const firstPageIds = new Set(firstPage.map(log => log.id));
          const secondPageIds = new Set(secondPage.map(log => log.id));
          
          firstPageIds.forEach(id => {
            expect(secondPageIds.has(id)).toBe(false);
          });
          
          // Verify all logs belong to the test user
          [...firstPage, ...secondPage].forEach(log => {
            expect(log.userId).toBe(testUserId);
          });
        }
      ),
      { numRuns: 3 }
    );
  }, 45000); // 45 second timeout

  /**
   * Property: Audit logs should preserve data integrity over time
   */
  test('Property: Audit log data integrity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 50 }),
          action: fc.constantFrom('create', 'update', 'delete'),
          resource: fc.constantFrom('report', 'schedule', 'user'),
          details: fc.string({ minLength: 1, maxLength: 200 }),
          ipAddress: fc.ipV4()
        }),
        async ({ userId, action, resource, details, ipAddress }) => {
          // Log audit event
          await authService.logAuditEvent(userId, action, resource, details, ipAddress);
          
          // Retrieve immediately
          const immediateLogs = await authService.getAuditLogs(1);
          expect(immediateLogs.length).toBeGreaterThan(0);
          
          const immediateLog = immediateLogs[0];
          
          // Wait a short time and retrieve again
          await new Promise(resolve => setTimeout(resolve, 100));
          const delayedLogs = await authService.getAuditLogs(1);
          expect(delayedLogs.length).toBeGreaterThan(0);
          
          const delayedLog = delayedLogs[0];
          
          // Verify data integrity is maintained
          expect(delayedLog.id).toBe(immediateLog.id);
          expect(delayedLog.userId).toBe(immediateLog.userId);
          expect(delayedLog.action).toBe(immediateLog.action);
          expect(delayedLog.resource).toBe(immediateLog.resource);
          expect(delayedLog.details).toBe(immediateLog.details);
          expect(delayedLog.ipAddress).toBe(immediateLog.ipAddress);
          expect(delayedLog.timestamp).toEqual(immediateLog.timestamp);
        }
      ),
      { numRuns: 3 }
    );
  }, 30000); // 30 second timeout

  /**
   * Property: Audit logs should handle edge cases gracefully
   */
  test('Property: Audit log edge case handling', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.oneof(
            fc.string({ minLength: 1, maxLength: 50 }),
            fc.constant(null)
          ),
          action: fc.string({ minLength: 1, maxLength: 50 }),
          resource: fc.string({ minLength: 1, maxLength: 50 }),
          details: fc.oneof(
            fc.string({ minLength: 0, maxLength: 1000 }), // Including empty strings
            fc.constant('')
          ),
          ipAddress: fc.oneof(
            fc.ipV4(),
            fc.ipV6(),
            fc.constant(null)
          ),
          userAgent: fc.oneof(
            fc.string({ minLength: 1, maxLength: 200 }),
            fc.constant(null)
          )
        }),
        async ({ userId, action, resource, details, ipAddress, userAgent }) => {
          // Create a unique identifier for this test
          const testId = `edge-test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          const uniqueUserId = userId ? `${userId}-${testId}` : null;
          const uniqueDetails = `${details}-${testId}`;
          
          // Log audit event with edge case data
          await authService.logAuditEvent(
            uniqueUserId,
            action,
            resource,
            uniqueDetails,
            ipAddress || undefined,
            userAgent || undefined
          );
          
          // Retrieve audit logs for this specific user or all logs if user is null
          const logs = await authService.getAuditLogs(10, 0, uniqueUserId || undefined);
          expect(logs.length).toBeGreaterThan(0);
          
          // Find our specific log by details
          const latestLog = logs.find(log => log.details === uniqueDetails);
          expect(latestLog).toBeDefined();
          
          // Verify edge case data is handled correctly
          expect(latestLog!.userId).toBe(uniqueUserId);
          expect(latestLog!.action).toBe(action);
          expect(latestLog!.resource).toBe(resource);
          expect(latestLog!.details).toBe(uniqueDetails);
          
          // IP address and user agent can be null
          if (ipAddress) {
            expect(latestLog!.ipAddress).toBe(ipAddress);
          }
          if (userAgent) {
            expect(latestLog!.userAgent).toBe(userAgent);
          }
          
          // Required fields should always be present
          expect(latestLog!.id).toBeDefined();
          expect(latestLog!.timestamp).toBeDefined();
        }
      ),
      { numRuns: 3 }
    );
  }, 30000); // 30 second timeout
});