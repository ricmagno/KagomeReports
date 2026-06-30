/**
 * Scheduler Service
 * Handles cron-based scheduling for automated report generation
 * Requirements: 7.1, 7.2, 7.3
 */

import * as cron from 'node-cron';
import Database from 'better-sqlite3';
import path from 'path';
import { reportLogger } from '@/utils/logger';
import { env, getDatabasePath } from '@/config/environment';
import { ReportConfig, ReportData, ReportResult, reportGenerationService } from './reportGeneration';
import { dataRetrievalService } from './dataRetrieval';
import { statisticalAnalysisService } from './statisticalAnalysis';
import { emailService } from './emailService';
import { dataFlowService } from './dataFlowService';
import { ReportManagementService } from './reportManagementService';
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
  /** When set, each execution loads the LATEST saved version of this report
   *  from ReportManagementService instead of using the stored snapshot. */
  linkedReportId?: string | undefined;
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
  private db!: Database.Database;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private executionQueue: ScheduleQueue[] = [];
  private isProcessingQueue = false;
  private maxConcurrentJobs: number;
  private currentRunningJobs = 0;
  /** Lazily-initialised ReportManagementService for loading versioned configs */
  private _reportMgmtService: ReportManagementService | null = null;

  private get reportMgmtService(): ReportManagementService {
    if (!this._reportMgmtService) {
      const Db = require('better-sqlite3');
      const reportsDb = new Db(getDatabasePath('reports.db'));
      this._reportMgmtService = new ReportManagementService(reportsDb);
    }
    return this._reportMgmtService;
  }

  constructor() {
    this.maxConcurrentJobs = env.MAX_CONCURRENT_REPORTS || 5;
  }

  /**
   * Initialize SQLite database for schedule storage
   */
  private initializeDatabase(): void {
    const dbPath = getDatabasePath('scheduler.db');
    this.db = new Database(dbPath);
    this.db.pragma('busy_timeout = 10000');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');

    this.db.exec(`
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
        created_by TEXT,
        linked_report_id TEXT
      )
    `);

    this.db.exec(`
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

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS execution_queue (
        schedule_id TEXT NOT NULL,
        scheduled_time DATETIME NOT NULL,
        priority INTEGER DEFAULT 0,
        retry_count INTEGER DEFAULT 0,
        PRIMARY KEY (schedule_id, scheduled_time)
      )
    `);

    // Column migrations
    const columns = this.db.pragma('table_info(schedules)') as any[];
    const columnNames = columns.map(col => col.name);

    if (!columnNames.includes('save_to_file')) {
      this.db.exec('ALTER TABLE schedules ADD COLUMN save_to_file BOOLEAN DEFAULT 1');
    }
    if (!columnNames.includes('send_email')) {
      this.db.exec('ALTER TABLE schedules ADD COLUMN send_email BOOLEAN DEFAULT 0');
    }
    if (!columnNames.includes('destination_path')) {
      this.db.exec('ALTER TABLE schedules ADD COLUMN destination_path TEXT');
    }
    if (!columnNames.includes('created_by')) {
      this.db.exec('ALTER TABLE schedules ADD COLUMN created_by TEXT');
    }
    if (!columnNames.includes('linked_report_id')) {
      this.db.exec('ALTER TABLE schedules ADD COLUMN linked_report_id TEXT');
    }

    // Migrate existing schedules: set send_email=1 if recipients exist
    this.db.prepare(`
      UPDATE schedules
      SET send_email = 1
      WHERE recipients IS NOT NULL
        AND recipients != '[]'
        AND send_email IS NULL
    `).run();

    reportLogger.info('Migrated existing schedules with recipients');
    reportLogger.info('Scheduler database initialized');
  }

  /**
   * Public initialize method for startup validation
   */
  async initialize(): Promise<void> {
    try {
      this.initializeDatabase();
      this.startQueueProcessor();
      reportLogger.info('Scheduler service initialization validated');
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

    if (!cron.validate(config.cronExpression)) {
      throw new Error(`Invalid cron expression: ${config.cronExpression}`);
    }

    const nextRun = this.getNextRunTime(config.cronExpression);
    const saveToFile = config.saveToFile !== undefined ? config.saveToFile : true;
    const sendEmail = config.sendEmail !== undefined ? config.sendEmail : (config.recipients && config.recipients.length > 0);
    const destinationPath = config.destinationPath || null;

    this.db.prepare(`
      INSERT INTO schedules (
        id, name, description, report_config, cron_expression, enabled,
        next_run, created_at, updated_at, recipients, save_to_file, send_email,
        destination_path, created_by, linked_report_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
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
      userId || null,
      config.linkedReportId || null
    );

    reportLogger.info('Schedule created', { scheduleId, name: config.name });

    if (config.enabled) {
      const fullConfig: ScheduleConfig = {
        ...config,
        id: scheduleId,
        nextRun,
        createdAt: now,
        updatedAt: now
      };
      try {
        this.startCronJob(fullConfig);
      } catch (error) {
        reportLogger.warn('Failed to start cron job during creation', { scheduleId, error });
      }
    }

    return scheduleId;
  }

  /**
   * Get all schedules
   */
  async getSchedules(userId?: string): Promise<ScheduleConfig[]> {
    let query = 'SELECT * FROM schedules';
    const params: any[] = [];

    if (userId) {
      query += ' WHERE created_by = ? OR created_by IS NULL';
      params.push(userId);
    }

    query += ' ORDER BY created_at DESC';

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(row => this.rowToScheduleConfig(row));
  }

  /**
   * Get schedule by ID
   */
  async getSchedule(scheduleId: string, userId?: string): Promise<ScheduleConfig | null> {
    let query = 'SELECT * FROM schedules WHERE id = ?';
    const params: any[] = [scheduleId];

    if (userId) {
      query += ' AND (created_by = ? OR created_by IS NULL)';
      params.push(userId);
    }

    const row = this.db.prepare(query).get(...params) as any;
    return row ? this.rowToScheduleConfig(row) : null;
  }

  /**
   * Update a schedule
   */
  async updateSchedule(scheduleId: string, updates: Partial<ScheduleConfig>, userId?: string): Promise<void> {
    const schedule = await this.getSchedule(scheduleId, userId);
    if (!schedule) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }

    if (updates.cronExpression && !cron.validate(updates.cronExpression)) {
      throw new Error(`Invalid cron expression: ${updates.cronExpression}`);
    }

    const now = new Date();
    const nextRun = updates.cronExpression ? this.getNextRunTime(updates.cronExpression) : schedule.nextRun;

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description || null); }
    if (updates.reportConfig !== undefined) { fields.push('report_config = ?'); values.push(JSON.stringify(updates.reportConfig)); }
    if (updates.cronExpression !== undefined) {
      fields.push('cron_expression = ?'); values.push(updates.cronExpression);
      fields.push('next_run = ?'); values.push(nextRun?.toISOString());
    }
    if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }
    if (updates.recipients !== undefined) {
      fields.push('recipients = ?');
      values.push(updates.recipients && updates.recipients.length > 0 ? JSON.stringify(updates.recipients) : null);
    }
    if (updates.saveToFile !== undefined) { fields.push('save_to_file = ?'); values.push(updates.saveToFile ? 1 : 0); }
    if (updates.sendEmail !== undefined) { fields.push('send_email = ?'); values.push(updates.sendEmail ? 1 : 0); }
    if (updates.destinationPath !== undefined) { fields.push('destination_path = ?'); values.push(updates.destinationPath || null); }

    fields.push('updated_at = ?');
    values.push(now.toISOString());
    values.push(scheduleId);

    const sql = `UPDATE schedules SET ${fields.join(', ')} WHERE id = ?`;

    reportLogger.info('Updating schedule', {
      scheduleId,
      fields: fields.map(f => f.split(' = ')[0]),
      sql
    });

    const result = this.db.prepare(sql).run(...values);

    reportLogger.info('Schedule updated in database', {
      scheduleId,
      changes: result.changes
    });

    schedulerService.stopCronJob(scheduleId);
    if (updates.enabled !== false) {
      const updatedSchedule = await schedulerService.getSchedule(scheduleId);
      if (updatedSchedule && updatedSchedule.enabled) {
        schedulerService.startCronJob(updatedSchedule);
      }
    }
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(scheduleId: string, userId?: string): Promise<void> {
    const schedule = await this.getSchedule(scheduleId, userId);
    if (!schedule) {
      throw new Error(`Schedule not found or unauthorized: ${scheduleId}`);
    }

    this.db.prepare('DELETE FROM schedules WHERE id = ?').run(scheduleId);
    this.stopCronJob(scheduleId);
    reportLogger.info('Schedule deleted', { scheduleId });
  }

  /**
   * Start all enabled schedules
   */
  async startAllSchedules(): Promise<void> {
    const schedules = await this.getSchedules();
    const enabledSchedules = schedules.filter(s => s.enabled);
    const now = new Date();

    for (const schedule of enabledSchedules) {
      const nextRun = this.getNextRunTime(schedule.cronExpression);

      if (!schedule.nextRun || schedule.nextRun < now) {
        reportLogger.info('Refreshing stale next run time on startup', {
          scheduleId: schedule.id,
          oldNextRun: schedule.nextRun,
          newNextRun: nextRun
        });

        this.db.prepare(
          'UPDATE schedules SET next_run = ?, updated_at = ? WHERE id = ?'
        ).run(nextRun.toISOString(), now.toISOString(), schedule.id);

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
   */
  async executeScheduleManually(scheduleId: string, userId?: string): Promise<string> {
    const schedule = await this.getSchedule(scheduleId, userId);
    if (!schedule) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }

    const executionId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.queueExecution(scheduleId, 10, executionId);
    reportLogger.info('Manual execution queued', { scheduleId, executionId, priority: 10 });
    return executionId;
  }

  /**
   * Start a cron job for a schedule
   */
  startCronJob(schedule: ScheduleConfig): void {
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
  stopCronJob(scheduleId: string): void {
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
    this.executionQueue.sort((a, b) => b.priority - a.priority);
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
    }, 1000);
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

      const schedule = await this.getSchedule(scheduleId);
      if (!schedule || !schedule.enabled) {
        reportLogger.warn('Schedule not found or disabled', { scheduleId });
        return;
      }

      if (schedule.linkedReportId) {
        try {
          const latestReport = await this.reportMgmtService.loadLatestByName(schedule.linkedReportId);
          if (latestReport) {
            const relativeRange = schedule.reportConfig.timeRange?.relativeRange;
            schedule.reportConfig = {
              ...latestReport.config,
              timeRange: {
                ...latestReport.config.timeRange,
                ...(relativeRange ? { relativeRange } : {})
              }
            } as ReportConfig;
            reportLogger.info('Loaded latest report version for scheduled execution', {
              scheduleId, executionId,
              linkedReportId: schedule.linkedReportId,
              reportVersion: latestReport.version
            });
          } else {
            reportLogger.warn('Linked report not found; falling back to stored config', {
              scheduleId, linkedReportId: schedule.linkedReportId
            });
          }
        } catch (versionErr) {
          reportLogger.warn('Failed to load latest report version; falling back to stored config', {
            scheduleId, linkedReportId: schedule.linkedReportId,
            error: versionErr instanceof Error ? versionErr.message : String(versionErr)
          });
        }
      }

      if (schedule.reportConfig.timeRange.relativeRange) {
        const { startTime: newStart, endTime: newEnd } = this.calculateRelativeTimeRange(schedule.reportConfig.timeRange.relativeRange);
        schedule.reportConfig.timeRange.startTime = newStart;
        schedule.reportConfig.timeRange.endTime = newEnd;
        reportLogger.info('Recalculated relative time range for scheduled execution', {
          scheduleId, executionId,
          relativeRange: schedule.reportConfig.timeRange.relativeRange,
          startTime: newStart, endTime: newEnd
        });
      }

      await this.recordExecution({ id: executionId, scheduleId, startTime, status: 'running' });
      await this.updateScheduleStatus(scheduleId, 'running', startTime);

      const dataFlowResult = await dataFlowService.executeDataFlow({
        reportConfig: schedule.reportConfig,
        includeStatistics: true,
        includeTrends: true,
        includeAnomalies: false,
        includeDataTable: schedule.reportConfig.includeDataTable ?? false
      });

      if (!dataFlowResult.success) {
        throw new Error(dataFlowResult.error || 'Data flow execution failed');
      }

      const reportResult = dataFlowResult.reportResult!;
      if (!reportResult.success) {
        throw new Error(reportResult.error || 'Report generation failed');
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const saveToFile = schedule.saveToFile !== undefined ? schedule.saveToFile : true;
      const sendEmail = schedule.sendEmail !== undefined ? schedule.sendEmail : (schedule.recipients && schedule.recipients.length > 0);

      let reportPath = reportResult.filePath;
      let fileSaveError: string | undefined;
      let emailSendError: string | undefined;

      if (saveToFile) {
        try {
          if (schedule.destinationPath && reportResult.filePath) {
            const fs = await import('fs/promises');
            const pathMod = await import('path');
            const sanitizedPath = schedule.destinationPath.replace(/\.\./g, '');
            const destDir = pathMod.isAbsolute(sanitizedPath)
              ? sanitizedPath
              : pathMod.join(env.REPORTS_DIR, sanitizedPath);
            await fs.mkdir(destDir, { recursive: true });
            const fileName = pathMod.basename(reportResult.filePath);
            const destPath = pathMod.join(destDir, fileName);
            await fs.copyFile(reportResult.filePath, destPath);
            reportPath = destPath;
            reportLogger.info('Report saved to custom destination', { scheduleId, executionId, destinationPath: destPath });
          } else {
            reportLogger.info('Report saved to default location', { scheduleId, executionId, reportPath: reportResult.filePath });
          }
        } catch (fileError) {
          fileSaveError = fileError instanceof Error ? fileError.message : 'Unknown file save error';
          reportLogger.error('Failed to save report to custom destination', {
            scheduleId, executionId, error: fileSaveError, destinationPath: schedule.destinationPath
          });
          throw new Error(`Failed to save report to destination: ${fileSaveError}`);
        }
      } else {
        reportLogger.info('File saving disabled for this schedule', { scheduleId, executionId });
      }

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
              scheduleId, executionId, recipients: schedule.recipients, messageId: emailResult.messageId
            });
          } else {
            emailSendError = emailResult.error;
            reportLogger.warn('Failed to send report email', {
              scheduleId, executionId, recipients: schedule.recipients, error: emailResult.error
            });
          }
        } catch (emailError) {
          emailSendError = emailError instanceof Error ? emailError.message : 'Unknown email error';
          reportLogger.error('Email sending failed with exception', { scheduleId, executionId, error: emailError });
        }
      } else if (sendEmail) {
        reportLogger.warn('Email delivery enabled but no recipients configured', { scheduleId, executionId });
      } else {
        reportLogger.info('Email delivery disabled for this schedule', { scheduleId, executionId });
      }

      await this.recordExecution({
        id: executionId, scheduleId, startTime, endTime,
        status: 'success', reportPath, duration
      } as ScheduleExecution);

      const nextRun = this.getNextRunTime(schedule.cronExpression);
      await this.updateScheduleStatus(scheduleId, 'success', startTime, nextRun);

      reportLogger.info('Scheduled execution completed successfully', {
        scheduleId, executionId, duration, reportPath,
        saveToFile, sendEmail,
        fileSaved: saveToFile && !fileSaveError,
        emailSent: sendEmail && !emailSendError,
        fileSaveError, emailSendError
      });

    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.recordExecution({ id: executionId, scheduleId, startTime, endTime, status: 'failed', error: errorMessage, duration });
      await this.updateScheduleStatus(scheduleId, 'failed', startTime, undefined, errorMessage);

      reportLogger.error('Scheduled execution failed', { scheduleId, executionId, error: errorMessage, duration });

      if (queueItem.retryCount < 3) {
        queueItem.retryCount++;
        queueItem.scheduledTime = new Date(Date.now() + (queueItem.retryCount * 60000));
        this.executionQueue.push(queueItem);
        reportLogger.info('Execution queued for retry', { scheduleId, retryCount: queueItem.retryCount });
      }
    }
  }

  /**
   * Record schedule execution
   */
  private async recordExecution(execution: ScheduleExecution): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO schedule_executions
      (id, schedule_id, start_time, end_time, status, report_path, error, duration)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      execution.id,
      execution.scheduleId,
      execution.startTime.toISOString(),
      execution.endTime?.toISOString() || null,
      execution.status,
      execution.reportPath || null,
      execution.error || null,
      execution.duration || null
    );
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
    const fields = ['last_status = ?', 'last_run = ?', 'updated_at = ?'];
    const values: any[] = [status, lastRun.toISOString(), new Date().toISOString()];

    if (nextRun) { fields.push('next_run = ?'); values.push(nextRun.toISOString()); }
    if (error !== undefined) { fields.push('last_error = ?'); values.push(error); }
    values.push(scheduleId);

    this.db.prepare(`UPDATE schedules SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  /**
   * Calculate absolute time range from a relative range string
   */
  private calculateRelativeTimeRange(relativeRange: string): { startTime: Date; endTime: Date } {
    const now = new Date();
    let startTime: Date;

    switch (relativeRange) {
      case 'last1h':  startTime = new Date(now.getTime() - 60 * 60 * 1000); break;
      case 'last2h':  startTime = new Date(now.getTime() - 2 * 60 * 60 * 1000); break;
      case 'last6h':  startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000); break;
      case 'last12h': startTime = new Date(now.getTime() - 12 * 60 * 60 * 1000); break;
      case 'last24h': startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
      case 'last7d':  startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case 'last30d': startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
      default:        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
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
      return new Date(Date.now() + 60000);
    }
  }

  /**
   * Get execution history for a schedule
   */
  async getExecutionHistory(scheduleId: string, limit: number = 50, userId?: string): Promise<ScheduleExecution[]> {
    if (userId) {
      const schedule = await this.getSchedule(scheduleId, userId);
      if (!schedule) {
        throw new Error(`Schedule not found or unauthorized: ${scheduleId}`);
      }
    }

    const rows = this.db.prepare(
      'SELECT * FROM schedule_executions WHERE schedule_id = ? ORDER BY start_time DESC LIMIT ?'
    ).all(scheduleId, limit) as any[];

    return rows.map(row => ({
      id: row.id,
      scheduleId: row.schedule_id,
      startTime: new Date(row.start_time),
      endTime: row.end_time ? new Date(row.end_time) : undefined,
      status: row.status,
      reportPath: row.report_path || undefined,
      error: row.error || undefined,
      duration: row.duration || undefined
    } as ScheduleExecution));
  }

  /**
   * Get a single execution by ID
   */
  async getExecution(executionId: string): Promise<ScheduleExecution | null> {
    const row = this.db.prepare(
      'SELECT * FROM schedule_executions WHERE id = ?'
    ).get(executionId) as any;

    if (!row) return null;

    return {
      id: row.id,
      scheduleId: row.schedule_id,
      startTime: new Date(row.start_time),
      endTime: row.end_time ? new Date(row.end_time) : undefined,
      status: row.status,
      reportPath: row.report_path || undefined,
      error: row.error || undefined,
      duration: row.duration || undefined
    } as ScheduleExecution;
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
    let query = 'SELECT * FROM schedule_executions';
    const params: any[] = [];

    if (timeRange) {
      query += ' WHERE start_time >= ? AND start_time <= ?';
      params.push(timeRange.startTime.toISOString(), timeRange.endTime.toISOString());
    }

    const rows = this.db.prepare(query).all(...params) as any[];
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

    return { totalExecutions, successfulExecutions, failedExecutions, averageDuration, executionsByStatus, executionsBySchedule };
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

      if (queueLength > 10) {
        issues.push(`High queue length: ${queueLength} pending executions`);
        status = 'warning';
      }

      if (runningExecutions >= this.maxConcurrentJobs) {
        issues.push(`Maximum concurrent jobs reached: ${runningExecutions}/${this.maxConcurrentJobs}`);
        status = 'warning';
      }

      const recentStats = await this.getExecutionStatistics({
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
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

      let lastExecutionTime: Date | undefined;
      if (recentStats.totalExecutions > 0) {
        const lastExecution = this.db.prepare(
          'SELECT start_time FROM schedule_executions ORDER BY start_time DESC LIMIT 1'
        ).get() as any;
        if (lastExecution) {
          lastExecutionTime = new Date(lastExecution.start_time);
        }
      }

      return {
        status, activeSchedules, runningExecutions, queueLength, issues,
        ...(lastExecutionTime !== undefined && { lastExecutionTime })
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
    recentFailures: Array<{ executionId: string; timestamp: Date; error: string; duration?: number }>;
  }> {
    let query = 'SELECT * FROM schedule_executions';
    const params: any[] = [];

    if (scheduleId) {
      query += ' WHERE schedule_id = ?';
      params.push(scheduleId);
    }

    query += ' ORDER BY start_time DESC';

    const rows = this.db.prepare(query).all(...params) as any[];

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
      .slice(0, 5)
      .map(r => ({
        executionId: r.id as string,
        timestamp: new Date(r.start_time),
        error: (r.error || 'Unknown error') as string,
        ...(r.duration != null && { duration: r.duration as number })
      }));

    return {
      executionCount, successRate, averageDuration, recentFailures,
      ...(lastExecution !== undefined && { lastExecution }),
      ...(nextExecution !== undefined && { nextExecution })
    };
  }

  /**
   * Retry failed execution
   */
  async retryExecution(executionId: string): Promise<void> {
    const row = this.db.prepare(
      'SELECT schedule_id FROM schedule_executions WHERE id = ? AND status = "failed"'
    ).get(executionId) as any;

    if (!row) {
      throw new Error('Failed execution not found');
    }

    this.queueExecution(row.schedule_id, 10);
    reportLogger.info('Execution retry queued', { executionId, scheduleId: row.schedule_id });
  }

  async cleanupExecutions(olderThanDays: number = 30): Promise<void> {
    const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
    const result = this.db.prepare(
      'DELETE FROM schedule_executions WHERE start_time < ?'
    ).run(cutoffDate.toISOString());
    reportLogger.info('Cleaned up old execution records', { deletedCount: result.changes });
  }

  /**
   * Shutdown the scheduler
   */
  async shutdown(): Promise<void> {
    this.stopAllSchedules();
    this.db.close();
    reportLogger.info('Scheduler database closed');
  }

  private rowToScheduleConfig(row: any): ScheduleConfig {
    const reportConfig = JSON.parse(row.report_config);
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
      createdByUserId: row.created_by || undefined,
      linkedReportId: row.linked_report_id || undefined
    } as ScheduleConfig;
  }
}

// Export singleton instance
export const schedulerService = new SchedulerService();
