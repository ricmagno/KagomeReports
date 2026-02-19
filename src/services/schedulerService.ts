/**
 * Scheduler Service
 * Handles cron-based scheduling for automated report generation
 * Requirements: 7.1, 7.2, 7.3
 */

import * as cron from 'node-cron';
import { Database } from 'sqlite3';
import path from 'path';
import { reportLogger } from '@/utils/logger';
import { env, getDatabasePath } from '@/config/environment';
import { ReportConfig, ReportData, reportGenerationService } from './reportGeneration';
import { dataRetrievalService } from './dataRetrieval';
import { statisticalAnalysisService } from './statisticalAnalysis';
import { emailService } from './emailService';
import { dataFlowService } from './dataFlowService';
import { getNextRunTime } from '@/utils/cronUtils';

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
  saveToFile?: boolean | undefined;
  sendEmail?: boolean | undefined;
  destinationPath?: string | undefined;
  createdByUserId?: string | undefined;
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
  manualExecutionId?: string;
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
  }

  /**
   * Initialize SQLite database for schedule storage
   */
  private async initializeDatabase(): Promise<void> {
    const dbPath = getDatabasePath('scheduler.db');
    this.db = new Database(dbPath);
    this.db.configure('busyTimeout', 10000); // 10 seconds timeout

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Enable WAL mode for better concurrency
        this.db.run('PRAGMA journal_mode = WAL');
        this.db.run('PRAGMA synchronous = NORMAL');

        // Create tables
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
            recipients TEXT,
            save_to_file BOOLEAN DEFAULT 1,
            send_email BOOLEAN DEFAULT 0,
            destination_path TEXT,
            created_by TEXT
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

        // Migration: Add new columns if they don't exist
        this.db.all("PRAGMA table_info(schedules)", (err, columns: any[]) => {
          if (err) {
            reportLogger.error('Failed to check table schema', { error: err });
            reject(err);
            return;
          }

          const columnNames = columns.map(col => col.name);

          if (!columnNames.includes('save_to_file')) {
            this.db.run('ALTER TABLE schedules ADD COLUMN save_to_file BOOLEAN DEFAULT 1');
          }

          if (!columnNames.includes('send_email')) {
            this.db.run('ALTER TABLE schedules ADD COLUMN send_email BOOLEAN DEFAULT 0');
          }

          if (!columnNames.includes('destination_path')) {
            this.db.run('ALTER TABLE schedules ADD COLUMN destination_path TEXT');
          }

          if (!columnNames.includes('created_by')) {
            this.db.run('ALTER TABLE schedules ADD COLUMN created_by TEXT');
          }

          // Migrate existing schedules: set send_email=1 if recipients exist
          this.db.run(`
            UPDATE schedules 
            SET send_email = 1 
            WHERE recipients IS NOT NULL 
              AND recipients != '[]' 
              AND send_email IS NULL
          `, (err) => {
            if (err) {
              reportLogger.error('Failed to migrate existing schedules', { error: err });
              reject(err);
            } else {
              reportLogger.info('Migrated existing schedules with recipients');
              reportLogger.info('Scheduler database initialized');
              resolve();
            }
          });
        });
      });
    });
  }

  /**
   * Public initialize method for startup validation
   */
  async initialize(): Promise<void> {
    try {
      // Ensure database is initialized before proceeding
      await this.initializeDatabase();

      // Start queue processor
      this.startQueueProcessor();

      reportLogger.info('Scheduler service initialization validated');

      // Start all enabled schedules
      await this.startAllSchedules();
    } catch (error) {
      reportLogger.error('Scheduler service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create a new schedule
   */
  async createSchedule(config: Omit<ScheduleConfig, 'id' | 'createdAt' | 'updatedAt'>, userId?: string): Promise<string> {
    const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    // Validate cron expression
    if (!cron.validate(config.cronExpression)) {
      throw new Error(`Invalid cron expression: ${config.cronExpression}`);
    }

    const nextRun = this.getNextRunTime(config.cronExpression);

    // Set defaults for delivery options
    const saveToFile = config.saveToFile !== undefined ? config.saveToFile : true;
    const sendEmail = config.sendEmail !== undefined ? config.sendEmail : (config.recipients && config.recipients.length > 0);
    const destinationPath = config.destinationPath || null;

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO schedules (
          id, name, description, report_config, cron_expression, enabled,
          next_run, created_at, updated_at, recipients, save_to_file, send_email, destination_path, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          config.recipients ? JSON.stringify(config.recipients) : null,
          saveToFile ? 1 : 0,
          sendEmail ? 1 : 0,
          destinationPath,
          userId || null
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
  async getSchedules(userId?: string): Promise<ScheduleConfig[]> {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM schedules';
      const params: any[] = [];

      if (userId) {
        query += ' WHERE created_by = ? OR created_by IS NULL';
        params.push(userId);
      }

      query += ' ORDER BY created_at DESC';

      this.db.all(
        query,
        params,
        (err, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            const schedules = rows.map(row => {
              const reportConfig = JSON.parse(row.report_config);
              // Convert date strings back to Date objects
              if (reportConfig.timeRange) {
                reportConfig.timeRange.startTime = new Date(reportConfig.timeRange.startTime);
                reportConfig.timeRange.endTime = new Date(reportConfig.timeRange.endTime);
              }

              return {
                id: row.id,
                name: row.name,
                description: row.description || undefined,
                reportConfig,
                cronExpression: row.cron_expression,
                enabled: Boolean(row.enabled),
                nextRun: row.next_run ? new Date(row.next_run) : undefined,
                lastRun: row.last_run ? new Date(row.last_run) : undefined,
                lastStatus: row.last_status || undefined,
                lastError: row.last_error || undefined,
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at),
                recipients: row.recipients ? JSON.parse(row.recipients) : undefined,
                saveToFile: row.save_to_file !== undefined ? Boolean(row.save_to_file) : true,
                sendEmail: row.send_email !== undefined ? Boolean(row.send_email) : false,
                destinationPath: row.destination_path || undefined,
                createdByUserId: row.created_by || undefined
              } as ScheduleConfig;
            });
            resolve(schedules);
          }
        }
      );
    });
  }

  /**
   * Get schedule by ID
   */
  async getSchedule(scheduleId: string, userId?: string): Promise<ScheduleConfig | null> {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM schedules WHERE id = ?';
      const params: any[] = [scheduleId];

      if (userId) {
        query += ' AND (created_by = ? OR created_by IS NULL)';
        params.push(userId);
      }

      this.db.get(
        query,
        params,
        (err, row: any) => {
          if (err) {
            reject(err);
          } else if (!row) {
            resolve(null);
          } else {
            const reportConfig = JSON.parse(row.report_config);
            // Convert date strings back to Date objects
            if (reportConfig.timeRange) {
              reportConfig.timeRange.startTime = new Date(reportConfig.timeRange.startTime);
              reportConfig.timeRange.endTime = new Date(reportConfig.timeRange.endTime);
              // preserve relativeRange if it exists
            }

            resolve({
              id: row.id,
              name: row.name,
              description: row.description || undefined,
              reportConfig,
              cronExpression: row.cron_expression,
              enabled: Boolean(row.enabled),
              nextRun: row.next_run ? new Date(row.next_run) : undefined,
              lastRun: row.last_run ? new Date(row.last_run) : undefined,
              lastStatus: row.last_status || undefined,
              lastError: row.last_error || undefined,
              createdAt: new Date(row.created_at),
              updatedAt: new Date(row.updated_at),
              recipients: row.recipients ? JSON.parse(row.recipients) : undefined,
              saveToFile: row.save_to_file !== undefined ? Boolean(row.save_to_file) : true,
              sendEmail: row.send_email !== undefined ? Boolean(row.send_email) : false,
              destinationPath: row.destination_path || undefined,
              createdByUserId: row.created_by || undefined
            } as ScheduleConfig);
          }
        }
      );
    });
  }

  /**
   * Update a schedule
   */
  async updateSchedule(scheduleId: string, updates: Partial<ScheduleConfig>, userId?: string): Promise<void> {
    const schedule = await this.getSchedule(scheduleId, userId);
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
      const fields: string[] = [];
      const values: any[] = [] as any[];

      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        fields.push('description = ?');
        values.push(updates.description || null);
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
        values.push(updates.recipients && updates.recipients.length > 0 ? JSON.stringify(updates.recipients) : null);
      }
      if (updates.saveToFile !== undefined) {
        fields.push('save_to_file = ?');
        values.push(updates.saveToFile ? 1 : 0);
      }
      if (updates.sendEmail !== undefined) {
        fields.push('send_email = ?');
        values.push(updates.sendEmail ? 1 : 0);
      }
      if (updates.destinationPath !== undefined) {
        fields.push('destination_path = ?');
        values.push(updates.destinationPath || null);
      }

      // Always update the updated_at timestamp
      fields.push('updated_at = ?');
      values.push(now.toISOString());

      // Add scheduleId as the last parameter for the WHERE clause
      values.push(scheduleId);

      const sql = `UPDATE schedules SET ${fields.join(', ')} WHERE id = ?`;

      reportLogger.info('Updating schedule', {
        scheduleId,
        fields: fields.map(f => f.split(' = ')[0]),
        sql
      });

      this.db.run(sql, values, function (err) {
        if (err) {
          reportLogger.error('Failed to update schedule in database', {
            scheduleId,
            error: err,
            sql,
            values
          });
          reject(err);
        } else {
          reportLogger.info('Schedule updated in database', {
            scheduleId,
            changes: this.changes
          });

          // Restart cron job if necessary
          schedulerService.stopCronJob(scheduleId);
          if (updates.enabled !== false) {
            schedulerService.getSchedule(scheduleId).then(updatedSchedule => {
              if (updatedSchedule && updatedSchedule.enabled) {
                schedulerService.startCronJob(updatedSchedule);
              }
            }).catch(err => {
              reportLogger.error('Failed to restart cron job after update', { scheduleId, error: err });
            });
          }

          resolve();
        }
      });
    });
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(scheduleId: string, userId?: string): Promise<void> {
    const schedule = await this.getSchedule(scheduleId, userId);
    if (!schedule) {
      throw new Error(`Schedule not found or unauthorized: ${scheduleId}`);
    }

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
    const now = new Date();

    for (const schedule of enabledSchedules) {
      // Refresh next run time on startup to ensure it's not in the past
      const nextRun = this.getNextRunTime(schedule.cronExpression);

      // If nextRun is missing or in the past, update it
      if (!schedule.nextRun || schedule.nextRun < now) {
        reportLogger.info('Refreshing stale next run time on startup', {
          scheduleId: schedule.id,
          oldNextRun: schedule.nextRun,
          newNextRun: nextRun
        });

        await new Promise<void>((resolve, reject) => {
          this.db.run(
            'UPDATE schedules SET next_run = ?, updated_at = ? WHERE id = ?',
            [nextRun.toISOString(), now.toISOString(), schedule.id],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        schedule.nextRun = nextRun;
      }

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
   * Manually execute a schedule immediately
   * @param scheduleId - The ID of the schedule to execute
   * @param userId - Optional user ID for authorization check
   * @returns Execution ID for tracking
   */
  async executeScheduleManually(scheduleId: string, userId?: string): Promise<string> {
    // Verify schedule exists
    const schedule = await this.getSchedule(scheduleId, userId);
    if (!schedule) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }

    // Generate execution ID
    const executionId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Queue with high priority (10) for manual executions
    this.queueExecution(scheduleId, 10, executionId);

    reportLogger.info('Manual execution queued', { scheduleId, executionId, priority: 10 });

    return executionId;
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
      timezone: env.DEFAULT_TIMEZONE
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
  private queueExecution(scheduleId: string, priority: number = 0, manualExecutionId?: string): void {
    const queueItem: ScheduleQueue = {
      scheduleId,
      scheduledTime: new Date(),
      priority,
      retryCount: 0,
      ...(manualExecutionId ? { manualExecutionId } : {})
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
    const { scheduleId, manualExecutionId } = queueItem;
    const executionId = manualExecutionId || `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();

    try {
      reportLogger.info('Starting scheduled execution', { scheduleId, executionId });

      // Get schedule configuration
      const schedule = await this.getSchedule(scheduleId);
      if (!schedule || !schedule.enabled) {
        reportLogger.warn('Schedule not found or disabled', { scheduleId });
        return;
      }

      // Recalculate time range if relativeRange is specified
      if (schedule.reportConfig.timeRange.relativeRange) {
        const { startTime: newStart, endTime: newEnd } = this.calculateRelativeTimeRange(schedule.reportConfig.timeRange.relativeRange);
        schedule.reportConfig.timeRange.startTime = newStart;
        schedule.reportConfig.timeRange.endTime = newEnd;

        reportLogger.info('Recalculated relative time range for scheduled execution', {
          scheduleId,
          executionId,
          relativeRange: schedule.reportConfig.timeRange.relativeRange,
          startTime: newStart,
          endTime: newEnd
        });
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
        includeStatistics: schedule.reportConfig.includeStatsSummary ?? true,
        includeTrends: schedule.reportConfig.includeTrendLines ?? true,
        includeAnomalies: false,
        includeDataTable: schedule.reportConfig.includeDataTable ?? false
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

      // Determine delivery methods (with defaults)
      const saveToFile = schedule.saveToFile !== undefined ? schedule.saveToFile : true;
      const sendEmail = schedule.sendEmail !== undefined ? schedule.sendEmail : (schedule.recipients && schedule.recipients.length > 0);

      let reportPath = reportResult.filePath;
      let fileSaveError: string | undefined;
      let emailSendError: string | undefined;

      // Handle file saving
      if (saveToFile) {
        try {
          // If custom destination path is provided, move/copy the file
          if (schedule.destinationPath && reportResult.filePath) {
            const fs = await import('fs/promises');
            const path = await import('path');

            // Sanitize and validate destination path
            const sanitizedPath = schedule.destinationPath.replace(/\.\./g, '');
            const destDir = path.isAbsolute(sanitizedPath)
              ? sanitizedPath
              : path.join(env.REPORTS_DIR, sanitizedPath);

            // Create directory if it doesn't exist
            await fs.mkdir(destDir, { recursive: true });

            // Copy file to destination
            const fileName = path.basename(reportResult.filePath);
            const destPath = path.join(destDir, fileName);
            await fs.copyFile(reportResult.filePath, destPath);

            reportPath = destPath;
            reportLogger.info('Report saved to custom destination', {
              scheduleId,
              executionId,
              destinationPath: destPath
            });
          } else {
            reportLogger.info('Report saved to default location', {
              scheduleId,
              executionId,
              reportPath: reportResult.filePath
            });
          }
        } catch (fileError) {
          fileSaveError = fileError instanceof Error ? fileError.message : 'Unknown file save error';
          reportLogger.error('Failed to save report to custom destination', {
            scheduleId,
            executionId,
            error: fileSaveError,
            destinationPath: schedule.destinationPath
          });
          // Rethrow if save to file is required but failed
          throw new Error(`Failed to save report to destination: ${fileSaveError}`);
        }
      } else {
        reportLogger.info('File saving disabled for this schedule', { scheduleId, executionId });
      }

      // Handle email delivery
      if (sendEmail && schedule.recipients && schedule.recipients.length > 0) {
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
            emailSendError = emailResult.error;
            reportLogger.warn('Failed to send report email', {
              scheduleId,
              executionId,
              recipients: schedule.recipients,
              error: emailResult.error
            });
          }
        } catch (emailError) {
          emailSendError = emailError instanceof Error ? emailError.message : 'Unknown email error';
          reportLogger.error('Email sending failed with exception', {
            scheduleId,
            executionId,
            error: emailError
          });
        }
      } else if (sendEmail) {
        reportLogger.warn('Email delivery enabled but no recipients configured', { scheduleId, executionId });
      } else {
        reportLogger.info('Email delivery disabled for this schedule', { scheduleId, executionId });
      }

      // Record successful execution
      await this.recordExecution({
        id: executionId,
        scheduleId,
        startTime,
        endTime,
        status: 'success',
        reportPath: reportPath,
        duration
      } as ScheduleExecution);

      // Update schedule status
      const nextRun = this.getNextRunTime(schedule.cronExpression);
      await this.updateScheduleStatus(scheduleId, 'success', startTime, nextRun);

      reportLogger.info('Scheduled execution completed successfully', {
        scheduleId,
        executionId,
        duration,
        reportPath: reportPath,
        saveToFile,
        sendEmail,
        fileSaved: saveToFile && !fileSaveError,
        emailSent: sendEmail && !emailSendError,
        fileSaveError,
        emailSendError
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
   * Calculate absolute time range from a relative range string
   */
  private calculateRelativeTimeRange(relativeRange: string): { startTime: Date; endTime: Date } {
    const now = new Date();
    let startTime: Date;

    switch (relativeRange) {
      case 'last1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'last2h':
        startTime = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        break;
      case 'last6h':
        startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case 'last12h':
        startTime = new Date(now.getTime() - 12 * 60 * 60 * 1000);
        break;
      case 'last24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'last7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    return { startTime, endTime: now };
  }

  /**
   * Get next run time for cron expression
   */
  private getNextRunTime(cronExpression: string): Date {
    try {
      return getNextRunTime(cronExpression, undefined, env.DEFAULT_TIMEZONE);
    } catch (error) {
      reportLogger.warn('Failed to calculate next run time using utility, falling back to basic calculation', {
        cronExpression,
        error: error instanceof Error ? error.message : String(error)
      });
      // Fallback: 1 minute from now
      return new Date(Date.now() + 60000);
    }
  }

  /**
   * Get execution history for a schedule
   */
  async getExecutionHistory(scheduleId: string, limit: number = 50, userId?: string): Promise<ScheduleExecution[]> {
    // Optional ownership check
    if (userId) {
      const schedule = await this.getSchedule(scheduleId, userId);
      if (!schedule) {
        throw new Error(`Schedule not found or unauthorized: ${scheduleId}`);
      }
    }

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
   * Get a single execution by ID
   */
  async getExecution(executionId: string): Promise<ScheduleExecution | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM schedule_executions WHERE id = ?',
        [executionId],
        (err, row: any) => {
          if (err) {
            reject(err);
          } else if (!row) {
            resolve(null);
          } else {
            resolve({
              id: row.id,
              scheduleId: row.schedule_id,
              startTime: new Date(row.start_time),
              endTime: row.end_time ? new Date(row.end_time) : undefined,
              status: row.status,
              reportPath: row.report_path || undefined,
              error: row.error || undefined,
              duration: row.duration || undefined
            } as ScheduleExecution);
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
        function (err) {
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
  async shutdown(): Promise<void> {
    this.stopAllSchedules();
    return new Promise((resolve) => {
      this.db.close((err) => {
        if (err) {
          reportLogger.error('Error closing scheduler database', { error: err });
        } else {
          reportLogger.info('Scheduler database closed');
        }
        resolve();
      });
    });
  }
}

// Export singleton instance
export const schedulerService = new SchedulerService();