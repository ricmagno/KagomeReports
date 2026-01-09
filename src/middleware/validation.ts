/**
 * Request Validation Middleware
 * Provides common validation utilities for API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { createError } from './errorHandler';

/**
 * Validate request body against a Zod schema
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        
        throw createError('Request body validation failed', 400);
      }
      
      req.body = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Validate request query parameters against a Zod schema
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.query);
      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        
        throw createError('Query parameters validation failed', 400);
      }
      
      req.query = result.data as any;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Validate request parameters against a Zod schema
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.params);
      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        
        throw createError('URL parameters validation failed', 400);
      }
      
      req.params = result.data as any;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  tagName: z.string().min(1).max(100).regex(/^[a-zA-Z0-9][a-zA-Z0-9_\-\.]*$/, 'Invalid tag name format'),
  
  dateTime: z.string().datetime().transform(str => new Date(str)),
  
  positiveInteger: z.number().int().positive(),
  
  pagination: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(1000).default(100),
    cursor: z.string().optional()
  }),
  
  timeRange: z.object({
    startTime: z.string().datetime().transform(str => new Date(str)),
    endTime: z.string().datetime().transform(str => new Date(str)),
    relativeRange: z.enum(['last1h', 'last24h', 'last7d', 'last30d']).optional()
  }).refine(data => data.startTime < data.endTime, {
    message: 'Start time must be before end time'
  })
};

/**
 * Rate limiting validation
 */
export function validateRateLimit(maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) {
  const requests = new Map<string, { count: number; resetTime: number }>();
  
  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean up old entries
    for (const [key, value] of requests.entries()) {
      if (value.resetTime < windowStart) {
        requests.delete(key);
      }
    }
    
    // Check current client
    const clientData = requests.get(clientId);
    if (!clientData) {
      requests.set(clientId, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }
    
    if (clientData.count >= maxRequests) {
      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs / 1000} seconds.`,
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
      });
      return;
    }
    
    clientData.count++;
    next();
  };
}