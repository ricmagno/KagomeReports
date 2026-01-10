/**
 * Scheduler Service
 * Handles cron-based scheduling for automated report generation
 * Requirements: 7.1, 7.2, 7.3
 */

import * as cron from 'node-cron';
import { Database } from 'sqlite3';
import path from 'path';
import { reportLogger } from '@/utils/logger';
import { env } from '@/config/environment';
import { ReportConfig, ReportData, reportGenerationService } from './reportGeneration';
import { dataRetrievalService } from './dataRetrieval';
import { statisticalAnalysisService } from './statisticalAnalysis';
import { emailService } from './emailService';
import { dataFlowService } from './dataFlowService';

export interface ScheduleConfig {
  id: string;
  name: string;
  description?: string | undefined;
  reportConfig: ReportConfig;
  cronExpression: string;
  enabled: boolean;
  nextRun?: Date | undefined;
  lastRun?: Date | undefined;
  lastStatus?: 'success' | 'failed' | 'running' | undefined;
  lastError?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
  recipients?: string[] | undefined;
}

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

export interface ScheduleQueue {
  scheduleId: string;
  scheduledTime: Date;
  priority: number;
  retryCount: number;
}

export class SchedulerService {
  private db!: Database;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private executionQueue: ScheduleQueue[] = [];
  private isProcessingQueue = false;
  private maxConcurrentJobs: number;
  private currentRunningJobs = 0;

  constructor() {
    this.maxConcurrentJobs = env.MAX_CONCURRENT_REPORTS || 5;
    this.initializeDatabase();
    this.startQueueProcessor();
  }

  /**
   * Initialize SQLite database for schedule storage
   */
  private initializeDatabase(): void {
    const dbPath = path.join(process.cwd(), 'data', 'scheduler.db');
    this.db = new Database(dbPath);

    // Create tables
    this.db.serialize(() => {
      // Schedules table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS schedules (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          report_config TEXT NOT NULL,
          cron_expression TEXT NOT NULL,
          enabled BOOLEAN DEFAULT 1,
          next_run DATETIME,
          last_run DATETIME,
          last_status TEXT,
          last_error TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          recipients TEXT
        )
      `);

      // Schedule executions table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS schedule_executions (
          id TEXT PRIMARY KEY,
          schedule_id TEXT NOT NULL,
          start_time DATETIME NOT NULL,
          end_time DATETIME,
          status TEXT NOT NULL,
          report_path TEXT,
          error TEXT,
          duration INTEGER,
          FOREIGN KEY (schedule_id) REFERENCES schedules (id)
        )
      `);

      // Execution queue table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS execution_queue (
          schedule_id TEXT NOT NULL,
          scheduled_time DATETIME NOT NULL,
          priority INTEGER DEFAULT 0,
          retry_count INTEGER DEFAULT 0,
          PRIMARY KEY (schedule_id, scheduled_time)
        )
      `);
    });

    reportLogger.info('Scheduler database initialized');
  }

  /**
   * Public initialize method for startup validation
   */
  async initialize(): Promise<void> {
    try {
      // Database is already initialized in constructor
      // This method is for startup validation
      reportLogger.info('Scheduler service initialization validated');
    } catch (error) {
      reportLogger.error('Scheduler service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create a new schedule
   */
  async createSchedule(config: Omit<ScheduleConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    // Validate cron expression
    if (!cron.validate(config.cronExpression)) {
      throw new Error(`Invalid cron expression: ${config.cronExpression}`);
    }

    const nextRun = this.getNextRunTime(config.cronExpression);

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO schedules (
          id, name, description, report_config, cron_expression, enabled,
          next_run, created_at, updated_at, recipients
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          scheduleId,
          config.name,
          config.description || null,
          JSON.stringify(config.reportConfig),
          config.cronExpression,
          config.enabled ? 1 : 0,
          nextRun.toISOString(),
          now.toISOString(),
          now.toISOString(),
          config.recipients ? JSON.stringify(config.recipients) : null
        ],
        (err) => {
          if (err) {
            reportLogger.error('Failed to create schedule', { error: err, scheduleId });
            reject(err);
          } else {
            reportLogger.info('Schedule created', { scheduleId, name: config.name });
            
            // Start the cron job if enabled
            if (config.enabled) {
              const fullConfig: ScheduleConfig = {
                ...config,
                id: scheduleId,
                nextRun,
                createdAt: now,
                updatedAt: now
              };
              // Start cron job after database operation completes
              try {
                this.startCronJob(fullConfig);
              } catch (error) {
                reportLogger.warn('Failed to start cron job during creation', { scheduleId, error });
              }
            }
            
            resolve(scheduleId);
          }
        }
      );
    });
  }

  /**
   * Get all schedules
   */
  async getSchedules(): Promise<ScheduleConfig[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM schedules ORDER BY created_at DESC',
        (err, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            const schedules = rows.map(row => ({
              id: row.id,
              name: row.name,
              description: row.description || undefined,
              reportConfig: JSON.parse(row.report_config),
              cronExpression: row.cron_expression,
              enabled: Boolean(row.enabled),
              nextRun: row.next_run ? new Date(row.next_run) : undefined,
              lastRun: row.last_run ? new Date(row.last_run) : undefined,
              lastStatus: row.last_status || undefined,
              lastError: row.last_error || undefined,
              createdAt: new Date(row.created_at),
              updatedAt: new Date(row.updated_at),
              recipients: row.recipients ? JSON.parse(row.recipients) : undefined
            } as ScheduleConfig));
            resolve(schedules);
          }
        }
      );
    });
  }

  /**
   * Get schedule by ID
   */
  async getSchedule(scheduleId: string): Promise<ScheduleConfig | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM schedules WHERE id = ?',
        [scheduleId],
        (err, row: any) => {
          if (err) {
            reject(err);
          } else if (!row) {
            resolve(null);
          } else {
            resolve({
              id: row.id,
              name: row.name,
              description: row.description || undefined,
              reportConfig: JSON.parse(row.report_config),
              cronExpression: row.cron_expression,
              enabled: Boolean(row.enabled),
              nextRun: row.next_run ? new Date(row.next_run) : undefined,
              lastRun: row.last_run ? new Date(row.last_run) : undefined,
              lastStatus: row.last_status || undefined,
              lastError: row.last_error || undefined,
              createdAt: new Date(row.created_at),
              updatedAt: new Date(row.updated_at),
              recipients: row.recipients ? JSON.parse(row.recipients) : undefined
            } as ScheduleConfig);
          }
        }
      );
    });
  }

  /**
   * Update a schedule
   */
  async updateSchedule(scheduleId: string, updates: Partial<ScheduleConfig>): Promise<void> {
    const schedule = await this.getSchedule(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }

    // Validate cron expression if being updated
    if (updates.cronExpression && !cron.validate(updates.cronExpression)) {
      throw new Error(`Invalid cron expression: ${updates.cronExpression}`);
    }

    const now = new Date();
    const nextRun = updates.cronExpression ? this.getNextRunTime(updates.cronExpression) : schedule.nextRun;

    return new Promise((resolve, reject) => {
      const fields = [];
      const values = [];

      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        fields.push('description = ?');
        values.push(updates.description);
      }
      if (updates.reportConfig !== undefined) {
        fields.push('report_config = ?');
        values.push(JSON.stringify(updates.reportConfig));
      }
      if (updates.cronExpression !== undefined) {
        fields.push('cron_expression = ?');
        values.push(updates.cronExpression);
        fields.push('next_run = ?');
        values.push(nextRun?.toISOString());
      }
      if (updates.enabled !== undefined) {
        fields.push('enabled = ?');
        values.push(updates.enabled ? 1 : 0);
      }
      if (updates.recipients !== undefined) {
        fields.push('recipients = ?');
        values.push(updates.recipients ? JSON.stringify(updates.recipients) : null);
      }

      fields.push('updated_at = ?');
      values.push(now.toISOString());
      values.push(scheduleId);

      this.db.run(
        `UPDATE schedules SET ${fields.join(', ')} WHERE id = ?`,
        values,
        (err) => {
          if (err) {
            reject(err);
          } else {
            reportLogger.info('Schedule updated', { scheduleId });

            // Restart cron job if necessary
            this.stopCronJob(scheduleId);
            if (updates.enabled !== false) {
              this.getSchedule(scheduleId).then(updatedSchedule => {
                if (updatedSchedule && updatedSchedule.enabled) {
                  this.startCronJob(updatedSchedule);
                }
              });
            }

            resolve();
          }
        }
      );
    });
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(scheduleId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM schedules WHERE id = ?',
        [scheduleId],
        (err) => {
          if (err) {
            reject(err);
          } else {
            this.stopCronJob(scheduleId);
            reportLogger.info('Schedule deleted', { scheduleId });
            resolve();
          }
        }
      );
    });
  }

  /**
   * Start all enabled schedules
   */
  async startAllSchedules(): Promise<void> {
    const schedules = await this.getSchedules();
    const enabledSchedules = schedules.filter(s => s.enabled);

    for (const schedule of enabledSchedules) {
      this.startCronJob(schedule);
    }

    reportLogger.info('Started all enabled schedules', { count: enabledSchedules.length });
  }

  /**
   * Stop all schedules
   */
  stopAllSchedules(): void {
    for (const [scheduleId, task] of this.scheduledJobs) {
      task.stop();
    }
    this.scheduledJobs.clear();
    reportLogger.info('Stopped all schedules');
  }

  /**
   * Start a cron job for a schedule
   */
  private startCronJob(schedule: ScheduleConfig): void {
    if (this.scheduledJobs.has(schedule.id)) {
      this.stopCronJob(schedule.id);
    }

    const task = cron.schedule(schedule.cronExpression, () => {
      this.queueExecution(schedule.id);
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    task.start();
    this.scheduledJobs.set(schedule.id, task);

    reportLogger.info('Cron job started', {
      scheduleId: schedule.id,
      cronExpression: schedule.cronExpression,
      nextRun: schedule.nextRun
    });
  }

  /**
   * Stop a cron job
   */
  private stopCronJob(scheduleId: string): void {
    const task = this.scheduledJobs.get(scheduleId);
    if (task) {
      task.stop();
      this.scheduledJobs.delete(scheduleId);
      reportLogger.info('Cron job stopped', { scheduleId });
    }
  }

  /**
   * Queue a schedule execution
   */
  private queueExecution(scheduleId: string, priority: number = 0): void {
    const queueItem: ScheduleQueue = {
      scheduleId,
      scheduledTime: new Date(),
      priority,
      retryCount: 0
    };

    this.executionQueue.push(queueItem);
    this.executionQueue.sort((a, b) => b.priority - a.priority); // Higher priority first

    reportLogger.info('Execution queued', { scheduleId, queueLength: this.executionQueue.length });
  }

  /**
   * Start the queue processor
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      if (!this.isProcessingQueue && this.executionQueue.length > 0 && this.currentRunningJobs < this.maxConcurrentJobs) {
        this.processQueue();
      }
    }, 1000); // Check every second
  }

  /**
   * Process the execution queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.executionQueue.length === 0 || this.currentRunningJobs >= this.maxConcurrentJobs) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      const queueItem = this.executionQueue.shift();
      if (queueItem) {
        this.currentRunningJobs++;
        this.executeSchedule(queueItem).finally(() => {
          this.currentRunningJobs--;
        });
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Execute a scheduled report
   */
  private async executeSchedule(queueItem: ScheduleQueue): Promise<void> {
    const { scheduleId } = queueItem;
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();

    try {
      reportLogger.info('Starting scheduled execution', { scheduleId, executionId });

      // Get schedule configuration
      const schedule = await this.getSchedule(scheduleId);
      if (!schedule || !schedule.enabled) {
        reportLogger.warn('Schedule not found or disabled', { scheduleId });
        return;
      }

      // Record execution start
      await this.recordExecution({
        id: executionId,
        scheduleId,
        startTime,
        status: 'running'
      });

      // Update schedule status
      await this.updateScheduleStatus(scheduleId, 'running', startTime);

      // Execute end-to-end data flow for the report
      const dataFlowResult = await dataFlowService.executeDataFlow({
        reportConfig: schedule.reportConfig,
        includeStatistics: true,
        includeTrends: true,
        includeAnomalies: false
      });

      if (!dataFlowResult.success) {
        throw new Error(dataFlowResult.error || 'Data flow execution failed');
      }

      // Generate the report (already done in data flow)
      const reportResult = dataFlowResult.reportResult!;

      if (!reportResult.success) {
        throw new Error(reportResult.error || 'Report generation failed');
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Record successful execution
      await this.recordExecution({
        id: executionId,
        scheduleId,
        startTime,
        endTime,
        status: 'success',
        reportPath: reportResult.filePath,
        duration
      } as ScheduleExecution);

      // Update schedule status
      const nextRun = this.getNextRunTime(schedule.cronExpression);
      await this.updateScheduleStatus(scheduleId, 'success', startTime, nextRun);

      // Send email if recipients are configured
      if (schedule.recipients && schedule.recipients.length > 0) {
        try {
          const emailResult = await emailService.sendReportEmail(
            schedule.recipients,
            reportResult.filePath!,
            schedule.reportConfig.name,
            `Scheduled Report: ${schedule.reportConfig.name}`,
            `
              <h2>Scheduled Report Delivery</h2>
              <p>Your scheduled report <strong>${schedule.reportConfig.name}</strong> has been generated and is attached to this email.</p>
              <p><strong>Schedule:</strong> ${schedule.name}</p>
              <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>Tags:</strong> ${schedule.reportConfig.tags.join(', ')}</p>
              <p><strong>Time Range:</strong> ${schedule.reportConfig.timeRange.startTime.toLocaleString()} - ${schedule.reportConfig.timeRange.endTime.toLocaleString()}</p>
              <hr>
              <p><em>This is an automated report from the Historian Reports system.</em></p>
            `
          );

          if (emailResult.success) {
            reportLogger.info('Report email sent successfully', {
              scheduleId,
              executionId,
              recipients: schedule.recipients,
              messageId: emailResult.messageId
            });
          } else {
            reportLogger.warn('Failed to send report email', {
              scheduleId,
              executionId,
              recipients: schedule.recipients,
              error: emailResult.error
            });
          }
        } catch (emailError) {
          reportLogger.error('Email sending failed with exception', {
            scheduleId,
            executionId,
            error: emailError
          });
        }
      }

      reportLogger.info('Scheduled execution completed successfully', {
        scheduleId,
        executionId,
        duration,
        reportPath: reportResult.filePath,
        emailSent: !!(schedule.recipients && schedule.recipients.length > 0)
      });

    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Record failed execution
      await this.recordExecution({
        id: executionId,
        scheduleId,
        startTime,
        endTime,
        status: 'failed',
        error: errorMessage,
        duration
      });

      // Update schedule status
      await this.updateScheduleStatus(scheduleId, 'failed', startTime, undefined, errorMessage);

      reportLogger.error('Scheduled execution failed', {
        scheduleId,
        executionId,
        error: errorMessage,
        duration
      });

      // Retry logic
      if (queueItem.retryCount < 3) {
        queueItem.retryCount++;
        queueItem.scheduledTime = new Date(Date.now() + (queueItem.retryCount * 60000)); // Retry after 1, 2, 3 minutes
        this.executionQueue.push(queueItem);
        reportLogger.info('Execution queued for retry', { scheduleId, retryCount: queueItem.retryCount });
      }
    }
  }

  /**
   * Record schedule execution
   */
  private async recordExecution(execution: ScheduleExecution): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO schedule_executions 
         (id, schedule_id, start_time, end_time, status, report_path, error, duration)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          execution.id,
          execution.scheduleId,
          execution.startTime.toISOString(),
          execution.endTime?.toISOString() || null,
          execution.status,
          execution.reportPath || null,
          execution.error || null,
          execution.duration || null
        ],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Update schedule status
   */
  private async updateScheduleStatus(
    scheduleId: string,
    status: 'success' | 'failed' | 'running',
    lastRun: Date,
    nextRun?: Date,
    error?: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const fields = ['last_status = ?', 'last_run = ?', 'updated_at = ?'];
      const values = [status, lastRun.toISOString(), new Date().toISOString()];

      if (nextRun) {
        fields.push('next_run = ?');
        values.push(nextRun.toISOString());
      }

      if (error !== undefined) {
        fields.push('last_error = ?');
        values.push(error);
      }

      values.push(scheduleId);

      this.db.run(
        `UPDATE schedules SET ${fields.join(', ')} WHERE id = ?`,
        values,
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Get next run time for cron expression
   */
  private getNextRunTime(cronExpression: string): Date {
    // Simple implementation - in production, use a proper cron parser
    const now = new Date();
    const nextRun = new Date(now.getTime() + 60000); // Default to 1 minute from now
    return nextRun;
  }

  /**
   * Get execution history for a schedule
   */
  async getExecutionHistory(scheduleId: string, limit: number = 50): Promise<ScheduleExecution[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM schedule_executions WHERE schedule_id = ? ORDER BY start_time DESC LIMIT ?',
        [scheduleId, limit],
        (err, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            const executions = rows.map(row => ({
              id: row.id,
              scheduleId: row.schedule_id,
              startTime: new Date(row.start_time),
              endTime: row.end_time ? new Date(row.end_time) : undefined,
              status: row.status,
              reportPath: row.report_path || undefined,
              error: row.error || undefined,
              duration: row.duration || undefined
            } as ScheduleExecution));
            resolve(executions);
          }
        }
      );
    });
  }

  /**
   * Get execution statistics for monitoring
   */
  async getExecutionStatistics(timeRange?: { startTime: Date; endTime: Date }): Promise<{
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageDuration: number;
    executionsByStatus: Record<string, number>;
    executionsBySchedule: Record<string, number>;
  }> {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM schedule_executions';
      const params: any[] = [];

      if (timeRange) {
        query += ' WHERE start_time >= ? AND start_time <= ?';
        params.push(timeRange.startTime.toISOString(), timeRange.endTime.toISOString());
      }

      this.db.all(query, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const totalExecutions = rows.length;
          const successfulExecutions = rows.filter(r => r.status === 'success').length;
          const failedExecutions = rows.filter(r => r.status === 'failed').length;
          
          const durationsWithValues = rows.filter(r => r.duration !== null).map(r => r.duration);
          const averageDuration = durationsWithValues.length > 0 
            ? durationsWithValues.reduce((sum, d) => sum + d, 0) / durationsWithValues.length 
            : 0;

          const executionsByStatus: Record<string, number> = {};
          const executionsBySchedule: Record<string, number> = {};

          rows.forEach(row => {
            executionsByStatus[row.status] = (executionsByStatus[row.status] || 0) + 1;
            executionsBySchedule[row.schedule_id] = (executionsBySchedule[row.schedule_id] || 0) + 1;
          });

          resolve({
            totalExecutions,
            successfulExecutions,
            failedExecutions,
            averageDuration,
            executionsByStatus,
            executionsBySchedule
          });
        }
      });
    });
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    activeSchedules: number;
    runningExecutions: number;
    queueLength: number;
    lastExecutionTime?: Date;
    issues: string[];
  }> {
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    try {
      const schedules = await this.getSchedules();
      const activeSchedules = schedules.filter(s => s.enabled).length;
      const queueLength = this.executionQueue.length;
      const runningExecutions = this.currentRunningJobs;

      // Check for issues
      if (queueLength > 10) {
        issues.push(`High queue length: ${queueLength} pending executions`);
        status = 'warning';
      }

      if (runningExecutions >= this.maxConcurrentJobs) {
        issues.push(`Maximum concurrent jobs reached: ${runningExecutions}/${this.maxConcurrentJobs}`);
        status = 'warning';
      }

      // Check for recent failures
      const recentStats = await this.getExecutionStatistics({
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        endTime: new Date()
      });

      const failureRate = recentStats.totalExecutions > 0 
        ? recentStats.failedExecutions / recentStats.totalExecutions 
        : 0;

      if (failureRate > 0.5) {
        issues.push(`High failure rate: ${Math.round(failureRate * 100)}% in last 24 hours`);
        status = 'critical';
      } else if (failureRate > 0.2) {
        issues.push(`Elevated failure rate: ${Math.round(failureRate * 100)}% in last 24 hours`);
        if (status === 'healthy') status = 'warning';
      }

      // Find last execution time
      let lastExecutionTime: Date | undefined;
      if (recentStats.totalExecutions > 0) {
        const lastExecution = await new Promise<any>((resolve, reject) => {
          this.db.get(
            'SELECT start_time FROM schedule_executions ORDER BY start_time DESC LIMIT 1',
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });
        
        if (lastExecution) {
          lastExecutionTime = new Date(lastExecution.start_time);
        }
      }

      return {
        status,
        activeSchedules,
        runningExecutions,
        queueLength,
        lastExecutionTime,
        issues
      } as {
        status: 'healthy' | 'warning' | 'critical';
        activeSchedules: number;
        runningExecutions: number;
        queueLength: number;
        lastExecutionTime?: Date;
        issues: string[];
      };
    } catch (error) {
      return {
        status: 'critical',
        activeSchedules: 0,
        runningExecutions: 0,
        queueLength: 0,
        issues: [`System health check failed: ${error}`]
      };
    }
  }

  /**
   * Get detailed execution metrics
   */
  async getExecutionMetrics(scheduleId?: string): Promise<{
    executionCount: number;
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
  }> {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM schedule_executions';
      const params: any[] = [];

      if (scheduleId) {
        query += ' WHERE schedule_id = ?';
        params.push(scheduleId);
      }

      query += ' ORDER BY start_time DESC';

      this.db.all(query, params, async (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const executionCount = rows.length;
          const successfulExecutions = rows.filter(r => r.status === 'success').length;
          const successRate = executionCount > 0 ? successfulExecutions / executionCount : 0;

          const durationsWithValues = rows.filter(r => r.duration !== null).map(r => r.duration);
          const averageDuration = durationsWithValues.length > 0 
            ? durationsWithValues.reduce((sum, d) => sum + d, 0) / durationsWithValues.length 
            : 0;

          const lastExecution = rows.length > 0 ? new Date(rows[0].start_time) : undefined;

          let nextExecution: Date | undefined;
          if (scheduleId) {
            const schedule = await this.getSchedule(scheduleId);
            nextExecution = schedule?.nextRun;
          }

          const recentFailures = rows
            .filter(r => r.status === 'failed')
            .slice(0, 5) // Last 5 failures
            .map(r => ({
              executionId: r.id,
              timestamp: new Date(r.start_time),
              error: r.error || 'Unknown error',
              duration: r.duration || undefined
            }));

          resolve({
            executionCount,
            successRate,
            averageDuration,
            lastExecution,
            nextExecution,
            recentFailures
          } as {
            executionCount: number;
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
          });
        }
      });
    });
  }

  /**
   * Retry failed execution
   */
  async retryExecution(executionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT schedule_id FROM schedule_executions WHERE id = ? AND status = "failed"',
        [executionId],
        (err, row: any) => {
          if (err) {
            reject(err);
          } else if (!row) {
            reject(new Error('Failed execution not found'));
          } else {
            // Queue the schedule for immediate execution with high priority
            this.queueExecution(row.schedule_id, 10); // High priority
            reportLogger.info('Execution retry queued', { executionId, scheduleId: row.schedule_id });
            resolve();
          }
        }
      );
    });
  }
  async cleanupExecutions(olderThanDays: number = 30): Promise<void> {
    const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
    
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM schedule_executions WHERE start_time < ?',
        [cutoffDate.toISOString()],
        function(err) {
          if (err) {
            reject(err);
          } else {
            reportLogger.info('Cleaned up old execution records', { deletedCount: this.changes });
            resolve();
          }
        }
      );
    });
  }

  /**
   * Shutdown the scheduler
   */
  shutdown(): void {
    this.stopAllSchedules();
    this.db.close();
    reportLogger.info('Scheduler service shutdown');
  }
}

// Export singleton instance
export const schedulerService = new SchedulerService();