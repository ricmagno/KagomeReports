/**
 * Tests for Schedule API Service Methods
 * Validates API service integration for scheduled reports
 */

import { apiService, setAuthToken } from '../api';
import { Schedule, ScheduleConfig, ScheduleExecution } from '../../types/schedule';

// Mock fetch globally
global.fetch = jest.fn();

describe('Schedule API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setAuthToken('test-token');
  });

  afterEach(() => {
    setAuthToken(null);
  });

  describe('getSchedules', () => {
    it('should fetch all schedules without parameters', async () => {
      const mockResponse = {
        success: true,
        data: {
          schedules: [
            {
              id: 'schedule-1',
              name: 'Daily Report',
              cronExpression: '0 9 * * *',
              enabled: true,
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-01'),
            },
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
          },
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      const result = await apiService.getSchedules();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/schedules'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
          }),
        })
      );
      expect(result.success).toBe(true);
      expect(result.data.schedules).toHaveLength(1);
    });

    it('should fetch schedules with pagination and filters', async () => {
      const mockResponse = {
        success: true,
        data: {
          schedules: [],
          pagination: {
            page: 2,
            limit: 20,
            total: 50,
            totalPages: 3,
          },
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      const result = await apiService.getSchedules({
        page: 2,
        limit: 20,
        enabled: true,
        search: 'daily',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=20'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('enabled=true'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=daily'),
        expect.any(Object)
      );
    });
  });

  describe('getSchedule', () => {
    it('should fetch a single schedule by ID', async () => {
      const mockSchedule: Schedule = {
        id: 'schedule-1',
        name: 'Daily Report',
        description: 'Daily automated report',
        reportConfig: {
          name: 'Test Report',
          description: 'Test',
          tags: ['tag1'],
          timeRange: {
            startTime: new Date('2024-01-01'),
            endTime: new Date('2024-01-02'),
          },
          chartTypes: ['line'],
          template: 'default',
        },
        cronExpression: '0 9 * * *',
        enabled: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: mockSchedule }),
      });

      const result = await apiService.getSchedule('schedule-1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/schedules/schedule-1'),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.data.id).toBe('schedule-1');
    });
  });

  describe('createSchedule', () => {
    it('should create a new schedule', async () => {
      const newSchedule: ScheduleConfig = {
        name: 'Weekly Report',
        description: 'Weekly automated report',
        reportConfig: {
          name: 'Test Report',
          description: 'Test',
          tags: ['tag1'],
          timeRange: {
            startTime: new Date('2024-01-01'),
            endTime: new Date('2024-01-02'),
          },
          chartTypes: ['line'],
          template: 'default',
        },
        cronExpression: '0 9 * * 1',
        enabled: true,
        recipients: ['user@example.com'],
      };

      const mockResponse = {
        success: true,
        data: {
          scheduleId: 'schedule-new',
          schedule: { ...newSchedule, id: 'schedule-new' },
          message: 'Schedule created successfully',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      const result = await apiService.createSchedule(newSchedule);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/schedules'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(newSchedule),
        })
      );
      expect(result.success).toBe(true);
      expect(result.data.scheduleId).toBe('schedule-new');
    });
  });

  describe('updateSchedule', () => {
    it('should update an existing schedule', async () => {
      const updates = {
        name: 'Updated Report Name',
        enabled: false,
      };

      const mockResponse = {
        success: true,
        data: {
          schedule: { id: 'schedule-1', ...updates },
          message: 'Schedule updated successfully',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      const result = await apiService.updateSchedule('schedule-1', updates);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/schedules/schedule-1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updates),
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('deleteSchedule', () => {
    it('should delete a schedule', async () => {
      const mockResponse = {
        success: true,
        data: {
          message: 'Schedule deleted successfully',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      const result = await apiService.deleteSchedule('schedule-1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/schedules/schedule-1'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('enableSchedule', () => {
    it('should enable a schedule', async () => {
      const mockResponse = {
        success: true,
        data: {
          schedule: { id: 'schedule-1', enabled: true },
          message: 'Schedule enabled successfully',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      const result = await apiService.enableSchedule('schedule-1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/schedules/schedule-1/enable'),
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('disableSchedule', () => {
    it('should disable a schedule', async () => {
      const mockResponse = {
        success: true,
        data: {
          schedule: { id: 'schedule-1', enabled: false },
          message: 'Schedule disabled successfully',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      const result = await apiService.disableSchedule('schedule-1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/schedules/schedule-1/disable'),
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('executeSchedule', () => {
    it('should manually execute a schedule', async () => {
      const mockResponse = {
        success: true,
        data: {
          executionId: 'exec-123',
          status: 'queued',
          message: 'Schedule execution queued',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      const result = await apiService.executeSchedule('schedule-1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/schedules/schedule-1/execute'),
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result.success).toBe(true);
      expect(result.data.executionId).toBe('exec-123');
    });
  });

  describe('getExecutionHistory', () => {
    it('should fetch execution history for a schedule', async () => {
      const mockExecutions: ScheduleExecution[] = [
        {
          id: 'exec-1',
          scheduleId: 'schedule-1',
          startTime: new Date('2024-01-01T09:00:00Z'),
          endTime: new Date('2024-01-01T09:05:00Z'),
          status: 'success',
          reportPath: '/reports/report-1.pdf',
          duration: 300000,
        },
      ];

      const mockResponse = {
        success: true,
        data: {
          executions: mockExecutions,
          pagination: {
            page: 1,
            limit: 50,
            total: 1,
            totalPages: 1,
          },
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      const result = await apiService.getExecutionHistory('schedule-1', {
        page: 1,
        limit: 50,
        status: 'success',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/schedules/schedule-1/executions'),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.data.executions).toHaveLength(1);
    });
  });

  describe('getExecutionStatistics', () => {
    it('should fetch execution statistics for a schedule', async () => {
      const mockStats = {
        totalExecutions: 100,
        successfulExecutions: 95,
        failedExecutions: 5,
        successRate: 0.95,
        averageDuration: 250000,
        lastExecution: new Date('2024-01-15T09:00:00Z'),
        nextExecution: new Date('2024-01-16T09:00:00Z'),
        recentFailures: [],
      };

      const mockResponse = {
        success: true,
        data: mockStats,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      const result = await apiService.getExecutionStatistics('schedule-1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/schedules/schedule-1/statistics'),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.data.successRate).toBe(0.95);
    });
  });

  describe('getSchedulerHealth', () => {
    it('should fetch scheduler system health', async () => {
      const mockHealth = {
        status: 'healthy' as const,
        activeSchedules: 10,
        runningExecutions: 2,
        queueLength: 0,
        issues: [],
      };

      const mockResponse = {
        success: true,
        data: mockHealth,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      const result = await apiService.getSchedulerHealth();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/schedules/health'),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('healthy');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Schedule not found' }),
      });

      await expect(apiService.getSchedule('non-existent')).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(apiService.getSchedules()).rejects.toThrow('Network error');
    });
  });
});
