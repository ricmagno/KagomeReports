import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { authenticateToken, requireRole } from '@/middleware/auth';
import { alertManagementService } from '@/services/alertManagementService';
import { alertEvalService } from '@/services/alertEvalService';
import { alertDeliveryConfigService } from '@/services/alertDeliveryConfigService';
import { emailService } from '@/services/emailService';
import { smsService } from '@/services/smsService';
import { logger } from '@/utils/logger';

const requireAdmin = requireRole('admin');

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
    alertEvalService.refresh().catch(err => logger.error('Failed to refresh alert subscriptions:', err));
    res.status(201).json({ success: true, data: config });
}));

router.put('/configs/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const validatedData = SaveAlertConfigSchema.parse(req.body);

    // Verify alert list exists
    const list = await alertManagementService.getAlertListById(validatedData.alertListId);
    if (!list) throw createError('Alert list not found', 400);

    const config = await alertManagementService.updateAlertConfig(req.params.id as string, validatedData as any);
    if (!config) throw createError('Alert config not found', 404);
    alertEvalService.refresh().catch(err => logger.error('Failed to refresh alert subscriptions:', err));
    res.json({ success: true, data: config });
}));

router.delete('/configs/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const success = await alertManagementService.deleteAlertConfig(req.params.id as string);
    if (!success) throw createError('Alert config not found', 404);
    alertEvalService.refresh().catch(err => logger.error('Failed to refresh alert subscriptions:', err));
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

// --- Alert Delivery Config ---

const EmailConfigSchema = z.object({
    enabled: z.boolean(),
    smtpHost: z.string().min(1, 'SMTP host is required'),
    smtpPort: z.coerce.number().int().min(1).max(65535),
    smtpSecure: z.boolean(),
    smtpUser: z.string().min(1, 'SMTP user is required'),
    smtpPassword: z.string().optional().default(''),
    fromName: z.string().default(''),
    fromEmail: z.string().email().or(z.literal('')).default(''),
});

router.get('/delivery-config/email', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const config = alertDeliveryConfigService.getEmailConfigForClient();
    res.json({ success: true, data: config });
}));

router.put('/delivery-config/email', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const parsed = EmailConfigSchema.safeParse(req.body);
    if (!parsed.success) throw createError('Invalid email configuration', 400);

    alertDeliveryConfigService.saveEmailConfig(parsed.data as any);

    const fullConfig = alertDeliveryConfigService.getEmailConfig();
    if (fullConfig) {
        emailService.reconfigure({
            host: fullConfig.smtpHost,
            port: fullConfig.smtpPort,
            secure: fullConfig.smtpSecure,
            user: fullConfig.smtpUser,
            password: fullConfig.smtpPassword,
            fromName: fullConfig.fromName,
            fromEmail: fullConfig.fromEmail,
        });
    }

    const clientConfig = alertDeliveryConfigService.getEmailConfigForClient();
    res.json({ success: true, data: clientConfig, message: 'Email configuration saved' });
}));

router.post('/delivery-config/email/test', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { testRecipient } = z.object({ testRecipient: z.string().email() }).parse(req.body);
    const result = await emailService.testConfiguration(testRecipient);
    res.json({ success: result.success, message: result.success ? 'Test email sent successfully' : result.error });
}));

// --- SMS Delivery Config ---

const SmsConfigSchema = z.object({
    enabled: z.boolean(),
    apiUrl: z.string().url('A valid API URL is required'),
    apiToken: z.string().optional().default(''),
});

router.get('/delivery-config/sms', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const config = alertDeliveryConfigService.getSmsConfigForClient();
    res.json({ success: true, data: config });
}));

router.put('/delivery-config/sms', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const parsed = SmsConfigSchema.safeParse(req.body);
    if (!parsed.success) throw createError('Invalid SMS configuration', 400);

    alertDeliveryConfigService.saveSmsConfig(parsed.data as any);

    const fullConfig = alertDeliveryConfigService.getSmsConfig();
    if (fullConfig) {
        smsService.reconfigure({ apiUrl: fullConfig.apiUrl, apiToken: fullConfig.apiToken });
    }

    const clientConfig = alertDeliveryConfigService.getSmsConfigForClient();
    res.json({ success: true, data: clientConfig, message: 'SMS configuration saved' });
}));

router.post('/delivery-config/sms/test', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { testRecipient } = z.object({ testRecipient: z.string().min(1, 'Phone number required') }).parse(req.body);
    const sent = await smsService.sendSms([testRecipient], 'Historian Reports — SMS configuration test message.');
    res.json({ success: sent, message: sent ? 'Test SMS sent successfully' : 'Failed to send SMS — check API URL and token' });
}));

export default router;
