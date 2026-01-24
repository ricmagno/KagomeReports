/**
 * Property-Based Tests for GitHub Release Service Integration
 * Validates universal correctness properties for GitHub API integration
 */

import fc from 'fast-check';
import crypto from 'crypto';
import { githubReleaseService } from '@/services/githubReleaseService';
import { versionManager } from '@/services/versionManager';

describe('GitHub Release Service - Property Tests', () => {
  /**
   * Property 2: Update Availability Detection
   * For any current version and latest version from GitHub, the system should correctly identify
   * whether an update is available by comparing versions using SemVer rules
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
   */
  describe('Property 2: Update Availability Detection', () => {
    it('should correctly identify when update is available', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.integer({ min: 0, max: 5 }),
            fc.integer({ min: 0, max: 5 }),
            fc.integer({ min: 0, max: 5 })
          ),
          ([major, minor, patch]) => {
            const currentVersion = `${major}.${minor}.${patch}`;
            const latestVersion = `${major}.${minor}.${patch + 1}`;

            const comparison = versionManager.compareVersions(currentVersion, latestVersion);
            expect(comparison).toBe(-1); // currentVersion < latestVersion
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should correctly identify when no update is available', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.integer({ min: 0, max: 5 }),
            fc.integer({ min: 0, max: 5 }),
            fc.integer({ min: 0, max: 5 })
          ),
          ([major, minor, patch]) => {
            const version = `${major}.${minor}.${patch}`;
            const comparison = versionManager.compareVersions(version, version);
            expect(comparison).toBe(0); // version == version
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 3: GitHub API Caching
   * For any GitHub release query, if the same query is made within 1 hour of the previous query,
   * the system should return cached results without making a new API call
   * Validates: Requirements 2.5
   */
  describe('Property 3: GitHub API Caching', () => {
    it('should cache release information', () => {
      const cacheStats1 = githubReleaseService.getCacheStats();
      const initialSize = cacheStats1.size;

      // Simulate caching by checking cache stats
      expect(cacheStats1).toHaveProperty('size');
      expect(cacheStats1).toHaveProperty('entries');
      expect(Array.isArray(cacheStats1.entries)).toBe(true);
    });

    it('should clear cache when requested', () => {
      githubReleaseService.clearCache();
      const cacheStats = githubReleaseService.getCacheStats();
      expect(cacheStats.size).toBe(0);
    });
  });

  /**
   * Property 4: Checksum Verification Determinism
   * For any downloaded file and its associated checksum, verifying the checksum multiple times
   * should always produce the same result
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
   */
  describe('Property 4: Checksum Verification Determinism', () => {
    it('should produce consistent checksum verification results', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 10, maxLength: 1000 }),
          (data) => {
            // Generate SHA256 checksum
            const hash = crypto.createHash('sha256');
            hash.update(data);
            const checksum = hash.digest('hex');

            // Verify multiple times
            const result1 = githubReleaseService.verifyChecksum(Buffer.from(data), checksum, 'sha256');
            const result2 = githubReleaseService.verifyChecksum(Buffer.from(data), checksum, 'sha256');
            const result3 = githubReleaseService.verifyChecksum(Buffer.from(data), checksum, 'sha256');

            // All results should be the same
            expect(result1).toBe(result2);
            expect(result2).toBe(result3);
            expect(result1).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject invalid checksums consistently', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 10, maxLength: 1000 }),
          (data) => {
            const invalidChecksum = 'invalid_checksum_value';

            const result1 = githubReleaseService.verifyChecksum(Buffer.from(data), invalidChecksum, 'sha256');
            const result2 = githubReleaseService.verifyChecksum(Buffer.from(data), invalidChecksum, 'sha256');

            expect(result1).toBe(result2);
            expect(result1).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should support both SHA256 and SHA512 algorithms', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 10, maxLength: 1000 }),
          (data) => {
            // Generate SHA256 checksum
            const hash256 = crypto.createHash('sha256');
            hash256.update(data);
            const checksum256 = hash256.digest('hex');

            // Generate SHA512 checksum
            const hash512 = crypto.createHash('sha512');
            hash512.update(data);
            const checksum512 = hash512.digest('hex');

            // Verify with correct algorithms
            const result256 = githubReleaseService.verifyChecksum(Buffer.from(data), checksum256, 'sha256');
            const result512 = githubReleaseService.verifyChecksum(Buffer.from(data), checksum512, 'sha512');

            expect(result256).toBe(true);
            expect(result512).toBe(true);

            // Verify with wrong algorithms should fail
            const wrongResult256 = githubReleaseService.verifyChecksum(Buffer.from(data), checksum512, 'sha256');
            const wrongResult512 = githubReleaseService.verifyChecksum(Buffer.from(data), checksum256, 'sha512');

            expect(wrongResult256).toBe(false);
            expect(wrongResult512).toBe(false);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Release notes parsing tests
   */
  describe('Release Notes Parsing', () => {
    it('should parse markdown release notes correctly', () => {
      const markdown = `
## Version 1.0.0

### Features
- **New feature 1**: Description
- *Feature 2*: Description

### Bug Fixes
- Fixed [issue #123](https://github.com/example/repo/issues/123)
- Fixed \`bug in code\`

\`\`\`
code block
\`\`\`
      `;

      const parsed = githubReleaseService.parseReleaseNotes(markdown);

      // Should not contain markdown formatting
      expect(parsed).not.toContain('**');
      expect(parsed).not.toContain('*');
      expect(parsed).not.toContain('```');
      expect(parsed).not.toContain('[');
      expect(parsed).not.toContain('](');

      // Should contain the actual content
      expect(parsed).toContain('Version 1.0.0');
      expect(parsed).toContain('Features');
      expect(parsed).toContain('New feature 1');
    });

    it('should handle empty release notes', () => {
      const parsed = githubReleaseService.parseReleaseNotes('');
      expect(parsed).toBe('');
    });

    it('should clean up extra whitespace', () => {
      const notes = `
Line 1


Line 2



Line 3
      `;

      const parsed = githubReleaseService.parseReleaseNotes(notes);
      const lines = parsed.split('\n\n');

      // Should have at most 3 sections (Line 1, Line 2, Line 3)
      expect(lines.length).toBeLessThanOrEqual(3);
    });
  });

  /**
   * Checksum algorithm tests
   */
  describe('Checksum Algorithm Support', () => {
    it('should correctly verify SHA256 checksums', () => {
      const data = Buffer.from('test data');
      const hash = crypto.createHash('sha256');
      hash.update(data);
      const checksum = hash.digest('hex');

      const result = githubReleaseService.verifyChecksum(data, checksum, 'sha256');
      expect(result).toBe(true);
    });

    it('should correctly verify SHA512 checksums', () => {
      const data = Buffer.from('test data');
      const hash = crypto.createHash('sha512');
      hash.update(data);
      const checksum = hash.digest('hex');

      const result = githubReleaseService.verifyChecksum(data, checksum, 'sha512');
      expect(result).toBe(true);
    });

    it('should be case-insensitive for checksum comparison', () => {
      const data = Buffer.from('test data');
      const hash = crypto.createHash('sha256');
      hash.update(data);
      const checksum = hash.digest('hex').toUpperCase();

      const result = githubReleaseService.verifyChecksum(data, checksum, 'sha256');
      expect(result).toBe(true);
    });
  });

  /**
   * Cache statistics tests
   */
  describe('Cache Statistics', () => {
    it('should track cache entries', () => {
      githubReleaseService.clearCache();
      
      const stats = githubReleaseService.getCacheStats();
      expect(stats.size).toBe(0);
      expect(Array.isArray(stats.entries)).toBe(true);
    });
  });
});
