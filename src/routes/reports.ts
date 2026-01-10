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
import { ReportConfig } from '@/services/reportGeneration';
import path from 'path';
import fs from 'fs';

const router = Router();

// Validation schemas
const reportConfigSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).min(1),
  timeRange: z.object({
    startTime: z.string().datetime().transform(str => new Date(str)),
    endTime: z.string().datetime().transform(str => new Date(str)),
    relativeRange: z.enum(['last1h', 'last24h', 'last7d', 'last30d']).optional()
  }),
  chartTypes: z.array(z.enum(['line', 'bar', 'trend', 'scatter'])).default(['line']),
  template: z.string().default('default'),
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
  includeAnomalies: z.boolean().default(false)
});

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
  const reportConfig: ReportConfig = {
    id: reportId,
    name: config.name,
    description: config.description,
    tags: config.tags,
    timeRange: config.timeRange,
    chartTypes: config.chartTypes as any[],
    template: config.template,
    format: config.format,
    branding: config.branding,
    metadata: config.metadata
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
  const { page = 1, limit = 10, search, category } = req.query;
  
  apiLogger.info('Retrieving saved reports', { page, limit, search, category });

  // TODO: Implement actual database query
  // For now, return mock data
  const mockReports = [
    {
      id: 'report-001',
      name: 'Daily Temperature Report',
      description: 'Daily temperature trends for all sensors',
      tags: ['TEMP001', 'TEMP002', 'TEMP003'],
      template: 'temperature-dashboard',
      createdBy: 'user@example.com',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      category: 'temperature'
    },
    {
      id: 'report-002',
      name: 'Pressure Analysis',
      description: 'Pressure system analysis with anomaly detection',
      tags: ['PRESS001', 'PRESS002'],
      template: 'pressure-analysis',
      createdBy: 'user@example.com',
      createdAt: '2023-01-02T00:00:00Z',
      updatedAt: '2023-01-02T00:00:00Z',
      category: 'pressure'
    }
  ];

  // Apply search filter if provided
  let filteredReports = mockReports;
  if (search) {
    const searchTerm = (search as string).toLowerCase();
    filteredReports = mockReports.filter(report => 
      report.name.toLowerCase().includes(searchTerm) ||
      report.description?.toLowerCase().includes(searchTerm)
    );
  }

  // Apply category filter if provided
  if (category) {
    filteredReports = filteredReports.filter(report => report.category === category);
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
}));

/**
 * POST /api/reports
 * Save a new report configuration
 */
router.post('/', authenticateToken, requirePermission('reports', 'write'), asyncHandler(async (req: Request, res: Response) => {
  const configResult = reportConfigSchema.safeParse(req.body);
  if (!configResult.success) {
    throw createError('Invalid report configuration', 400);
  }

  const config = configResult.data;
  
  apiLogger.info('Saving new report configuration', { config });

  // TODO: Implement actual database save
  // For now, return mock response
  const reportId = `report_${Date.now()}`;
  
  const savedReport = {
    id: reportId,
    ...config,
    createdBy: 'current-user@example.com', // TODO: Get from authentication
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  res.status(201).json({
    success: true,
    data: savedReport,
    message: 'Report configuration saved successfully'
  });
}));

/**
 * GET /api/reports/:id
 * Get a specific report configuration
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  apiLogger.info('Retrieving report configuration', { id });

  // TODO: Implement actual database query
  // For now, return mock data
  if (id === 'report-001') {
    const report = {
      id: 'report-001',
      name: 'Daily Temperature Report',
      description: 'Daily temperature trends for all sensors',
      tags: ['TEMP001', 'TEMP002', 'TEMP003'],
      timeRange: {
        startTime: '2023-01-01T00:00:00Z',
        endTime: '2023-01-02T00:00:00Z',
        relativeRange: 'last24h'
      },
      chartTypes: ['line', 'trend'],
      template: 'temperature-dashboard',
      format: 'pdf',
      createdBy: 'user@example.com',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    };

    res.json({
      success: true,
      data: report
    });
  } else {
    throw createError('Report not found', 404);
  }
}));

/**
 * PUT /api/reports/:id
 * Update a report configuration
 */
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const configResult = reportConfigSchema.partial().safeParse(req.body);
  if (!configResult.success) {
    throw createError('Invalid report configuration', 400);
  }

  const updates = configResult.data;
  
  apiLogger.info('Updating report configuration', { id, updates });

  // TODO: Implement actual database update
  // For now, return mock response
  if (id === 'report-001') {
    const updatedReport = {
      id: 'report-001',
      name: 'Daily Temperature Report',
      description: 'Daily temperature trends for all sensors',
      tags: ['TEMP001', 'TEMP002', 'TEMP003'],
      timeRange: {
        startTime: '2023-01-01T00:00:00Z',
        endTime: '2023-01-02T00:00:00Z'
      },
      chartTypes: ['line', 'trend'],
      template: 'temperature-dashboard',
      format: 'pdf',
      createdBy: 'user@example.com',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: new Date().toISOString(),
      ...updates
    };

    res.json({
      success: true,
      data: updatedReport,
      message: 'Report configuration updated successfully'
    });
  } else {
    throw createError('Report not found', 404);
  }
}));

/**
 * DELETE /api/reports/:id
 * Delete a report configuration
 */
router.delete('/:id', authenticateToken, requirePermission('reports', 'delete'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  apiLogger.info('Deleting report configuration', { id });

  // TODO: Implement actual database deletion
  // For now, return mock response
  if (id === 'report-001') {
    res.json({
      success: true,
      message: 'Report configuration deleted successfully'
    });
  } else {
    throw createError('Report not found', 404);
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
    const reportFile = files.find(file => file.startsWith(id));
    
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