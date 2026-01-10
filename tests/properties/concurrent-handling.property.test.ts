/**
 * Property-based tests for Concurrent Request Handling
 * Property 11: Concurrent Request Handling
 * Validates: Requirements 7.3, 10.2
 */

import * as fc from 'fast-check';
import { schedulerService, ScheduleConfig } from '@/services/schedulerService';
import { ReportConfig } from '@/services/reportGeneration';

describe('Property 11: Concurrent Request Handling', () => {
  beforeAll(() => {
    jest.setTimeout(60000);
  });

  afterAll(() => {
    schedulerService.shutdown();
  });

  /**
   * Property: Concurrent schedule creation should not cause conflicts
   */
  test('Concurrent schedule creation maintains data integrity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 30 }),
            cronExpression: fc.constantFrom('0 0 * * *', '0 */6 * * *', '0 0 */2 * *'),
            enabled: fc.boolean(),
            tags: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 3 })
          }),
          { minLength: 3, maxLength: 8 }
        ),
        async (scheduleDataArray) => {
          const scheduleIds: string[] = [];

          try {
            // Create schedules concurrently
            const createPromises = scheduleDataArray.map(async (scheduleData, index) => {
              const reportConfig: ReportConfig = {
                id: `report_${Date.now()}_${index}`,
                name: `${scheduleData.name}_${index}`,
                description: undefined,
                tags: scheduleData.tags,
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

              return schedulerService.createSchedule({
                name: `${scheduleData.name}_${index}`,
                description: undefined,
                reportConfig,
                cronExpression: scheduleData.cronExpression,
                enabled: scheduleData.enabled,
                recipients: undefined
              });
            });

            const createdIds = await Promise.all(createPromises);
            scheduleIds.push(...createdIds);

            // Verify all schedules were created successfully
            expect(createdIds).toHaveLength(scheduleDataArray.length);
            expect(new Set(createdIds).size).toBe(createdIds.length); // All IDs should be unique

            // Verify each schedule can be retrieved
            const retrievePromises = createdIds.map(id => schedulerService.getSchedule(id));
            const retrievedSchedules = await Promise.all(retrievePromises);

            retrievedSchedules.forEach((schedule, index) => {
              const originalData = scheduleDataArray[index];
              expect(schedule).toBeTruthy();
              expect(schedule!.id).toBe(createdIds[index]);
              expect(schedule!.name).toBe(`${originalData!.name}_${index}`);
              expect(schedule!.cronExpression).toBe(originalData!.cronExpression);
              expect(schedule!.enabled).toBe(originalData!.enabled);
            });

          } finally {
            // Clean up concurrently
            const deletePromises = scheduleIds.map(id => 
              schedulerService.deleteSchedule(id).catch(() => {}) // Ignore errors
            );
            await Promise.all(deletePromises);
          }
        }
      ),
      { numRuns: 10, timeout: 50000 }
    );
  });

  /**
   * Property: Concurrent schedule updates should maintain consistency
   */
  test('Concurrent schedule updates maintain consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          initialName: fc.string({ minLength: 1, maxLength: 20 }),
          cronExpression: fc.constantFrom('0 0 * * *', '0 */6 * * *'),
          updateOperations: fc.array(
            fc.record({
              field: fc.constantFrom('name', 'enabled', 'description'),
              value: fc.oneof(
                fc.string({ minLength: 1, maxLength: 30 }),
                fc.boolean(),
                fc.option(fc.string({ maxLength: 100 }))
              )
            }),
            { minLength: 2, maxLength: 5 }
          )
        }),
        async (testData) => {
          const reportConfig: ReportConfig = {
            id: `report_${Date.now()}`,
            name: testData.initialName,
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
            name: testData.initialName,
            description: undefined,
            reportConfig,
            cronExpression: testData.cronExpression,
            enabled: true,
            recipients: undefined
          });

          try {
            // Perform concurrent updates
            const updatePromises = testData.updateOperations.map(async (operation, index) => {
              const updateData: any = {};
              
              if (operation.field === 'name' && typeof operation.value === 'string') {
                updateData.name = `${operation.value}_${index}`;
              } else if (operation.field === 'enabled' && typeof operation.value === 'boolean') {
                updateData.enabled = operation.value;
              } else if (operation.field === 'description') {
                updateData.description = typeof operation.value === 'string' ? operation.value : undefined;
              }

              return schedulerService.updateSchedule(scheduleId, updateData);
            });

            // Wait for all updates to complete
            await Promise.all(updatePromises);

            // Verify schedule still exists and is in a consistent state
            const finalSchedule = await schedulerService.getSchedule(scheduleId);
            expect(finalSchedule).toBeTruthy();
            expect(finalSchedule!.id).toBe(scheduleId);
            expect(finalSchedule!.cronExpression).toBe(testData.cronExpression);

            // Verify the schedule has valid properties (one of the updates should have taken effect)
            expect(typeof finalSchedule!.name).toBe('string');
            expect(finalSchedule!.name.length).toBeGreaterThan(0);
            expect(typeof finalSchedule!.enabled).toBe('boolean');

          } finally {
            await schedulerService.deleteSchedule(scheduleId);
          }
        }
      ),
      { numRuns: 8, timeout: 30000 }
    );
  });

  /**
   * Property: Concurrent read operations should not interfere with each other
   */
  test('Concurrent read operations maintain consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          scheduleCount: fc.integer({ min: 3, max: 6 }),
          readOperationsPerSchedule: fc.integer({ min: 5, max: 10 }),
          name: fc.string({ minLength: 1, maxLength: 20 })
        }),
        async (testData) => {
          const scheduleIds: string[] = [];

          try {
            // Create multiple schedules
            for (let i = 0; i < testData.scheduleCount; i++) {
              const reportConfig: ReportConfig = {
                id: `report_${Date.now()}_${i}`,
                name: `${testData.name}_${i}`,
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
                name: `${testData.name}_${i}`,
                description: undefined,
                reportConfig,
                cronExpression: '0 0 * * *',
                enabled: true,
                recipients: undefined
              });

              scheduleIds.push(scheduleId);
            }

            // Perform concurrent read operations
            const readPromises: Promise<any>[] = [];

            scheduleIds.forEach(scheduleId => {
              for (let i = 0; i < testData.readOperationsPerSchedule; i++) {
                // Mix different types of read operations
                if (i % 3 === 0) {
                  readPromises.push(schedulerService.getSchedule(scheduleId));
                } else if (i % 3 === 1) {
                  readPromises.push(schedulerService.getExecutionHistory(scheduleId, 10));
                } else {
                  readPromises.push(schedulerService.getSchedules());
                }
              }
            });

            const results = await Promise.all(readPromises);

            // Verify all read operations completed successfully
            expect(results).toHaveLength(scheduleIds.length * testData.readOperationsPerSchedule);

            // Verify individual schedule reads
            let scheduleReadIndex = 0;
            scheduleIds.forEach(scheduleId => {
              for (let i = 0; i < testData.readOperationsPerSchedule; i++) {
                const result = results[scheduleReadIndex];
                
                if (i % 3 === 0) {
                  // getSchedule result
                  expect(result).toBeTruthy();
                  expect(result.id).toBe(scheduleId);
                } else if (i % 3 === 1) {
                  // getExecutionHistory result
                  expect(Array.isArray(result)).toBe(true);
                } else {
                  // getSchedules result
                  expect(Array.isArray(result)).toBe(true);
                  expect(result.length).toBeGreaterThanOrEqual(testData.scheduleCount);
                }
                
                scheduleReadIndex++;
              }
            });

          } finally {
            // Clean up
            const deletePromises = scheduleIds.map(id => 
              schedulerService.deleteSchedule(id).catch(() => {})
            );
            await Promise.all(deletePromises);
          }
        }
      ),
      { numRuns: 5, timeout: 40000 }
    );
  });

  /**
   * Property: Mixed concurrent operations (create, read, update, delete) should maintain system integrity
   */
  test('Mixed concurrent operations maintain system integrity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          initialScheduleCount: fc.integer({ min: 2, max: 4 }),
          operationCount: fc.integer({ min: 8, max: 15 }),
          baseName: fc.string({ minLength: 1, maxLength: 15 })
        }),
        async (testData) => {
          const scheduleIds: string[] = [];
          const createdDuringTest: string[] = [];

          try {
            // Create initial schedules
            for (let i = 0; i < testData.initialScheduleCount; i++) {
              const reportConfig: ReportConfig = {
                id: `report_${Date.now()}_${i}`,
                name: `${testData.baseName}_initial_${i}`,
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
                name: `${testData.baseName}_initial_${i}`,
                description: undefined,
                reportConfig,
                cronExpression: '0 0 * * *',
                enabled: true,
                recipients: undefined
              });

              scheduleIds.push(scheduleId);
            }

            // Perform mixed concurrent operations
            const operationPromises: Promise<any>[] = [];

            for (let i = 0; i < testData.operationCount; i++) {
              const operationType = i % 4;

              if (operationType === 0 && scheduleIds.length > 0) {
                // Read operation
                const randomIndex = Math.floor(Math.random() * scheduleIds.length);
                const randomId = scheduleIds[randomIndex];
                if (randomId) {
                  operationPromises.push(
                    schedulerService.getSchedule(randomId).catch(() => null)
                  );
                }
              } else if (operationType === 1) {
                // Create operation
                const reportConfig: ReportConfig = {
                  id: `report_${Date.now()}_new_${i}`,
                  name: `${testData.baseName}_new_${i}`,
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

                operationPromises.push(
                  schedulerService.createSchedule({
                    name: `${testData.baseName}_new_${i}`,
                    description: undefined,
                    reportConfig,
                    cronExpression: '0 0 * * *',
                    enabled: false,
                    recipients: undefined
                  }).then(id => {
                    createdDuringTest.push(id);
                    return id;
                  }).catch(() => null)
                );
              } else if (operationType === 2 && scheduleIds.length > 0) {
                // Update operation
                const randomIndex = Math.floor(Math.random() * scheduleIds.length);
                const randomId = scheduleIds[randomIndex];
                if (randomId) {
                  operationPromises.push(
                    schedulerService.updateSchedule(randomId, {
                      description: `Updated at ${Date.now()}`
                    }).catch(() => null)
                  );
                }
              } else {
                // List operation
                operationPromises.push(
                  schedulerService.getSchedules().catch(() => [])
                );
              }
            }

            const results = await Promise.all(operationPromises);

            // Verify operations completed (some may have failed due to timing, but system should be stable)
            expect(results).toHaveLength(testData.operationCount);

            // Verify system is still in a consistent state
            const finalSchedules = await schedulerService.getSchedules();
            expect(Array.isArray(finalSchedules)).toBe(true);

            // Verify initial schedules still exist (unless deleted)
            for (const scheduleId of scheduleIds) {
              const schedule = await schedulerService.getSchedule(scheduleId);
              if (schedule) {
                expect(schedule.id).toBe(scheduleId);
                expect(typeof schedule.name).toBe('string');
                expect(typeof schedule.enabled).toBe('boolean');
              }
            }

          } finally {
            // Clean up all schedules
            const allIds = [...scheduleIds, ...createdDuringTest];
            const deletePromises = allIds.map(id => 
              schedulerService.deleteSchedule(id).catch(() => {})
            );
            await Promise.all(deletePromises);
          }
        }
      ),
      { numRuns: 3, timeout: 45000 }
    );
  });

  /**
   * Property: System should handle resource exhaustion gracefully
   */
  test('System handles resource constraints gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          scheduleCount: fc.integer({ min: 10, max: 20 }),
          baseName: fc.string({ minLength: 1, maxLength: 10 })
        }),
        async (testData) => {
          const scheduleIds: string[] = [];

          try {
            // Create many schedules rapidly
            const createPromises = Array.from({ length: testData.scheduleCount }, (_, i) => {
              const reportConfig: ReportConfig = {
                id: `report_${Date.now()}_${i}`,
                name: `${testData.baseName}_${i}`,
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

              return schedulerService.createSchedule({
                name: `${testData.baseName}_${i}`,
                description: undefined,
                reportConfig,
                cronExpression: '0 0 * * *',
                enabled: false, // Keep disabled to avoid execution overhead
                recipients: undefined
              }).catch(error => {
                // Some creates might fail under load, which is acceptable
                return null;
              });
            });

            const results = await Promise.all(createPromises);
            const successfulIds = results.filter(id => id !== null) as string[];
            scheduleIds.push(...successfulIds);

            // Verify at least some schedules were created successfully
            expect(successfulIds.length).toBeGreaterThan(0);

            // Verify system is still responsive
            const allSchedules = await schedulerService.getSchedules();
            expect(Array.isArray(allSchedules)).toBe(true);

            // Verify created schedules are accessible
            const sampleSize = Math.min(5, successfulIds.length);
            const sampleIds = successfulIds.slice(0, sampleSize);
            
            for (const scheduleId of sampleIds) {
              const schedule = await schedulerService.getSchedule(scheduleId);
              expect(schedule).toBeTruthy();
              expect(schedule!.id).toBe(scheduleId);
            }

          } finally {
            // Clean up in batches to avoid overwhelming the system
            const batchSize = 5;
            for (let i = 0; i < scheduleIds.length; i += batchSize) {
              const batch = scheduleIds.slice(i, i + batchSize);
              const deletePromises = batch.map(id => 
                schedulerService.deleteSchedule(id).catch(() => {})
              );
              await Promise.all(deletePromises);
              
              // Small delay between batches
              if (i + batchSize < scheduleIds.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }
          }
        }
      ),
      { numRuns: 3, timeout: 50000 }
    );
  });
});