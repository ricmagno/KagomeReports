/**
 * Encryption Service
 * Handles data encryption at rest and secure data handling
 * Requirements: 9.2, 9.3, 9.4
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { apiLogger } from '@/utils/logger';
import { env } from '@/config/environment';

export interface EncryptedData {
  data: string;
  iv: string;
  tag: string;
  algorithm: string;
}

export interface SecureConnectionConfig {
  encrypt: boolean;
  trustServerCertificate: boolean;
  enableArithAbort: boolean;
  connectionTimeout: number;
  requestTimeout: number;
}

export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly tagLength = 16; // 128 bits
  private encryptionKey!: Buffer; // Definite assignment assertion

  constructor() {
    this.initializeEncryptionKey();
  }

  /**
   * Initialize or load encryption key
   */
  private initializeEncryptionKey(): void {
    const keyPath = path.join(process.cwd(), 'data', 'encryption.key');
    
    try {
      // Try to load existing key
      if (fs.existsSync(keyPath)) {
        const keyData = fs.readFileSync(keyPath, 'utf8');
        this.encryptionKey = Buffer.from(keyData, 'hex');
        apiLogger.info('Encryption key loaded from file');
      } else {
        // Generate new key
        this.encryptionKey = crypto.randomBytes(this.keyLength);
        
        // Ensure data directory exists
        const dataDir = path.dirname(keyPath);
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // Save key to file with restricted permissions
        fs.writeFileSync(keyPath, this.encryptionKey.toString('hex'), { mode: 0o600 });
        apiLogger.info('New encryption key generated and saved');
      }
    } catch (error) {
      apiLogger.error('Failed to initialize encryption key', { error });
      throw new Error('Encryption service initialization failed');
    }
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(plaintext: string): EncryptedData {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // For CBC mode, we'll use HMAC for integrity
      const hmac = crypto.createHmac('sha256', this.encryptionKey);
      hmac.update(iv.toString('hex') + encrypted);
      const tag = hmac.digest('hex');
      
      return {
        data: encrypted,
        iv: iv.toString('hex'),
        tag: tag,
        algorithm: 'aes-256-cbc'
      };
    } catch (error) {
      apiLogger.error('Encryption failed', { error });
      throw new Error('Data encryption failed');
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: EncryptedData): string {
    try {
      const iv = Buffer.from(encryptedData.iv, 'hex');
      
      // Verify integrity using HMAC
      const hmac = crypto.createHmac('sha256', this.encryptionKey);
      hmac.update(encryptedData.iv + encryptedData.data);
      const expectedTag = hmac.digest('hex');
      
      if (!crypto.timingSafeEqual(Buffer.from(encryptedData.tag, 'hex'), Buffer.from(expectedTag, 'hex'))) {
        throw new Error('Data integrity check failed');
      }
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
      
      let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      apiLogger.error('Decryption failed', { error });
      throw new Error('Data decryption failed');
    }
  }

  /**
   * Hash sensitive data (one-way)
   */
  hash(data: string, salt?: string): { hash: string; salt: string } {
    try {
      const actualSalt = salt || crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(data, actualSalt, 100000, 64, 'sha512').toString('hex');
      
      return {
        hash,
        salt: actualSalt
      };
    } catch (error) {
      apiLogger.error('Hashing failed', { error });
      throw new Error('Data hashing failed');
    }
  }

  /**
   * Verify hashed data
   */
  verifyHash(data: string, hash: string, salt: string): boolean {
    try {
      const computedHash = crypto.pbkdf2Sync(data, salt, 100000, 64, 'sha512').toString('hex');
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'));
    } catch (error) {
      apiLogger.error('Hash verification failed', { error });
      return false;
    }
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate secure random password
   */
  generateSecurePassword(length: number = 16): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      password += charset[randomIndex];
    }
    
    return password;
  }

  /**
   * Encrypt database connection string
   */
  encryptConnectionString(connectionString: string): EncryptedData {
    return this.encrypt(connectionString);
  }

  /**
   * Decrypt database connection string
   */
  decryptConnectionString(encryptedData: EncryptedData): string {
    return this.decrypt(encryptedData);
  }

  /**
   * Get secure database connection configuration
   */
  getSecureConnectionConfig(): SecureConnectionConfig {
    return {
      encrypt: true,
      trustServerCertificate: false, // Set to true only for development
      enableArithAbort: true,
      connectionTimeout: 30000,
      requestTimeout: 30000
    };
  }

  /**
   * Sanitize sensitive data for logging
   */
  sanitizeForLogging(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'auth', 
      'connectionstring', 'jwt', 'session', 'cookie', 'apikey'
    ];

    const sanitized = { ...data };

    for (const key in sanitized) {
      const lowerKey = key.toLowerCase();
      
      // Check if the key itself is sensitive (exact match or contains sensitive terms)
      const isSensitiveKey = sensitiveFields.some(field => {
        return lowerKey === field || 
               lowerKey.includes(field) && 
               (lowerKey.endsWith(field) || lowerKey.startsWith(field) || lowerKey.includes(field + '_') || lowerKey.includes('_' + field));
      });
      
      if (isSensitiveKey) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeForLogging(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * Encrypt file contents
   */
  encryptFile(filePath: string, outputPath?: string): void {
    try {
      const plaintext = fs.readFileSync(filePath, 'utf8');
      const encrypted = this.encrypt(plaintext);
      
      const output = outputPath || `${filePath}.encrypted`;
      fs.writeFileSync(output, JSON.stringify(encrypted), { mode: 0o600 });
      
      apiLogger.info('File encrypted successfully', { 
        inputFile: path.basename(filePath),
        outputFile: path.basename(output)
      });
    } catch (error) {
      apiLogger.error('File encryption failed', { error, filePath });
      throw new Error('File encryption failed');
    }
  }

  /**
   * Decrypt file contents
   */
  decryptFile(encryptedFilePath: string, outputPath?: string): void {
    try {
      const encryptedData = JSON.parse(fs.readFileSync(encryptedFilePath, 'utf8'));
      const decrypted = this.decrypt(encryptedData);
      
      const output = outputPath || encryptedFilePath.replace('.encrypted', '');
      fs.writeFileSync(output, decrypted, { mode: 0o600 });
      
      apiLogger.info('File decrypted successfully', {
        inputFile: path.basename(encryptedFilePath),
        outputFile: path.basename(output)
      });
    } catch (error) {
      apiLogger.error('File decryption failed', { error, encryptedFilePath });
      throw new Error('File decryption failed');
    }
  }

  /**
   * Securely delete file (overwrite with random data)
   */
  secureDelete(filePath: string): void {
    try {
      if (!fs.existsSync(filePath)) {
        return;
      }

      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      
      // Overwrite with random data multiple times
      const passes = 3;
      for (let i = 0; i < passes; i++) {
        const randomData = crypto.randomBytes(fileSize);
        fs.writeFileSync(filePath, randomData);
        fs.fsyncSync(fs.openSync(filePath, 'r+'));
      }
      
      // Finally delete the file
      fs.unlinkSync(filePath);
      
      apiLogger.info('File securely deleted', { filePath: path.basename(filePath) });
    } catch (error) {
      apiLogger.error('Secure file deletion failed', { error, filePath });
      throw new Error('Secure file deletion failed');
    }
  }

  /**
   * Create secure backup of sensitive data
   */
  createSecureBackup(data: any, backupPath: string): void {
    try {
      const serializedData = JSON.stringify(data);
      const encrypted = this.encrypt(serializedData);
      
      // Ensure backup directory exists
      const backupDir = path.dirname(backupPath);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      fs.writeFileSync(backupPath, JSON.stringify(encrypted), { mode: 0o600 });
      
      apiLogger.info('Secure backup created', { backupPath: path.basename(backupPath) });
    } catch (error) {
      apiLogger.error('Secure backup creation failed', { error, backupPath });
      throw new Error('Secure backup creation failed');
    }
  }

  /**
   * Restore from secure backup
   */
  restoreSecureBackup(backupPath: string): any {
    try {
      const encryptedData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      const decrypted = this.decrypt(encryptedData);
      const data = JSON.parse(decrypted);
      
      apiLogger.info('Secure backup restored', { backupPath: path.basename(backupPath) });
      return data;
    } catch (error) {
      apiLogger.error('Secure backup restoration failed', { error, backupPath });
      throw new Error('Secure backup restoration failed');
    }
  }

  /**
   * Validate data integrity
   */
  validateIntegrity(data: string, expectedHash: string): boolean {
    try {
      const actualHash = crypto.createHash('sha256').update(data).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(actualHash, 'hex'));
    } catch (error) {
      apiLogger.error('Integrity validation failed', { error });
      return false;
    }
  }

  /**
   * Generate data integrity hash
   */
  generateIntegrityHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();