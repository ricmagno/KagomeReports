/**
 * Schedule Types
 * TypeScript interfaces for scheduled reports feature
 */

import { ReportConfig } from './api';

/**
 * Schedule configuration interface
 * Represents a scheduled report automation
 */
export interface Schedule {
  id: string;
  name: string;
  description?: string;
  reportConfig: ReportConfig;
  cronExpression: string;
  enabled: boolean;
  nextRun?: Date;
  lastRun?: Date;
  lastStatus?: 'success' | 'failed' | 'running';
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
  recipients?: string[];
  saveToFile?: boolean;
  sendEmail?: boolean;
  destinationPath?: string;
}

/**
 * Schedule execution record
 * Represents a single execution of a scheduled report
 */
export interface ScheduleExecution {
  id: string;
  scheduleId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'success' | 'failed';
  reportPath?: string;
  error?: string;
  duration?: number;
}

/**
 * Pagination metadata for API responses
 */
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Schedule creation/update payload
 * Omits auto-generated fields
 */
export type ScheduleConfig = Omit<Schedule, 'id' | 'createdAt' | 'updatedAt' | 'nextRun' | 'lastRun' | 'lastStatus' | 'lastError'>;

/**
 * Schedule update payload
 * All fields are optional for partial updates
 */
export type ScheduleUpdatePayload = Partial<Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * Execution history query parameters
 */
export interface ExecutionHistoryParams {
  page?: number;
  limit?: number;
  status?: 'running' | 'success' | 'failed';
}

/**
 * Schedule list query parameters
 */
export interface ScheduleListParams {
  page?: number;
  limit?: number;
  enabled?: boolean;
  search?: string;
}

/**
 * Execution statistics summary
 */
export interface ExecutionStatistics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  averageDuration: number;
  lastExecution?: Date;
  nextExecution?: Date;
  recentFailures: Array<{
    executionId: string;
    timestamp: Date;
    error: string;
    duration?: number;
  }>;
}

/**
 * System health status for scheduler
 */
export interface SchedulerHealth {
  status: 'healthy' | 'warning' | 'critical';
  activeSchedules: number;
  runningExecutions: number;
  queueLength: number;
  lastExecutionTime?: Date;
  issues: string[];
}
