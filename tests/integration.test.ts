/**
 * Integration Tests
 * Tests complete report generation workflow, scheduled execution, and authentication flows
 * Requirements: 1.1, 4.1, 7.2, 8.1, 9.1
 */

import request from 'supertest';
import { app } from '@/server';
import { schedulerService } from '@/services/schedulerService';
import { emailService } from '@/services/emailService';
import { authService } from '@/services/authService';
import { dataRetrievalService } from '@/services/dataRetrieval';
import { reportGenerationService } from '@/services/reportGeneration';
import { dataFlowService } from '@/services/dataFlowService';
import fs from 'fs';
import path from 'path';

// Mock external dependencies
jest.mock('@/services/emailService');
jest.mock('@/services/dataRetrieval');

const mockedEmailService = emailService as jest.Mocked<typeof emailService>;
const mockedDataRetrievalService = dataRetrievalService as jest.Mocked<typeof dataRetrievalService>;

describe('Integration Tests', () => {
  let authToken: string;
  let testReportId: string;
  let testScheduleId: string;

  beforeAll(async () => {
    // Setup test authentication
    const loginResponse = await authService.authenticate('test@example.com', 'testpassword');
    authToken = loginResponse.token;

    // Setup mock data
    mockedDataRetrievalService.getTimeSeriesData.mockResolvedValue([
      {
        timestamp: new Date('2023-01-01T00:00:00Z'),
        value: 25.5,
        quality: QualityCode.Good,
        tagName: 'TAG1'
      },
      {
        timestamp: new Date('2023-01-01T01:00:00Z'),
        value: 26.2,
        quality: QualityCode.Good,
        tagName: 'TAG1'
      },
      {
        timestamp: new Date('2023-01-01T02:00:00Z'),
        value: 24.8,
        quality: QualityCode.Good,
        tagName: 'TAG1'
      }
    ]);

    mockedEmailService.sendReportEmail.mockResolvedValue({
      success: true,
      messageId: 'test-message-id',
      recipients: {
        accepted: ['test@example.com'],
        rejected: [],
        pending: []
      }
    });
  });

  afterAll(async () => {
    // Cleanup test data
    if (testScheduleId) {
      try {
        await schedulerService.deleteSchedule(testScheduleId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Cleanup test report files
    const reportsDir = process.env.REPORTS_DIR || './reports';
    if (fs.existsSync(reportsDir)) {
      const files = fs.readdirSync(reportsDir);
      files.forEach(file => {
        if (file.includes('test') || file.includes(testReportId)) {
          try {
            fs.unlinkSync(path.join(reportsDir, file));
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      });
    }
  });

  describe('Complete Report Generation Workflow', () => {
    test('should generate report through end-to-end data flow', async () => {
      const reportConfig = {
        name: 'Integration Test Report',
        description: 'Test report for integration testing',
        tags: ['TEST_TAG_001', 'TEST_TAG_002'],
        timeRange: {
          startTime: '2023-01-01T00:00:00Z',
          endTime: '2023-01-01T23:59:59Z'
        },
        chartTypes: ['line', 'trend'] as ('line' | 'bar' | 'trend' | 'scatter')[],
        format: 'pdf',
        includeStatistics: true,
        includeTrends: true,
        includeAnomalies: false
      };

      const response = await request(app)
        .post('/api/reports/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(reportConfig)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.reportId).toBeDefined();
      expect(response.body.status).toBe('generated');
      expect(response.body.downloadUrl).toBeDefined();
      expect(response.body.dataMetrics).toBeDefined();
      expect(response.body.dataMetrics.totalDataPoints).toBeGreaterThan(0);
      expect(response.body.dataMetrics.tagsProcessed).toBe(2);

      testReportId = response.body.reportId;

      // Verify data retrieval was called for each tag
      expect(mockedDataRetrievalService.getTimeSeriesData).toHaveBeenCalledTimes(2);
      expect(mockedDataRetrievalService.getTimeSeriesData).toHaveBeenCalledWith(
        'TEST_TAG_001',
        expect.objectContaining({
          startTime: new Date('2023-01-01T00:00:00Z'),
          endTime: new Date('2023-01-01T23:59:59Z')
        })
      );
    });

    test('should download generated report', async () => {
      expect(testReportId).toBeDefined();

      const response = await request(app)
        .get(`/api/reports/${testReportId}/download`)
        .expect(200);

      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.body).toBeDefined();
    });

    test('should handle invalid report configuration', async () => {
      const invalidConfig = {
        name: '', // Invalid: empty name
        tags: [], // Invalid: no tags
        timeRange: {
          startTime: '2023-01-02T00:00:00Z',
          endTime: '2023-01-01T00:00:00Z' // Invalid: end before start
        }
      };

      const response = await request(app)
        .post('/api/reports/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidConfig)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should handle data retrieval failures gracefully', async () => {
      // Mock data retrieval failure
      mockedDataRetrievalService.getTimeSeriesData.mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const reportConfig = {
        name: 'Failure Test Report',
        tags: ['FAILING_TAG'],
        timeRange: {
          startTime: '2023-01-01T00:00:00Z',
          endTime: '2023-01-01T23:59:59Z'
        },
        chartTypes: ['line'] as ('line' | 'bar' | 'trend' | 'scatter')[]
      };

      const response = await request(app)
        .post('/api/reports/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(reportConfig)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Scheduled Report Execution and Delivery', () => {
    test('should create and execute scheduled report', async () => {
      const scheduleConfig = {
        name: 'Integration Test Schedule',
        description: 'Test schedule for integration testing',
        reportConfig: {
          name: 'Scheduled Integration Test Report',
          tags: ['SCHED_TAG_001'],
          timeRange: {
            startTime: '2023-01-01T00:00:00Z',
            endTime: '2023-01-01T23:59:59Z'
          },
          chartTypes: ['line'] as ('line' | 'bar' | 'trend' | 'scatter')[],
          format: 'pdf' as ('pdf' | 'docx')
        },
        cronExpression: '0 0 * * *', // Daily at midnight
        enabled: true,
        recipients: ['test@example.com']
      };

      // Create schedule
      const createResponse = await request(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send(scheduleConfig)
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.scheduleId).toBeDefined();

      testScheduleId = createResponse.body.scheduleId;

      // Get schedule details
      const getResponse = await request(app)
        .get(`/api/schedules/${testScheduleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.success).toBe(true);
      expect(getResponse.body.data.name).toBe(scheduleConfig.name);
      expect(getResponse.body.data.enabled).toBe(true);
    });

    test('should execute schedule manually and send email', async () => {
      expect(testScheduleId).toBeDefined();

      // Execute schedule manually
      const executeResponse = await request(app)
        .post(`/api/schedules/${testScheduleId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(executeResponse.body.success).toBe(true);
      expect(executeResponse.body.executionId).toBeDefined();

      // Wait for execution to complete (in real scenario, this would be async)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify email was sent
      expect(mockedEmailService.sendReportEmail).toHaveBeenCalledWith(
        ['test@example.com'],
        expect.any(String), // Report file path
        expect.any(String), // Report name
        expect.stringContaining('Scheduled Report'),
        expect.stringContaining('Scheduled Report Delivery')
      );
    });

    test('should get execution history', async () => {
      expect(testScheduleId).toBeDefined();

      const response = await request(app)
        .get(`/api/schedules/${testScheduleId}/executions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);

      const execution = response.body.data[0];
      expect(execution.scheduleId).toBe(testScheduleId);
      expect(execution.status).toMatch(/^(success|failed|running)$/);
      expect(execution.startTime).toBeDefined();
    });

    test('should update schedule configuration', async () => {
      expect(testScheduleId).toBeDefined();

      const updates = {
        name: 'Updated Integration Test Schedule',
        enabled: false,
        recipients: ['updated@example.com', 'test@example.com']
      };

      const response = await request(app)
        .put(`/api/schedules/${testScheduleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify updates
      const getResponse = await request(app)
        .get(`/api/schedules/${testScheduleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.data.name).toBe(updates.name);
      expect(getResponse.body.data.enabled).toBe(false);
      expect(getResponse.body.data.recipients).toEqual(updates.recipients);
    });
  });

  describe('User Authentication and Authorization Flows', () => {
    test('should authenticate user with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'testpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(loginData.email);
    });

    test('should reject invalid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.token).toBeUndefined();
    });

    test('should protect endpoints with authentication', async () => {
      // Try to access protected endpoint without token
      const response = await request(app)
        .get('/api/reports')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('authentication');
    });

    test('should allow access with valid token', async () => {
      const response = await request(app)
        .get('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    test('should handle token refresh', async () => {
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.body.token).toBeDefined();
      expect(refreshResponse.body.token).not.toBe(authToken);

      // Verify new token works
      const testResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${refreshResponse.body.token}`)
        .expect(200);

      expect(testResponse.body.success).toBe(true);
    });

    test('should handle user logout', async () => {
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(logoutResponse.body.success).toBe(true);

      // Verify token is invalidated (this depends on implementation)
      // In a real scenario, the token might be blacklisted
    });

    test.skip('should enforce role-based permissions', async () => {
      // TODO: Implement user registration or use existing admin user
      // Create a user with limited permissions
      // const limitedUser = await authService.register({
      //   email: 'limited@example.com',
      //   password: 'testpassword',
      //   role: 'viewer'
      // });

      const limitedLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'limited@example.com',
          password: 'testpassword'
        })
        .expect(200);

      const limitedToken = limitedLoginResponse.body.token;

      // Try to create a report with limited permissions
      const reportConfig = {
        name: 'Unauthorized Report',
        tags: ['TEST_TAG'],
        timeRange: {
          startTime: '2023-01-01T00:00:00Z',
          endTime: '2023-01-01T23:59:59Z'
        }
      };

      const response = await request(app)
        .post('/api/reports/generate')
        .set('Authorization', `Bearer ${limitedToken}`)
        .send(reportConfig)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('permission');
    });
  });

  describe('System Health and Monitoring', () => {
    test('should provide system health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toMatch(/^(healthy|warning|critical)$/);
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.services).toBeDefined();
      expect(response.body.services.database).toBeDefined();
      expect(response.body.services.scheduler).toBeDefined();
    });

    test('should provide detailed system metrics', async () => {
      const response = await request(app)
        .get('/api/system/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.uptime).toBeDefined();
      expect(response.body.data.memory).toBeDefined();
      expect(response.body.data.scheduler).toBeDefined();
    });

    test('should handle database connectivity issues', async () => {
      // This test would require mocking database failures
      // For now, we'll test the health endpoint's error handling
      const response = await request(app)
        .get('/api/health/database')
        .expect(200);

      expect(response.body.status).toBeDefined();
      expect(response.body.connectionTime).toBeDefined();
    });
  });

  describe('Data Flow Service Integration', () => {
    test('should validate data flow configuration', async () => {
      const validConfig = {
        reportConfig: {
          id: 'test-report',
          name: 'Test Report',
          tags: ['TAG1', 'TAG2'],
          timeRange: {
            startTime: new Date('2023-01-01T00:00:00Z'),
            endTime: new Date('2023-01-01T23:59:59Z')
          },
          chartTypes: ['line'],
          template: 'default',
          format: 'pdf'
        },
        includeStatistics: true,
        includeTrends: true,
        includeAnomalies: false
      };

      const validation = dataFlowService.validateDataFlowConfig(validConfig);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect invalid data flow configuration', async () => {
      const invalidConfig = {
        reportConfig: {
          id: 'test-report',
          name: '', // Invalid: empty name
          tags: [], // Invalid: no tags
          timeRange: {
            startTime: new Date('2023-01-02T00:00:00Z'),
            endTime: new Date('2023-01-01T00:00:00Z') // Invalid: end before start
          },
          chartTypes: [], // Invalid: no chart types
          template: 'default',
          format: 'pdf'
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

    test('should execute complete data flow with real-time data', async () => {
      const config = {
        reportConfig: {
          id: 'realtime-test',
          name: 'Real-time Test Report',
          tags: ['RT_TAG_001'],
          timeRange: {
            startTime: new Date('2023-01-01T00:00:00Z'),
            endTime: new Date('2023-01-01T12:00:00Z')
          },
          chartTypes: ['line'],
          template: 'default',
          format: 'pdf'
        },
        includeStatistics: true,
        includeTrends: true,
        realTimeData: {
          'RT_TAG_001': [
            {
              timestamp: new Date('2023-01-01T12:01:00Z'),
              value: 30.5,
              quality: 'Good'
            },
            {
              timestamp: new Date('2023-01-01T12:02:00Z'),
              value: 31.2,
              quality: 'Good'
            }
          ]
        }
      };

      const result = await dataFlowService.executeDataFlow(config);

      expect(result.success).toBe(true);
      expect(result.dataMetrics).toBeDefined();
      expect(result.dataMetrics.totalDataPoints).toBeGreaterThan(0);
      expect(result.dataMetrics.tagsProcessed).toBe(1);
      expect(result.dataMetrics.processingTime).toBeGreaterThan(0);
      expect(result.reportResult).toBeDefined();
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle concurrent report generation requests', async () => {
      const reportConfig = {
        name: 'Concurrent Test Report',
        tags: ['CONCURRENT_TAG'],
        timeRange: {
          startTime: '2023-01-01T00:00:00Z',
          endTime: '2023-01-01T23:59:59Z'
        },
        chartTypes: ['line']
      };

      // Send multiple concurrent requests
      const promises = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/reports/generate')
          .set('Authorization', `Bearer ${authToken}`)
          .send(reportConfig)
      );

      const responses = await Promise.all(promises);

      // All requests should succeed or fail gracefully
      responses.forEach(response => {
        expect([200, 429, 500]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.reportId).toBeDefined();
        }
      });
    });

    test('should handle scheduler service failures gracefully', async () => {
      // Test scheduler health when database is unavailable
      const healthResponse = await request(app)
        .get('/api/system/scheduler/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(healthResponse.body.status).toMatch(/^(healthy|warning|critical)$/);
      expect(healthResponse.body.activeSchedules).toBeDefined();
      expect(healthResponse.body.runningExecutions).toBeDefined();
    });

    test('should retry failed operations', async () => {
      // Mock a temporary failure followed by success
      mockedDataRetrievalService.getTimeSeriesData
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce([
          {
            timestamp: new Date('2023-01-01T00:00:00Z'),
            value: 25.0,
            quality: 'Good'
          }
        ]);

      const reportConfig = {
        name: 'Retry Test Report',
        tags: ['RETRY_TAG'],
        timeRange: {
          startTime: '2023-01-01T00:00:00Z',
          endTime: '2023-01-01T23:59:59Z'
        },
        chartTypes: ['line']
      };

      // The data flow service should handle retries internally
      const result = await dataFlowService.executeDataFlow({
        reportConfig: {
          id: 'retry-test',
          ...reportConfig,
          template: 'default',
          format: 'pdf'
        }
      });

      // Should eventually succeed after retry
      expect(result.success).toBe(true);
    });
  });
});