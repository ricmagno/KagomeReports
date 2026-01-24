/**
 * Property-Based Tests for Version Management
 * Validates universal correctness properties for version handling
 */

import fc from 'fast-check';
import { versionManager } from '@/services/versionManager';

describe('Version Management - Property Tests', () => {
  /**
   * Property 11: Version Format Consistency
   * For any version string returned by the system, it should follow semantic versioning format (MAJOR.MINOR.PATCH)
   * Validates: Requirements 1.1, 1.5
   */
  describe('Property 11: Version Format Consistency', () => {
    it('should always return versions in valid SemVer format', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 10 }), (major) => {
          fc.property(fc.integer({ min: 0, max: 10 }), (minor) => {
            fc.property(fc.integer({ min: 0, max: 10 }), (patch) => {
              const version = `${major}.${minor}.${patch}`;
              const isValid = versionManager.validateVersion(version);
              expect(isValid).toBe(true);
            });
          });
        })
      );
    });

    it('should reject invalid version formats', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !versionManager.validateVersion(s)),
          (invalidVersion) => {
            const isValid = versionManager.validateVersion(invalidVersion);
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid SemVer with prerelease and build metadata', () => {
      const validVersions = [
        '1.0.0-alpha',
        '1.0.0-alpha.1',
        '1.0.0-0.3.7',
        '1.0.0-x.7.z.92',
        '1.0.0+20130313144700',
        '1.0.0-beta+exp.sha.5114f85'
      ];

      validVersions.forEach(version => {
        expect(versionManager.validateVersion(version)).toBe(true);
      });
    });
  });

  /**
   * Property 9: Build Metadata Completeness
   * For any application startup, the build metadata should include all required fields
   * Validates: Requirements 1.2, 1.4
   */
  describe('Property 9: Build Metadata Completeness', () => {
    it('should always return complete build metadata with all required fields', () => {
      const versionInfo = versionManager.getCurrentVersion();

      expect(versionInfo).toHaveProperty('version');
      expect(versionInfo).toHaveProperty('buildDate');
      expect(versionInfo).toHaveProperty('commitHash');
      expect(versionInfo).toHaveProperty('branchName');

      // Validate types
      expect(typeof versionInfo.version).toBe('string');
      expect(typeof versionInfo.buildDate).toBe('string');
      expect(typeof versionInfo.commitHash).toBe('string');
      expect(typeof versionInfo.branchName).toBe('string');

      // Validate non-empty
      expect(versionInfo.version.length).toBeGreaterThan(0);
      expect(versionInfo.buildDate.length).toBeGreaterThan(0);
      expect(versionInfo.commitHash.length).toBeGreaterThan(0);
      expect(versionInfo.branchName.length).toBeGreaterThan(0);
    });

    it('should return valid ISO 8601 build date', () => {
      const versionInfo = versionManager.getCurrentVersion();
      const buildDate = new Date(versionInfo.buildDate);
      expect(buildDate.toString()).not.toBe('Invalid Date');
    });

    it('should return version in valid SemVer format', () => {
      const versionInfo = versionManager.getCurrentVersion();
      expect(versionManager.validateVersion(versionInfo.version)).toBe(true);
    });
  });

  /**
   * Property 1: Version Comparison Transitivity
   * For any three versions v1, v2, v3 following SemVer format, if v1 < v2 and v2 < v3, then v1 < v3
   * Validates: Requirements 1.5, 2.3
   */
  describe('Property 1: Version Comparison Transitivity', () => {
    it('should maintain transitivity: if v1 < v2 and v2 < v3, then v1 < v3', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.integer({ min: 0, max: 5 }),
            fc.integer({ min: 0, max: 5 }),
            fc.integer({ min: 0, max: 5 })
          ),
          ([major1, major2, major3]) => {
            const v1 = `${major1}.0.0`;
            const v2 = `${major2}.0.0`;
            const v3 = `${major3}.0.0`;

            const cmp12 = versionManager.compareVersions(v1, v2);
            const cmp23 = versionManager.compareVersions(v2, v3);
            const cmp13 = versionManager.compareVersions(v1, v3);

            // If v1 < v2 and v2 < v3, then v1 < v3
            if (cmp12 === -1 && cmp23 === -1) {
              expect(cmp13).toBe(-1);
            }

            // If v1 > v2 and v2 > v3, then v1 > v3
            if (cmp12 === 1 && cmp23 === 1) {
              expect(cmp13).toBe(1);
            }

            // If v1 == v2 and v2 == v3, then v1 == v3
            if (cmp12 === 0 && cmp23 === 0) {
              expect(cmp13).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be reflexive: compareVersions(v, v) should always return 0', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.integer({ min: 0, max: 10 }),
            fc.integer({ min: 0, max: 10 }),
            fc.integer({ min: 0, max: 10 })
          ),
          ([major, minor, patch]) => {
            const version = `${major}.${minor}.${patch}`;
            expect(versionManager.compareVersions(version, version)).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should be antisymmetric: if compareVersions(v1, v2) = 1, then compareVersions(v2, v1) = -1', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.integer({ min: 0, max: 10 }),
            fc.integer({ min: 0, max: 10 })
          ),
          ([major1, major2]) => {
            const v1 = `${major1}.0.0`;
            const v2 = `${major2}.0.0`;

            const cmp12 = versionManager.compareVersions(v1, v2);
            const cmp21 = versionManager.compareVersions(v2, v1);

            if (cmp12 === 1) {
              expect(cmp21).toBe(-1);
            } else if (cmp12 === -1) {
              expect(cmp21).toBe(1);
            } else {
              expect(cmp21).toBe(0);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Version comparison correctness tests
   */
  describe('Version Comparison Correctness', () => {
    it('should correctly compare major versions', () => {
      expect(versionManager.compareVersions('1.0.0', '2.0.0')).toBe(-1);
      expect(versionManager.compareVersions('2.0.0', '1.0.0')).toBe(1);
      expect(versionManager.compareVersions('1.0.0', '1.0.0')).toBe(0);
    });

    it('should correctly compare minor versions', () => {
      expect(versionManager.compareVersions('1.0.0', '1.1.0')).toBe(-1);
      expect(versionManager.compareVersions('1.1.0', '1.0.0')).toBe(1);
      expect(versionManager.compareVersions('1.1.0', '1.1.0')).toBe(0);
    });

    it('should correctly compare patch versions', () => {
      expect(versionManager.compareVersions('1.0.0', '1.0.1')).toBe(-1);
      expect(versionManager.compareVersions('1.0.1', '1.0.0')).toBe(1);
      expect(versionManager.compareVersions('1.0.1', '1.0.1')).toBe(0);
    });

    it('should handle prerelease versions correctly', () => {
      // Version without prerelease is greater than with prerelease
      expect(versionManager.compareVersions('1.0.0', '1.0.0-alpha')).toBe(1);
      expect(versionManager.compareVersions('1.0.0-alpha', '1.0.0')).toBe(-1);
      expect(versionManager.compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1);
    });

    it('should handle complex version comparisons', () => {
      expect(versionManager.compareVersions('1.0.0', '1.0.1')).toBe(-1);
      expect(versionManager.compareVersions('1.0.1', '1.1.0')).toBe(-1);
      expect(versionManager.compareVersions('1.1.0', '2.0.0')).toBe(-1);
    });
  });

  /**
   * Version validation edge cases
   */
  describe('Version Validation Edge Cases', () => {
    it('should reject versions with invalid format', () => {
      const invalidVersions = [
        '1',
        '1.0',
        '1.0.0.0',
        'v1.0.0',
        '1.0.0-',
        '1.0.0+',
        '',
        'abc',
        '1.a.0'
      ];

      invalidVersions.forEach(version => {
        expect(versionManager.validateVersion(version)).toBe(false);
      });
    });

    it('should accept versions with numeric prerelease identifiers', () => {
      expect(versionManager.validateVersion('1.0.0-1')).toBe(true);
      expect(versionManager.validateVersion('1.0.0-0.3.7')).toBe(true);
      expect(versionManager.validateVersion('1.0.0-alpha.1')).toBe(true);
    });
  });

  /**
   * Cache behavior tests
   */
  describe('Version Cache Behavior', () => {
    it('should return consistent version info on multiple calls', () => {
      const version1 = versionManager.getCurrentVersion();
      const version2 = versionManager.getCurrentVersion();

      expect(version1.version).toBe(version2.version);
      expect(version1.buildDate).toBe(version2.buildDate);
      expect(version1.commitHash).toBe(version2.commitHash);
      expect(version1.branchName).toBe(version2.branchName);
    });

    it('should clear cache when requested', () => {
      const version1 = versionManager.getCurrentVersion();
      versionManager.clearCache();
      const version2 = versionManager.getCurrentVersion();

      // Version should be the same, but cache should be refreshed
      expect(version1.version).toBe(version2.version);
    });
  });
});
