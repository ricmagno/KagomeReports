/**
 * Report Management API Routes
 * Handles report generation, CRUD operations, and schedule management
 * Requirements: 4.1, 6.1, 7.1
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { apiLogger } from '@/utils/logger';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { authenticateToken, requirePermission } from '@/middleware/auth';
import { dataFlowService } from '@/services/dataFlowService';
import { ReportConfig } from '@/types/reports';
import { SpecificationLimits, RetrievalMode } from '@/types/historian';
import { ReportManagementService } from '@/services/reportManagementService';
import { ReportVersionService } from '@/services/reportVersionService';
import { validateSpecificationLimitsMap } from '@/utils/specificationLimitsValidator';
import { configExportService } from '@/services/configExportService';
import { configImportService } from '@/services/configImportService';
import { ExportRequest, ImportRequest, isValidExportFormat } from '@/types/reportExportImport';
import { Database } from 'sqlite3';
import path from 'path';
import fs from 'fs';

const router = Router();

// Initialize services (will be properly injected in production)
let reportManagementService: ReportManagementService;
let reportVersionService: ReportVersionService;

// Initialize services with database
const initializeServices = () => {
  if (!reportManagementService) {
    const dbPath = process.env.DATABASE_PATH || './data/reports.db';
    const db = new Database(dbPath);
    reportManagementService = new ReportManagementService(db);
    reportVersionService = new ReportVersionService(db);
  }
};

// Validation schemas
const reportConfigBaseSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).min(1),
  timeRange: z.object({
    startTime: z.string().datetime().transform(str => new Date(str)),
    endTime: z.string().datetime().transform(str => new Date(str)),
    relativeRange: z.enum(['last1h', 'last2h', 'last6h', 'last12h', 'last24h', 'last7d', 'last30d']).optional()
  }),
  chartTypes: z.array(z.enum(['line', 'bar', 'trend', 'scatter'])).default(['line']),
  template: z.string().default('default'),
  retrievalMode: z.string().optional().transform(val => {
    if (!val) return undefined;
    // Map frontend values to backend RetrievalMode enum values
    if (val === 'Delta') return RetrievalMode.Delta;
    if (val === 'Cyclic') return RetrievalMode.Cyclic;
    if (val === 'AVG' || val === 'Average') return RetrievalMode.Average;
    if (val === 'RoundTrip' || val === 'Full') return RetrievalMode.Full;
    return val as RetrievalMode; // Pass through if it's already a valid enum value
  }),
  filters: z.object({
    qualityFilter: z.array(z.number()).optional(),
    valueRange: z.object({
      min: z.number().optional(),
      max: z.number().optional()
    }).optional()
  }).optional(),
  format: z.enum(['pdf', 'docx']).default('pdf'),
  branding: z.object({
    companyName: z.string().optional(),
    logo: z.string().optional(),
    colors: z.object({
      primary: z.string().optional(),
      secondary: z.string().optional()
    }).optional()
  }).optional(),
  metadata: z.object({
    author: z.string().optional(),
    subject: z.string().optional(),
    keywords: z.array(z.string()).optional()
  }).optional(),
  includeStatistics: z.boolean().default(true),
  includeTrends: z.boolean().default(true),
  includeAnomalies: z.boolean().default(false),
  // Advanced Chart Analytics fields
  specificationLimits: z.record(z.string(), z.object({
    lsl: z.number().finite().optional(),
    usl: z.number().finite().optional()
  })).optional().transform(val => val as Record<string, SpecificationLimits> | undefined),
  includeSPCCharts: z.boolean().default(false),
  includeTrendLines: z.boolean().default(true),
  includeStatsSummary: z.boolean().default(true),
  version: z.number().int().positive().optional()
});

const reportConfigSchema = reportConfigBaseSchema.refine(
  (data) => {
    // Validate specification limits if provided
    if (data.specificationLimits) {
      const validation = validateSpecificationLimitsMap(data.specificationLimits);
      return validation.isValid;
    }
    return true;
  },
  (data) => {
    // Generate error message with details
    if (data.specificationLimits) {
      const validation = validateSpecificationLimitsMap(data.specificationLimits);
      if (!validation.isValid) {
        return {
          message: validation.errors.join('; '),
          path: ['specificationLimits']
        };
      }
    }
    return { message: 'Invalid specification limits' };
  }
);

const saveReportSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  config: reportConfigBaseSchema.omit({ name: true, description: true }),
  changeDescription: z.string().max(200).optional()
}).transform(data => ({
  ...data,
  description: data.description || undefined,
  changeDescription: data.changeDescription || undefined
}));

const scheduleConfigSchema = z.object({
  reportId: z.string().uuid(),
  interval: z.enum(['hourly', '6h', '8h', '12h', 'daily', 'weekly', 'monthly']),
  recipients: z.array(z.string().email()).min(1),
  enabled: z.boolean().default(true),
  startDate: z.string().datetime().transform(str => new Date(str)).optional(),
  endDate: z.string().datetime().transform(str => new Date(str)).optional()
});

/**
 * POST /api/reports/generate
 * Generate a report on-demand using end-to-end data flow
 */
router.post('/generate', authenticateToken, requirePermission('reports', 'write'), asyncHandler(async (req: Request, res: Response) => {
  const configResult = reportConfigSchema.safeParse(req.body);
  if (!configResult.success) {
    apiLogger.error('Invalid report configuration', { errors: configResult.error.errors });
    throw createError('Invalid report configuration', 400);
  }

  const config = configResult.data;
  const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Create full report config
  const reportConfig: any = {
    id: reportId,
    name: config.name,
    description: config.description,
    tags: config.tags,
    timeRange: config.timeRange,
    chartTypes: config.chartTypes,
    template: config.template,
    format: config.format,
    branding: config.branding,
    metadata: config.metadata,
    version: config.version,
    retrievalMode: config.retrievalMode
  };

  apiLogger.info('Starting end-to-end report generation', {
    reportId,
    tags: config.tags,
    timeRange: config.timeRange
  });

  try {
    // Validate data flow configuration
    const validation = dataFlowService.validateDataFlowConfig({
      reportConfig,
      includeStatistics: config.includeStatistics,
      includeTrends: config.includeTrends,
      includeAnomalies: config.includeAnomalies
    });

    if (!validation.valid) {
      apiLogger.error('Data flow configuration validation failed', {
        reportId,
        errors: validation.errors
      });
      throw createError(`Configuration validation failed: ${validation.errors.join(', ')}`, 400);
    }

    // Execute end-to-end data flow
    const result = await dataFlowService.executeDataFlow({
      reportConfig,
      includeStatistics: config.includeStatistics,
      includeTrends: config.includeTrends,
      includeAnomalies: config.includeAnomalies
    });

    if (!result.success) {
      apiLogger.error('Report generation failed', {
        reportId,
        error: result.error,
        dataMetrics: result.dataMetrics
      });
      throw createError(result.error || 'Report generation failed', 500);
    }

    apiLogger.info('Report generation completed successfully', {
      reportId,
      dataMetrics: result.dataMetrics,
      reportMetadata: result.reportResult?.metadata
    });

    res.json({
      success: true,
      reportId,
      status: 'generated',
      message: 'Report generation completed successfully',
      config: reportConfig,
      generatedAt: new Date().toISOString(),
      downloadUrl: `/api/reports/${reportId}/download`,
      metadata: result.reportResult?.metadata,
      dataMetrics: result.dataMetrics
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    apiLogger.error('Report generation failed with exception', {
      reportId,
      error: errorMessage
    });

    // Return error response
    res.status(500).json({
      success: false,
      reportId,
      status: 'failed',
      message: 'Report generation failed',
      error: errorMessage,
      generatedAt: new Date().toISOString()
    });
  }
}));

/**
 * GET /api/reports
 * Get list of saved report configurations
 */
router.get('/', authenticateToken, requirePermission('reports', 'read'), asyncHandler(async (req: Request, res: Response) => {
  initializeServices();

  const { page = 1, limit = 10, search, userId } = req.query;
  const currentUserId = (req as any).user?.id; // Get from authentication middleware

  apiLogger.info('Retrieving saved reports', { page, limit, search, userId: currentUserId });

  try {
    // Get reports from database
    const reports = await reportManagementService.listReports(
      userId as string || currentUserId
    );

    // Apply search filter if provided
    let filteredReports = reports;
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      filteredReports = reports.filter(report =>
        report.name.toLowerCase().includes(searchTerm) ||
        report.description?.toLowerCase().includes(searchTerm)
      );
    }

    // Apply pagination
    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const paginatedReports = filteredReports.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: paginatedReports,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: filteredReports.length,
        pages: Math.ceil(filteredReports.length / Number(limit))
      }
    });

  } catch (error) {
    apiLogger.error('Error retrieving reports:', error);
    throw createError('Failed to retrieve reports', 500);
  }
}));

/**
 * POST /api/reports/save
 * Save a new report configuration with versioning
 */
router.post('/save', authenticateToken, requirePermission('reports', 'write'), asyncHandler(async (req: Request, res: Response) => {
  initializeServices();

  const requestResult = saveReportSchema.safeParse(req.body);
  if (!requestResult.success) {
    apiLogger.error('Invalid save report request', { errors: requestResult.error.errors });
    throw createError('Invalid report configuration', 400);
  }

  const saveRequest = requestResult.data as any;
  const currentUserId = (req as any).user?.id || 'anonymous'; // Get from authentication middleware

  apiLogger.info('Saving report configuration', {
    name: saveRequest.name,
    userId: currentUserId
  });

  try {
    const result = await reportManagementService.saveReport(saveRequest, currentUserId);

    if (result.success) {
      res.status(201).json({
        success: true,
        data: {
          reportId: result.reportId,
          version: result.version,
          name: saveRequest.name,
          description: saveRequest.description
        },
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    apiLogger.error('Error saving report:', error);
    throw createError('Failed to save report', 500);
  }
}));

/**
 * POST /api/reports
 * Save a new report configuration (legacy endpoint - redirects to /save)
 */
router.post('/', authenticateToken, requirePermission('reports', 'write'), asyncHandler(async (req: Request, res: Response) => {
  // Redirect to the new save endpoint by calling the same handler
  const requestResult = saveReportSchema.safeParse(req.body);
  if (!requestResult.success) {
    apiLogger.error('Invalid save report request', { errors: requestResult.error.errors });
    throw createError('Invalid report configuration', 400);
  }

  const saveRequest = requestResult.data as any;
  const currentUserId = (req as any).user?.id || 'anonymous';

  apiLogger.info('Saving report configuration (legacy endpoint)', {
    name: saveRequest.name,
    userId: currentUserId
  });

  try {
    const result = await reportManagementService.saveReport(saveRequest, currentUserId);

    if (result.success) {
      res.status(201).json({
        success: true,
        data: {
          reportId: result.reportId,
          version: result.version,
          name: saveRequest.name,
          description: saveRequest.description
        },
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    apiLogger.error('Error saving report:', error);
    throw createError('Failed to save report', 500);
  }
}));

/**
 * GET /api/reports/:id
 * Get a specific report configuration
 */
router.get('/:id', authenticateToken, requirePermission('reports', 'read'), asyncHandler(async (req: Request, res: Response) => {
  initializeServices();

  const { id } = req.params;

  if (!id) {
    throw createError('Report ID is required', 400);
  }

  apiLogger.info('Retrieving report configuration', { id });

  try {
    const report = await reportManagementService.loadReport(id);

    if (!report) {
      throw createError('Report not found', 404);
    }

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    apiLogger.error('Error retrieving report:', error);
    throw createError('Failed to retrieve report', 500);
  }
}));

/**
 * GET /api/reports/:id/versions
 * Get version history for a report
 */
router.get('/:id/versions', authenticateToken, requirePermission('reports', 'read'), asyncHandler(async (req: Request, res: Response) => {
  initializeServices();

  const { id } = req.params;

  if (!id) {
    throw createError('Report ID is required', 400);
  }

  apiLogger.info('Retrieving report version history', { reportId: id });

  try {
    const versionHistory = await reportVersionService.getVersionStatistics(id);

    if (!versionHistory) {
      throw createError('Report not found', 404);
    }

    const fullHistory = await reportManagementService.getReportVersions(id);

    res.json({
      success: true,
      data: {
        ...versionHistory,
        versions: fullHistory?.versions || []
      }
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    apiLogger.error('Error retrieving version history:', error);
    throw createError('Failed to retrieve version history', 500);
  }
}));

/**
 * POST /api/reports/:id/versions
 * Create new version of existing report
 */
router.post('/:id/versions', authenticateToken, requirePermission('reports', 'write'), asyncHandler(async (req: Request, res: Response) => {
  initializeServices();

  const { id } = req.params;

  if (!id) {
    throw createError('Report ID is required', 400);
  }

  const configResult = reportConfigSchema.safeParse(req.body);

  if (!configResult.success) {
    apiLogger.error('Invalid report configuration for new version', { errors: configResult.error.errors });
    throw createError('Invalid report configuration', 400);
  }

  const config = configResult.data;
  const currentUserId = (req as any).user?.id || 'anonymous';
  const changeDescription = req.body.changeDescription || `Version created on ${new Date().toISOString()}`;

  apiLogger.info('Creating new version of report', { reportId: id, userId: currentUserId });

  try {
    const newVersion = await reportManagementService.createNewVersion(
      id,
      config as any,
      currentUserId,
      changeDescription
    );

    if (!newVersion) {
      throw createError('Failed to create new version', 500);
    }

    res.status(201).json({
      success: true,
      data: newVersion,
      message: `New version ${newVersion.version} created successfully`
    });

  } catch (error) {
    apiLogger.error('Error creating new version:', error);
    throw createError('Failed to create new version', 500);
  }
}));
/**
 * PUT /api/reports/:id
 * Update a report configuration (creates new version)
 */
router.put('/:id', authenticateToken, requirePermission('reports', 'write'), asyncHandler(async (req: Request, res: Response) => {
  initializeServices();

  const { id } = req.params;

  if (!id) {
    throw createError('Report ID is required', 400);
  }

  const configResult = reportConfigBaseSchema.partial().safeParse(req.body);

  if (!configResult.success) {
    throw createError('Invalid report configuration', 400);
  }

  const updates = configResult.data;
  const currentUserId = (req as any).user?.id || 'anonymous';

  apiLogger.info('Updating report configuration', { id, updates, userId: currentUserId });

  try {
    // Load existing report
    const existingReport = await reportManagementService.loadReport(id);
    if (!existingReport) {
      throw createError('Report not found', 404);
    }

    const updatedConfig = {
      ...existingReport.config,
      ...updates,
      name: updates.name || existingReport.config.name,
      description: updates.description || existingReport.config.description,
      tags: updates.tags || existingReport.config.tags,
      timeRange: updates.timeRange || existingReport.config.timeRange,
      chartTypes: updates.chartTypes || existingReport.config.chartTypes,
      template: updates.template as any || existingReport.config.template,
      updatedAt: new Date()
    } as ReportConfig;

    // Create new version with updates
    const newVersion = await reportManagementService.createNewVersion(
      existingReport.name,
      updatedConfig,
      currentUserId,
      req.body.changeDescription || 'Updated configuration'
    );

    if (!newVersion) {
      throw createError('Failed to update report', 500);
    }

    res.json({
      success: true,
      data: {
        id: newVersion.id,
        version: newVersion.version,
        config: newVersion.config
      },
      message: 'Report configuration updated successfully'
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    apiLogger.error('Error updating report:', error);
    throw createError('Failed to update report', 500);
  }
}));

/**
 * DELETE /api/reports/:id
 * Delete a report configuration and all its versions
 */
router.delete('/:id', authenticateToken, requirePermission('reports', 'delete'), asyncHandler(async (req: Request, res: Response) => {
  initializeServices();

  const { id } = req.params;

  if (!id) {
    throw createError('Report ID is required', 400);
  }

  const currentUserId = (req as any).user?.id || 'anonymous';

  apiLogger.info('Deleting report configuration', { id, userId: currentUserId });

  try {
    const success = await reportManagementService.deleteReport(id, currentUserId);

    if (success) {
      res.json({
        success: true,
        message: 'Report configuration deleted successfully'
      });
    } else {
      throw createError('Report not found or access denied', 404);
    }

  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    apiLogger.error('Error deleting report:', error);
    throw createError('Failed to delete report', 500);
  }
}));

/**
 * POST /api/reports/export
 * Export a report configuration to JSON or Power BI format
 * Requirements: 1.1, 2.1, 4.3
 */
router.post('/export', authenticateToken, requirePermission('reports', 'read'), asyncHandler(async (req: Request, res: Response) => {
  const { config, format } = req.body as ExportRequest;

  // Validate request body
  if (!config) {
    apiLogger.error('Export failed: missing config');
    throw createError('Report configuration is required', 400);
  }

  if (!format || !isValidExportFormat(format)) {
    apiLogger.error('Export failed: invalid format', { format });
    throw createError('Invalid export format. Must be "json" or "powerbi"', 400);
  }

  apiLogger.info('Starting report configuration export', {
    format,
    configName: config.name,
    tags: config.tags?.length || 0,
  });

  try {
    // Call export service
    const result = await configExportService.exportConfiguration(config, {
      format,
      includeMetadata: true,
    });

    // Set response headers
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Cache-Control', 'no-cache');

    // Return file data
    res.send(result.data);

    apiLogger.info('Export completed successfully', {
      format,
      filename: result.filename,
      size: Buffer.isBuffer(result.data) ? result.data.length : Buffer.byteLength(result.data, 'utf8'),
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    apiLogger.error('Export failed', {
      format,
      configName: config.name,
      error: errorMessage,
    });

    // Check for specific error types
    if (errorMessage.includes('exceeds maximum export size')) {
      throw createError(errorMessage, 413); // Payload Too Large
    } else if (errorMessage.includes('Unsupported export format')) {
      throw createError(errorMessage, 400); // Bad Request
    } else {
      throw createError('Failed to export configuration', 500);
    }
  }
}));

/**
 * POST /api/reports/import
 * Import a report configuration from JSON file
 * Requirements: 3.2, 3.3, 3.5
 */
router.post('/import', authenticateToken, requirePermission('reports', 'write'), asyncHandler(async (req: Request, res: Response) => {
  const { fileContent } = req.body as ImportRequest;

  // Validate request body
  if (!fileContent || typeof fileContent !== 'string') {
    apiLogger.error('Import failed: missing or invalid fileContent');
    throw createError('File content is required and must be a string', 400);
  }

  apiLogger.info('Starting report configuration import', {
    contentLength: fileContent.length,
  });

  try {
    // Call import service
    const result = await configImportService.importConfiguration(fileContent);

    if (result.success) {
      apiLogger.info('Import completed successfully', {
        configName: result.config?.name,
        tags: result.config?.tags?.length || 0,
        warnings: result.warnings?.length || 0,
      });

      // Return success response with config and warnings
      res.json({
        success: true,
        data: result.config,
        warnings: result.warnings,
        metadata: {
          schemaVersion: result.config?.importMetadata?.schemaVersion,
        },
      });
    } else {
      apiLogger.warn('Import validation failed', {
        errorCount: result.errors?.length || 0,
      });

      // Return validation errors
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Configuration validation failed',
          validationErrors: result.errors,
        },
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    apiLogger.error('Import failed with exception', {
      error: errorMessage,
    });

    // Check for specific error types
    if (errorMessage.includes('exceeds maximum allowed size')) {
      throw createError(errorMessage, 413); // Payload Too Large
    } else {
      throw createError('Failed to import configuration', 500);
    }
  }
}));

/**
 * GET /api/reports/:id/download
 * Download a generated report
 */
router.get('/:id/download', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  apiLogger.info('Downloading report', { id });

  try {
    // Look for the report file in the reports directory
    const reportsDir = process.env.REPORTS_DIR || './reports';
    const files = fs.readdirSync(reportsDir);

    // Find file that starts with the report ID
    const reportFile = files.find(file => id && file.startsWith(id));

    if (!reportFile) {
      apiLogger.warn('Report file not found', { reportId: id });
      throw createError('Report not found', 404);
    }

    const filePath = path.join(reportsDir, reportFile);

    // Check if file exists and is readable
    if (!fs.existsSync(filePath)) {
      apiLogger.warn('Report file does not exist', { reportId: id, filePath });
      throw createError('Report file not found', 404);
    }

    const stats = fs.statSync(filePath);
    const fileExtension = path.extname(reportFile).toLowerCase();

    // Set appropriate content type
    let contentType = 'application/octet-stream';
    if (fileExtension === '.pdf') {
      contentType = 'application/pdf';
    } else if (fileExtension === '.docx') {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    // Set response headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `attachment; filename="${reportFile}"`);
    res.setHeader('Cache-Control', 'no-cache');

    // Stream the file
    const fileStream = fs.createReadStream(filePath);

    fileStream.on('error', (error) => {
      apiLogger.error('Error streaming report file', { reportId: id, error });
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error downloading report',
          reportId: id
        });
      }
    });

    fileStream.pipe(res);

    apiLogger.info('Report download started', {
      reportId: id,
      fileName: reportFile,
      fileSize: stats.size,
      contentType
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }

    apiLogger.error('Failed to download report', { reportId: id, error });
    throw createError('Failed to download report', 500);
  }
}));

export default router;