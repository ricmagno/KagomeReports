import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { opcuaConfigService } from '@/services/opcuaConfigService';
import { opcuaService } from '@/services/opcuaService';
import { asyncHandler } from '@/middleware/errorHandler';
import { authenticateToken, requireRole } from '@/middleware/auth';
import { apiLogger } from '@/utils/logger';

const router = Router();

router.use(authenticateToken);

router.get('/configs', asyncHandler(async (req: Request, res: Response) => {
    const configs = await opcuaConfigService.listConfigurations();
    res.json({ success: true, data: configs });
}));

router.post('/configs', [
    requireRole('admin'),
    body('name').trim().notEmpty(),
    body('endpointUrl').trim().notEmpty(),
    body('securityMode').isIn(['None', 'Sign', 'SignAndEncrypt']),
    body('securityPolicy').isIn(['None', 'Basic128Rsa15', 'Basic256', 'Basic256Sha256']),
    body('authenticationMode').isIn(['Anonymous', 'Username']),
], asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const configId = await opcuaConfigService.saveConfiguration(req.body, req.user!.id);
    return res.status(201).json({ success: true, data: { id: configId } });
}));

router.post('/test-connection', asyncHandler(async (req: Request, res: Response) => {
    apiLogger.info('Testing OPC UA connection...', { endpoint: req.body.endpointUrl });
    try {
        await opcuaService.connect(req.body);
        await opcuaService.disconnect();
        res.json({ success: true, message: 'Connection successful' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
}));

router.get('/browse', asyncHandler(async (req: Request, res: Response) => {
    const nodeId = (req.query.nodeId as string) || 'RootFolder';
    const tags = await opcuaService.browse(nodeId);
    res.json({ success: true, data: tags });
}));

router.post('/activate/:id', requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await opcuaConfigService.activateConfiguration(id);
    const config = await opcuaConfigService.loadConfiguration(id);
    await opcuaService.connect(config);
    return res.json({ success: true, message: 'Configuration activated' });
}));

router.delete('/configs/:id', requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        apiLogger.info(`Deleting OPC UA configuration: ${id}`);
        await opcuaConfigService.deleteConfiguration(id);
        res.json({ success: true, message: 'Configuration deleted' });
    } catch (error: any) {
        apiLogger.error(`Failed to delete OPC UA configuration: ${req.params.id}`, error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
}));

export default router;
