/**
 * Frontend types for database configuration management
 */

export interface DatabaseConfig {
  id?: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
  connectionTimeout: number;
  requestTimeout: number;
}

export interface DatabaseConfigSummary {
  id: string;
  name: string;
  host: string;
  database: string;
  isActive: boolean;
  lastTested?: Date;
  status: 'connected' | 'disconnected' | 'error' | 'untested';
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  responseTime?: number;
  serverVersion?: string;
  error?: string;
  testedAt: Date;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface DatabaseConfigFormData extends Omit<DatabaseConfig, 'id'> {
  // Additional form-specific fields
  confirmPassword?: string;
  testConnection?: boolean;
}

export interface DatabaseConfigFormErrors {
  [key: string]: string | undefined;
  name?: string;
  host?: string;
  port?: string;
  database?: string;
  username?: string;
  password?: string;
  confirmPassword?: string;
  connectionTimeout?: string;
  requestTimeout?: string;
}