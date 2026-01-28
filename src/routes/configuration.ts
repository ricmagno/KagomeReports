/**
 * Configuration Management API Routes
 * Provides secure access to application configurations for Administrators
 * Requirements: 6.1, 6.2, 6.3, 9.1, 9.2, 9.3, 9.5
 */

import { Router, Request, Response } from 'express';
import { apiLogger } from '@/utils/logger';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { authenticateToken, requireRole } from '@/middleware/auth';
import { ConfigurationService } from '@/services/configurationService';
import { ConfigurationUpdateService } from '@/services/configurationUpdateService';
import { AuditLogger } from '@/services/auditLogger';
import {
  RevealSensitiveRequest,
  RevealSensitiveResponse,
  ConfigurationUpdateRequest,
  ConfigurationUpdateResponse
} from '@/types/configuration';

const router = Router();
const auditLogger = new AuditLogger();
const updateService = new ConfigurationUpdateService();

/**
 * Middleware to verify Administrator role
 */
const requireAdmin = requireRole('admin');

/**
 * GET /api/configuration
 * Retrieve all configurations organized by category
 * 
 * Requirements: 1.1, 1.3, 1.4, 2.1, 6.1, 6.2, 6.3, 9.1, 9.2, 9.3, 9.5
 * 
 * Response:
 * - 200: Configuration data organized by category
 * - 401: Unauthorized - authentication required
 * - 403: Forbidden - Administrator role required
 * - 500: Server error
 */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    apiLogger.info('Configuration retrieval requested', {
      userId: req.user?.id,
      userRole: req.user?.role
    });

    try {
      // Verify user is authenticated and is an admin
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      if (req.user.role !== 'admin') {
        apiLogger.warn('Non-admin user attempted to access configurations', {
          userId: req.user.id,
          userRole: req.user.role
        });
        throw createError('Insufficient permissions - Administrator role required', 403);
      }

      // Log configuration access for audit purposes
      await auditLogger.logConfigurationAccess(req.user.id, new Date(), req.ip, req.get('User-Agent'));

      // Retrieve all configurations
      const configurations = ConfigurationService.getAllConfigurations();

      apiLogger.info('Configurations retrieved successfully', {
        userId: req.user.id,
        configCount: configurations.reduce((sum, group) => sum + group.configurations.length, 0),
        categoryCount: configurations.length
      });

      res.json({
        success: true,
        data: configurations
      });
    } catch (error) {
      apiLogger.error('Error retrieving configurations', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });
      throw error;
    }
  })
);

/**
 * GET /api/configuration/:category
 * Retrieve configurations for a specific category
 * 
 * Requirements: 2.1, 2.2, 6.1, 6.2, 6.3
 * 
 * Parameters:
 * - category: Configuration category (Database, Application, Email, Report, Performance, Security, Logging)
 * 
 * Response:
 * - 200: Configuration data for the specified category
 * - 400: Invalid category
 * - 401: Unauthorized
 * - 403: Forbidden
 * - 500: Server error
 */
router.get(
  '/:category',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { category } = req.params;

    apiLogger.info('Category configuration retrieval requested', {
      userId: req.user?.id,
      category
    });

    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      if (req.user.role !== 'admin') {
        throw createError('Insufficient permissions - Administrator role required', 403);
      }

      // Log configuration access
      await auditLogger.logConfigurationAccess(req.user.id, new Date(), req.ip, req.get('User-Agent'));

      // Retrieve configurations for category
      const configurations = ConfigurationService.getConfigurationsByCategory(category as any);

      if (configurations.length === 0) {
        throw createError(`Invalid category: ${category}`, 400);
      }

      apiLogger.info('Category configurations retrieved successfully', {
        userId: req.user.id,
        category,
        configCount: configurations.length
      });

      res.json({
        success: true,
        data: {
          category,
          configurations
        }
      });
    } catch (error) {
      apiLogger.error('Error retrieving category configurations', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        category
      });
      throw error;
    }
  })
);

/**
 * POST /api/configuration/reveal
 * Reveal a sensitive configuration value
 * 
 * Requirements: 3.4, 3.5, 7.2
 * 
 * Request Body:
 * {
 *   "configName": "DB_PASSWORD"
 * }
 * 
 * Response:
 * - 200: Sensitive value revealed
 * - 400: Invalid configuration name or not sensitive
 * - 401: Unauthorized
 * - 403: Forbidden
 * - 500: Server error
 */
router.post(
  '/reveal',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { configName } = req.body as RevealSensitiveRequest;

    apiLogger.info('Sensitive value reveal requested', {
      userId: req.user?.id,
      configName
    });

    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      if (req.user.role !== 'admin') {
        throw createError('Insufficient permissions - Administrator role required', 403);
      }

      if (!configName) {
        throw createError('Configuration name is required', 400);
      }

      // Check if configuration exists and is sensitive
      if (!ConfigurationService.isSensitive(configName)) {
        throw createError('Configuration is not sensitive or does not exist', 400);
      }

      // Get the actual sensitive value
      const value = ConfigurationService.getSensitiveValue(configName);

      if (!value) {
        throw createError('Configuration value not found', 400);
      }

      // Log the reveal action for audit purposes
      await auditLogger.logSensitiveValueReveal(
        req.user.id,
        configName,
        new Date(),
        req.ip,
        req.get('User-Agent')
      );

      apiLogger.info('Sensitive value revealed', {
        userId: req.user.id,
        configName
      });

      const response: RevealSensitiveResponse = {
        success: true,
        value
      };

      res.json(response);
    } catch (error) {
      apiLogger.error('Error revealing sensitive value', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        configName
      });
      throw error;
    }
  })
);

/**
 * POST /api/configuration/update
 * Update one or more configuration values
 * 
 * Requirements: 4.5, 4.8, 4.9, 5.1, 5.2, 9.1, 9.2, 9.3
 * 
 * Request Body:
 * {
 *   "changes": [
 *     {
 *       "name": "DB_HOST",
 *       "oldValue": "localhost",
 *       "newValue": "192.168.1.100"
 *     },
 *     {
 *       "name": "DB_PORT",
 *       "oldValue": "1433",
 *       "newValue": "1434"
 *     }
 *   ]
 * }
 * 
 * Response (200 OK):
 * {
 *   "success": true,
 *   "message": "Configuration updated successfully",
 *   "updatedConfigurations": [
 *     {
 *       "name": "DB_HOST",
 *       "value": "192.168.1.100",
 *       "requiresRestart": true
 *     },
 *     {
 *       "name": "DB_PORT",
 *       "value": "1434",
 *       "requiresRestart": true
 *     }
 *   ]
 * }
 * 
 * Response (400 Bad Request):
 * {
 *   "success": false,
 *   "error": "Validation failed",
 *   "validationErrors": [
 *     {
 *       "name": "DB_PORT",
 *       "error": "Port must be a number between 1 and 65535"
 *     }
 *   ]
 * }
 * 
 * Response (401 Unauthorized):
 * {
 *   "success": false,
 *   "error": "Unauthorized - Administrator role required"
 * }
 * 
 * Response (403 Forbidden):
 * {
 *   "success": false,
 *   "error": "Insufficient permissions"
 * }
 * 
 * Response (500 Server Error):
 * {
 *   "success": false,
 *   "error": "Failed to update configuration"
 * }
 */
router.post(
  '/update',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { changes } = req.body as ConfigurationUpdateRequest;

    apiLogger.info('Configuration update requested', {
      userId: req.user?.id,
      changeCount: changes?.length || 0
    });

    try {
      // Verify authentication
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      // Verify Administrator role
      if (req.user.role !== 'admin') {
        apiLogger.warn('Non-admin user attempted to update configurations', {
          userId: req.user.id,
          userRole: req.user.role
        });
        throw createError('Insufficient permissions - Administrator role required', 403);
      }

      // Validate request body
      if (!changes || !Array.isArray(changes) || changes.length === 0) {
        throw createError('Changes array is required and must not be empty', 400);
      }

      // Validate each change has required fields
      for (const change of changes) {
        if (!change.name || change.oldValue === undefined || change.newValue === undefined) {
          throw createError('Each change must have name, oldValue, and newValue', 400);
        }
      }

      // Perform the update with validation and audit logging
      const result = await updateService.updateConfigurations(
        changes,
        req.user.id,
        req.ip,
        req.get('User-Agent')
      );

      // Return appropriate status code based on result
      if (!result.success) {
        if (result.validationErrors && result.validationErrors.length > 0) {
          res.status(400).json(result);
        } else {
          res.status(500).json(result);
        }
      } else {
        res.status(200).json(result);
      }

      apiLogger.info('Configuration update completed', {
        userId: req.user.id,
        success: result.success,
        changeCount: changes.length
      });
    } catch (error) {
      apiLogger.error('Error updating configurations', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });
      throw error;
    }
  })
);

export default router;
