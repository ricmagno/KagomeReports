/**
 * Report Management Service
 * Handles saving, versioning, and retrieval of report configurations
 */

import { Database } from 'sqlite3';
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

export class ReportManagementService {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
    this.initializeTables();
  }

  /**
   * Helper method to deserialize dates in config objects
   */
  private deserializeDates(config: any): any {
    if (config.timeRange) {
      if (config.timeRange.startTime) {
        config.timeRange.startTime = new Date(config.timeRange.startTime);
      }
      if (config.timeRange.endTime) {
        config.timeRange.endTime = new Date(config.timeRange.endTime);
      }
    }
    if (config.createdAt) {
      config.createdAt = new Date(config.createdAt);
    }
    if (config.updatedAt) {
      config.updatedAt = new Date(config.updatedAt);
    }
    return config;
  }

  /**
   * Initialize database tables for report management
   */
  private initializeTables(): void {
    const createReportsTable = `
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
    `;

    const createReportVersionsTable = `
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
    `;

    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_reports_name ON reports(name)',
      'CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by)',
      'CREATE INDEX IF NOT EXISTS idx_report_versions_report_id ON report_versions(report_id)',
      'CREATE INDEX IF NOT EXISTS idx_report_versions_version ON report_versions(report_id, version DESC)'
    ];

    this.db.serialize(() => {
      this.db.run(createReportsTable);
      this.db.run(createReportVersionsTable);
      createIndexes.forEach(index => this.db.run(index));
    });

    logger.info('Report management tables initialized');
  }

  /**
   * Validate report configuration before saving
   */
  private validateReportConfig(config: ReportConfig): ReportValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!config.name || config.name.trim().length === 0) {
      errors.push('Report name is required');
    }

    if (!config.tags || config.tags.length === 0) {
      errors.push('At least one tag must be selected');
    }

    if (!config.timeRange || !config.timeRange.startTime || !config.timeRange.endTime) {
      errors.push('Valid time range is required');
    }

    if (config.timeRange && config.timeRange.startTime >= config.timeRange.endTime) {
      errors.push('Start time must be before end time');
    }

    if (!config.chartTypes || config.chartTypes.length === 0) {
      warnings.push('No chart types selected - report will contain only data tables');
    }

    // Name length validation
    if (config.name && config.name.length > 100) {
      errors.push('Report name must be 100 characters or less');
    }

    // Description length validation
    if (config.description && config.description.length > 500) {
      errors.push('Report description must be 500 characters or less');
    }

    // Tag count validation
    if (config.tags && config.tags.length > 50) {
      warnings.push('Large number of tags may impact report generation performance');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get the next version number for a report name
   */
  private async getNextVersionNumber(reportName: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT MAX(version) as max_version 
        FROM reports 
        WHERE name = ?
      `;

      this.db.get(query, [reportName], (err, row: any) => {
        if (err) {
          logger.error('Error getting next version number:', err);
          reject(err);
          return;
        }

        const nextVersion = row?.max_version ? row.max_version + 1 : 1;
        resolve(nextVersion);
      });
    });
  }

  /**
   * Mark previous versions as not latest
   */
  private async markPreviousVersionsAsOld(reportName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE reports 
        SET is_latest_version = false, updated_at = CURRENT_TIMESTAMP
        WHERE name = ? AND is_latest_version = true
      `;

      this.db.run(query, [reportName], (err) => {
        if (err) {
          logger.error('Error marking previous versions as old:', err);
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Save a report configuration
   */
  async saveReport(request: SaveReportRequest, userId: string): Promise<SaveReportResponse> {
    try {
      const fullConfig = {
        id: '', // Will be set later
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
        // Advanced Chart Analytics fields
        specificationLimits: request.config.specificationLimits,
        includeSPCCharts: request.config.includeSPCCharts,
        includeTrendLines: request.config.includeTrendLines,
        includeStatsSummary: request.config.includeStatsSummary,
        retrievalMode: (request.config as any).retrievalMode,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1 // Will be updated later
      } as ReportConfig;

      // Validate the report configuration
      const validation = this.validateReportConfig(fullConfig);
      if (!validation.isValid) {
        return {
          success: false,
          reportId: '',
          version: 0,
          message: `Validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Get next version number
      const version = await this.getNextVersionNumber(request.name);

      // Mark previous versions as not latest
      if (version > 1) {
        await this.markPreviousVersionsAsOld(request.name);
      }

      const reportId = uuidv4();
      const now = new Date().toISOString();

      // Update the full config with final values
      fullConfig.id = reportId;
      fullConfig.version = version;
      fullConfig.createdAt = new Date(now);
      fullConfig.updatedAt = new Date(now);

      // Save to reports table
      const insertReportQuery = `
        INSERT INTO reports (
          id, name, description, config, version, 
          is_latest_version, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, true, ?, ?, ?)
      `;

      await new Promise<void>((resolve, reject) => {
        this.db.run(
          insertReportQuery,
          [reportId, request.name, request.description, JSON.stringify(fullConfig), version, userId, now, now],
          (err) => {
            if (err) {
              logger.error('Error saving report:', err);
              reject(err);
              return;
            }
            resolve();
          }
        );
      });

      // Save to report_versions table for history tracking
      const versionId = uuidv4();
      const insertVersionQuery = `
        INSERT INTO report_versions (
          id, report_id, version, config, change_description, 
          is_active, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, true, ?, ?)
      `;

      await new Promise<void>((resolve, reject) => {
        this.db.run(
          insertVersionQuery,
          [versionId, request.name, version, JSON.stringify(fullConfig), request.changeDescription || 'Initial version', userId, now],
          (err) => {
            if (err) {
              logger.error('Error saving report version:', err);
              reject(err);
              return;
            }
            resolve();
          }
        );
      });

      logger.info(`Report saved successfully: ${request.name} v${version} by ${userId}`);

      return {
        success: true,
        reportId,
        version,
        message: `Report "${request.name}" saved successfully as version ${version}`
      };

    } catch (error) {
      logger.error('Error in saveReport:', error);
      return {
        success: false,
        reportId: '',
        version: 0,
        message: `Failed to save report: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Load a specific report configuration
   */
  async loadReport(reportId: string): Promise<SavedReport | null> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM reports 
        WHERE id = ? AND is_latest_version = true
      `;

      this.db.get(query, [reportId], (err, row: any) => {
        if (err) {
          logger.error('Error loading report:', err);
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        try {
          const config = JSON.parse(row.config);

          // Convert date strings back to Date objects
          if (config.timeRange) {
            if (config.timeRange.startTime) {
              config.timeRange.startTime = new Date(config.timeRange.startTime);
            }
            if (config.timeRange.endTime) {
              config.timeRange.endTime = new Date(config.timeRange.endTime);
            }
          }
          if (config.createdAt) {
            config.createdAt = new Date(config.createdAt);
          }
          if (config.updatedAt) {
            config.updatedAt = new Date(config.updatedAt);
          }

          const savedReport: SavedReport = {
            id: row.id,
            name: row.name,
            description: row.description || '',
            config,
            version: row.version,
            createdBy: row.created_by,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
            isLatestVersion: row.is_latest_version
          };

          resolve(savedReport);
        } catch (parseError) {
          logger.error('Error parsing report config:', parseError);
          reject(parseError);
        }
      });
    });
  }

  /**
   * List all saved reports for a user
   */
  async listReports(userId?: string): Promise<ReportListItem[]> {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          r.*,
          (SELECT COUNT(*) FROM reports r2 WHERE r2.name = r.name) as total_versions
        FROM reports r 
        WHERE r.is_latest_version = true
      `;

      const params: any[] = [];

      if (userId) {
        query += ' AND r.created_by = ?';
        params.push(userId);
      }

      query += ' ORDER BY r.updated_at DESC';

      this.db.all(query, params, (err, rows: any[]) => {
        if (err) {
          logger.error('Error listing reports:', err);
          reject(err);
          return;
        }

        const reports: ReportListItem[] = rows.map(row => ({
          id: row.id,
          name: row.name,
          description: row.description || '',
          config: this.deserializeDates(JSON.parse(row.config)),
          version: row.version,
          createdBy: row.created_by,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
          isLatestVersion: row.is_latest_version,
          totalVersions: row.total_versions
        }));

        resolve(reports);
      });
    });
  }

  /**
   * Delete a report and all its versions
   */
  async deleteReport(reportId: string, userId: string): Promise<boolean> {
    try {
      // First, get the report name to delete all versions
      const report = await this.loadReport(reportId);
      if (!report) {
        logger.warn(`Report not found for deletion: ${reportId}`);
        return false;
      }

      // Check if user has permission to delete (owner or admin)
      if (report.createdBy !== userId) {
        logger.warn(`User ${userId} attempted to delete report ${reportId} owned by ${report.createdBy}`);
        return false;
      }

      // Delete from reports table
      await new Promise<void>((resolve, reject) => {
        const deleteReportsQuery = 'DELETE FROM reports WHERE name = ?';
        this.db.run(deleteReportsQuery, [report.name], (err) => {
          if (err) {
            logger.error('Error deleting from reports table:', err);
            reject(err);
            return;
          }
          resolve();
        });
      });

      // Delete from report_versions table
      await new Promise<void>((resolve, reject) => {
        const deleteVersionsQuery = 'DELETE FROM report_versions WHERE report_id = ?';
        this.db.run(deleteVersionsQuery, [report.name], (err) => {
          if (err) {
            logger.error('Error deleting from report_versions table:', err);
            reject(err);
            return;
          }
          resolve();
        });
      });

      logger.info(`Report deleted successfully: ${report.name} by ${userId}`);
      return true;

    } catch (error) {
      logger.error('Error in deleteReport:', error);
      return false;
    }
  }

  /**
   * Get version history for a report
   */
  async getReportVersions(reportName: string): Promise<ReportVersionHistory | null> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM report_versions 
        WHERE report_id = ? 
        ORDER BY version DESC
      `;

      this.db.all(query, [reportName], (err, rows: any[]) => {
        if (err) {
          logger.error('Error getting report versions:', err);
          reject(err);
          return;
        }

        if (rows.length === 0) {
          resolve(null);
          return;
        }

        try {
          const versions: ReportVersion[] = rows.map(row => ({
            id: row.id,
            reportId: row.report_id,
            version: row.version,
            config: this.deserializeDates(JSON.parse(row.config)),
            createdAt: new Date(row.created_at),
            createdBy: row.created_by,
            changeDescription: row.change_description,
            isActive: row.is_active
          }));

          const history: ReportVersionHistory = {
            reportId: reportName,
            reportName: versions[0]?.config.name || reportName,
            versions,
            totalVersions: versions.length
          };

          resolve(history);
        } catch (parseError) {
          logger.error('Error parsing version configs:', parseError);
          reject(parseError);
        }
      });
    });
  }

  /**
   * Create a new version of an existing report
   */
  async createNewVersion(reportName: string, config: ReportConfig, userId: string, changeDescription?: string): Promise<ReportVersion | null> {
    try {
      // Get next version number
      const version = await this.getNextVersionNumber(reportName);

      // Mark previous versions as not latest
      await this.markPreviousVersionsAsOld(reportName);

      const reportId = uuidv4();
      const versionId = uuidv4();
      const now = new Date().toISOString();

      // Create full report config
      const fullConfig: ReportConfig = {
        ...config,
        id: reportId,
        version,
        createdBy: userId,
        createdAt: new Date(now),
        updatedAt: new Date(now)
      };

      // Save to reports table
      const insertReportQuery = `
        INSERT INTO reports (
          id, name, description, config, version, 
          is_latest_version, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, true, ?, ?, ?)
      `;

      await new Promise<void>((resolve, reject) => {
        this.db.run(
          insertReportQuery,
          [reportId, config.name, config.description, JSON.stringify(fullConfig), version, userId, now, now],
          (err) => {
            if (err) {
              logger.error('Error saving new report version:', err);
              reject(err);
              return;
            }
            resolve();
          }
        );
      });

      // Save to report_versions table
      const insertVersionQuery = `
        INSERT INTO report_versions (
          id, report_id, version, config, change_description, 
          is_active, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, true, ?, ?)
      `;

      await new Promise<void>((resolve, reject) => {
        this.db.run(
          insertVersionQuery,
          [versionId, reportName, version, JSON.stringify(fullConfig), changeDescription || `Version ${version}`, userId, now],
          (err) => {
            if (err) {
              logger.error('Error saving report version:', err);
              reject(err);
              return;
            }
            resolve();
          }
        );
      });

      const newVersion: ReportVersion = {
        id: versionId,
        reportId: reportName,
        version,
        config: fullConfig,
        createdAt: new Date(now),
        createdBy: userId,
        changeDescription: changeDescription || `Version ${version}`,
        isActive: true
      };

      logger.info(`New report version created: ${reportName} v${version} by ${userId}`);
      return newVersion;

    } catch (error) {
      logger.error('Error creating new version:', error);
      return null;
    }
  }
}