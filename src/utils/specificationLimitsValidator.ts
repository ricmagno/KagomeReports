/**
 * Specification Limits Validation Utilities
 * Validates specification limits for SPC analysis
 */

import { SpecificationLimits } from '@/types/historian';
import { createError } from '@/middleware/errorHandler';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates a single specification limit configuration
 * 
 * @param limits - The specification limits to validate
 * @param tagName - Optional tag name for error messages
 * @returns Validation result with any error messages
 */
export function validateSpecificationLimits(
  limits: SpecificationLimits,
  tagName?: string
): ValidationResult {
  const errors: string[] = [];
  const prefix = tagName ? `Tag "${tagName}": ` : '';

  // First validate that limits are finite numbers if provided
  if (limits.lsl !== undefined && !isFinite(limits.lsl)) {
    errors.push(`${prefix}Lower Specification Limit (LSL) must be a finite number`);
  }

  if (limits.usl !== undefined && !isFinite(limits.usl)) {
    errors.push(`${prefix}Upper Specification Limit (USL) must be a finite number`);
  }

  // Only check USL > LSL if both are provided and both are finite
  if (limits.lsl !== undefined && limits.usl !== undefined) {
    if (isFinite(limits.lsl) && isFinite(limits.usl)) {
      // Validate that USL > LSL
      if (limits.usl <= limits.lsl) {
        errors.push(
          `${prefix}Upper Specification Limit (USL) must be greater than Lower Specification Limit (LSL). ` +
          `Current values: USL=${limits.usl}, LSL=${limits.lsl}`
        );
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates multiple specification limits (e.g., for a report configuration)
 * 
 * @param specLimitsMap - Map of tag names to specification limits
 * @returns Validation result with any error messages
 */
export function validateSpecificationLimitsMap(
  specLimitsMap: Record<string, SpecificationLimits>
): ValidationResult {
  const allErrors: string[] = [];

  for (const [tagName, limits] of Object.entries(specLimitsMap)) {
    const result = validateSpecificationLimits(limits, tagName);
    if (!result.isValid) {
      allErrors.push(...result.errors);
    }
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors
  };
}

/**
 * Validates specification limits and throws an error if invalid
 * Used in service methods where validation errors should halt execution
 * 
 * @param limits - The specification limits to validate
 * @param tagName - Optional tag name for error messages
 * @throws Error if validation fails
 */
export function validateSpecificationLimitsOrThrow(
  limits: SpecificationLimits,
  tagName?: string
): void {
  const result = validateSpecificationLimits(limits, tagName);
  
  if (!result.isValid) {
    throw createError(
      `Invalid specification limits: ${result.errors.join('; ')}`,
      400
    );
  }
}

/**
 * Validates a map of specification limits and throws an error if any are invalid
 * 
 * @param specLimitsMap - Map of tag names to specification limits
 * @throws Error if validation fails
 */
export function validateSpecificationLimitsMapOrThrow(
  specLimitsMap: Record<string, SpecificationLimits>
): void {
  const result = validateSpecificationLimitsMap(specLimitsMap);
  
  if (!result.isValid) {
    throw createError(
      `Invalid specification limits configuration: ${result.errors.join('; ')}`,
      400
    );
  }
}

/**
 * Checks if specification limits are complete (both LSL and USL provided)
 * 
 * @param limits - The specification limits to check
 * @returns True if both LSL and USL are defined
 */
export function hasCompleteSpecificationLimits(
  limits: SpecificationLimits
): boolean {
  return limits.lsl !== undefined && limits.usl !== undefined;
}

/**
 * Checks if specification limits are valid for Cp/Cpk calculation
 * 
 * @param limits - The specification limits to check
 * @returns True if limits are complete and valid
 */
export function canCalculateCapabilityIndices(
  limits: SpecificationLimits
): boolean {
  if (!hasCompleteSpecificationLimits(limits)) {
    return false;
  }

  const result = validateSpecificationLimits(limits);
  return result.isValid;
}
