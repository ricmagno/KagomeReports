/**
 * Database Configuration API Routes
 * Handles database configuration management endpoints
 * Requirements: 9.1, 9.2, 9.5, 9.6, 9.7
 */

import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { databaseConfigService } from '@/services/databaseConfigService';
import { asyncHandler } from '@/middleware/errorHandler';
import { authenticateToken, requireRole } from '@/middleware/auth';
import { apiLogger } from '@/utils/logger';
import { DatabaseConfig } from '@/types/databaseConfig';

const router = Router();

// All database configuration routes require authentication
router.use(authenticateToken);

/**
 * GET /api/database/configs
 * List all database configurations
 */
router.get('/configs', asyncHandler(async (req: Request, res: Response) => {
  const configurations = await databaseConfigService.listConfigurations();
  
  apiLogger.info('Database configurations listed', {
    userId: req.user?.id,
    count: configurations.length
  });

  res.json({
    success: true,
    data: configurations
  });
}));

/**
 * GET /api/database/configs/:id
 * Get specific database configuration
 */
router.get('/configs/:id', [
  param('id').isUUID().withMessage('Invalid configuration ID')
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { id } = req.params;
  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Configuration ID is required'
    });
  }

  const configuration = await databaseConfigService.loadConfiguration(id);
  
  // Remove password from response for security
  const { password, ...safeConfig } = configuration;
  
  apiLogger.info('Database configuration retrieved', {
    userId: req.user?.id,
    configId: id,
    configName: configuration.name
  });

  res.json({
    success: true,
    data: safeConfig
  });
}));

/**
 * POST /api/database/configs
 * Create new database configuration (Admin only)
 */
router.post('/configs', [
  requireRole('admin'),
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters'),
  body('host').trim().isLength({ min: 1, max: 255 }).withMessage('Host is required'),
  body('port').isInt({ min: 1, max: 65535 }).withMessage('Port must be between 1 and 65535'),
  body('database').trim().isLength({ min: 1, max: 100 }).withMessage('Database name is required'),
  body('username').trim().isLength({ min: 1, max: 100 }).withMessage('Username is required'),
  body('password').isLength({ min: 1 }).withMessage('Password is required'),
  body('encrypt').isBoolean().withMessage('Encrypt must be boolean'),
  body('trustServerCertificate').isBoolean().withMessage('Trust server certificate must be boolean'),
  body('connectionTimeout').isInt({ min: 1000, max: 300000 }).withMessage('Connection timeout must be between 1000ms and 300000ms'),
  body('requestTimeout').isInt({ min: 1000, max: 300000 }).withMessage('Request timeout must be between 1000ms and 300000ms')
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const config: DatabaseConfig = {
    name: req.body.name,
    host: req.body.host,
    port: req.body.port,
    database: req.body.database,
    username: req.body.username,
    password: req.body.password,
    encrypt: req.body.encrypt,
    trustServerCertificate: req.body.trustServerCertificate,
    connectionTimeout: req.body.connectionTimeout,
    requestTimeout: req.body.requestTimeout
  };

  const configId = await databaseConfigService.saveConfiguration(config, req.user!.id);
  
  apiLogger.info('Database configuration created', {
    userId: req.user?.id,
    configId,
    configName: config.name,
    host: config.host,
    database: config.database
  });

  res.status(201).json({
    success: true,
    message: 'Database configuration created successfully',
    data: { id: configId }
  });
}));

/**
 * PUT /api/database/configs/:id
 * Update database configuration (Admin only)
 */
router.put('/configs/:id', [
  requireRole('admin'),
  param('id').isUUID().withMessage('Invalid configuration ID'),
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters'),
  body('host').trim().isLength({ min: 1, max: 255 }).withMessage('Host is required'),
  body('port').isInt({ min: 1, max: 65535 }).withMessage('Port must be between 1 and 65535'),
  body('database').trim().isLength({ min: 1, max: 100 }).withMessage('Database name is required'),
  body('username').trim().isLength({ min: 1, max: 100 }).withMessage('Username is required'),
  body('password').isLength({ min: 1 }).withMessage('Password is required'),
  body('encrypt').isBoolean().withMessage('Encrypt must be boolean'),
  body('trustServerCertificate').isBoolean().withMessage('Trust server certificate must be boolean'),
  body('connectionTimeout').isInt({ min: 1000, max: 300000 }).withMessage('Connection timeout must be between 1000ms and 300000ms'),
  body('requestTimeout').isInt({ min: 1000, max: 300000 }).withMessage('Request timeout must be between 1000ms and 300000ms')
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { id } = req.params;
  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Configuration ID is required'
    });
  }

  const config: DatabaseConfig = {
    id,
    name: req.body.name,
    host: req.body.host,
    port: req.body.port,
    database: req.body.database,
    username: req.body.username,
    password: req.body.password,
    encrypt: req.body.encrypt,
    trustServerCertificate: req.body.trustServerCertificate,
    connectionTimeout: req.body.connectionTimeout,
    requestTimeout: req.body.requestTimeout
  };

  const configId = await databaseConfigService.saveConfiguration(config, req.user!.id);
  
  apiLogger.info('Database configuration updated', {
    userId: req.user?.id,
    configId,
    configName: config.name,
    host: config.host,
    database: config.database
  });

  res.json({
    success: true,
    message: 'Database configuration updated successfully',
    data: { id: configId }
  });
}));

/**
 * DELETE /api/database/configs/:id
 * Delete database configuration (Admin only)
 */
router.delete('/configs/:id', [
  requireRole('admin'),
  param('id').isUUID().withMessage('Invalid configuration ID')
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { id } = req.params;
  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Configuration ID is required'
    });
  }

  await databaseConfigService.deleteConfiguration(id);
  
  apiLogger.info('Database configuration deleted', {
    userId: req.user?.id,
    configId: id
  });

  res.json({
    success: true,
    message: 'Database configuration deleted successfully'
  });
}));

/**
 * POST /api/database/test
 * Test database connection
 */
router.post('/test', [
  body('host').trim().isLength({ min: 1, max: 255 }).withMessage('Host is required'),
  body('port').isInt({ min: 1, max: 65535 }).withMessage('Port must be between 1 and 65535'),
  body('database').trim().isLength({ min: 1, max: 100 }).withMessage('Database name is required'),
  body('username').trim().isLength({ min: 1, max: 100 }).withMessage('Username is required'),
  body('password').isLength({ min: 1 }).withMessage('Password is required'),
  body('encrypt').isBoolean().withMessage('Encrypt must be boolean'),
  body('trustServerCertificate').isBoolean().withMessage('Trust server certificate must be boolean'),
  body('connectionTimeout').isInt({ min: 1000, max: 300000 }).withMessage('Connection timeout must be between 1000ms and 300000ms'),
  body('requestTimeout').isInt({ min: 1000, max: 300000 }).withMessage('Request timeout must be between 1000ms and 300000ms')
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const config: DatabaseConfig = {
    name: 'Test Connection',
    host: req.body.host,
    port: req.body.port,
    database: req.body.database,
    username: req.body.username,
    password: req.body.password,
    encrypt: req.body.encrypt,
    trustServerCertificate: req.body.trustServerCertificate,
    connectionTimeout: req.body.connectionTimeout,
    requestTimeout: req.body.requestTimeout
  };

  const testResult = await databaseConfigService.testConnection(config);
  
  apiLogger.info('Database connection tested', {
    userId: req.user?.id,
    host: config.host,
    database: config.database,
    success: testResult.success,
    responseTime: testResult.responseTime
  });

  res.json({
    success: true,
    data: testResult
  });
}));

/**
 * POST /api/database/activate/:id
 * Activate database configuration (Admin only)
 */
router.post('/activate/:id', [
  requireRole('admin'),
  param('id').isUUID().withMessage('Invalid configuration ID')
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { id } = req.params;
  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Configuration ID is required'
    });
  }

  await databaseConfigService.activateConfiguration(id);
  
  apiLogger.info('Database configuration activated', {
    userId: req.user?.id,
    configId: id
  });

  res.json({
    success: true,
    message: 'Database configuration activated successfully'
  });
}));

/**
 * GET /api/database/active
 * Get active database configuration
 */
router.get('/active', asyncHandler(async (req: Request, res: Response) => {
  const activeConfig = databaseConfigService.getActiveConfiguration();
  
  if (!activeConfig) {
    return res.json({
      success: true,
      data: null,
      message: 'No active database configuration'
    });
  }

  // Return safe configuration data (without encrypted password)
  const safeConfig = {
    id: activeConfig.id,
    name: activeConfig.name,
    host: activeConfig.host,
    port: activeConfig.port,
    database: activeConfig.database,
    username: activeConfig.username,
    encrypt: activeConfig.encrypt,
    trustServerCertificate: activeConfig.trustServerCertificate,
    connectionTimeout: activeConfig.connectionTimeout,
    requestTimeout: activeConfig.requestTimeout,
    status: activeConfig.status,
    lastTested: activeConfig.lastTested
  };

  apiLogger.info('Active database configuration retrieved', {
    userId: req.user?.id,
    configId: activeConfig.id,
    configName: activeConfig.name
  });

  res.json({
    success: true,
    data: safeConfig
  });
}));

export default router;