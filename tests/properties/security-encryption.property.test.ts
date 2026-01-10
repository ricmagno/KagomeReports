/**
 * Property-Based Tests for Security and Encryption
 * Tests encryption algorithms, security middleware, and data protection
 * Requirements: 9.3, 8.5
 * 
 * **Property 14: Security and Encryption**
 * **Validates: Requirements 9.3, 8.5**
 */

import fc from 'fast-check';
import { encryptionService } from '../../src/services/encryptionService';
// import { authService } from '../../src/services/authService';

describe('Security and Encryption Properties', () => {
  beforeAll(async () => {
    // Allow time for services to initialize
    await new Promise(resolve => setTimeout(resolve, 500));
  }, 10000); // 10 second timeout

  afterAll(async () => {
    // Clean up
    // authService.shutdown();
  }, 5000); // 5 second timeout

  /**
   * Property: Encryption should be deterministic for decryption but non-deterministic for encryption
   */
  test('Property: Encryption round-trip consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 1000 }),
        async (plaintext) => {
          const encrypted = encryptionService.encrypt(plaintext);
          const decrypted = encryptionService.decrypt(encrypted);
          
          // Round-trip should preserve original data
          expect(decrypted).toBe(plaintext);
          
          // Encrypted data should be different from plaintext
          expect(encrypted.data).not.toBe(plaintext);
          
          // Should have all required encryption components
          expect(encrypted.iv).toBeDefined();
          expect(encrypted.tag).toBeDefined();
          expect(encrypted.algorithm).toBeDefined();
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: Same plaintext should produce different encrypted data (due to random IV)
   */
  test('Property: Encryption non-determinism', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (plaintext) => {
          const encrypted1 = encryptionService.encrypt(plaintext);
          const encrypted2 = encryptionService.encrypt(plaintext);
          
          // Different IVs should produce different encrypted data
          expect(encrypted1.iv).not.toBe(encrypted2.iv);
          expect(encrypted1.data).not.toBe(encrypted2.data);
          expect(encrypted1.tag).not.toBe(encrypted2.tag);
          
          // But both should decrypt to same plaintext
          expect(encryptionService.decrypt(encrypted1)).toBe(plaintext);
          expect(encryptionService.decrypt(encrypted2)).toBe(plaintext);
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: Data tampering should always be detected
   */
  test('Property: Tamper detection reliability', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          plaintext: fc.string({ minLength: 1, maxLength: 100 }),
          tamperType: fc.constantFrom('data', 'iv', 'tag')
        }),
        async ({ plaintext, tamperType }) => {
          const encrypted = encryptionService.encrypt(plaintext);
          
          // Create tampered version
          const tampered = { ...encrypted };
          
          switch (tamperType) {
            case 'data':
              // Flip last bit of encrypted data
              const dataBytes = Buffer.from(tampered.data, 'hex');
              if (dataBytes.length > 0) {
                const lastIndex = dataBytes.length - 1;
                const lastByte = dataBytes[lastIndex];
                if (lastByte !== undefined) {
                  dataBytes[lastIndex] = lastByte ^ 1;
                  tampered.data = dataBytes.toString('hex');
                }
              }
              break;
            case 'iv':
              // Flip last bit of IV
              const ivBytes = Buffer.from(tampered.iv, 'hex');
              if (ivBytes.length > 0) {
                const lastIndex = ivBytes.length - 1;
                const lastByte = ivBytes[lastIndex];
                if (lastByte !== undefined) {
                  ivBytes[lastIndex] = lastByte ^ 1;
                  tampered.iv = ivBytes.toString('hex');
                }
              }
              break;
            case 'tag':
              // Flip last bit of tag
              const tagBytes = Buffer.from(tampered.tag, 'hex');
              if (tagBytes.length > 0) {
                const lastIndex = tagBytes.length - 1;
                const lastByte = tagBytes[lastIndex];
                if (lastByte !== undefined) {
                  tagBytes[lastIndex] = lastByte ^ 1;
                  tampered.tag = tagBytes.toString('hex');
                }
              }
              break;
          }
          
          // Tampered data should fail decryption
          expect(() => {
            encryptionService.decrypt(tampered);
          }).toThrow();
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: Password hashing should be consistent with same salt
   */
  test('Property: Password hashing consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          password: fc.string({ minLength: 1, maxLength: 100 }),
          salt: fc.string({ minLength: 16, maxLength: 32 }).filter(s => /^[0-9a-f]*$/i.test(s))
        }),
        async ({ password, salt }) => {
          const hash1 = encryptionService.hash(password, salt);
          const hash2 = encryptionService.hash(password, salt);
          
          // Same password and salt should produce same hash
          expect(hash1.hash).toBe(hash2.hash);
          expect(hash1.salt).toBe(salt);
          expect(hash2.salt).toBe(salt);
          
          // Hash verification should work
          expect(encryptionService.verifyHash(password, hash1.hash, salt)).toBe(true);
          expect(encryptionService.verifyHash(password, hash2.hash, salt)).toBe(true);
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: Different passwords should produce different hashes
   */
  test('Property: Password hash uniqueness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          password1: fc.string({ minLength: 1, maxLength: 100 }),
          password2: fc.string({ minLength: 1, maxLength: 100 })
        }).filter(({ password1, password2 }) => password1 !== password2),
        async ({ password1, password2 }) => {
          const hash1 = encryptionService.hash(password1);
          const hash2 = encryptionService.hash(password2);
          
          // Different passwords should produce different hashes
          expect(hash1.hash).not.toBe(hash2.hash);
          
          // Cross-verification should fail
          expect(encryptionService.verifyHash(password1, hash2.hash, hash2.salt)).toBe(false);
          expect(encryptionService.verifyHash(password2, hash1.hash, hash1.salt)).toBe(false);
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: Secure token generation should produce unique tokens
   */
  test('Property: Token uniqueness and entropy', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 8, max: 64 }),
        async (tokenLength) => {
          const tokens = new Set<string>();
          const numTokens = 20;
          
          // Generate multiple tokens
          for (let i = 0; i < numTokens; i++) {
            const token = encryptionService.generateSecureToken(tokenLength);
            
            // Token should have correct length (hex encoding doubles byte length)
            expect(token.length).toBe(tokenLength * 2);
            
            // Token should be unique
            expect(tokens.has(token)).toBe(false);
            tokens.add(token);
            
            // Token should only contain hex characters
            expect(/^[0-9a-f]+$/i.test(token)).toBe(true);
          }
          
          // All tokens should be unique
          expect(tokens.size).toBe(numTokens);
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: Data sanitization should consistently redact sensitive fields
   */
  test('Property: Data sanitization consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sensitiveKey: fc.constantFrom('password', 'token', 'secret', 'apiKey', 'connectionString'),
          sensitiveValue: fc.string({ minLength: 1, maxLength: 100 }),
          normalKey: fc.constantFrom('name', 'email', 'url', 'description', 'title'),
          normalValue: fc.string({ minLength: 1, maxLength: 100 })
        }),
        async ({ sensitiveKey, sensitiveValue, normalKey, normalValue }) => {
          const data = {
            [sensitiveKey]: sensitiveValue,
            [normalKey]: normalValue
          };
          
          const sanitized = encryptionService.sanitizeForLogging(data);
          
          // Sensitive field should be redacted
          expect(sanitized[sensitiveKey]).toBe('[REDACTED]');
          
          // Normal field should remain unchanged
          expect(sanitized[normalKey]).toBe(normalValue);
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: File encryption should preserve data integrity
   */
  test('Property: File encryption integrity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 1000 }),
        async (fileContent) => {
          const fs = require('fs');
          const path = require('path');
          
          const testFile = path.join(process.cwd(), `test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.txt`);
          const encryptedFile = testFile + '.encrypted';
          const decryptedFile = testFile + '.decrypted';
          
          try {
            // Write original content
            fs.writeFileSync(testFile, fileContent);
            
            // Encrypt file
            encryptionService.encryptFile(testFile, encryptedFile);
            
            // Verify encrypted file exists and is different
            expect(fs.existsSync(encryptedFile)).toBe(true);
            const encryptedContent = fs.readFileSync(encryptedFile, 'utf8');
            expect(encryptedContent).not.toBe(fileContent);
            
            // Decrypt file
            encryptionService.decryptFile(encryptedFile, decryptedFile);
            
            // Verify decrypted content matches original
            expect(fs.existsSync(decryptedFile)).toBe(true);
            const decryptedContent = fs.readFileSync(decryptedFile, 'utf8');
            expect(decryptedContent).toBe(fileContent);
            
          } finally {
            // Clean up test files
            [testFile, encryptedFile, decryptedFile].forEach(file => {
              if (fs.existsSync(file)) {
                fs.unlinkSync(file);
              }
            });
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: Data integrity validation should be reliable
   */
  test('Property: Data integrity validation reliability', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 1000 }),
        async (data) => {
          const hash = encryptionService.generateIntegrityHash(data);
          
          // Original data should validate successfully
          expect(encryptionService.validateIntegrity(data, hash)).toBe(true);
          
          // Modified data should fail validation (if different)
          const modifiedData = data + 'X';
          if (modifiedData !== data) {
            expect(encryptionService.validateIntegrity(modifiedData, hash)).toBe(false);
          }
          
          // Hash should be consistent for same data
          const hash2 = encryptionService.generateIntegrityHash(data);
          expect(hash).toBe(hash2);
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: Secure backup and restore should preserve data
   */
  test('Property: Secure backup integrity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          data: fc.anything(),
          backupId: fc.integer({ min: 1, max: 1000000 })
        }),
        async ({ data, backupId }) => {
          const fs = require('fs');
          const path = require('path');
          
          const backupFile = path.join(process.cwd(), `backup-${backupId}-${Date.now()}.enc`);
          
          try {
            // Create secure backup
            encryptionService.createSecureBackup(data, backupFile);
            
            // Verify backup file exists
            expect(fs.existsSync(backupFile)).toBe(true);
            
            // Verify backup content is encrypted (not readable as original data)
            const backupContent = fs.readFileSync(backupFile, 'utf8');
            expect(backupContent).not.toBe(JSON.stringify(data));
            
            // Restore backup
            const restoredData = encryptionService.restoreSecureBackup(backupFile);
            
            // Verify restored data matches original
            expect(restoredData).toEqual(data);
            
          } finally {
            // Clean up backup file
            if (fs.existsSync(backupFile)) {
              fs.unlinkSync(backupFile);
            }
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: Connection string encryption should be secure
   */
  test('Property: Connection string security', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          server: fc.domain(),
          database: fc.string({ minLength: 1, maxLength: 50 }),
          username: fc.string({ minLength: 1, maxLength: 50 }),
          password: fc.string({ minLength: 1, maxLength: 50 })
        }),
        async ({ server, database, username, password }) => {
          const connectionString = `Server=${server};Database=${database};User=${username};Password=${password};`;
          
          const encrypted = encryptionService.encryptConnectionString(connectionString);
          
          // Encrypted data should not contain original connection string
          expect(encrypted.data).not.toContain(server);
          expect(encrypted.data).not.toContain(database);
          expect(encrypted.data).not.toContain(username);
          expect(encrypted.data).not.toContain(password);
          
          // Should decrypt back to original
          const decrypted = encryptionService.decryptConnectionString(encrypted);
          expect(decrypted).toBe(connectionString);
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property: Secure password generation should meet complexity requirements
   */
  test('Property: Secure password complexity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 8, max: 64 }),
        async (passwordLength) => {
          const passwords = new Set<string>();
          const numPasswords = 10;
          
          for (let i = 0; i < numPasswords; i++) {
            const password = encryptionService.generateSecurePassword(passwordLength);
            
            // Password should have correct length
            expect(password.length).toBe(passwordLength);
            
            // Password should be unique
            expect(passwords.has(password)).toBe(false);
            passwords.add(password);
            
            // Password should contain mix of character types
            expect(/[A-Z]/.test(password)).toBe(true); // Uppercase
            expect(/[a-z]/.test(password)).toBe(true); // Lowercase
            expect(/[0-9]/.test(password)).toBe(true); // Numbers
            
            // Password should not contain spaces
            expect(password).not.toContain(' ');
          }
          
          // All passwords should be unique
          expect(passwords.size).toBe(numPasswords);
        }
      ),
      { numRuns: 5 }
    );
  });
});