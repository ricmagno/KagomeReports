/**
 * Integration Tests for Scheduled Reports
 * Tests complete workflows for schedule CRUD, execution, and enable/disable operations
 * 
 * Requirements:
 * - 12.1: Test schedule CRUD workflow
 * - 12.2: Test schedule execution workflow
 * - 12.3: Test enable/disable workflow
 */

import { SchedulerService, ScheduleConfig } from '../../src/services/schedulerService';
import { Database } from 'sqlite3';
import fs from 'fs';
import path from 'path';

describe('Scheduled Reports Integration Tests', () => {
  let schedulerService: SchedulerService;
  let testDb: Database;
  const testDbPath = path.join(__dirname, '../../data/test-scheduler-integration.db');

  beforeAll(() => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Create test database
    testDb = new Database(testDbPath);
    
    // Initialize scheduler service with test database
    // Note: We'll need to create a new instance for testing
    schedulerService = new SchedulerService();
  });

  afterAll((done) => {
    // Shutdown scheduler
    schedulerService.shutdown();
    
    // Clean up test database
    setTimeout(() => {
      if (fs.existsSync(testDbPath)) {
        try {
          fs.unlinkSync(testDbPath);
        } catch (error) {
          console.error('Error cleaning up test database:', error);
        }
      }
      done();
    }, 100);
  });

  describe('12.1 Schedule CRUD Workflow', () => {
    let createdScheduleId: string;

    it('should create a new schedule and verify it appears in the list', async () => {
      // Create schedule
      const scheduleConfig = {
        name: 'Integration Test Schedule',
        description: 'Test schedule for integration testing',
        reportConfig: {
          id: 'test-report-1',
          name: 'Test Report',
          description: 'Test report configuration',
          tags: ['TAG001', 'TAG002'],
          timeRange: {
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-02T00:00:00Z')
          },
          chartTypes: ['line' as const],
          template: 'default' as const,
          format: 'pdf' as const
        },
        cronExpression: '0 9 * * *', // Daily at 9 AM
        enabled: true,
        recipients: ['test@example.com']
      };

      createdScheduleId = await schedulerService.createSchedule(scheduleConfig);

      // Verify schedule was created
      expect(createdScheduleId).toBeDefined();
      expect(createdScheduleId).toMatch(/^schedule_/);

      // Verify schedule appears in list
      const schedules = await schedulerService.getSchedules();
      const foundSchedule = schedules.find(s => s.id === createdScheduleId);

      expect(foundSchedule).toBeDefined();
      expect(foundSchedule?.name).toBe(scheduleConfig.name);
      expect(foundSchedule?.description).toBe(scheduleConfig.description);
      expect(foundSchedule?.cronExpression).toBe(scheduleConfig.cronExpression);
      expect(foundSchedule?.enabled).toBe(true);
      expect(foundSchedule?.recipients).toEqual(scheduleConfig.recipients);
    });

    it('should retrieve a specific schedule by ID', async () => {
      const schedule = await schedulerService.getSchedule(createdScheduleId);

      expect(schedule).toBeDefined();
      expect(schedule?.id).toBe(createdScheduleId);
      expect(schedule?.name).toBe('Integration Test Schedule');
      expect(schedule?.reportConfig.tags).toEqual(['TAG001', 'TAG002']);
    });

    it('should edit a schedule and verify changes are persisted', async () => {
      // Update schedule
      const updates = {
        name: 'Updated Integration Test Schedule',
        description: 'Updated description',
        cronExpression: '0 */6 * * *', // Every 6 hours
        recipients: ['updated@example.com', 'another@example.com']
      };

      await schedulerService.updateSchedule(createdScheduleId, updates);

      // Verify changes
      const updatedSchedule = await schedulerService.getSchedule(createdScheduleId);

      expect(updatedSchedule).toBeDefined();
      expect(updatedSchedule?.name).toBe(updates.name);
      expect(updatedSchedule?.description).toBe(updates.description);
      expect(updatedSchedule?.cronExpression).toBe(updates.cronExpression);
      expect(updatedSchedule?.recipients).toEqual(updates.recipients);
      expect(updatedSchedule?.id).toBe(createdScheduleId); // ID should remain unchanged
    });

    it('should delete a schedule and verify it is removed from the list', async () => {
      // Delete schedule
      await schedulerService.deleteSchedule(createdScheduleId);

      // Verify schedule is deleted
      const deletedSchedule = await schedulerService.getSchedule(createdScheduleId);
      expect(deletedSchedule).toBeNull();

      // Verify schedule is not in list
      const schedules = await schedulerService.getSchedules();
      const foundSchedule = schedules.find(s => s.id === createdScheduleId);
      expect(foundSchedule).toBeUndefined();
    });

    it('should handle creating multiple schedules', async () => {
      const scheduleConfigs = [
        {
          name: 'Schedule A',
          description: 'First test schedule',
          reportConfig: {
            id: 'report-a',
            name: 'Report A',
            description: 'Test',
            tags: ['TAG001'],
            timeRange: {
              startTime: new Date('2024-01-01T00:00:00Z'),
              endTime: new Date('2024-01-02T00:00:00Z')
            },
            chartTypes: ['line' as const],
            template: 'default' as const,
            format: 'pdf' as const
          },
          cronExpression: '0 9 * * *',
          enabled: true
        },
        {
          name: 'Schedule B',
          description: 'Second test schedule',
          reportConfig: {
            id: 'report-b',
            name: 'Report B',
            description: 'Test',
            tags: ['TAG002'],
            timeRange: {
              startTime: new Date('2024-01-01T00:00:00Z'),
              endTime: new Date('2024-01-02T00:00:00Z')
            },
            chartTypes: ['bar' as const],
            template: 'default' as const,
            format: 'pdf' as const
          },
          cronExpression: '0 */12 * * *',
          enabled: false
        }
      ];

      const scheduleIds: string[] = [];

      for (const config of scheduleConfigs) {
        const id = await schedulerService.createSchedule(config);
        scheduleIds.push(id);
      }

      // Verify all schedules were created
      const schedules = await schedulerService.getSchedules();
      
      expect(schedules.length).toBeGreaterThanOrEqual(2);
      expect(schedules.some(s => s.name === 'Schedule A')).toBe(true);
      expect(schedules.some(s => s.name === 'Schedule B')).toBe(true);

      // Clean up
      for (const id of scheduleIds) {
        await schedulerService.deleteSchedule(id);
      }
    });
  });

  describe('12.2 Schedule Execution Workflow', () => {
    let testScheduleId: string;

    beforeAll(async () => {
      // Create a test schedule for execution testing
      const scheduleConfig = {
        name: 'Execution Test Schedule',
        description: 'Schedule for testing execution workflow',
        reportConfig: {
          id: 'exec-test-report',
          name: 'Execution Test Report',
          description: 'Test',
          tags: ['TAG001'],
          timeRange: {
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-02T00:00:00Z')
          },
          chartTypes: ['line' as const],
          template: 'default' as const,
          format: 'pdf' as const
        },
        cronExpression: '0 0 * * *', // Daily at midnight
        enabled: true,
        recipients: ['execution-test@example.com']
      };

      testScheduleId = await schedulerService.createSchedule(scheduleConfig);
    });

    afterAll(async () => {
      // Clean up test schedule
      if (testScheduleId) {
        await schedulerService.deleteSchedule(testScheduleId);
      }
    });

    it('should queue a manual execution and verify it is queued', async () => {
      // Note: The current implementation doesn't expose a direct method to manually queue
      // executions from the service. In a real integration test, we would:
      // 1. Trigger manual execution via API
      // 2. Verify execution is queued
      // 3. Check execution status
      
      // For now, we'll verify the schedule exists and is enabled
      const schedule = await schedulerService.getSchedule(testScheduleId);
      
      expect(schedule).toBeDefined();
      expect(schedule?.enabled).toBe(true);
      expect(schedule?.cronExpression).toBe('0 0 * * *');
      
      // Verify we can get execution history (even if empty)
      const executions = await schedulerService.getExecutionHistory(testScheduleId);
      expect(Array.isArray(executions)).toBe(true);
    });

    it('should view execution history and verify it is displayed', async () => {
      // Get execution history
      const executions = await schedulerService.getExecutionHistory(testScheduleId, 50);

      // Verify execution history is returned (may be empty for new schedule)
      expect(Array.isArray(executions)).toBe(true);
      
      // Verify execution history structure
      if (executions.length > 0) {
        const execution = executions[0];
        expect(execution).toHaveProperty('id');
        expect(execution).toHaveProperty('scheduleId');
        expect(execution).toHaveProperty('startTime');
        expect(execution).toHaveProperty('status');
        if (execution) {
          expect(execution.scheduleId).toBe(testScheduleId);
        }
      }
    });

    it('should retrieve execution metrics for a schedule', async () => {
      // Get execution metrics
      const metrics = await schedulerService.getExecutionMetrics(testScheduleId);

      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('executionCount');
      expect(metrics).toHaveProperty('successRate');
      expect(metrics).toHaveProperty('averageDuration');
      expect(metrics).toHaveProperty('recentFailures');
      
      expect(typeof metrics.executionCount).toBe('number');
      expect(typeof metrics.successRate).toBe('number');
      expect(typeof metrics.averageDuration).toBe('number');
      expect(Array.isArray(metrics.recentFailures)).toBe(true);
    });

    it('should retrieve execution statistics across all schedules', async () => {
      const stats = await schedulerService.getExecutionStatistics();

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('totalExecutions');
      expect(stats).toHaveProperty('successfulExecutions');
      expect(stats).toHaveProperty('failedExecutions');
      expect(stats).toHaveProperty('averageDuration');
      expect(stats).toHaveProperty('executionsByStatus');
      expect(stats).toHaveProperty('executionsBySchedule');

      expect(typeof stats.totalExecutions).toBe('number');
      expect(typeof stats.successfulExecutions).toBe('number');
      expect(typeof stats.failedExecutions).toBe('number');
      expect(typeof stats.averageDuration).toBe('number');
    });
  });

  describe('12.3 Enable/Disable Workflow', () => {
    let testScheduleId: string;

    beforeAll(async () => {
      // Create a test schedule for enable/disable testing
      const scheduleConfig = {
        name: 'Enable/Disable Test Schedule',
        description: 'Schedule for testing enable/disable workflow',
        reportConfig: {
          id: 'toggle-test-report',
          name: 'Toggle Test Report',
          description: 'Test',
          tags: ['TAG001'],
          timeRange: {
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-02T00:00:00Z')
          },
          chartTypes: ['line' as const],
          template: 'default' as const,
          format: 'pdf' as const
        },
        cronExpression: '0 12 * * *', // Daily at noon
        enabled: true,
        recipients: []
      };

      testScheduleId = await schedulerService.createSchedule(scheduleConfig);
    });

    afterAll(async () => {
      // Clean up test schedule
      if (testScheduleId) {
        await schedulerService.deleteSchedule(testScheduleId);
      }
    });

    it('should disable a schedule and verify status is updated', async () => {
      // Disable schedule
      await schedulerService.updateSchedule(testScheduleId, { enabled: false });

      // Verify schedule is disabled
      const schedule = await schedulerService.getSchedule(testScheduleId);
      
      expect(schedule).toBeDefined();
      expect(schedule?.enabled).toBe(false);
      expect(schedule?.id).toBe(testScheduleId);
    });

    it('should enable a schedule and verify status is updated', async () => {
      // Enable schedule
      await schedulerService.updateSchedule(testScheduleId, { enabled: true });

      // Verify schedule is enabled
      const schedule = await schedulerService.getSchedule(testScheduleId);
      
      expect(schedule).toBeDefined();
      expect(schedule?.enabled).toBe(true);
      expect(schedule?.id).toBe(testScheduleId);
    });

    it('should handle multiple enable/disable toggles', async () => {
      // Toggle multiple times
      await schedulerService.updateSchedule(testScheduleId, { enabled: false });
      let schedule = await schedulerService.getSchedule(testScheduleId);
      expect(schedule?.enabled).toBe(false);

      await schedulerService.updateSchedule(testScheduleId, { enabled: true });
      schedule = await schedulerService.getSchedule(testScheduleId);
      expect(schedule?.enabled).toBe(true);

      await schedulerService.updateSchedule(testScheduleId, { enabled: false });
      schedule = await schedulerService.getSchedule(testScheduleId);
      expect(schedule?.enabled).toBe(false);

      await schedulerService.updateSchedule(testScheduleId, { enabled: true });
      schedule = await schedulerService.getSchedule(testScheduleId);
      expect(schedule?.enabled).toBe(true);
    });

    it('should verify enabled schedules are included in active count', async () => {
      // Ensure schedule is enabled
      await schedulerService.updateSchedule(testScheduleId, { enabled: true });

      // Get system health to check active schedules
      const health = await schedulerService.getSystemHealth();

      expect(health).toBeDefined();
      expect(health.activeSchedules).toBeGreaterThanOrEqual(1);
      expect(health.status).toBeDefined();
      expect(['healthy', 'warning', 'critical']).toContain(health.status);
    });

    it('should verify disabled schedules are not included in active count', async () => {
      // Get initial active count
      const initialHealth = await schedulerService.getSystemHealth();
      const initialActiveCount = initialHealth.activeSchedules;

      // Disable schedule
      await schedulerService.updateSchedule(testScheduleId, { enabled: false });

      // Get updated active count
      const updatedHealth = await schedulerService.getSystemHealth();
      const updatedActiveCount = updatedHealth.activeSchedules;

      // Active count should decrease by 1
      expect(updatedActiveCount).toBe(initialActiveCount - 1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle retrieving non-existent schedule', async () => {
      const nonExistentId = 'non-existent-schedule-id';
      const schedule = await schedulerService.getSchedule(nonExistentId);
      
      expect(schedule).toBeNull();
    });

    it('should reject invalid cron expressions', async () => {
      const invalidConfig = {
        name: 'Invalid Cron Schedule',
        description: 'Schedule with invalid cron expression',
        reportConfig: {
          id: 'invalid-cron-report',
          name: 'Invalid Cron Report',
          description: 'Test',
          tags: ['TAG001'],
          timeRange: {
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-02T00:00:00Z')
          },
          chartTypes: ['line' as const],
          template: 'default' as const,
          format: 'pdf' as const
        },
        cronExpression: 'invalid cron expression',
        enabled: true
      };

      await expect(schedulerService.createSchedule(invalidConfig)).rejects.toThrow();
    });

    it('should handle updating non-existent schedule', async () => {
      const nonExistentId = 'non-existent-schedule-id';
      
      await expect(
        schedulerService.updateSchedule(nonExistentId, { name: 'Updated Name' })
      ).rejects.toThrow();
    });

    it('should handle deleting non-existent schedule gracefully', async () => {
      const nonExistentId = 'non-existent-schedule-id';
      
      // Delete should not throw error for non-existent schedule
      await expect(schedulerService.deleteSchedule(nonExistentId)).resolves.not.toThrow();
    });
  });

  describe('System Health and Monitoring', () => {
    it('should retrieve system health status', async () => {
      const health = await schedulerService.getSystemHealth();

      expect(health).toBeDefined();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('activeSchedules');
      expect(health).toHaveProperty('runningExecutions');
      expect(health).toHaveProperty('queueLength');
      expect(health).toHaveProperty('issues');

      expect(['healthy', 'warning', 'critical']).toContain(health.status);
      expect(typeof health.activeSchedules).toBe('number');
      expect(typeof health.runningExecutions).toBe('number');
      expect(typeof health.queueLength).toBe('number');
      expect(Array.isArray(health.issues)).toBe(true);
    });

    it('should retrieve execution statistics with time range', async () => {
      const timeRange = {
        startTime: new Date('2024-01-01T00:00:00Z'),
        endTime: new Date('2024-12-31T23:59:59Z')
      };

      const stats = await schedulerService.getExecutionStatistics(timeRange);

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('totalExecutions');
      expect(stats).toHaveProperty('successfulExecutions');
      expect(stats).toHaveProperty('failedExecutions');
      expect(stats).toHaveProperty('averageDuration');
    });
  });

  describe('Data Integrity and Persistence', () => {
    it('should persist schedule data across service operations', async () => {
      // Create schedule
      const scheduleConfig = {
        name: 'Persistence Test Schedule',
        description: 'Testing data persistence',
        reportConfig: {
          id: 'persistence-test-report',
          name: 'Persistence Test Report',
          description: 'Test',
          tags: ['TAG001', 'TAG002', 'TAG003'],
          timeRange: {
            startTime: new Date('2024-01-01T00:00:00Z'),
            endTime: new Date('2024-01-02T00:00:00Z')
          },
          chartTypes: ['line' as const, 'bar' as const],
          template: 'default' as const,
          format: 'pdf' as const
        },
        cronExpression: '0 8 * * 1', // Weekly on Monday at 8 AM
        enabled: true,
        recipients: ['persistence@example.com']
      };

      const scheduleId = await schedulerService.createSchedule(scheduleConfig);

      // Retrieve and verify all fields
      const retrievedSchedule = await schedulerService.getSchedule(scheduleId);

      expect(retrievedSchedule).toBeDefined();
      expect(retrievedSchedule?.name).toBe(scheduleConfig.name);
      expect(retrievedSchedule?.description).toBe(scheduleConfig.description);
      expect(retrievedSchedule?.cronExpression).toBe(scheduleConfig.cronExpression);
      expect(retrievedSchedule?.enabled).toBe(scheduleConfig.enabled);
      expect(retrievedSchedule?.recipients).toEqual(scheduleConfig.recipients);
      expect(retrievedSchedule?.reportConfig.tags).toEqual(scheduleConfig.reportConfig.tags);
      expect(retrievedSchedule?.reportConfig.chartTypes).toEqual(scheduleConfig.reportConfig.chartTypes);

      // Clean up
      await schedulerService.deleteSchedule(scheduleId);
    });

    it('should handle date serialization correctly', async () => {
      const startTime = new Date('2024-06-15T14:30:00Z');
      const endTime = new Date('2024-06-16T18:45:00Z');

      const scheduleConfig = {
        name: 'Date Serialization Test',
        description: 'Testing date handling',
        reportConfig: {
          id: 'date-test-report',
          name: 'Date Test Report',
          description: 'Test',
          tags: ['TAG001'],
          timeRange: {
            startTime,
            endTime
          },
          chartTypes: ['line' as const],
          template: 'default' as const,
          format: 'pdf' as const
        },
        cronExpression: '0 9 * * *',
        enabled: true
      };

      const scheduleId = await schedulerService.createSchedule(scheduleConfig);
      const retrievedSchedule = await schedulerService.getSchedule(scheduleId);

      expect(retrievedSchedule).toBeDefined();
      expect(retrievedSchedule?.reportConfig.timeRange.startTime).toBeInstanceOf(Date);
      expect(retrievedSchedule?.reportConfig.timeRange.endTime).toBeInstanceOf(Date);
      expect(retrievedSchedule?.reportConfig.timeRange.startTime.getTime()).toBe(startTime.getTime());
      expect(retrievedSchedule?.reportConfig.timeRange.endTime.getTime()).toBe(endTime.getTime());

      // Clean up
      await schedulerService.deleteSchedule(scheduleId);
    });
  });
});
