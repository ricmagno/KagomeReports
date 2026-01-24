/**
 * Update Security Middleware
 * Provides security and error handling for update operations
 * Requirements: 4.2, 4.6, 2.4
 */

import { Request, Response, NextFunction } from 'express';
import { dbLogger } from '@/utils/logger';
import { z } from 'zod';

const securityLogger = dbLogger.child({ middleware: 'UpdateSecurity' });

/**
 * Rate limiting configuration
 */
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

/**
 * Rate limiter store
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Default rate limit configuration
 */
const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10 // 10 requests per minute
};

/**
 * Validate update request body
 */
export const validateUpdateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        securityLogger.warn('Invalid update request', {
          errors: error.errors,
          ip: req.ip
        });
        res.status(400).json({
          success: false,
          error: 'Invalid request',
          details: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        });
        return;
      }
      next(error);
    }
  };
};

/**
 * Rate limiting middleware for update endpoints
 */
export const updateRateLimit = (config: Partial<RateLimitConfig> = {}) => {
  const finalConfig = { ...DEFAULT_RATE_LIMIT, ...config };

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();

    // Get or create rate limit entry
    let entry = rateLimitStore.get(clientId);

    if (!entry || now > entry.resetTime) {
      // Create new entry
      entry = {
        count: 1,
        resetTime: now + finalConfig.windowMs
      };
      rateLimitStore.set(clientId, entry);
      next();
      return;
    }

    // Check if limit exceeded
    if (entry.count >= finalConfig.maxRequests) {
      securityLogger.warn('Rate limit exceeded', {
        clientId,
        count: entry.count,
        limit: finalConfig.maxRequests
      });

      res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: Math.ceil((entry.resetTime - now) / 1000)
      });
      return;
    }

    // Increment count
    entry.count++;
    next();
  };
};

/**
 * HTTPS enforcement middleware
 */
export const enforceHttps = (req: Request, res: Response, next: NextFunction): void => {
  // Skip in development
  if (process.env.NODE_ENV === 'development') {
    next();
    return;
  }

  // Check if request is HTTPS or has X-Forwarded-Proto header
  const isHttps = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https';

  if (!isHttps) {
    securityLogger.warn('Non-HTTPS request to update endpoint', {
      ip: req.ip,
      path: req.path
    });

    res.status(403).json({
      success: false,
      error: 'HTTPS required for update operations'
    });
    return;
  }

  next();
};

/**
 * Validate version string format
 */
export const validateVersionFormat = (req: Request, res: Response, next: NextFunction): void => {
  const { version } = req.body;

  if (!version) {
    res.status(400).json({
      success: false,
      error: 'Version is required'
    });
    return;
  }

  // SemVer regex
  const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

  if (!semverRegex.test(version)) {
    securityLogger.warn('Invalid version format', {
      version,
      ip: req.ip
    });

    res.status(400).json({
      success: false,
      error: 'Invalid version format. Must follow SemVer (e.g., 1.0.0)'
    });
    return;
  }

  next();
};

/**
 * Validate backup path for security
 */
export const validateBackupPath = (req: Request, res: Response, next: NextFunction): void => {
  const { backupPath } = req.body;

  if (!backupPath) {
    res.status(400).json({
      success: false,
      error: 'Backup path is required'
    });
    return;
  }

  // Prevent path traversal attacks
  if (backupPath.includes('..') || backupPath.startsWith('/')) {
    securityLogger.warn('Suspicious backup path', {
      backupPath,
      ip: req.ip
    });

    res.status(400).json({
      success: false,
      error: 'Invalid backup path'
    });
    return;
  }

  next();
};

/**
 * Error handling middleware for update operations
 */
export const updateErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  securityLogger.error('Update operation error', {
    error: error.message,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  // Don't expose internal error details to client
  const statusCode = (error as any).statusCode || 500;
  const message = process.env.NODE_ENV === 'development' 
    ? error.message 
    : 'An error occurred during the update operation';

  res.status(statusCode).json({
    success: false,
    error: message
  });
};

/**
 * Clean up rate limit store periodically
 */
export const cleanupRateLimitStore = () => {
  setInterval(() => {
    const now = Date.now();
    for (const [clientId, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(clientId);
      }
    }
  }, 60 * 1000); // Clean up every minute
};

// Start cleanup on module load
cleanupRateLimitStore();
