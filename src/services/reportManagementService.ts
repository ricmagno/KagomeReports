/**
 * Report Management Service
 * Handles saving, versioning, and retrieval of report configurations
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  ReportConfig,
  SavedReport,
  ReportVersion,
  ReportVersionHistory,
  ReportListItem,
  SaveReportRequest,
  SaveReportResponse,
  ReportValidationResult
} from '../types/reports';
import { logger } from '../utils/logger';
import { getDatabasePath } from '@/config/environment';
import { authService } from './authService';

export class ReportManagementService {
  private db: Database.Database;

  constructor(database: Database.Database) {
    this.db = database;
    this.initializeTables();
  }

  async waitForInitialization(): Promise<void> { }

  private deserializeDates(config: any): any {
    if (config.timeRange) {
      if (config.timeRange.startTime) config.timeRange.startTime = new Date(config.timeRange.startTime);
      if (config.timeRange.endTime) config.timeRange.endTime = new Date(config.timeRange.endTime);
    }
    if (config.createdAt) config.createdAt = new Date(config.createdAt);
    if (config.updatedAt) config.updatedAt = new Date(config.updatedAt);
    return config;
  }

  private initializeTables(): void {
    try {
      const authDbPath = getDatabasePath('auth.db');
      try {
        this.db.exec(`ATTACH DATABASE '${authDbPath}' AS auth`);
      } catch (err: any) {
        if (!err.message?.includes('already being used') && !err.message?.includes('database auth is already in use')) {
          logger.debug('Auth database attachment note (can be ignored if already attached):', err.message);
        }
      }

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS reports (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          config JSON NOT NULL,
          version INTEGER DEFAULT 1,
          parent_id TEXT,
          is_latest_version BOOLEAN DEFAULT true,
          created_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS report_versions (
          id TEXT PRIMARY KEY,
          report_id TEXT NOT NULL,
          version INTEGER NOT NULL,
          config JSON NOT NULL,
          change_description TEXT,
          is_active BOOLEAN DEFAULT true,
          created_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(report_id, version)
        )
      `);

      this.db.exec('CREATE INDEX IF NOT EXISTS idx_reports_name ON reports(name)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_report_versions_report_id ON report_versions(report_id)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_report_versions_version ON report_versions(report_id, version DESC)');

      logger.info('Report management tables initialized');
    } catch (error) {
      logger.error('Failed to initialize report management tables:', error);
      throw error;
    }
  }

  private validateReportConfig(config: ReportConfig): ReportValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.name || config.name.trim().length === 0) errors.push('Report name is required');
    if (!config.tags || config.tags.length === 0) errors.push('At least one tag must be selected');
    if (!config.timeRange || !config.timeRange.startTime || !config.timeRange.endTime) errors.push('Valid time range is required');
    if (config.timeRange && config.timeRange.startTime >= config.timeRange.endTime) errors.push('Start time must be before end time');
    if (!config.chartTypes || config.chartTypes.length === 0) warnings.push('No chart types selected - report will contain only data tables');
    if (config.name && config.name.length > 100) errors.push('Report name must be 100 characters or less');
    if (config.description && config.description.length > 500) errors.push('Report description must be 500 characters or less');
    if (config.tags && config.tags.length > 50) warnings.push('Large number of tags may impact report generation performance');

    return { isValid: errors.length === 0, errors, warnings };
  }

  private getNextVersionNumber(reportName: string): number {
    const row = this.db.prepare('SELECT MAX(version) as max_version FROM reports WHERE name = ?').get(reportName) as any;
    return row?.max_version ? row.max_version + 1 : 1;
  }

  private markPreviousVersionsAsOld(reportName: string): void {
    this.db.prepare(
      'UPDATE reports SET is_latest_version = false, updated_at = CURRENT_TIMESTAMP WHERE name = ? AND is_latest_version = true'
    ).run(reportName);
  }

  async saveReport(request: SaveReportRequest, userId: string): Promise<SaveReportResponse> {
    try {
      const fullConfig = {
        id: '',
        name: request.name,
        description: request.description,
        tags: request.config.tags,
        timeRange: request.config.timeRange,
        chartTypes: request.config.chartTypes,
        template: request.config.template,
        format: request.config.format,
        filters: request.config.filters,
        branding: request.config.branding,
        metadata: request.config.metadata,
        specificationLimits: request.config.specificationLimits,
        includeSPCCharts: request.config.includeSPCCharts,
        includeTrendLines: request.config.includeTrendLines,
        includeMultiTrend: (request.config as any).includeMultiTrend,
        includeStatsSummary: request.config.includeStatsSummary,
        includeDataTable: request.config.includeDataTable,
        retrievalMode: (request.config as any).retrievalMode,
        advancedFilters: (request.config as any).advancedFilters,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      } as ReportConfig;

      const validation = this.validateReportConfig(fullConfig);
      if (!validation.isValid) {
        return { success: false, reportId: '', version: 0, message: `Validation failed: ${validation.errors.join(', ')}` };
      }

      const version = this.getNextVersionNumber(request.name);
      if (version > 1) this.markPreviousVersionsAsOld(request.name);

      const reportId = uuidv4();
      const now = new Date().toISOString();
      fullConfig.id = reportId;
      fullConfig.version = version;
      fullConfig.createdAt = new Date(now);
      fullConfig.updatedAt = new Date(now);

      this.db.prepare(`
        INSERT INTO reports (id, name, description, config, version, is_latest_version, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, true, ?, ?, ?)
      `).run(reportId, request.name, request.description, JSON.stringify(fullConfig), version, userId, now, now);

      const versionId = uuidv4();
      this.db.prepare(`
        INSERT INTO report_versions (id, report_id, version, config, change_description, is_active, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, true, ?, ?)
      `).run(versionId, request.name, version, JSON.stringify(fullConfig), request.changeDescription || 'Initial version', userId, now);

      logger.info(`Report saved successfully: ${request.name} v${version} by ${userId}`);
      return { success: true, reportId, version, message: `Report "${request.name}" saved successfully as version ${version}` };

    } catch (error) {
      logger.error('Error in saveReport:', error);
      return { success: false, reportId: '', version: 0, message: `Failed to save report: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  async loadReport(reportId: string): Promise<SavedReport | null> {
    const row = this.db.prepare(`
      SELECT r.*, u.username as created_by_name
      FROM reports r
      LEFT JOIN auth.users u ON r.created_by = u.id
      WHERE r.id = ? AND r.is_latest_version = true
    `).get(reportId) as any;

    if (!row) return null;

    try {
      const config = JSON.parse(row.config);
      if (config.timeRange) {
        if (config.timeRange.startTime) config.timeRange.startTime = new Date(config.timeRange.startTime);
        if (config.timeRange.endTime) config.timeRange.endTime = new Date(config.timeRange.endTime);
      }
      if (config.createdAt) config.createdAt = new Date(config.createdAt);
      if (config.updatedAt) config.updatedAt = new Date(config.updatedAt);

      return {
        id: row.id,
        name: row.name,
        description: row.description || '',
        config,
        version: row.version,
        createdBy: row.created_by_name || row.created_by,
        createdByUserId: row.created_by,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        isLatestVersion: row.is_latest_version
      };
    } catch (parseError) {
      logger.error('Error parsing report config:', parseError);
      throw parseError;
    }
  }

  async loadLatestByName(reportName: string): Promise<SavedReport | null> {
    const row = this.db.prepare(`
      SELECT r.*, u.username as created_by_name
      FROM reports r
      LEFT JOIN auth.users u ON r.created_by = u.id
      WHERE r.name = ? AND r.is_latest_version = true
      LIMIT 1
    `).get(reportName) as any;

    if (!row) return null;

    try {
      const config = this.deserializeDates(JSON.parse(row.config));
      return {
        id: row.id,
        name: row.name,
        description: row.description || '',
        config,
        version: row.version,
        createdBy: row.created_by_name || row.created_by,
        createdByUserId: row.created_by,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        isLatestVersion: row.is_latest_version
      };
    } catch (parseError) {
      logger.error('Error parsing report config in loadLatestByName:', parseError);
      throw parseError;
    }
  }

  async listReports(userId?: string): Promise<ReportListItem[]> {
    let query = `
      SELECT r.*, u.username as created_by_name,
        (SELECT COUNT(*) FROM reports r2 WHERE r2.name = r.name) as total_versions
      FROM reports r
      LEFT JOIN auth.users u ON r.created_by = u.id
      WHERE r.is_latest_version = true
    `;
    const params: any[] = [];
    if (userId) { query += ' AND r.created_by = ?'; params.push(userId); }
    query += ' ORDER BY r.updated_at DESC';

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      config: this.deserializeDates(JSON.parse(row.config)),
      version: row.version,
      createdBy: row.created_by_name || row.created_by,
      createdByUserId: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      isLatestVersion: row.is_latest_version,
      totalVersions: row.total_versions
    }));
  }

  async deleteReport(reportId: string, userId: string): Promise<boolean> {
    try {
      const report = await this.loadReport(reportId);
      if (!report) { logger.warn(`Report not found for deletion: ${reportId}`); return false; }

      const userRow = this.db.prepare('SELECT role FROM auth.users WHERE id = ?').get(userId) as any;
      const userRole = userRow?.role || 'user';

      if (userRole !== 'admin' && report.createdByUserId !== userId) {
        logger.warn(`User ${userId} (role: ${userRole}) attempted to delete report ${reportId} owned by ${report.createdByUserId}`);
        return false;
      }

      this.db.prepare('DELETE FROM reports WHERE name = ?').run(report.name);
      this.db.prepare('DELETE FROM report_versions WHERE report_id = ?').run(report.name);

      logger.info(`Report deleted successfully: ${report.name} by ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error in deleteReport:', error);
      return false;
    }
  }

  async getReportVersions(reportName: string): Promise<ReportVersionHistory | null> {
    const rows = this.db.prepare(`
      SELECT rv.*, u.username as created_by_name
      FROM report_versions rv
      LEFT JOIN auth.users u ON rv.created_by = u.id
      WHERE rv.report_id = ?
      ORDER BY rv.version DESC
    `).all(reportName) as any[];

    if (rows.length === 0) return null;

    try {
      const versions: ReportVersion[] = rows.map(row => ({
        id: row.id,
        reportId: row.report_id,
        version: row.version,
        config: this.deserializeDates(JSON.parse(row.config)),
        createdAt: new Date(row.created_at),
        createdBy: row.created_by_name || row.created_by,
        changeDescription: row.change_description,
        isActive: row.is_active
      }));

      return {
        reportId: reportName,
        reportName: versions[0]?.config.name || reportName,
        versions,
        totalVersions: versions.length
      };
    } catch (parseError) {
      logger.error('Error parsing version configs:', parseError);
      throw parseError;
    }
  }

  async createNewVersion(reportName: string, config: ReportConfig, userId: string, changeDescription?: string): Promise<ReportVersion | null> {
    try {
      const version = this.getNextVersionNumber(reportName);
      this.markPreviousVersionsAsOld(reportName);

      const reportId = uuidv4();
      const versionId = uuidv4();
      const now = new Date().toISOString();

      const fullConfig: ReportConfig = { ...config, id: reportId, version, createdBy: userId, createdAt: new Date(now), updatedAt: new Date(now) };

      this.db.prepare(`
        INSERT INTO reports (id, name, description, config, version, is_latest_version, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, true, ?, ?, ?)
      `).run(reportId, config.name, config.description, JSON.stringify(fullConfig), version, userId, now, now);

      this.db.prepare(`
        INSERT INTO report_versions (id, report_id, version, config, change_description, is_active, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, true, ?, ?)
      `).run(versionId, reportName, version, JSON.stringify(fullConfig), changeDescription || `Version ${version}`, userId, now);

      logger.info(`New report version created: ${reportName} v${version} by ${userId}`);
      return { id: versionId, reportId: reportName, version, config: fullConfig, createdAt: new Date(now), createdBy: userId, changeDescription: changeDescription || `Version ${version}`, isActive: true };

    } catch (error) {
      logger.error('Error creating new version:', error);
      return null;
    }
  }
}
