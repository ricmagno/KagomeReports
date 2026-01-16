/**
 * Validation Utilities
 * Helper functions for validating form inputs and data
 */

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates an email address format
 * @param email - The email address to validate
 * @returns Validation result with error message if invalid
 */
export const validateEmail = (email: string): ValidationResult => {
  if (!email || typeof email !== 'string') {
    return {
      isValid: false,
      error: 'Email address is required',
    };
  }

  const trimmedEmail = email.trim();

  if (trimmedEmail.length === 0) {
    return {
      isValid: false,
      error: 'Email address is required',
    };
  }

  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmedEmail)) {
    return {
      isValid: false,
      error: 'Invalid email address format',
    };
  }

  // Additional checks
  if (trimmedEmail.length > 254) {
    return {
      isValid: false,
      error: 'Email address is too long (max 254 characters)',
    };
  }

  const [localPart, domain] = trimmedEmail.split('@');

  if (localPart.length > 64) {
    return {
      isValid: false,
      error: 'Email local part is too long (max 64 characters)',
    };
  }

  if (domain.length > 253) {
    return {
      isValid: false,
      error: 'Email domain is too long (max 253 characters)',
    };
  }

  // Check for consecutive dots
  if (trimmedEmail.includes('..')) {
    return {
      isValid: false,
      error: 'Email address cannot contain consecutive dots',
    };
  }

  // Check for leading/trailing dots in local part
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return {
      isValid: false,
      error: 'Email local part cannot start or end with a dot',
    };
  }

  return {
    isValid: true,
  };
};

/**
 * Validates multiple email addresses
 * @param emails - Array of email addresses to validate
 * @returns Validation result with error message if any email is invalid
 */
export const validateEmails = (emails: string[]): ValidationResult => {
  if (!Array.isArray(emails)) {
    return {
      isValid: false,
      error: 'Email list must be an array',
    };
  }

  if (emails.length === 0) {
    return {
      isValid: false,
      error: 'At least one email address is required',
    };
  }

  for (let i = 0; i < emails.length; i++) {
    const result = validateEmail(emails[i]);
    if (!result.isValid) {
      return {
        isValid: false,
        error: `Email ${i + 1}: ${result.error}`,
      };
    }
  }

  // Check for duplicates
  const uniqueEmails = new Set(emails.map(e => e.trim().toLowerCase()));
  if (uniqueEmails.size !== emails.length) {
    return {
      isValid: false,
      error: 'Duplicate email addresses are not allowed',
    };
  }

  return {
    isValid: true,
  };
};

/**
 * Validates a schedule name
 * @param name - The schedule name to validate
 * @returns Validation result with error message if invalid
 */
export const validateScheduleName = (name: string): ValidationResult => {
  if (!name || typeof name !== 'string') {
    return {
      isValid: false,
      error: 'Schedule name is required',
    };
  }

  const trimmedName = name.trim();

  if (trimmedName.length === 0) {
    return {
      isValid: false,
      error: 'Schedule name is required',
    };
  }

  if (trimmedName.length < 1) {
    return {
      isValid: false,
      error: 'Schedule name must be at least 1 character',
    };
  }

  if (trimmedName.length > 100) {
    return {
      isValid: false,
      error: 'Schedule name must be 100 characters or less',
    };
  }

  // Check for invalid characters (optional - adjust based on requirements)
  const invalidCharsRegex = /[<>:"/\\|?*\x00-\x1F]/;
  if (invalidCharsRegex.test(trimmedName)) {
    return {
      isValid: false,
      error: 'Schedule name contains invalid characters',
    };
  }

  return {
    isValid: true,
  };
};

/**
 * Validates a schedule description
 * @param description - The schedule description to validate
 * @returns Validation result with error message if invalid
 */
export const validateScheduleDescription = (description?: string): ValidationResult => {
  // Description is optional
  if (!description) {
    return {
      isValid: true,
    };
  }

  if (typeof description !== 'string') {
    return {
      isValid: false,
      error: 'Description must be a string',
    };
  }

  const trimmedDescription = description.trim();

  if (trimmedDescription.length > 500) {
    return {
      isValid: false,
      error: 'Description must be 500 characters or less',
    };
  }

  return {
    isValid: true,
  };
};

/**
 * Validates a required field
 * @param value - The value to validate
 * @param fieldName - The name of the field for error messages
 * @returns Validation result with error message if invalid
 */
export const validateRequired = (value: any, fieldName: string = 'Field'): ValidationResult => {
  if (value === null || value === undefined) {
    return {
      isValid: false,
      error: `${fieldName} is required`,
    };
  }

  if (typeof value === 'string' && value.trim().length === 0) {
    return {
      isValid: false,
      error: `${fieldName} is required`,
    };
  }

  if (Array.isArray(value) && value.length === 0) {
    return {
      isValid: false,
      error: `${fieldName} must have at least one item`,
    };
  }

  return {
    isValid: true,
  };
};

/**
 * Validates a string length
 * @param value - The string to validate
 * @param min - Minimum length (inclusive)
 * @param max - Maximum length (inclusive)
 * @param fieldName - The name of the field for error messages
 * @returns Validation result with error message if invalid
 */
export const validateLength = (
  value: string,
  min: number,
  max: number,
  fieldName: string = 'Field'
): ValidationResult => {
  if (typeof value !== 'string') {
    return {
      isValid: false,
      error: `${fieldName} must be a string`,
    };
  }

  const length = value.trim().length;

  if (length < min) {
    return {
      isValid: false,
      error: `${fieldName} must be at least ${min} character${min === 1 ? '' : 's'}`,
    };
  }

  if (length > max) {
    return {
      isValid: false,
      error: `${fieldName} must be ${max} characters or less`,
    };
  }

  return {
    isValid: true,
  };
};

/**
 * Validates a URL format
 * @param url - The URL to validate
 * @returns Validation result with error message if invalid
 */
export const validateUrl = (url: string): ValidationResult => {
  if (!url || typeof url !== 'string') {
    return {
      isValid: false,
      error: 'URL is required',
    };
  }

  try {
    new URL(url);
    return {
      isValid: true,
    };
  } catch {
    return {
      isValid: false,
      error: 'Invalid URL format',
    };
  }
};

/**
 * Validates a number is within a range
 * @param value - The number to validate
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @param fieldName - The name of the field for error messages
 * @returns Validation result with error message if invalid
 */
export const validateRange = (
  value: number,
  min: number,
  max: number,
  fieldName: string = 'Value'
): ValidationResult => {
  if (typeof value !== 'number' || isNaN(value)) {
    return {
      isValid: false,
      error: `${fieldName} must be a number`,
    };
  }

  if (value < min) {
    return {
      isValid: false,
      error: `${fieldName} must be at least ${min}`,
    };
  }

  if (value > max) {
    return {
      isValid: false,
      error: `${fieldName} must be ${max} or less`,
    };
  }

  return {
    isValid: true,
  };
};

/**
 * Validates a date is not in the past
 * @param date - The date to validate
 * @param fieldName - The name of the field for error messages
 * @returns Validation result with error message if invalid
 */
export const validateFutureDate = (
  date: Date | string | number,
  fieldName: string = 'Date'
): ValidationResult => {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return {
      isValid: false,
      error: `${fieldName} is invalid`,
    };
  }

  if (dateObj.getTime() < Date.now()) {
    return {
      isValid: false,
      error: `${fieldName} must be in the future`,
    };
  }

  return {
    isValid: true,
  };
};

/**
 * Combines multiple validation results
 * @param results - Array of validation results
 * @returns Combined validation result with all errors
 */
export const combineValidationResults = (results: ValidationResult[]): ValidationResult => {
  const errors = results.filter(r => !r.isValid).map(r => r.error).filter(Boolean);

  if (errors.length === 0) {
    return {
      isValid: true,
    };
  }

  return {
    isValid: false,
    error: errors.join('; '),
  };
};

/**
 * Form field validation helper
 * Creates a validation function for a specific field
 * @param validators - Array of validation functions
 * @returns Combined validation function
 */
export const createFieldValidator = (
  ...validators: Array<(value: any) => ValidationResult>
) => {
  return (value: any): ValidationResult => {
    for (const validator of validators) {
      const result = validator(value);
      if (!result.isValid) {
        return result;
      }
    }
    return { isValid: true };
  };
};

/**
 * Validates a schedule configuration object
 * @param config - The schedule configuration to validate
 * @returns Validation result with error message if invalid
 */
export const validateScheduleConfig = (config: {
  name: string;
  description?: string;
  cronExpression: string;
  recipients?: string[];
}): ValidationResult => {
  // Validate name
  const nameResult = validateScheduleName(config.name);
  if (!nameResult.isValid) {
    return nameResult;
  }

  // Validate description
  const descriptionResult = validateScheduleDescription(config.description);
  if (!descriptionResult.isValid) {
    return descriptionResult;
  }

  // Validate cron expression (basic check - detailed validation in cronUtils)
  const cronResult = validateRequired(config.cronExpression, 'Cron expression');
  if (!cronResult.isValid) {
    return cronResult;
  }

  // Validate recipients if provided
  if (config.recipients && config.recipients.length > 0) {
    const recipientsResult = validateEmails(config.recipients);
    if (!recipientsResult.isValid) {
      return recipientsResult;
    }
  }

  return {
    isValid: true,
  };
};
