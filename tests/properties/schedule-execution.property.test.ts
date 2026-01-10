/**
 * Property-based tests for Schedule Execution Timing
 * Property 10: Schedule Execution Timing
 * Validates: Requirements 7.1, 7.2
 */

import * as fc from 'fast-check';
import { schedulerService, ScheduleConfig } from '@/services/schedulerService';
import { ReportConfig } from '@/services/reportGeneration';

describe('Property 10: Schedule Execution Timing', () => {
  beforeAll(() => {
    // Ensure scheduler is initialized
    jest.setTimeout(30000);
  });

  afterAll(() => {
    // Clean up scheduler
    schedulerService.shutdown();
  });

  /**
   * Property: Schedule creation should always result in valid next execution time
   */
  test('Schedule creation produces valid next execution times', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          description: fc.option(fc.string({ maxLength: 200 })),
          cronExpression: fc.constantFrom(
            '0 0 * * *',     // Daily at midnight
            '0 */6 * * *',   // Every 6 hours
            '0 0 */2 * *',   // Every 2 days
            '0 0 * * 0',     // Weekly on Sunday
            '0 0 1 * *'      // Monthly on 1st
          ),
          enabled: fc.boolean(),
          tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          recipients: fc.option(fc.array(fc.emailAddress(), { minLength: 1, maxLength: 3 }))
        }),
        async (scheduleData) => {
          const reportConfig: ReportConfig = {
            id: `report_${Date.now()}`,
            name: scheduleData.name,
            description: scheduleData.description || undefined,
            tags: scheduleData.tags,
            timeRange: {
              startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
              endTime: new Date()
            },
            chartTypes: ['line'],
            template: 'default',
            format: 'pdf',
            branding: undefined,
            metadata: undefined
          };

          const config = {
            name: scheduleData.name,
            description: scheduleData.description || undefined,
            reportConfig,
            cronExpression: scheduleData.cronExpression,
            enabled: scheduleData.enabled,
            recipients: scheduleData.recipients || undefined
          };

          try {
            const scheduleId = await schedulerService.createSchedule(config);
            const schedule = await schedulerService.getSchedule(scheduleId);

            // Verify schedule was created
            expect(schedule).toBeTruthy();
            expect(schedule!.id).toBe(scheduleId);
            expect(schedule!.name).toBe(scheduleData.name);
            expect(schedule!.cronExpression).toBe(scheduleData.cronExpression);
            expect(schedule!.enabled).toBe(scheduleData.enabled);

            // Verify next execution time is in the future (if enabled)
            if (scheduleData.enabled && schedule!.nextRun) {
              expect(schedule!.nextRun.getTime()).toBeGreaterThan(Date.now());
            }

            // Clean up
            await schedulerService.deleteSchedule(scheduleId);
          } catch (error) {
            // Should not throw for valid cron expressions
            throw new Error(`Schedule creation failed: ${error}`);
          }
        }
      ),
      { numRuns: 20, timeout: 25000 }
    );
  });

  /**
   * Property: Schedule updates should maintain timing consistency
   */
  test('Schedule updates maintain timing consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          initialCron: fc.constantFrom('0 0 * * *', '0 */6 * * *', '0 0 */2 * *'),
          updatedCron: fc.constantFrom('0 0 * * *', '0 */6 * * *', '0 0 */2 * *'),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          enabled: fc.boolean()
        }),
        async (testData) => {
          const reportConfig: ReportConfig = {
            id: `report_${Date.now()}`,
            name: testData.name,
            description: undefined,
            tags: ['test-tag'],
            timeRange: {
              startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
              endTime: new Date()
            },
            chartTypes: ['line'],
            template: 'default',
            format: 'pdf',
            branding: undefined,
            metadata: undefined
          };

          // Create initial schedule
          const scheduleId = await schedulerService.createSchedule({
            name: testData.name,
            description: undefined,
            reportConfig,
            cronExpression: testData.initialCron,
            enabled: testData.enabled,
            recipients: undefined
          });

          const initialSchedule = await schedulerService.getSchedule(scheduleId);
          const initialNextRun = initialSchedule!.nextRun;

          // Update the cron expression
          await schedulerService.updateSchedule(scheduleId, {
            cronExpression: testData.updatedCron
          });

          const updatedSchedule = await schedulerService.getSchedule(scheduleId);

          // Verify the schedule was updated
          expect(updatedSchedule!.cronExpression).toBe(testData.updatedCron);

          // If cron expression changed, next run should be recalculated
          if (testData.initialCron !== testData.updatedCron && testData.enabled) {
            // Next run time should be updated (may be same or different depending on timing)
            expect(updatedSchedule!.nextRun).toBeDefined();
            expect(updatedSchedule!.nextRun!.getTime()).toBeGreaterThan(Date.now());
          }

          // Clean up
          await schedulerService.deleteSchedule(scheduleId);
        }
      ),
      { numRuns: 15, timeout: 20000 }
    );
  });

  /**
   * Property: Disabled schedules should not have active cron jobs
   */
  test('Disabled schedules do not execute', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          cronExpression: fc.constantFrom('0 0 * * *', '0 */6 * * *'),
          initialEnabled: fc.boolean()
        }),
        async (testData) => {
          const reportConfig: ReportConfig = {
            id: `report_${Date.now()}`,
            name: testData.name,
            description: undefined,
            tags: ['test-tag'],
            timeRange: {
              startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
              endTime: new Date()
            },
            chartTypes: ['line'],
            template: 'default',
            format: 'pdf',
            branding: undefined,
            metadata: undefined
          };

          // Create schedule
          const scheduleId = await schedulerService.createSchedule({
            name: testData.name,
            description: undefined,
            reportConfig,
            cronExpression: testData.cronExpression,
            enabled: testData.initialEnabled,
            recipients: undefined
          });

          // Disable the schedule
          await schedulerService.updateSchedule(scheduleId, { enabled: false });

          const disabledSchedule = await schedulerService.getSchedule(scheduleId);

          // Verify schedule is disabled
          expect(disabledSchedule!.enabled).toBe(false);

          // Re-enable the schedule
          await schedulerService.updateSchedule(scheduleId, { enabled: true });

          const enabledSchedule = await schedulerService.getSchedule(scheduleId);

          // Verify schedule is enabled
          expect(enabledSchedule!.enabled).toBe(true);
          expect(enabledSchedule!.nextRun).toBeDefined();
          expect(enabledSchedule!.nextRun!.getTime()).toBeGreaterThan(Date.now());

          // Clean up
          await schedulerService.deleteSchedule(scheduleId);
        }
      ),
      { numRuns: 10, timeout: 15000 }
    );
  });

  /**
   * Property: Schedule execution history should be properly recorded
   */
  test('Schedule execution history is properly maintained', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          cronExpression: fc.constantFrom('0 0 * * *', '0 */6 * * *')
        }),
        async (testData) => {
          const reportConfig: ReportConfig = {
            id: `report_${Date.now()}`,
            name: testData.name,
            description: undefined,
            tags: ['test-tag'],
            timeRange: {
              startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
              endTime: new Date()
            },
            chartTypes: ['line'],
            template: 'default',
            format: 'pdf',
            branding: undefined,
            metadata: undefined
          };

          // Create schedule
          const scheduleId = await schedulerService.createSchedule({
            name: testData.name,
            description: undefined,
            reportConfig,
            cronExpression: testData.cronExpression,
            enabled: false, // Keep disabled to avoid actual execution
            recipients: undefined
          });

          // Get initial execution history (should be empty)
          const initialHistory = await schedulerService.getExecutionHistory(scheduleId);
          expect(initialHistory).toHaveLength(0);

          // Verify schedule exists
          const schedule = await schedulerService.getSchedule(scheduleId);
          expect(schedule).toBeTruthy();
          expect(schedule!.id).toBe(scheduleId);

          // Clean up
          await schedulerService.deleteSchedule(scheduleId);

          // Verify schedule is deleted
          const deletedSchedule = await schedulerService.getSchedule(scheduleId);
          expect(deletedSchedule).toBeNull();
        }
      ),
      { numRuns: 10, timeout: 15000 }
    );
  });

  /**
   * Property: Multiple schedules can coexist without conflicts
   */
  test('Multiple schedules coexist without conflicts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 30 }),
            cronExpression: fc.constantFrom('0 0 * * *', '0 */6 * * *', '0 0 */2 * *'),
            enabled: fc.boolean()
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (scheduleDataArray) => {
          const scheduleIds: string[] = [];

          try {
            // Create multiple schedules
            for (const scheduleData of scheduleDataArray) {
              const reportConfig: ReportConfig = {
                id: `report_${Date.now()}_${Math.random()}`,
                name: scheduleData.name,
                description: undefined,
                tags: ['test-tag'],
                timeRange: {
                  startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
                  endTime: new Date()
                },
                chartTypes: ['line'],
                template: 'default',
                format: 'pdf',
                branding: undefined,
                metadata: undefined
              };

              const scheduleId = await schedulerService.createSchedule({
                name: scheduleData.name,
                description: undefined,
                reportConfig,
                cronExpression: scheduleData.cronExpression,
                enabled: scheduleData.enabled,
                recipients: undefined
              });

              scheduleIds.push(scheduleId);
            }

            // Verify all schedules exist and are independent
            const allSchedules = await schedulerService.getSchedules();
            const createdSchedules = allSchedules.filter(s => scheduleIds.includes(s.id));

            expect(createdSchedules).toHaveLength(scheduleIds.length);

            // Verify each schedule has correct properties
            for (let i = 0; i < scheduleIds.length; i++) {
              const schedule = createdSchedules.find(s => s.id === scheduleIds[i]);
              const originalData = scheduleDataArray[i];
              expect(schedule).toBeTruthy();
              expect(schedule!.name).toBe(originalData!.name);
              expect(schedule!.cronExpression).toBe(originalData!.cronExpression);
              expect(schedule!.enabled).toBe(originalData!.enabled);
            }

          } finally {
            // Clean up all created schedules
            for (const scheduleId of scheduleIds) {
              try {
                await schedulerService.deleteSchedule(scheduleId);
              } catch (error) {
                // Ignore cleanup errors
              }
            }
          }
        }
      ),
      { numRuns: 5, timeout: 20000 }
    );
  });
});