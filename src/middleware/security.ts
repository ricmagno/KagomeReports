/**
 * Security Middleware
 * Handles security headers, rate limiting, and data protection
 * Requirements: 9.2, 9.3, 9.4
 */

import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { apiLogger } from '@/utils/logger';
import { encryptionService } from '@/services/encryptionService';
import { createError } from './errorHandler';

/**
 * Security headers middleware using Helmet
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for report generation
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  }
});

/**
 * Rate limiting middleware
 */
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    apiLogger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method
    });
    
    res.status(429).json({
      success: false,
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    });
  }
});

/**
 * Strict rate limiting for authentication endpoints
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req: Request, res: Response) => {
    apiLogger.warn('Authentication rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    
    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: '15 minutes'
    });
  }
});

/**
 * Input sanitization middleware
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    apiLogger.error('Input sanitization failed', { error });
    next(createError('Invalid input data', 400));
  }
};

/**
 * Sanitize object recursively
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Sanitize string input
 */
function sanitizeString(str: string): string {
  if (typeof str !== 'string') {
    return str;
  }

  // Remove potentially dangerous characters
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim();
}

/**
 * Request logging middleware with sensitive data protection
 */
export const secureRequestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Log request with sanitized data
  const logData = {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length'),
    // Don't log sensitive headers or body data
    headers: sanitizeHeaders(req.headers)
  };

  apiLogger.info('Incoming request', logData);

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(body: any) {
    const duration = Date.now() - startTime;
    
    apiLogger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      responseSize: JSON.stringify(body).length
    });

    return originalJson.call(this, body);
  };

  next();
};

/**
 * Sanitize headers for logging
 */
function sanitizeHeaders(headers: any): any {
  const sensitiveHeaders = [
    'authorization', 'cookie', 'set-cookie', 'x-api-key',
    'x-auth-token', 'x-access-token', 'x-refresh-token'
  ];

  const sanitized: any = {};
  
  for (const key in headers) {
    if (sensitiveHeaders.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = headers[key];
    }
  }

  return sanitized;
}

/**
 * Data integrity validation middleware
 */
export const validateDataIntegrity = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Check for data integrity header
    const integrityHeader = req.get('X-Data-Integrity');
    
    if (integrityHeader && req.body) {
      const bodyString = JSON.stringify(req.body);
      const isValid = encryptionService.validateIntegrity(bodyString, integrityHeader);
      
      if (!isValid) {
        apiLogger.warn('Data integrity validation failed', {
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        throw createError('Data integrity validation failed', 400);
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Secure response headers middleware
 */
export const secureResponseHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Add custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  next();
};

/**
 * IP whitelist middleware (for admin endpoints)
 */
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = req.ip || req.connection.remoteAddress || '';
    
    // Allow localhost in development
    const isLocalhost = clientIP === '127.0.0.1' || clientIP === '::1' || clientIP.includes('127.0.0.1');
    
    if (process.env.NODE_ENV === 'development' && isLocalhost) {
      next();
      return;
    }

    if (!allowedIPs.includes(clientIP)) {
      apiLogger.warn('IP access denied', {
        ip: clientIP,
        path: req.path,
        method: req.method
      });
      
      res.status(403).json({
        success: false,
        error: 'Access denied from this IP address'
      });
      return;
    }

    next();
  };
};

/**
 * Request size limiter middleware
 */
export const requestSizeLimiter = (maxSize: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.get('Content-Length') || '0');
    const maxBytes = parseSize(maxSize);
    
    if (contentLength > maxBytes) {
      apiLogger.warn('Request size limit exceeded', {
        contentLength,
        maxSize,
        path: req.path,
        ip: req.ip
      });
      
      res.status(413).json({
        success: false,
        error: 'Request entity too large'
      });
      return;
    }

    next();
  };
};

/**
 * Parse size string to bytes
 */
function parseSize(sizeStr: string): number {
  const units: Record<string, number> = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024,
  };
  
  const match = sizeStr.toLowerCase().match(/^(\d+)(b|kb|mb|gb)?$/);
  if (!match) {
    return 10 * 1024 * 1024; // Default 10MB
  }
  
  const [, sizeValue, unit] = match;
  if (!sizeValue) {
    return 10 * 1024 * 1024; // Default 10MB
  }
  
  const parsedSize = parseInt(sizeValue);
  const multiplier = unit ? units[unit] : 1;
  
  return parsedSize * (multiplier || 1);
}