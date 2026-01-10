/**
 * Encryption and Security Tests
 * Tests data encryption, security middleware, and audit logging
 * Requirements: 9.2, 9.3, 9.4
 */

import { encryptionService } from '../src/services/encryptionService';
import { authService } from '../src/services/authService';
import fs from 'fs';
import path from 'path';

describe('Encryption and Security', () => {
  beforeAll(async () => {
    // Allow time for services to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Clean up
    authService.shutdown();
  });

  describe('Data Encryption', () => {
    test('should encrypt and decrypt data correctly', () => {
      const plaintext = 'This is sensitive data that needs encryption';
      
      const encrypted = encryptionService.encrypt(plaintext);
      
      expect(encrypted.data).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.tag).toBeDefined();
      expect(encrypted.algorithm).toBeDefined();
      expect(encrypted.data).not.toBe(plaintext);
      
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    test('should generate different encrypted data for same input', () => {
      const plaintext = 'Same input data';
      
      const encrypted1 = encryptionService.encrypt(plaintext);
      const encrypted2 = encryptionService.encrypt(plaintext);
      
      // Should be different due to random IV
      expect(encrypted1.data).not.toBe(encrypted2.data);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      
      // But both should decrypt to same plaintext
      expect(encryptionService.decrypt(encrypted1)).toBe(plaintext);
      expect(encryptionService.decrypt(encrypted2)).toBe(plaintext);
    });

    test('should fail decryption with tampered data', () => {
      const plaintext = 'Original data';
      const encrypted = encryptionService.encrypt(plaintext);
      
      // Tamper with encrypted data
      const tamperedData = {
        ...encrypted,
        data: encrypted.data.slice(0, -2) + 'XX' // Change last 2 characters
      };
      
      expect(() => {
        encryptionService.decrypt(tamperedData);
      }).toThrow();
    });

    test('should fail decryption with tampered tag', () => {
      const plaintext = 'Original data';
      const encrypted = encryptionService.encrypt(plaintext);
      
      // Tamper with tag
      const tamperedTag = {
        ...encrypted,
        tag: encrypted.tag.slice(0, -2) + 'XX' // Change last 2 characters
      };
      
      expect(() => {
        encryptionService.decrypt(tamperedTag);
      }).toThrow();
    });
  });

  describe('Password Hashing', () => {
    test('should hash passwords securely', () => {
      const password = 'mySecurePassword123!';
      
      const result1 = encryptionService.hash(password);
      const result2 = encryptionService.hash(password);
      
      expect(result1.hash).toBeDefined();
      expect(result1.salt).toBeDefined();
      expect(result2.hash).toBeDefined();
      expect(result2.salt).toBeDefined();
      
      // Different salts should produce different hashes
      expect(result1.hash).not.toBe(result2.hash);
      expect(result1.salt).not.toBe(result2.salt);
    });

    test('should verify password hashes correctly', () => {
      const password = 'testPassword456';
      const { hash, salt } = encryptionService.hash(password);
      
      expect(encryptionService.verifyHash(password, hash, salt)).toBe(true);
      expect(encryptionService.verifyHash('wrongPassword', hash, salt)).toBe(false);
    });

    test('should use consistent salt for same password when provided', () => {
      const password = 'consistentPassword';
      const salt = 'fixedSalt123';
      
      const result1 = encryptionService.hash(password, salt);
      const result2 = encryptionService.hash(password, salt);
      
      expect(result1.hash).toBe(result2.hash);
      expect(result1.salt).toBe(salt);
      expect(result2.salt).toBe(salt);
    });
  });

  describe('Secure Token Generation', () => {
    test('should generate secure random tokens', () => {
      const token1 = encryptionService.generateSecureToken();
      const token2 = encryptionService.generateSecureToken();
      
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes = 64 hex characters
      expect(token2.length).toBe(64);
    });

    test('should generate tokens of specified length', () => {
      const token16 = encryptionService.generateSecureToken(16);
      const token64 = encryptionService.generateSecureToken(64);
      
      expect(token16.length).toBe(32); // 16 bytes = 32 hex characters
      expect(token64.length).toBe(128); // 64 bytes = 128 hex characters
    });

    test('should generate secure passwords', () => {
      const password1 = encryptionService.generateSecurePassword();
      const password2 = encryptionService.generateSecurePassword();
      
      expect(password1).toBeDefined();
      expect(password2).toBeDefined();
      expect(password1).not.toBe(password2);
      expect(password1.length).toBe(16); // Default length
      expect(password2.length).toBe(16);
      
      // Should contain mix of characters
      expect(/[A-Z]/.test(password1)).toBe(true); // Uppercase
      expect(/[a-z]/.test(password1)).toBe(true); // Lowercase
      expect(/[0-9]/.test(password1)).toBe(true); // Numbers
    });
  });

  describe('Data Sanitization', () => {
    test('should sanitize sensitive data for logging', () => {
      const sensitiveData = {
        username: 'testuser',
        password: 'secretPassword',
        token: 'jwt-token-here',
        apiKey: 'secret-api-key',
        connectionString: 'server=localhost;database=test;user=admin;password=secret',
        normalField: 'this is fine'
      };
      
      const sanitized = encryptionService.sanitizeForLogging(sensitiveData);
      
      expect(sanitized.username).toBe('testuser');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.connectionString).toBe('[REDACTED]');
      expect(sanitized.normalField).toBe('this is fine');
    });

    test('should handle nested objects in sanitization', () => {
      const nestedData = {
        user: {
          name: 'John Doe',
          credentials: {
            password: 'secret123',
            token: 'bearer-token'
          }
        },
        config: {
          dbPassword: 'dbSecret',
          apiUrl: 'https://api.example.com'
        }
      };
      
      const sanitized = encryptionService.sanitizeForLogging(nestedData);
      
      expect(sanitized.user.name).toBe('John Doe');
      expect(sanitized.user.credentials.password).toBe('[REDACTED]');
      expect(sanitized.user.credentials.token).toBe('[REDACTED]');
      expect(sanitized.config.dbPassword).toBe('[REDACTED]');
      expect(sanitized.config.apiUrl).toBe('https://api.example.com');
    });
  });

  describe('File Encryption', () => {
    const testFilePath = path.join(process.cwd(), 'test-file.txt');
    const encryptedFilePath = testFilePath + '.encrypted';
    const decryptedFilePath = testFilePath + '.decrypted';

    beforeEach(() => {
      // Clean up any existing test files
      [testFilePath, encryptedFilePath, decryptedFilePath].forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });
    });

    afterEach(() => {
      // Clean up test files
      [testFilePath, encryptedFilePath, decryptedFilePath].forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });
    });

    test('should encrypt and decrypt files', () => {
      const originalContent = 'This is sensitive file content\nWith multiple lines\nAnd special characters: !@#$%^&*()';
      
      // Create test file
      fs.writeFileSync(testFilePath, originalContent);
      
      // Encrypt file
      encryptionService.encryptFile(testFilePath, encryptedFilePath);
      expect(fs.existsSync(encryptedFilePath)).toBe(true);
      
      // Verify encrypted content is different
      const encryptedContent = fs.readFileSync(encryptedFilePath, 'utf8');
      expect(encryptedContent).not.toBe(originalContent);
      
      // Decrypt file
      encryptionService.decryptFile(encryptedFilePath, decryptedFilePath);
      expect(fs.existsSync(decryptedFilePath)).toBe(true);
      
      // Verify decrypted content matches original
      const decryptedContent = fs.readFileSync(decryptedFilePath, 'utf8');
      expect(decryptedContent).toBe(originalContent);
    });
  });

  describe('Data Integrity', () => {
    test('should generate and validate integrity hashes', () => {
      const data = 'Important data that needs integrity checking';
      
      const hash = encryptionService.generateIntegrityHash(data);
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64); // SHA-256 produces 64 character hex string
      
      expect(encryptionService.validateIntegrity(data, hash)).toBe(true);
      expect(encryptionService.validateIntegrity('tampered data', hash)).toBe(false);
    });

    test('should detect data tampering', () => {
      const originalData = 'Original important data';
      const hash = encryptionService.generateIntegrityHash(originalData);
      
      const tamperedData = 'Tampered important data';
      expect(encryptionService.validateIntegrity(tamperedData, hash)).toBe(false);
    });
  });

  describe('Secure Backup and Restore', () => {
    const backupPath = path.join(process.cwd(), 'test-backup.enc');

    afterEach(() => {
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
    });

    test('should create and restore secure backups', () => {
      const originalData = {
        users: ['user1', 'user2'],
        config: { setting1: 'value1', setting2: 'value2' },
        sensitive: 'secret information'
      };
      
      // Create secure backup
      encryptionService.createSecureBackup(originalData, backupPath);
      expect(fs.existsSync(backupPath)).toBe(true);
      
      // Verify backup is encrypted (not readable as JSON)
      const backupContent = fs.readFileSync(backupPath, 'utf8');
      expect(() => JSON.parse(backupContent)).not.toThrow(); // Should be valid JSON (encrypted data structure)
      
      // Restore backup
      const restoredData = encryptionService.restoreSecureBackup(backupPath);
      expect(restoredData).toEqual(originalData);
    });
  });

  describe('Audit Logging with Encryption', () => {
    test('should encrypt sensitive audit log data', async () => {
      const sensitiveDetails = 'User performed sensitive action with secret data';
      const userAgent = 'Mozilla/5.0 (Test Browser)';
      
      // Log audit event (this should encrypt sensitive data)
      await authService.logAuditEvent(
        'test-user-id',
        'sensitive_action',
        'test_resource',
        sensitiveDetails,
        '192.168.1.100',
        userAgent
      );
      
      // Retrieve audit logs (this should decrypt the data)
      const logs = await authService.getAuditLogs(1);
      expect(logs.length).toBeGreaterThan(0);
      
      const latestLog = logs[0];
      expect(latestLog.details).toBe(sensitiveDetails);
      expect(latestLog.userAgent).toBe(userAgent);
      expect(latestLog.action).toBe('sensitive_action');
    });
  });

  describe('Connection String Security', () => {
    test('should encrypt and decrypt connection strings', () => {
      const connectionString = 'Server=localhost;Database=TestDB;User=admin;Password=secret123;';
      
      const encrypted = encryptionService.encryptConnectionString(connectionString);
      expect(encrypted.data).toBeDefined();
      expect(encrypted.data).not.toBe(connectionString);
      
      const decrypted = encryptionService.decryptConnectionString(encrypted);
      expect(decrypted).toBe(connectionString);
    });

    test('should provide secure connection configuration', () => {
      const config = encryptionService.getSecureConnectionConfig();
      
      expect(config.encrypt).toBe(true);
      expect(config.trustServerCertificate).toBe(false);
      expect(config.enableArithAbort).toBe(true);
      expect(config.connectionTimeout).toBe(30000);
      expect(config.requestTimeout).toBe(30000);
    });
  });
});