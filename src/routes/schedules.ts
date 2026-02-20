/**
 * Schedule Management API Routes
 * Handles automated report scheduling and execution
 * Requirements: 7.1, 7.2, 7.3
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { apiLogger } from '@/utils/logger';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { authenticateToken, requirePermission } from '@/middleware/auth';
import { schedulerService, ScheduleConfig } from '@/services/schedulerService';
import { ReportConfig } from '@/services/reportGeneration';
import { SpecificationLimits } from '@/types/historian';
import { userManagementService } from '@/services/userManagementService';
import fs from 'fs';
import path from 'path';

const router = Router();

// Validation schemas
const reportConfigSchema = z.object({
  id: z.string().min(1),
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
  // ── Advanced Analytics flags ──────────────────────────────────────────────
  // These MUST be declared here, otherwise Zod strips them from the config blob
  // stored in scheduler.db and the PDF generator never sees them.
  includeStatsSummary: z.boolean().optional(),
  includeTrendLines: z.boolean().optional(),
  includeSPCCharts: z.boolean().optional(),
  includeDataTable: z.boolean().optional(),
  includeStatistics: z.boolean().optional(),
  includeTrends: z.boolean().optional(),
  includeAnomalies: z.boolean().optional(),
  specificationLimits: z.record(
    z.string(),
    z.object({ lsl: z.number().optional(), usl: z.number().optional() })
  ).optional().transform(val => val as Record<string, SpecificationLimits> | undefined),
  retrievalMode: z.string().optional(),
  version: z.number().optional()
});

const scheduleConfigSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  reportConfig: reportConfigSchema,
  cronExpression: z.string().min(1),
  enabled: z.boolean().default(true),
  recipients: z.array(z.string().email()).optional(),
  saveToFile: z.boolean().optional().default(true),
  sendEmail: z.boolean().optional(),
  destinationPath: z.string().optional(),
  /** Report name to link; each execution loads the latest version from ReportManagementService */
  linkedReportId: z.string().optional()
}).refine(data => {
  // At least one delivery method must be enabled
  const saveToFile = data.saveToFile !== undefined ? data.saveToFile : true;
  const sendEmail = data.sendEmail !== undefined ? data.sendEmail : (data.recipients && data.recipients.length > 0);
  return saveToFile || sendEmail;
}, {
  message: "At least one delivery method must be enabled (Save to Disk or Send via Email)",
  path: ["deliveryOptions"]
});

const scheduleUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  reportConfig: reportConfigSchema.optional(),
  cronExpression: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  recipients: z.array(z.string().email()).optional(),
  saveToFile: z.boolean().optional(),
  sendEmail: z.boolean().optional(),
  destinationPath: z.string().optional(),
  linkedReportId: z.string().optional()
}).transform(data => {
  // Remove undefined values to avoid TypeScript strict optional issues
  const result: any = {};
  Object.keys(data).forEach(key => {
    if (data[key as keyof typeof data] !== undefined) {
      result[key] = data[key as keyof typeof data];
    }
  });
  return result;
}).refine(data => {
  // If reportConfig is provided, validate it has required fields
  if (data.reportConfig) {
    return data.reportConfig.tags && data.reportConfig.tags.length > 0;
  }
  return true;
}, {
  message: "Report config must include at least one tag",
  path: ["reportConfig", "tags"]
}).refine(data => {
  // If both delivery options are explicitly set to false, reject
  if (data.saveToFile === false && data.sendEmail === false) {
    return false;
  }
  return true;
}, {
  message: "At least one delivery method must be enabled (Save to Disk or Send via Email)",
  path: ["deliveryOptions"]
});

/**
 * GET /api/schedules
 * Get list of scheduled reports
 */
router.get('/', authenticateToken, requirePermission('schedules', 'read'), asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 10, enabled } = req.query;
  const currentUserId = (req as any).user?.id;

  apiLogger.info('Retrieving scheduled reports', { page, limit, enabled, userId: currentUserId });

  try {
    const schedules = await schedulerService.getSchedules(req.user?.role === 'admin' ? undefined : currentUserId);

    // Resolve user IDs to usernames for display
    const enrichedSchedules = await Promise.all(schedules.map(async (s) => {
      let createdBy = 'System';
      if (s.createdByUserId) {
        try {
          const u = await userManagementService.getUser(s.createdByUserId);
          createdBy = u ? u.username : 'Unknown User';
        } catch (err) {
          createdBy = 'Unknown User';
        }
      }
      return { ...s, createdBy };
    }));

    // Apply filters
    let filteredSchedules = enrichedSchedules;
    if (enabled !== undefined) {
      const isEnabled = enabled === 'true';
      filteredSchedules = enrichedSchedules.filter(s => s.enabled === isEnabled);
    }

    // Apply pagination
    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const paginatedSchedules = filteredSchedules.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        schedules: paginatedSchedules,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: filteredSchedules.length,
          totalPages: Math.ceil(filteredSchedules.length / Number(limit))
        }
      }
    });
  } catch (error) {
    apiLogger.error('Failed to retrieve schedules', { error });
    throw createError('Failed to retrieve schedules', 500);
  }
}));

/**
 * POST /api/schedules
 * Create a new schedule
 */
router.post('/', authenticateToken, requirePermission('schedules', 'write'), asyncHandler(async (req: Request, res: Response) => {
  const configResult = scheduleConfigSchema.safeParse(req.body);
  if (!configResult.success) {
    apiLogger.error('Invalid schedule configuration', { errors: configResult.error.errors });
    throw createError('Invalid schedule configuration', 400);
  }

  const config = configResult.data;
  const currentUserId = (req as any).user?.id;

  apiLogger.info('Creating new schedule', { name: config.name, userId: currentUserId });

  try {
    const scheduleId = await schedulerService.createSchedule(config, currentUserId);
    const savedSchedule = await schedulerService.getSchedule(scheduleId);

    res.status(201).json({
      success: true,
      data: {
        scheduleId: scheduleId,
        schedule: savedSchedule,
        message: 'Schedule created successfully'
      }
    });
  } catch (error) {
    apiLogger.error('Failed to create schedule', { error, config: config.name });
    throw createError('Failed to create schedule', 500);
  }
}));

/**
 * GET /api/schedules/:id
 * Get a specific schedule
 */
router.get('/:id', authenticateToken, requirePermission('schedules', 'read'), asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const currentUserId = (req as any).user?.id;

  apiLogger.info('Retrieving schedule', { id, userId: currentUserId });

  try {
    const schedule = await schedulerService.getSchedule(id, currentUserId);

    if (!schedule) {
      throw createError('Schedule not found', 404);
    }

    res.json({
      success: true,
      data: schedule
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    apiLogger.error('Failed to retrieve schedule', { error, id });
    throw createError('Failed to retrieve schedule', 500);
  }
}));

/**
 * PUT /api/schedules/:id
 * Update a schedule
 */
router.put('/:id', authenticateToken, requirePermission('schedules', 'write'), asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const currentUserId = (req as any).user?.id;

  const configResult = scheduleUpdateSchema.safeParse(req.body);
  if (!configResult.success) {
    apiLogger.error('Invalid schedule update configuration', { errors: configResult.error.errors });
    throw createError('Invalid schedule configuration', 400);
  }

  const updates = configResult.data;

  apiLogger.info('Updating schedule', { id, updates: Object.keys(updates), userId: currentUserId });

  try {
    await schedulerService.updateSchedule(id, updates, currentUserId);
    const updatedSchedule = await schedulerService.getSchedule(id, currentUserId);

    res.json({
      success: true,
      data: {
        schedule: updatedSchedule,
        message: 'Schedule updated successfully'
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw createError('Schedule not found', 404);
    }
    apiLogger.error('Failed to update schedule', { error, id });
    throw createError('Failed to update schedule', 500);
  }
}));

/**
 * DELETE /api/schedules/:id
 * Delete a schedule
 */
router.delete('/:id', authenticateToken, requirePermission('schedules', 'delete'), asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const currentUserId = (req as any).user?.id;

  apiLogger.info('Deleting schedule', { id, userId: currentUserId });

  try {
    await schedulerService.deleteSchedule(id, currentUserId);

    res.json({
      success: true,
      message: 'Schedule deleted successfully'
    });
  } catch (error) {
    apiLogger.error('Failed to delete schedule', { error, id });
    throw createError('Failed to delete schedule', 500);
  }
}));

/**
 * POST /api/schedules/:id/execute
 * Manually execute a schedule
 */
router.post('/:id/execute', authenticateToken, requirePermission('schedules', 'write'), asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const currentUserId = (req as any).user?.id;

  apiLogger.info('Manually executing schedule', { id, userId: currentUserId });

  try {
    // Trigger the execution through the scheduler service
    const executionId = await schedulerService.executeScheduleManually(id, currentUserId);

    res.json({
      success: true,
      data: {
        executionId,
        status: 'queued',
        message: 'Schedule execution queued successfully',
        queuedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw createError('Schedule not found', 404);
    }
    apiLogger.error('Failed to execute schedule', { error, id });
    throw createError('Failed to execute schedule', 500);
  }
}));

/**
 * POST /api/schedules/:id/enable
 * Enable a schedule
 */
router.post('/:id/enable', authenticateToken, requirePermission('schedules', 'write'), asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const currentUserId = (req as any).user?.id;

  apiLogger.info('Enabling schedule', { id, userId: currentUserId });

  try {
    await schedulerService.updateSchedule(id, { enabled: true }, currentUserId);
    const updatedSchedule = await schedulerService.getSchedule(id, currentUserId);

    res.json({
      success: true,
      data: {
        schedule: updatedSchedule,
        message: 'Schedule enabled successfully'
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw createError('Schedule not found', 404);
    }
    apiLogger.error('Failed to enable schedule', { error, id });
    throw createError('Failed to enable schedule', 500);
  }
}));

/**
 * POST /api/schedules/:id/disable
 * Disable a schedule
 */
router.post('/:id/disable', authenticateToken, requirePermission('schedules', 'write'), asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const currentUserId = (req as any).user?.id;

  apiLogger.info('Disabling schedule', { id, userId: currentUserId });

  try {
    await schedulerService.updateSchedule(id, { enabled: false }, currentUserId);
    const updatedSchedule = await schedulerService.getSchedule(id, currentUserId);

    res.json({
      success: true,
      data: {
        schedule: updatedSchedule,
        message: 'Schedule disabled successfully'
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw createError('Schedule not found', 404);
    }
    apiLogger.error('Failed to disable schedule', { error, id });
    throw createError('Failed to disable schedule', 500);
  }
}));

/**
 * GET /api/schedules/:id/executions
 * Get execution history for a schedule
 */
router.get('/:id/executions', authenticateToken, requirePermission('schedules', 'read'), asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const currentUserId = (req as any).user?.id;
  const { page = 1, limit = 10, status } = req.query;

  apiLogger.info('Retrieving schedule execution history', { id, page, limit, status, userId: currentUserId });

  try {
    const executions = await schedulerService.getExecutionHistory(id, Number(limit) * Number(page), currentUserId);

    // Apply status filter if provided
    let filteredExecutions = executions;
    if (status) {
      filteredExecutions = executions.filter(e => e.status === status);
    }

    // Apply pagination
    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const paginatedExecutions = filteredExecutions.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        executions: paginatedExecutions,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: filteredExecutions.length,
          totalPages: Math.ceil(filteredExecutions.length / Number(limit))
        }
      }
    });
  } catch (error) {
    apiLogger.error('Failed to retrieve execution history', { error, id });
  }
}));

/**
 * GET /api/schedules/executions/:executionId/download
 * Download a report from a specific execution
 */
router.get('/executions/:executionId/download', asyncHandler(async (req: Request, res: Response) => {
  const { executionId } = req.params;

  if (!executionId) {
    throw createError('Execution ID is required', 400);
  }

  apiLogger.info('Request to download scheduled report execution', { executionId });

  try {
    const execution = await schedulerService.getExecution(executionId);

    if (!execution) {
      throw createError('Execution not found', 404);
    }

    if (execution.status !== 'success' || !execution.reportPath) {
      throw createError('Report not available for this execution', 400);
    }

    const filePath = execution.reportPath;

    if (!fs.existsSync(filePath)) {
      apiLogger.warn('Report file missing from disk', { executionId, filePath });
      throw createError('Report file missing from disk', 404);
    }

    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    if (error instanceof Error && (error as any).status) throw error;
    apiLogger.error('Failed to download execution report', { executionId, error });
    throw createError('Failed to download report', 500);
  }
}));

export default router;