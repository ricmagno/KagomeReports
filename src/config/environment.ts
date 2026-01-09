import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Environment validation schema
const envSchema = z.object({
  // Database Configuration
  DB_HOST: z.string().min(1, 'Database host is required'),
  DB_PORT: z.coerce.number().int().min(1).max(65535),
  DB_NAME: z.string().min(1, 'Database name is required'),
  DB_USER: z.string().min(1, 'Database user is required'),
  DB_PASSWORD: z.string().min(1, 'Database password is required'),
  DB_ENCRYPT: z.coerce.boolean().default(true),
  DB_TRUST_SERVER_CERTIFICATE: z.coerce.boolean().default(false),

  // Application Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  // Email Configuration
  SMTP_HOST: z.string().min(1, 'SMTP host is required'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().email('Valid SMTP user email is required'),
  SMTP_PASSWORD: z.string().min(1, 'SMTP password is required'),

  // Report Configuration
  REPORTS_DIR: z.string().default('./reports'),
  TEMP_DIR: z.string().default('./temp'),
  MAX_REPORT_SIZE_MB: z.coerce.number().int().min(1).max(500).default(50),
  CHART_WIDTH: z.coerce.number().int().min(400).max(2000).default(800),
  CHART_HEIGHT: z.coerce.number().int().min(300).max(1500).default(400),

  // Performance Configuration
  DB_POOL_MIN: z.coerce.number().int().min(1).max(50).default(2),
  DB_POOL_MAX: z.coerce.number().int().min(2).max(100).default(10),
  DB_TIMEOUT_MS: z.coerce.number().int().min(5000).max(300000).default(30000),
  CACHE_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(300),
  MAX_CONCURRENT_REPORTS: z.coerce.number().int().min(1).max(20).default(5),

  // Security Configuration
  CORS_ORIGIN: z.string().url('Valid CORS origin URL is required'),
  SESSION_TIMEOUT_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(60000).max(3600000).default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(10).max(1000).default(100),

  // Logging Configuration
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE: z.string().default('./logs/app.log'),
  LOG_MAX_SIZE: z.string().default('10m'),
  LOG_MAX_FILES: z.coerce.number().int().min(1).max(20).default(5),
});

// Validate and export environment configuration
export const env = envSchema.parse(process.env);

// Type for environment configuration
export type Environment = z.infer<typeof envSchema>;

// Helper function to check if running in production
export const isProduction = () => env.NODE_ENV === 'production';

// Helper function to check if running in development
export const isDevelopment = () => env.NODE_ENV === 'development';

// Helper function to check if running in test
export const isTest = () => env.NODE_ENV === 'test';