import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { authenticateToken } from '@/middleware/auth';
import { alertManagementService } from '@/services/alertManagementService';

const router = Router();

// Validation schemas
const AlertListMemberSchema = z.object({
    name: z.string().min(1),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional().or(z.literal(''))
});

const SaveAlertListSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    members: z.array(AlertListMemberSchema)
});

const SaveAlertPatternSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    pvSuffix: z.string().min(1),
    hhLimitSuffix: z.string(),
    hLimitSuffix: z.string(),
    lLimitSuffix: z.string(),
    llLimitSuffix: z.string(),
    hhEventSuffix: z.string(),
    hEventSuffix: z.string(),
    lEventSuffix: z.string(),
    llEventSuffix: z.string(),
});

const SaveAlertConfigSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    tagBase: z.string().min(1),
    monitorHH: z.boolean(),
    monitorH: z.boolean(),
    monitorL: z.boolean(),
    monitorLL: z.boolean(),
    alertListId: z.string().uuid(),
    patternId: z.string(),
    isActive: z.boolean().default(true)
});

// --- Alert Lists ---

router.get('/lists', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const lists = await alertManagementService.getAlertLists();
    res.json({ success: true, data: lists });
}));

router.get('/lists/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const list = await alertManagementService.getAlertListById(req.params.id as string);
    if (!list) throw createError('Alert list not found', 404);
    res.json({ success: true, data: list });
}));

router.post('/lists', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const validatedData = SaveAlertListSchema.parse(req.body);
    const userId = (req as any).user.id;
    const list = await alertManagementService.createAlertList(validatedData as any, userId);
    res.status(201).json({ success: true, data: list });
}));

router.put('/lists/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const validatedData = SaveAlertListSchema.parse(req.body);
    const list = await alertManagementService.updateAlertList(req.params.id as string, validatedData as any);
    if (!list) throw createError('Alert list not found', 404);
    res.json({ success: true, data: list });
}));

router.delete('/lists/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const success = await alertManagementService.deleteAlertList(req.params.id as string);
    if (!success) throw createError('Alert list not found', 404);
    res.json({ success: true, message: 'Deleted successfully' });
}));

// --- Alert Configs ---

router.get('/configs', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const configs = await alertManagementService.getAlertConfigs();
    res.json({ success: true, data: configs });
}));

router.get('/configs/active', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const configs = await alertManagementService.getActiveAlertConfigs();
    res.json({ success: true, data: configs });
}));

router.get('/configs/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const config = await alertManagementService.getAlertConfigById(req.params.id as string);
    if (!config) throw createError('Alert config not found', 404);
    res.json({ success: true, data: config });
}));

router.post('/configs', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const validatedData = SaveAlertConfigSchema.parse(req.body);
    const userId = (req as any).user.id;

    // Verify alert list exists
    const list = await alertManagementService.getAlertListById(validatedData.alertListId);
    if (!list) throw createError('Alert list not found', 400);

    const config = await alertManagementService.createAlertConfig(validatedData as any, userId);
    res.status(201).json({ success: true, data: config });
}));

router.put('/configs/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const validatedData = SaveAlertConfigSchema.parse(req.body);

    // Verify alert list exists
    const list = await alertManagementService.getAlertListById(validatedData.alertListId);
    if (!list) throw createError('Alert list not found', 400);

    const config = await alertManagementService.updateAlertConfig(req.params.id as string, validatedData as any);
    if (!config) throw createError('Alert config not found', 404);
    res.json({ success: true, data: config });
}));

router.delete('/configs/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const success = await alertManagementService.deleteAlertConfig(req.params.id as string);
    if (!success) throw createError('Alert config not found', 404);
    res.json({ success: true, message: 'Deleted successfully' });
}));

// --- Alert Patterns ---

router.get('/patterns', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const patterns = await alertManagementService.getAlertPatterns();
    res.json({ success: true, data: patterns });
}));

router.get('/patterns/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const pattern = await alertManagementService.getAlertPatternById(req.params.id as string);
    if (!pattern) throw createError('Alert pattern not found', 404);
    res.json({ success: true, data: pattern });
}));

router.post('/patterns', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    // Only admins should modify patterns
    if ((req as any).user.role !== 'admin') throw createError('Forbidden. Admin access required.', 403);

    const validatedData = SaveAlertPatternSchema.parse(req.body);
    const userId = (req as any).user.id;
    const pattern = await alertManagementService.createAlertPattern(validatedData as any, userId);
    res.status(201).json({ success: true, data: pattern });
}));

router.put('/patterns/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    if ((req as any).user.role !== 'admin') throw createError('Forbidden. Admin access required.', 403);

    const validatedData = SaveAlertPatternSchema.parse(req.body);
    const pattern = await alertManagementService.updateAlertPattern(req.params.id as string, validatedData as any);
    if (!pattern) throw createError('Alert pattern not found', 404);
    res.json({ success: true, data: pattern });
}));

router.delete('/patterns/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    if ((req as any).user.role !== 'admin') throw createError('Forbidden. Admin access required.', 403);

    const success = await alertManagementService.deleteAlertPattern(req.params.id as string);
    if (!success) throw createError('Alert pattern not found', 404);
    res.json({ success: true, message: 'Deleted successfully' });
}));

export default router;
