/**
 * User Management API Routes
 * Handles user CRUD operations and machine management
 * Requirements: User Management System Phase 3
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { apiLogger } from '@/utils/logger';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { userManagementService } from '@/services/userManagementService';
import { authenticateToken, requireAdmin, checkPasswordChangeRequired } from '@/middleware/auth';

const router = Router();

// Validation schemas
const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  role: z.enum(['user', 'admin', 'view-only']).default('user'),
  requirePasswordChange: z.boolean().default(false)
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  role: z.enum(['user', 'admin', 'view-only']).optional(),
  isActive: z.boolean().optional()
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
  confirmPassword: z.string().min(8).max(200)
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8).max(200),
  requirePasswordChange: z.boolean().default(true)
});

/**
 * GET /api/users
 * List users with filtering and pagination
 */
router.get('/', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { 
    role, 
    isActive, 
    search, 
    limit = 50, 
    offset = 0 
  } = req.query;

  apiLogger.info('List users request', { 
    role, 
    isActive, 
    search, 
    limit, 
    offset,
    requestedBy: req.user?.username 
  });

  const filters: any = {};
  if (role) filters.role = role as string;
  if (isActive !== undefined) filters.isActive = isActive === 'true';
  if (search) filters.search = search as string;

  // Convert offset to page number
  const pageSize = Number(limit);
  const page = Math.floor(Number(offset) / pageSize) + 1;

  const users = await userManagementService.listUsers(
    filters,
    page,
    pageSize
  );

  res.json({
    success: true,
    data: users.users,
    pagination: {
      limit: users.pageSize,
      offset: (users.page - 1) * users.pageSize,
      total: users.total
    }
  });
}));

/**
 * GET /api/users/:userId
 * Get user details by ID
 */
router.get('/:userId', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    throw createError('User ID required', 400);
  }

  apiLogger.info('Get user request', { userId, requestedBy: req.user?.username });

  const user = await userManagementService.getUser(userId);

  if (!user) {
    throw createError('User not found', 404);
  }

  res.json({
    success: true,
    data: user
  });
}));

/**
 * POST /api/users
 * Create a new user
 */
router.post('/', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const validationResult = createUserSchema.safeParse(req.body);
  
  if (!validationResult.success) {
    throw createError('Invalid user data', 400);
  }

  const userData = validationResult.data;

  apiLogger.info('Create user request', { 
    username: userData.username,
    role: userData.role,
    createdBy: req.user?.username 
  });

  const result = await userManagementService.createUser(userData);

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: result
  });
}));

/**
 * PUT /api/users/:userId
 * Update user details
 */
router.put('/:userId', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    throw createError('User ID required', 400);
  }

  const validationResult = updateUserSchema.safeParse(req.body);
  
  if (!validationResult.success) {
    throw createError('Invalid update data', 400);
  }

  const updates = validationResult.data;

  apiLogger.info('Update user request', { 
    userId, 
    updates,
    updatedBy: req.user?.username 
  });

  const updatedUser = await userManagementService.updateUser(userId, updates);

  res.json({
    success: true,
    message: 'User updated successfully',
    data: updatedUser
  });
}));

/**
 * DELETE /api/users/:userId
 * Delete user (with cascade deletion of View-Only accounts)
 */
router.delete('/:userId', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    throw createError('User ID required', 400);
  }

  apiLogger.info('Delete user request', { 
    userId, 
    deletedBy: req.user?.username 
  });

  // Prevent self-deletion
  if (userId === req.user?.id) {
    throw createError('Cannot delete your own account', 400);
  }

  await userManagementService.deleteUser(userId);

  res.json({
    success: true,
    message: 'User deleted successfully'
  });
}));

/**
 * POST /api/users/me/change-password
 * Change current user's password
 */
router.post('/me/change-password', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const validationResult = changePasswordSchema.safeParse(req.body);
  
  if (!validationResult.success) {
    throw createError('Invalid password data', 400);
  }

  const { currentPassword, newPassword } = validationResult.data;

  apiLogger.info('Change password request', { userId: req.user?.id });

  await userManagementService.changePassword(
    req.user!.id,
    currentPassword,
    newPassword
  );

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
}));

/**
 * POST /api/users/:userId/reset-password
 * Reset user password (admin only)
 */
router.post('/:userId/reset-password', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    throw createError('User ID required', 400);
  }

  const validationResult = resetPasswordSchema.safeParse(req.body);
  
  if (!validationResult.success) {
    throw createError('Invalid password data', 400);
  }

  const { newPassword, requirePasswordChange } = validationResult.data;

  apiLogger.info('Reset password request', { 
    userId, 
    resetBy: req.user?.username 
  });

  await userManagementService.resetPassword(userId, newPassword);

  res.json({
    success: true,
    message: 'Password reset successfully'
  });
}));

/**
 * GET /api/users/:userId/machines
 * Get user's auto-login machines
 */
router.get('/:userId/machines', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    throw createError('User ID required', 400);
  }

  // Users can only view their own machines unless they're admin
  if (userId !== req.user?.id && req.user?.role !== 'admin') {
    throw createError('Insufficient permissions', 403);
  }

  apiLogger.info('Get user machines request', { userId });

  const { autoLoginService } = await import('@/services/autoLoginService');
  const machines = await autoLoginService.getUserMachines(userId);

  res.json({
    success: true,
    data: machines
  });
}));

/**
 * DELETE /api/users/:userId/machines/:machineId
 * Remove a machine from user's auto-login
 */
router.delete('/:userId/machines/:machineId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { userId, machineId } = req.params;

  if (!userId || !machineId) {
    throw createError('User ID and Machine ID required', 400);
  }

  // Users can only remove their own machines unless they're admin
  if (userId !== req.user?.id && req.user?.role !== 'admin') {
    throw createError('Insufficient permissions', 403);
  }

  apiLogger.info('Remove machine request', { userId, machineId });

  const { autoLoginService } = await import('@/services/autoLoginService');
  await autoLoginService.removeMachine(userId, machineId);

  res.json({
    success: true,
    message: 'Machine removed successfully'
  });
}));

/**
 * POST /api/users/:userId/activate
 * Activate user account (admin only)
 */
router.post('/:userId/activate', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    throw createError('User ID required', 400);
  }

  apiLogger.info('Activate user request', { 
    userId, 
    activatedBy: req.user?.username 
  });

  await userManagementService.activateUser(userId);

  res.json({
    success: true,
    message: 'User activated successfully'
  });
}));

/**
 * POST /api/users/:userId/deactivate
 * Deactivate user account (admin only)
 */
router.post('/:userId/deactivate', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    throw createError('User ID required', 400);
  }

  // Prevent self-deactivation
  if (userId === req.user?.id) {
    throw createError('Cannot deactivate your own account', 400);
  }

  apiLogger.info('Deactivate user request', { 
    userId, 
    deactivatedBy: req.user?.username 
  });

  await userManagementService.deactivateUser(userId);

  res.json({
    success: true,
    message: 'User deactivated successfully'
  });
}));

export default router;
