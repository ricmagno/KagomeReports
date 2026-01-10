/**
 * Simple Property-Based Tests for Security and Encryption
 * Minimal test to verify FastCheck is working
 */

import fc from 'fast-check';
import { encryptionService } from '../../src/services/encryptionService';

describe('Simple Security Properties', () => {
  /**
   * Property: Encryption round-trip consistency
   */
  test('Property: Simple encryption round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 10 }),
        async (plaintext) => {
          const encrypted = encryptionService.encrypt(plaintext);
          const decrypted = encryptionService.decrypt(encrypted);
          
          // Round-trip should preserve original data
          expect(decrypted).toBe(plaintext);
        }
      ),
      { numRuns: 3 }
    );
  });
});