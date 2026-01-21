/**
 * Unit Tests for Specification Limits Validation
 * Tests validation logic for SPC specification limits
 */

import {
  validateSpecificationLimits,
  validateSpecificationLimitsMap,
  validateSpecificationLimitsOrThrow,
  validateSpecificationLimitsMapOrThrow,
  hasCompleteSpecificationLimits,
  canCalculateCapabilityIndices
} from '@/utils/specificationLimitsValidator';
import { SpecificationLimits } from '@/types/historian';

describe('Specification Limits Validation', () => {
  describe('validateSpecificationLimits', () => {
    it('should validate valid specification limits with both LSL and USL', () => {
      const limits: SpecificationLimits = {
        lsl: 10,
        usl: 90
      };

      const result = validateSpecificationLimits(limits);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject when USL equals LSL', () => {
      const limits: SpecificationLimits = {
        lsl: 50,
        usl: 50
      };

      const result = validateSpecificationLimits(limits);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Upper Specification Limit (USL) must be greater than Lower Specification Limit (LSL)');
    });

    it('should reject when USL is less than LSL', () => {
      const limits: SpecificationLimits = {
        lsl: 90,
        usl: 10
      };

      const result = validateSpecificationLimits(limits);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Upper Specification Limit (USL) must be greater than Lower Specification Limit (LSL)');
      expect(result.errors[0]).toContain('USL=10');
      expect(result.errors[0]).toContain('LSL=90');
    });

    it('should accept specification limits with only LSL', () => {
      const limits: SpecificationLimits = {
        lsl: 10
      };

      const result = validateSpecificationLimits(limits);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept specification limits with only USL', () => {
      const limits: SpecificationLimits = {
        usl: 90
      };

      const result = validateSpecificationLimits(limits);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept empty specification limits', () => {
      const limits: SpecificationLimits = {};

      const result = validateSpecificationLimits(limits);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject infinite USL', () => {
      const limits: SpecificationLimits = {
        lsl: 10,
        usl: Infinity
      };

      const result = validateSpecificationLimits(limits);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Upper Specification Limit (USL) must be a finite number'))).toBe(true);
    });

    it('should reject infinite LSL', () => {
      const limits: SpecificationLimits = {
        lsl: -Infinity,
        usl: 90
      };

      const result = validateSpecificationLimits(limits);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Lower Specification Limit (LSL) must be a finite number'))).toBe(true);
    });

    it('should reject NaN values', () => {
      const limits: SpecificationLimits = {
        lsl: NaN,
        usl: 90
      };

      const result = validateSpecificationLimits(limits);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should include tag name in error messages when provided', () => {
      const limits: SpecificationLimits = {
        lsl: 90,
        usl: 10
      };

      const result = validateSpecificationLimits(limits, 'TEMP_SENSOR_01');

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Tag "TEMP_SENSOR_01"');
    });

    it('should validate negative specification limits', () => {
      const limits: SpecificationLimits = {
        lsl: -100,
        usl: -10
      };

      const result = validateSpecificationLimits(limits);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate zero as a valid limit', () => {
      const limits: SpecificationLimits = {
        lsl: 0,
        usl: 100
      };

      const result = validateSpecificationLimits(limits);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate very small differences between LSL and USL', () => {
      const limits: SpecificationLimits = {
        lsl: 10.0,
        usl: 10.001
      };

      const result = validateSpecificationLimits(limits);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateSpecificationLimitsMap', () => {
    it('should validate a map with all valid limits', () => {
      const limitsMap: Record<string, SpecificationLimits> = {
        TAG001: { lsl: 10, usl: 90 },
        TAG002: { lsl: 20, usl: 80 },
        TAG003: { lsl: 0, usl: 100 }
      };

      const result = validateSpecificationLimitsMap(limitsMap);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject a map with one invalid limit', () => {
      const limitsMap: Record<string, SpecificationLimits> = {
        TAG001: { lsl: 10, usl: 90 },
        TAG002: { lsl: 80, usl: 20 }, // Invalid
        TAG003: { lsl: 0, usl: 100 }
      };

      const result = validateSpecificationLimitsMap(limitsMap);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('TAG002');
    });

    it('should collect all errors from multiple invalid limits', () => {
      const limitsMap: Record<string, SpecificationLimits> = {
        TAG001: { lsl: 90, usl: 10 }, // Invalid
        TAG002: { lsl: 80, usl: 20 }, // Invalid
        TAG003: { lsl: 0, usl: 100 }  // Valid
      };

      const result = validateSpecificationLimitsMap(limitsMap);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('TAG001');
      expect(result.errors[1]).toContain('TAG002');
    });

    it('should validate an empty map', () => {
      const limitsMap: Record<string, SpecificationLimits> = {};

      const result = validateSpecificationLimitsMap(limitsMap);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a map with partial limits', () => {
      const limitsMap: Record<string, SpecificationLimits> = {
        TAG001: { lsl: 10 },
        TAG002: { usl: 90 },
        TAG003: {}
      };

      const result = validateSpecificationLimitsMap(limitsMap);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateSpecificationLimitsOrThrow', () => {
    it('should not throw for valid limits', () => {
      const limits: SpecificationLimits = {
        lsl: 10,
        usl: 90
      };

      expect(() => validateSpecificationLimitsOrThrow(limits)).not.toThrow();
    });

    it('should throw for invalid limits', () => {
      const limits: SpecificationLimits = {
        lsl: 90,
        usl: 10
      };

      expect(() => validateSpecificationLimitsOrThrow(limits)).toThrow('Invalid specification limits');
    });

    it('should include tag name in error when provided', () => {
      const limits: SpecificationLimits = {
        lsl: 90,
        usl: 10
      };

      expect(() => validateSpecificationLimitsOrThrow(limits, 'TEMP_SENSOR')).toThrow('TEMP_SENSOR');
    });
  });

  describe('validateSpecificationLimitsMapOrThrow', () => {
    it('should not throw for valid map', () => {
      const limitsMap: Record<string, SpecificationLimits> = {
        TAG001: { lsl: 10, usl: 90 },
        TAG002: { lsl: 20, usl: 80 }
      };

      expect(() => validateSpecificationLimitsMapOrThrow(limitsMap)).not.toThrow();
    });

    it('should throw for invalid map', () => {
      const limitsMap: Record<string, SpecificationLimits> = {
        TAG001: { lsl: 10, usl: 90 },
        TAG002: { lsl: 80, usl: 20 }
      };

      expect(() => validateSpecificationLimitsMapOrThrow(limitsMap)).toThrow('Invalid specification limits configuration');
    });
  });

  describe('hasCompleteSpecificationLimits', () => {
    it('should return true when both LSL and USL are defined', () => {
      const limits: SpecificationLimits = {
        lsl: 10,
        usl: 90
      };

      expect(hasCompleteSpecificationLimits(limits)).toBe(true);
    });

    it('should return false when only LSL is defined', () => {
      const limits: SpecificationLimits = {
        lsl: 10
      };

      expect(hasCompleteSpecificationLimits(limits)).toBe(false);
    });

    it('should return false when only USL is defined', () => {
      const limits: SpecificationLimits = {
        usl: 90
      };

      expect(hasCompleteSpecificationLimits(limits)).toBe(false);
    });

    it('should return false for empty limits', () => {
      const limits: SpecificationLimits = {};

      expect(hasCompleteSpecificationLimits(limits)).toBe(false);
    });
  });

  describe('canCalculateCapabilityIndices', () => {
    it('should return true for valid complete limits', () => {
      const limits: SpecificationLimits = {
        lsl: 10,
        usl: 90
      };

      expect(canCalculateCapabilityIndices(limits)).toBe(true);
    });

    it('should return false for incomplete limits', () => {
      const limits: SpecificationLimits = {
        lsl: 10
      };

      expect(canCalculateCapabilityIndices(limits)).toBe(false);
    });

    it('should return false for invalid limits', () => {
      const limits: SpecificationLimits = {
        lsl: 90,
        usl: 10
      };

      expect(canCalculateCapabilityIndices(limits)).toBe(false);
    });

    it('should return false for empty limits', () => {
      const limits: SpecificationLimits = {};

      expect(canCalculateCapabilityIndices(limits)).toBe(false);
    });

    it('should return false for limits with infinite values', () => {
      const limits: SpecificationLimits = {
        lsl: 10,
        usl: Infinity
      };

      expect(canCalculateCapabilityIndices(limits)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large numbers', () => {
      const limits: SpecificationLimits = {
        lsl: 1e10,
        usl: 1e11
      };

      const result = validateSpecificationLimits(limits);

      expect(result.isValid).toBe(true);
    });

    it('should handle very small numbers', () => {
      const limits: SpecificationLimits = {
        lsl: 1e-10,
        usl: 1e-9
      };

      const result = validateSpecificationLimits(limits);

      expect(result.isValid).toBe(true);
    });

    it('should handle negative zero', () => {
      const limits: SpecificationLimits = {
        lsl: -0,
        usl: 100
      };

      const result = validateSpecificationLimits(limits);

      expect(result.isValid).toBe(true);
    });
  });
});
