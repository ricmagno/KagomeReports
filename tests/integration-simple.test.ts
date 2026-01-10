/**
 * Simplified Integration Tests
 * Tests essential workflows without complex mocking
 * Requirements: 1.1, 4.1, 7.2, 8.1, 9.1
 */

import { dataFlowService } from '@/services/dataFlowService';
import { schedulerService } from '@/services/schedulerService';
import { authService } from '@/services/authService';

describe('Integration Tests - Essential Workflows', () => {
  describe('Data Flow Configuration Validation', () => {
    test('should validate correct data flow configuration', () => {
      const validConfig = {
        reportConfig: {
          id: 'test-report',
          name: 'Valid Test Report',
          tags: ['TAG1', 'TAG2'],
          timeRange: {
            startTime: new Date('2023-01-01T00:00:00Z'),
            endTime: new Date('2023-01-01T23:59:59Z')
          },
          chartTypes: ['line'] as ('line' | 'bar' | 'trend' | 'scatter')[],
          template: 'default',
          format: 'pdf' as ('pdf' | 'docx')
        },
        includeStatistics: true,
        includeTrends: true,
        includeAnomalies: false
      };

      const validation = dataFlowService.validateDataFlowConfig(validConfig);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect invalid data flow configuration', () => {
      const invalidConfig = {
        reportConfig: {
          id: 'test-report',
          name: '', // Invalid: empty name
          tags: [], // Invalid: no tags
          timeRange: {
            startTime: new Date('2023-01-02T00:00:00Z'),
            endTime: new Date('2023-01-01T00:00:00Z') // Invalid: end before start
          },
          chartTypes: [] as ('line' | 'bar' | 'trend' | 'scatter')[],
          template: 'default',
          format: 'pdf' as ('pdf' | 'docx')
        }
      };

      const validation = dataFlowService.validateDataFlowConfig(invalidConfig);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors).toContain('Report name is required');
      expect(validation.errors).toContain('At least one tag is required');
      expect(validation.errors).toContain('Start time must be before end time');
      expect(validation.errors).toContain('At least one chart type is required');
    });

    test('should validate time range requirements', () => {
      const configWithInvalidTimeRange = {
        reportConfig: {
          id: 'test-report',
          name: 'Test Report',
          tags: ['TAG1'],
          timeRange: {
            startTime: new Date('2023-01-01T12:00:00Z'),
            endTime: new Date('2023-01-01T06:00:00Z') // End before start
          },
          chartTypes: ['line'] as ('line' | 'bar' | 'trend' | 'scatter')[],
          template: 'default',
          format: 'pdf' as ('pdf' | 'docx')
        }
      };

      const validation = dataFlowService.validateDataFlowConfig(configWithInvalidTimeRange);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Start time must be before end time');
    });
  });

  describe('Scheduler Service Integration', () => {
    let testScheduleId: string;

    afterEach(async () => {
      // Cleanup test schedule
      if (testScheduleId) {
        try {
          await schedulerService.deleteSchedule(testScheduleId);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    test('should create and retrieve schedule', async () => {
      const scheduleConfig = {
        name: 'Integration Test Schedule',
        description: 'Test schedule for integration testing',
        reportConfig: {
          id: 'sched-report-001',
          name: 'Scheduled Test Report',
          tags: ['SCHED_TAG_001'],
          timeRange: {
            startTime: new Date('2023-01-01T00:00:00Z'),
            endTime: new Date('2023-01-01T23:59:59Z')
          },
          chartTypes: ['line'] as ('line' | 'bar' | 'trend' | 'scatter')[],
          template: 'default',
          format: 'pdf' as ('pdf' | 'docx')
        },
        cronExpression: '0 0 * * *', // Daily at midnight
        enabled: true,
        recipients: ['test@example.com']
      };

      // Create schedule
      testScheduleId = await schedulerService.createSchedule(scheduleConfig);
      
      expect(testScheduleId).toBeDefined();
      expect(typeof testScheduleId).toBe('string');

      // Retrieve schedule
      const retrievedSchedule = await schedulerService.getSchedule(testScheduleId);
      
      expect(retrievedSchedule).toBeDefined();
      expect(retrievedSchedule?.name).toBe(scheduleConfig.name);
      expect(retrievedSchedule?.enabled).toBe(true);
      expect(retrievedSchedule?.cronExpression).toBe(scheduleConfig.cronExpression);
    });

    test('should update schedule configuration', async () => {
      const initialConfig = {
        name: 'Initial Schedule',
        description: 'Initial description',
        reportConfig: {
          id: 'update-test-001',
          name: 'Update Test Report',
          tags: ['UPDATE_TAG'],
          timeRange: {
            startTime: new Date('2023-01-01T00:00:00Z'),
            endTime: new Date('2023-01-01T23:59:59Z')
          },
          chartTypes: ['line'] as ('line' | 'bar' | 'trend' | 'scatter')[],
          template: 'default',
          format: 'pdf' as ('pdf' | 'docx')
        },
        cronExpression: '0 0 * * *',
        enabled: true
      };

      // Create schedule
      testScheduleId = await schedulerService.createSchedule(initialConfig);

      // Update schedule
      const updates = {
        name: 'Updated Schedule Name',
        enabled: false,
        recipients: ['updated@example.com']
      };

      await schedulerService.updateSchedule(testScheduleId, updates);

      // Verify updates
      const updatedSchedule = await schedulerService.getSchedule(testScheduleId);
      
      expect(updatedSchedule?.name).toBe(updates.name);
      expect(updatedSchedule?.enabled).toBe(false);
      expect(updatedSchedule?.recipients).toEqual(updates.recipients);
    });

    test('should get system health status', async () => {
      const health = await schedulerService.getSystemHealth();
      
      expect(health).toBeDefined();
      expect(health.status).toMatch(/^(healthy|warning|critical)$/);
      expect(typeof health.activeSchedules).toBe('number');
      expect(typeof health.runningExecutions).toBe('number');
      expect(typeof health.queueLength).toBe('number');
      expect(Array.isArray(health.issues)).toBe(true);
    });

    test('should get execution metrics', async () => {
      const metrics = await schedulerService.getExecutionMetrics();
      
      expect(metrics).toBeDefined();
      expect(typeof metrics.executionCount).toBe('number');
      expect(typeof metrics.successRate).toBe('number');
      expect(typeof metrics.averageDuration).toBe('number');
      expect(Array.isArray(metrics.recentFailures)).toBe(true);
    });
  });

  describe('Authentication Service Integration', () => {
    test('should authenticate with valid credentials', async () => {
      // Use the default admin user created during initialization
      const result = await authService.authenticate('admin', 'admin123');
      
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user?.username).toBe('admin');
    });

    test('should reject invalid credentials', async () => {
      const result = await authService.authenticate('admin', 'wrongpassword');
      
      expect(result.success).toBe(false);
      expect(result.token).toBeUndefined();
      expect(result.error).toBeDefined();
    });

    test('should verify valid JWT tokens', async () => {
      // First authenticate to get a token
      const authResult = await authService.authenticate('admin', 'admin123');
      expect(authResult.success).toBe(true);
      expect(authResult.token).toBeDefined();
      
      // Then verify the token
      const verification = await authService.verifyToken(authResult.token!);
      
      expect(verification.valid).toBe(true);
      expect(verification.user).toBeDefined();
      expect(verification.user?.username).toBe('admin');
    });

    test('should reject invalid JWT tokens', async () => {
      const verification = await authService.verifyToken('invalid-token');
      
      expect(verification.valid).toBe(false);
      expect(verification.error).toBeDefined();
    });

    test('should check user permissions', async () => {
      // First authenticate to get user ID
      const authResult = await authService.authenticate('admin', 'admin123');
      expect(authResult.success).toBe(true);
      expect(authResult.user?.id).toBeDefined();
      
      const userId = authResult.user!.id;
      
      // Check admin permissions
      const hasReportRead = await authService.hasPermission(userId, 'reports', 'read');
      const hasReportWrite = await authService.hasPermission(userId, 'reports', 'write');
      const hasSystemDelete = await authService.hasPermission(userId, 'system', 'delete');
      
      expect(hasReportRead).toBe(true);
      expect(hasReportWrite).toBe(true);
      expect(hasSystemDelete).toBe(true);
    });

    test('should get user permissions list', async () => {
      // First authenticate to get user ID
      const authResult = await authService.authenticate('admin', 'admin123');
      expect(authResult.success).toBe(true);
      
      const userId = authResult.user!.id;
      const permissions = await authService.getUserPermissions(userId);
      
      expect(Array.isArray(permissions)).toBe(true);
      expect(permissions.length).toBeGreaterThan(0);
      
      // Check that admin has expected permissions
      const reportReadPerm = permissions.find(p => p.resource === 'reports' && p.action === 'read');
      expect(reportReadPerm).toBeDefined();
      expect(reportReadPerm?.granted).toBe(true);
    });

    test('should handle logout', async () => {
      // First authenticate to get a token
      const authResult = await authService.authenticate('admin', 'admin123');
      expect(authResult.success).toBe(true);
      
      // Then logout
      const logoutResult = await authService.logout(authResult.token!);
      expect(logoutResult).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing required fields in data flow config', () => {
      const incompleteConfig = {
        reportConfig: {
          id: 'incomplete-test',
          name: 'Incomplete Test Report',
          tags: [], // Missing tags - this is the error we want to test
          timeRange: {
            startTime: new Date('2023-01-01T00:00:00Z'),
            endTime: new Date('2023-01-01T23:59:59Z')
          },
          chartTypes: [] as ('line' | 'bar' | 'trend' | 'scatter')[], // Missing chart types
          template: 'default',
          format: 'pdf' as ('pdf' | 'docx')
        }
      };

      const validation = dataFlowService.validateDataFlowConfig(incompleteConfig);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('At least one tag is required');
      expect(validation.errors).toContain('At least one chart type is required');
    });

    test('should handle invalid cron expressions in scheduler', async () => {
      const invalidScheduleConfig = {
        name: 'Invalid Cron Schedule',
        reportConfig: {
          id: 'invalid-cron-test',
          name: 'Invalid Cron Test Report',
          tags: ['CRON_TAG'],
          timeRange: {
            startTime: new Date('2023-01-01T00:00:00Z'),
            endTime: new Date('2023-01-01T23:59:59Z')
          },
          chartTypes: ['line'] as ('line' | 'bar' | 'trend' | 'scatter')[],
          template: 'default',
          format: 'pdf' as ('pdf' | 'docx')
        },
        cronExpression: 'invalid-cron-expression',
        enabled: true
      };

      await expect(schedulerService.createSchedule(invalidScheduleConfig))
        .rejects
        .toThrow('Invalid cron expression');
    });

    test('should handle non-existent schedule operations', async () => {
      const nonExistentId = 'non-existent-schedule-id';
      
      const schedule = await schedulerService.getSchedule(nonExistentId);
      expect(schedule).toBeNull();
      
      await expect(schedulerService.updateSchedule(nonExistentId, { name: 'Updated' }))
        .rejects
        .toThrow('Schedule not found');
    });

    test('should handle authentication with non-existent user', async () => {
      const result = await authService.authenticate('nonexistent@example.com', 'password');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.token).toBeUndefined();
    });
  });

  describe('System Integration Health Checks', () => {
    test('should validate all core services are initialized', () => {
      // Test that services can be imported and have expected methods
      expect(typeof dataFlowService.validateDataFlowConfig).toBe('function');
      expect(typeof dataFlowService.executeDataFlow).toBe('function');
      
      expect(typeof schedulerService.createSchedule).toBe('function');
      expect(typeof schedulerService.getSystemHealth).toBe('function');
      
      expect(typeof authService.authenticate).toBe('function');
      expect(typeof authService.verifyToken).toBe('function');
    });

    test('should validate configuration validation works across services', () => {
      // Test that validation methods return expected structure
      const dataFlowValidation = dataFlowService.validateDataFlowConfig({
        reportConfig: {
          id: 'test',
          name: 'Test',
          tags: ['TAG1'],
          timeRange: {
            startTime: new Date('2023-01-01T00:00:00Z'),
            endTime: new Date('2023-01-01T23:59:59Z')
          },
          chartTypes: ['line'] as ('line' | 'bar' | 'trend' | 'scatter')[],
          template: 'default',
          format: 'pdf' as ('pdf' | 'docx')
        }
      });
      
      expect(dataFlowValidation).toHaveProperty('valid');
      expect(dataFlowValidation).toHaveProperty('errors');
      expect(Array.isArray(dataFlowValidation.errors)).toBe(true);
    });
  });
});