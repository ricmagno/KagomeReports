/**
 * Auto-Login API Routes
 * Handles machine-based auto-login functionality
 * Requirements: User Management System Phase 3
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { apiLogger } from '@/utils/logger';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { autoLoginService } from '@/services/autoLoginService';
import { authService } from '@/services/authService';
import { authenticateToken, rateLimitPerUser } from '@/middleware/auth';

const router = Router();

// Validation schemas
const fingerprintSchema = z.object({
  fingerprint: z.string().min(1),
  machineName: z.string().min(1).max(100).optional()
});

const enableAutoLoginSchema = z.object({
  fingerprint: z.string().min(1),
  machineName: z.string().min(1).max(100)
});

const authenticateAutoLoginSchema = z.object({
  fingerprint: z.string().min(1)
});

// Apply rate limiting to auto-login endpoints (max 10 requests per 15 minutes)
router.use(rateLimitPerUser(10, 15 * 60 * 1000));

/**
 * POST /api/auth/auto-login/check
 * Check if auto-login is available for a fingerprint
 */
router.post('/check', asyncHandler(async (req: Request, res: Response) => {
  const validationResult = fingerprintSchema.safeParse(req.body);
  
  if (!validationResult.success) {
    throw createError('Invalid fingerprint data', 400);
  }

  const { fingerprint } = validationResult.data;

  apiLogger.info('Auto-login check request', { 
    fingerprintHash: fingerprint.substring(0, 10) + '...',
    ip: req.ip 
  });

  const result = await autoLoginService.checkAutoLoginAvailability(fingerprint);

  res.json({
    success: true,
    data: {
      available: result.available,
      userId: result.userId
    }
  });
}));

/**
 * POST /api/auth/auto-login/enable
 * Enable auto-login for current user on this machine
 */
router.post('/enable', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const validationResult = enableAutoLoginSchema.safeParse(req.body);
  
  if (!validationResult.success) {
    throw createError('Invalid auto-login data', 400);
  }

  const { fingerprint, machineName } = validationResult.data;

  apiLogger.info('Enable auto-login request', { 
    userId: req.user?.id,
    username: req.user?.username,
    machineName,
    ip: req.ip 
  });

  // View-Only users cannot enable auto-login
  if (req.user?.role === 'view-only') {
    throw createError('View-Only users cannot enable auto-login', 403);
  }

  const machineId = await autoLoginService.enableAutoLogin(
    req.user!.id,
    fingerprint,
    machineName
  );

  // Log audit event
  await authService.logAuditEvent(
    req.user!.id,
    'auto_login_enabled',
    'auth',
    `Auto-login enabled for machine: ${machineName}`,
    req.ip,
    req.get('User-Agent')
  );

  res.json({
    success: true,
    message: 'Auto-login enabled successfully',
    data: {
      machineId,
      machineName
    }
  });
}));

/**
 * POST /api/auth/auto-login/disable
 * Disable auto-login for current user
 */
router.post('/disable', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { fingerprint } = req.body;

  if (!fingerprint) {
    throw createError('Fingerprint required', 400);
  }

  apiLogger.info('Disable auto-login request', { 
    userId: req.user?.id,
    username: req.user?.username 
  });

  await autoLoginService.disableAutoLogin(req.user!.id, fingerprint);

  // Log audit event
  await authService.logAuditEvent(
    req.user!.id,
    'auto_login_disabled',
    'auth',
    'Auto-login disabled for machine',
    req.ip,
    req.get('User-Agent')
  );

  res.json({
    success: true,
    message: 'Auto-login disabled successfully'
  });
}));

/**
 * POST /api/auth/auto-login/authenticate
 * Authenticate using auto-login fingerprint
 */
router.post('/authenticate', asyncHandler(async (req: Request, res: Response) => {
  const validationResult = authenticateAutoLoginSchema.safeParse(req.body);
  
  if (!validationResult.success) {
    throw createError('Invalid authentication data', 400);
  }

  const { fingerprint } = validationResult.data;

  apiLogger.info('Auto-login authentication attempt', { 
    fingerprintHash: fingerprint.substring(0, 10) + '...',
    ip: req.ip || 'unknown'
  });

  // Validate auto-login token
  const validation = await autoLoginService.validateAutoLoginToken(
    fingerprint,
    req.ip || 'unknown'
  );

  if (!validation.success || !validation.user) {
    // Log failed attempt
    await authService.logAuditEvent(
      null,
      'auto_login_failed',
      'auth',
      `Failed auto-login attempt from IP: ${req.ip || 'unknown'}`,
      req.ip || 'unknown',
      req.get('User-Agent')
    );

    throw createError('Auto-login authentication failed', 401);
  }

  // Log successful auto-login
  await authService.logAuditEvent(
    validation.user.id,
    'auto_login_success',
    'auth',
    'User logged in via auto-login',
    req.ip,
    req.get('User-Agent')
  );

  res.json({
    success: true,
    message: 'Auto-login successful',
    data: {
      token: validation.token,
      user: validation.user
    }
  });
}));

/**
 * POST /api/auth/fingerprint
 * Generate fingerprint hash from browser fingerprint data
 */
router.post('/fingerprint', asyncHandler(async (req: Request, res: Response) => {
  const { fingerprintData } = req.body;

  if (!fingerprintData) {
    throw createError('Fingerprint data required', 400);
  }

  apiLogger.info('Generate fingerprint hash request', { ip: req.ip });

  const fingerprintHash = await autoLoginService.generateFingerprint(fingerprintData);

  res.json({
    success: true,
    data: {
      fingerprint: fingerprintHash
    }
  });
}));

/**
 * GET /api/auth/auto-login/status
 * Check if auto-login is enabled for current user
 */
router.get('/status', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { fingerprint } = req.query;

  if (!fingerprint || typeof fingerprint !== 'string') {
    throw createError('Fingerprint required', 400);
  }

  apiLogger.info('Auto-login status request', { userId: req.user?.id });

  const isEnabled = await autoLoginService.isAutoLoginEnabled(req.user!.id, fingerprint);

  res.json({
    success: true,
    data: {
      enabled: isEnabled
    }
  });
}));

export default router;
