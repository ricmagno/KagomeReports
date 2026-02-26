/**
 * Dashboard Management API Routes
 * Handles dashboard CRUD operations, versioning, and export/import
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { apiLogger } from '@/utils/logger';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { authenticateToken } from '@/middleware/auth';
import { DashboardManagementService } from '@/services/dashboardManagementService';
import { DashboardVersionService } from '@/services/dashboardVersionService';
import { DashboardExportService } from '@/services/dashboardExportService';
import { DashboardImportService } from '@/services/dashboardImportService';
import { getDatabasePath } from '@/config/environment';
import { Database } from 'sqlite3';

const router = Router();

// Initialize services
let managementService: DashboardManagementService;
let versionService: DashboardVersionService;
let exportService: DashboardExportService;
let importService: DashboardImportService;

const initializeServices = () => {
    if (!managementService) {
        const dbPath = process.env.DATABASE_PATH || getDatabasePath('dashboards.db');
        apiLogger.info('Initializing Dashboard database', { dbPath });
        const db = new Database(dbPath);
        managementService = new DashboardManagementService(db);
        versionService = new DashboardVersionService(db);
        exportService = new DashboardExportService();
        importService = new DashboardImportService();
        apiLogger.info('Dashboard services initialized');
    }
};

// Validation schemas
const SaveDashboardSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    config: z.object({
        widgets: z.array(z.any()),
        timeRange: z.object({
            startTime: z.string().optional().transform(str => str ? new Date(str) : undefined),
            endTime: z.string().optional().transform(str => str ? new Date(str) : undefined),
            relativeRange: z.enum(['last1h', 'last2h', 'last6h', 'last12h', 'last24h', 'last7d', 'last30d']).optional()
        }),
        refreshRate: z.number().default(30)
    }),
    changeDescription: z.string().optional()
});

// List all dashboards
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    initializeServices();
    const dashboards = await managementService.listDashboards();
    res.json({
        success: true,
        data: dashboards
    });
}));

// Load a specific dashboard
router.get('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    initializeServices();
    const { id } = req.params;
    if (!id) {
        throw createError('Dashboard ID is required', 400);
    }
    const dashboard = await managementService.loadDashboard(id);
    if (!dashboard) {
        throw createError('Dashboard not found', 404);
    }
    res.json({
        success: true,
        data: dashboard
    });
}));

// Save or update a dashboard
router.post('/save', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    initializeServices();
    const validatedData = SaveDashboardSchema.parse(req.body);
    const userId = (req as any).user.id;

    const result = await managementService.saveDashboard(validatedData, userId);

    if (result.success) {
        res.json(result);
    } else {
        throw createError(result.message, 400);
    }
}));

// Delete a dashboard
router.delete('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    initializeServices();
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!id) {
        throw createError('Dashboard ID is required', 400);
    }
    if (!userId) {
        throw createError('User not authenticated', 401);
    }

    const success = await managementService.deleteDashboard(id, userId);

    if (success) {
        res.json({ success: true, message: 'Dashboard deleted successfully' });
    } else {
        throw createError('Dashboard not found or unauthorized', 403);
    }
}));

// Get dashboard version history
router.get('/:name/versions', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    initializeServices();
    const { name } = req.params;
    if (!name) {
        throw createError('Dashboard name is required', 400);
    }
    const history = await managementService.getDashboardVersions(name);
    if (!history) {
        throw createError('No version history found', 404);
    }
    res.json({
        success: true,
        data: history
    });
}));

// Compare two dashboard versions
router.get('/:name/compare/:v1/:v2', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    initializeServices();
    const { name, v1: v1Str, v2: v2Str } = req.params;

    if (!name || !v1Str || !v2Str) {
        throw createError('Invalid dashboard name or version numbers', 400);
    }

    const v1 = parseInt(v1Str);
    const v2 = parseInt(v2Str);

    if (isNaN(v1) || isNaN(v2)) {
        throw createError('Invalid version numbers', 400);
    }

    const comparison = await versionService.compareVersions(name, v1, v2);

    if (!comparison) {
        throw createError('One or both versions not found', 404);
    }
    res.json({
        success: true,
        data: comparison
    });
}));

// Export a dashboard
router.post('/export', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    initializeServices();
    const { id } = req.body;
    if (!id) {
        throw createError('Dashboard ID is required for export', 400);
    }
    const dashboard = await managementService.loadDashboard(id);
    if (!dashboard) {
        throw createError('Dashboard not found', 404);
    }

    const exportResult = exportService.exportDashboard(dashboard.config);
    res.json(exportResult);
}));

// Import a dashboard
router.post('/import', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    initializeServices();
    const userId = (req as any).user?.id;
    if (!userId) {
        throw createError('User not authenticated', 401);
    }

    try {
        const config = await importService.importDashboard(JSON.stringify(req.body.data));
        const result = await managementService.saveDashboard({
            name: config.name,
            description: config.description || 'Imported dashboard',
            config: config,
            changeDescription: 'Imported from file'
        }, userId);

        res.json(result);
    } catch (error) {
        throw createError(error instanceof Error ? error.message : 'Import failed', 400);
    }
}));

export default router;
