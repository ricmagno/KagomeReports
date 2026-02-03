import winston from 'winston';
import { env } from '@/config/environment';
import path from 'path';
import fs from 'fs';

// Import encryption service for data sanitization
// Note: This creates a circular dependency, so we'll handle it differently
let encryptionService: any = null;
try {
  // Lazy load to avoid circular dependency
  encryptionService = require('@/services/encryptionService').encryptionService;
} catch {
  // Encryption service not available during initialization
}

// Ensure logs directory exists
const logsDir = path.dirname(env.LOG_FILE);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }

    if (stack) {
      log += `\n${stack}`;
    }

    return log;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: logFormat,
  defaultMeta: { service: 'historian-reports' },
  transports: [
    // File transport
    new winston.transports.File({
      filename: env.LOG_FILE,
      maxsize: parseSize(env.LOG_MAX_SIZE),
      maxFiles: env.LOG_MAX_FILES,
      tailable: true,
    }),

    // Error file transport
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: parseSize(env.LOG_MAX_SIZE),
      maxFiles: env.LOG_MAX_FILES,
      tailable: true,
    }),
  ],
});

// Add console transport
logger.add(new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  )
}));

/**
 * Parse size string (e.g., "10m", "1g") to bytes
 */
function parseSize(sizeStr: string): number {
  const units: Record<string, number> = {
    'b': 1,
    'k': 1024,
    'm': 1024 * 1024,
    'g': 1024 * 1024 * 1024,
  };

  const match = sizeStr.toLowerCase().match(/^(\d+)([bkmg]?)$/);
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

/**
 * Sanitize sensitive data for logging
 */
function sanitizeLogData(data: any): any {
  if (encryptionService && typeof encryptionService.sanitizeForLogging === 'function') {
    return encryptionService.sanitizeForLogging(data);
  }

  // Fallback sanitization if encryption service is not available
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sensitiveFields = [
    'password', 'token', 'secret', 'key', 'auth', 'credential',
    'connectionString', 'jwt', 'session', 'cookie'
  ];

  const sanitized = { ...data };

  for (const key in sanitized) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeLogData(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: Record<string, any>) {
  const sanitizedContext = sanitizeLogData(context);
  return logger.child(sanitizedContext);
}

/**
 * Log database operations
 */
export const dbLogger = createChildLogger({ component: 'database' });

/**
 * Log API operations
 */
export const apiLogger = createChildLogger({ component: 'api' });

/**
 * Log report generation operations
 */
export const reportLogger = createChildLogger({ component: 'reports' });

/**
 * Log email operations
 */
export const emailLogger = createChildLogger({ component: 'email' });

/**
 * Log scheduler operations
 */
export const schedulerLogger = createChildLogger({ component: 'scheduler' });