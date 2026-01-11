/**
 * Type definitions for database configuration management
 */

export interface DatabaseConfiguration {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  encryptedPassword: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
  connectionTimeout: number;
  requestTimeout: number;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  lastTested?: Date;
  status: 'connected' | 'disconnected' | 'error' | 'untested';
}

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

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  responseTime?: number;
  serverVersion?: string;
  error?: string;
  testedAt: Date;
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

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface EncryptedConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  encryptedPassword: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
  connectionTimeout: number;
  requestTimeout: number;
}