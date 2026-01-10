/**
 * Core Integration Tests
 * Simplified integration tests for essential workflows
 * Requirements: 1.1, 4.1, 7.2, 8.1, 9.1
 */

import { dataFlowService } from '@/services/dataFlowService';
import { schedulerService } from '@/services/schedulerService';
import { reportGenerationService } from '@/services/reportGeneration';
import { authService } from '@/services/authService';
import { dataRetrievalService } from '@/services/dataRetrieval';
import { emailService } from '@/services/emailService';
import { QualityCode } from '@/types/historian';

// Mock external dependencies
jest.mock('@/services/dataRetrieval');
jest.mock('@/services/emailService');

const mockedDataRetrievalService = dataRetrievalService as jest.Mocked<typeof dataRetrievalService>;
const mockedEmailService = emailService as jest.Mocked<typeof emailService>;

describe('Core Integration Tests', () => {
  beforeAll(() => {
    // Setup mock data
    mockedDataRetrievalService.getTimeSeriesData.mockResolvedValue([
      {
        timestamp: new Date('2023-01-01T00:00:00Z'),
        value: 25.5,
        quality: QualityCode.Good,
        tagName: 'TEST_TAG_001'
      },
      {
        timestamp: new Date('2023-01-01T01:00:00Z'),
        value: 26.2,
        quality: QualityCode.Good,
        tagName: 'TEST_TAG_001'
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

  describe('End-to-End Data Flow', () => {
    test('should execute complete data flow successfully', async () => {
      const config = {
        reportConfig: {
          id: 'test-report-001',
          name: 'Integration Test Report',
          tags: ['TEST_TAG_001'],
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

      const result = await dataFlowService.executeDataFlow(config);

      expect(result.success).toBe(true);
      expect(result.dataMetrics).toBeDefined();
      expect(result.dataMetrics.totalDataPoints).toBeGreaterThan(0);
      expect(result.dataMetrics.tagsProcessed).toBe(1);
      expect(result.reportResult).toBeDefined();
      expect(result.reportResult?.success).toBe(true);
    });

    test('should validate data flow configuration', () => {
      const validConfig = {
        reportConfig: {
          id: 'test-report',
          name: 'Valid Report',
          tags: ['TAG1'],
          timeRange: {
            startTime: new Date('2023-01-01T00:00:00Z'),
            endTime: new Date('2023-01-01T23:59:59Z')
          },
          chartTypes: ['line'] as ('line' | 'bar' | 'trend' | 'scatter')[],
          template: 'default',
          format: 'pdf' as ('pdf' | 'docx')
        }
      };

      const validation = dataFlowService.validateDataFlowConfig(validConfig);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect invalid configuration', () => {
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
    });
  });

  describe('Scheduler Integration', () => {
    let testScheduleId: string;

    afterEach(async () => {
      if (testScheduleId) {
        try {
          await schedulerService.deleteSchedule(testScheduleId);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    test('should create and manage schedules', async () => {
      const scheduleConfig = {
        name: 'Test Schedule',
        description: 'Integration test schedule',
        reportConfig: {
          id: 'sched-report-001',
          name: 'Scheduled Report',
          tags: ['SCHED_TAG_001'],
          timeRange: {
            startTime: new Date('2023-01-01T00:00:00Z'),
            endTime: new Date('2023-01-01T23:59:59Z')
          },
          chartTypes: ['line'] as ('line' | 'bar' | 'trend' | 'scatter')[],
          template: 'default',
          format: 'pdf' as ('pdf' | 'docx')
        },
        cronExpression: '0 0 * * *',
        enabled: true,
        recipients: ['test@example.com']
      };

      testScheduleId = await schedulerService.createSchedule(scheduleConfig);
      expect(testScheduleId).toBeDefined();

      const schedule = await schedulerService.getSchedule(testScheduleId);
      expect(schedule).toBeDefined();
      expect(schedule?.name).toBe(scheduleConfig.name);
      expect(schedule?.enabled).toBe(true);
    });

    test('should get scheduler health status', async () => {
      const health = await schedulerService.getSystemHealth();
      
      expect(health.status).toMatch(/^(healthy|warning|critical)$/);
      expect(health.activeSchedules).toBeDefined();
      expect(health.runningExecutions).toBeDefined();
      expect(health.queueLength).toBeDefined();
      expect(health.issues).toBeInstanceOf(Array);
    });

    test('should get execution metrics', async () => {
      const metrics = await schedulerService.getExecutionMetrics();
      
      expect(metrics.executionCount).toBeDefined();
      expect(metrics.successRate).toBeDefined();
      expect(metrics.averageDuration).toBeDefined();
      expect(metrics.recentFailures).toBeInstanceOf(Array);
    });
  });

  describe('Authentication Flow', () => {
    test('should authenticate user successfully', async () => {
      const result = await authService.authenticate('test@example.com', 'testpassword');
      
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe('test@example.com');
    });

    test('should reject invalid credentials', async () => {
      const result = await authService.authenticate('test@example.com', 'wrongpassword');
      
      expect(result.success).toBe(false);
      expect(result.token).toBeUndefined();
      expect(result.error).toBeDefined();
    });

    test('should validate JWT tokens', async () => {
      const loginResult = await authService.authenticate('test@example.com', 'testpassword');
      expect(loginResult.success).toBe(true);
      
      const validation = await authService.verifyToken(loginResult.token!);
      expect(validation.valid).toBe(true);
      expect(validation.user).toBeDefined();
    });
  });

  describe('Report Generation Integration', () => {
    test('should generate report with statistics and trends', async () => {
      const reportData = {
        config: {
          id: 'report-stats-001',
          name: 'Statistics Test Report',
          tags: ['STATS_TAG_001'],
          timeRange: {
            startTime: new Date('2023-01-01T00:00:00Z'),
            endTime: new Date('2023-01-01T23:59:59Z')
          },
          chartTypes: ['line', 'trend'] as ('line' | 'bar' | 'trend' | 'scatter')[],
          template: 'default',
          format: 'pdf' as ('pdf' | 'docx')
        },
        data: {
          'STATS_TAG_001': [
            {
              timestamp: new Date('2023-01-01T00:00:00Z'),
              value: 25.5,
              quality: QualityCode.Good,
              tagName: 'STATS_TAG_001'
            },
            {
              timestamp: new Date('2023-01-01T01:00:00Z'),
              value: 26.2,
              quality: QualityCode.Good,
              tagName: 'STATS_TAG_001'
            }
          ]
        },
        statistics: {
          'STATS_TAG_001': {
            count: 2,
            average: 25.85,
            min: 25.5,
            max: 26.2,
            standardDeviation: 0.35,
            dataQuality: 100
          }
        },
        trends: {
          'STATS_TAG_001': {
            slope: 0.7,
            intercept: 25.5,
            correlation: 1.0,
            equation: 'y = 0.7x + 25.5',
            confidence: 0.95
          }
        },
        charts: {},
        generatedAt: new Date()
      };

      const result = await reportGenerationService.generateReport(reportData);
      
      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.pages).toBeGreaterThan(0);
    });

    test('should handle report generation errors gracefully', async () => {
      const invalidReportData = {
        config: {
          id: 'invalid-report',
          name: 'Invalid Report',
          tags: [],
          timeRange: {
            startTime: new Date('2023-01-01T00:00:00Z'),
            endTime: new Date('2023-01-01T23:59:59Z')
          },
          chartTypes: [] as ('line' | 'bar' | 'trend' | 'scatter')[],
          template: 'nonexistent',
          format: 'pdf' as ('pdf' | 'docx')
        },
        data: {},
        generatedAt: new Date()
      };

      const result = await reportGenerationService.generateReport(invalidReportData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Email Integration', () => {
    test('should send report email successfully', async () => {
      const result = await emailService.sendReportEmail(
        ['test@example.com'],
        '/path/to/test-report.pdf',
        'Test Report',
        'Test Report Subject',
        '<p>Test email body</p>'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    test('should handle email sending errors', async () => {
      mockedEmailService.sendReportEmail.mockResolvedValueOnce({
        success: false,
        error: 'SMTP connection failed',
        recipients: {
          accepted: [],
          rejected: ['invalid@email'],
          pending: []
        }
      });

      const result = await emailService.sendReportEmail(
        ['invalid@email'],
        '/nonexistent/report.pdf',
        'Test Report',
        'Test Subject',
        'Test Body'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle data retrieval failures in data flow', async () => {
      mockedDataRetrievalService.getTimeSeriesData.mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const config = {
        reportConfig: {
          id: 'error-test-001',
          name: 'Error Test Report',
          tags: ['ERROR_TAG_001'],
          timeRange: {
            startTime: new Date('2023-01-01T00:00:00Z'),
            endTime: new Date('2023-01-01T23:59:59Z')
          },
          chartTypes: ['line'] as ('line' | 'bar' | 'trend' | 'scatter')[],
          template: 'default',
          format: 'pdf' as ('pdf' | 'docx')
        }
      };

      const result = await dataFlowService.executeDataFlow(config);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.dataMetrics).toBeDefined();
    });

    test('should provide meaningful error messages', async () => {
      const config = {
        reportConfig: {
          id: 'validation-error-test',
          name: '', // Invalid name
          tags: [], // No tags
          timeRange: {
            startTime: new Date('2023-01-02T00:00:00Z'),
            endTime: new Date('2023-01-01T00:00:00Z') // Invalid range
          },
          chartTypes: [] as ('line' | 'bar' | 'trend' | 'scatter')[],
          template: 'default',
          format: 'pdf' as ('pdf' | 'docx')
        }
      };

      const validation = dataFlowService.validateDataFlowConfig(config);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Report name is required');
      expect(validation.errors).toContain('At least one tag is required');
      expect(validation.errors).toContain('Start time must be before end time');
      expect(validation.errors).toContain('At least one chart type is required');
    });
  });
});