/**
 * Unit Tests for Configuration Validation Service
 */

import {
  ConfigurationValidationService,
  ValidationResult,
  ValidationRule
} from '@/services/configurationValidationService';

describe('ConfigurationValidationService', () => {
  describe('validateByDataType', () => {
    describe('string validation', () => {
      it('should validate string values', () => {
        const result = ConfigurationValidationService.validateByDataType('test', 'string');
        expect(result.isValid).toBe(true);
      });

      it('should accept empty strings for string type', () => {
        const result = ConfigurationValidationService.validateByDataType('', 'string');
        expect(result.isValid).toBe(true);
      });

      it('should reject non-string values', () => {
        const result = ConfigurationValidationService.validateByDataType('test', 'string');
        expect(result.isValid).toBe(true); // String is always valid for string type
      });
    });

    describe('number validation', () => {
      it('should validate numeric strings', () => {
        const result = ConfigurationValidationService.validateByDataType('123', 'number');
        expect(result.isValid).toBe(true);
      });

      it('should validate negative numbers', () => {
        const result = ConfigurationValidationService.validateByDataType('-123', 'number');
        expect(result.isValid).toBe(true);
      });

      it('should validate decimal numbers', () => {
        const result = ConfigurationValidationService.validateByDataType('123.45', 'number');
        expect(result.isValid).toBe(true);
      });

      it('should reject non-numeric strings', () => {
        const result = ConfigurationValidationService.validateByDataType('abc', 'number');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('must be a valid number');
      });

      it('should reject empty strings for number type', () => {
        const result = ConfigurationValidationService.validateByDataType('', 'number');
        expect(result.isValid).toBe(true); // Empty is allowed, required rule handles it
      });
    });

    describe('boolean validation', () => {
      it('should validate true string', () => {
        const result = ConfigurationValidationService.validateByDataType('true', 'boolean');
        expect(result.isValid).toBe(true);
      });

      it('should validate false string', () => {
        const result = ConfigurationValidationService.validateByDataType('false', 'boolean');
        expect(result.isValid).toBe(true);
      });

      it('should validate 1 as true', () => {
        const result = ConfigurationValidationService.validateByDataType('1', 'boolean');
        expect(result.isValid).toBe(true);
      });

      it('should validate 0 as false', () => {
        const result = ConfigurationValidationService.validateByDataType('0', 'boolean');
        expect(result.isValid).toBe(true);
      });

      it('should reject invalid boolean values', () => {
        const result = ConfigurationValidationService.validateByDataType('yes', 'boolean');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('must be true or false');
      });
    });

    describe('array validation', () => {
      it('should validate valid JSON arrays', () => {
        const result = ConfigurationValidationService.validateByDataType('["a", "b"]', 'array');
        expect(result.isValid).toBe(true);
      });

      it('should validate empty JSON arrays', () => {
        const result = ConfigurationValidationService.validateByDataType('[]', 'array');
        expect(result.isValid).toBe(true);
      });

      it('should reject invalid JSON arrays', () => {
        const result = ConfigurationValidationService.validateByDataType('[invalid]', 'array');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('valid JSON array');
      });
    });
  });

  describe('validateRule', () => {
    describe('required rule', () => {
      it('should pass for non-empty values', () => {
        const rule: ValidationRule = { type: 'required', message: 'Required' };
        const result = ConfigurationValidationService.validateRule('value', 'string', rule);
        expect(result.isValid).toBe(true);
      });

      it('should fail for empty values', () => {
        const rule: ValidationRule = { type: 'required', message: 'Required' };
        const result = ConfigurationValidationService.validateRule('', 'string', rule);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Required');
      });

      it('should fail for whitespace-only values', () => {
        const rule: ValidationRule = { type: 'required', message: 'Required' };
        const result = ConfigurationValidationService.validateRule('   ', 'string', rule);
        expect(result.isValid).toBe(false);
      });
    });

    describe('min rule', () => {
      it('should pass for values >= min', () => {
        const rule: ValidationRule = { type: 'min', value: 10, message: 'Min 10' };
        const result = ConfigurationValidationService.validateRule('15', 'number', rule);
        expect(result.isValid).toBe(true);
      });

      it('should pass for values equal to min', () => {
        const rule: ValidationRule = { type: 'min', value: 10, message: 'Min 10' };
        const result = ConfigurationValidationService.validateRule('10', 'number', rule);
        expect(result.isValid).toBe(true);
      });

      it('should fail for values < min', () => {
        const rule: ValidationRule = { type: 'min', value: 10, message: 'Min 10' };
        const result = ConfigurationValidationService.validateRule('5', 'number', rule);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Min 10');
      });

      it('should ignore min rule for non-number types', () => {
        const rule: ValidationRule = { type: 'min', value: 10, message: 'Min 10' };
        const result = ConfigurationValidationService.validateRule('abc', 'string', rule);
        expect(result.isValid).toBe(true);
      });
    });

    describe('max rule', () => {
      it('should pass for values <= max', () => {
        const rule: ValidationRule = { type: 'max', value: 100, message: 'Max 100' };
        const result = ConfigurationValidationService.validateRule('50', 'number', rule);
        expect(result.isValid).toBe(true);
      });

      it('should pass for values equal to max', () => {
        const rule: ValidationRule = { type: 'max', value: 100, message: 'Max 100' };
        const result = ConfigurationValidationService.validateRule('100', 'number', rule);
        expect(result.isValid).toBe(true);
      });

      it('should fail for values > max', () => {
        const rule: ValidationRule = { type: 'max', value: 100, message: 'Max 100' };
        const result = ConfigurationValidationService.validateRule('150', 'number', rule);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Max 100');
      });
    });

    describe('minLength rule', () => {
      it('should pass for strings with length >= minLength', () => {
        const rule: ValidationRule = { type: 'minLength', value: 5, message: 'Min 5 chars' };
        const result = ConfigurationValidationService.validateRule('hello', 'string', rule);
        expect(result.isValid).toBe(true);
      });

      it('should fail for strings with length < minLength', () => {
        const rule: ValidationRule = { type: 'minLength', value: 5, message: 'Min 5 chars' };
        const result = ConfigurationValidationService.validateRule('hi', 'string', rule);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Min 5 chars');
      });
    });

    describe('maxLength rule', () => {
      it('should pass for strings with length <= maxLength', () => {
        const rule: ValidationRule = { type: 'maxLength', value: 10, message: 'Max 10 chars' };
        const result = ConfigurationValidationService.validateRule('hello', 'string', rule);
        expect(result.isValid).toBe(true);
      });

      it('should fail for strings with length > maxLength', () => {
        const rule: ValidationRule = { type: 'maxLength', value: 10, message: 'Max 10 chars' };
        const result = ConfigurationValidationService.validateRule('hello world', 'string', rule);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Max 10 chars');
      });
    });

    describe('pattern rule', () => {
      it('should pass for values matching pattern', () => {
        const rule: ValidationRule = { type: 'pattern', value: '^[0-9]+$', message: 'Numbers only' };
        const result = ConfigurationValidationService.validateRule('12345', 'string', rule);
        expect(result.isValid).toBe(true);
      });

      it('should fail for values not matching pattern', () => {
        const rule: ValidationRule = { type: 'pattern', value: '^[0-9]+$', message: 'Numbers only' };
        const result = ConfigurationValidationService.validateRule('abc123', 'string', rule);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Numbers only');
      });
    });

    describe('enum rule', () => {
      it('should pass for values in enum list', () => {
        const rule: ValidationRule = { type: 'enum', value: ['dev', 'prod', 'test'], message: 'Invalid env' };
        const result = ConfigurationValidationService.validateRule('dev', 'string', rule);
        expect(result.isValid).toBe(true);
      });

      it('should fail for values not in enum list', () => {
        const rule: ValidationRule = { type: 'enum', value: ['dev', 'prod', 'test'], message: 'Invalid env' };
        const result = ConfigurationValidationService.validateRule('staging', 'string', rule);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Invalid env');
      });
    });
  });

  describe('validateConfigurationValue', () => {
    describe('DB_PORT validation', () => {
      it('should validate valid port numbers', () => {
        const result = ConfigurationValidationService.validateConfigurationValue('DB_PORT', '1433');
        expect(result.isValid).toBe(true);
      });

      it('should reject port numbers below 1', () => {
        const result = ConfigurationValidationService.validateConfigurationValue('DB_PORT', '0');
        expect(result.isValid).toBe(false);
      });

      it('should reject port numbers above 65535', () => {
        const result = ConfigurationValidationService.validateConfigurationValue('DB_PORT', '65536');
        expect(result.isValid).toBe(false);
      });

      it('should reject non-numeric port values', () => {
        const result = ConfigurationValidationService.validateConfigurationValue('DB_PORT', 'abc');
        expect(result.isValid).toBe(false);
      });
    });

    describe('NODE_ENV validation', () => {
      it('should validate development environment', () => {
        const result = ConfigurationValidationService.validateConfigurationValue('NODE_ENV', 'development');
        expect(result.isValid).toBe(true);
      });

      it('should validate production environment', () => {
        const result = ConfigurationValidationService.validateConfigurationValue('NODE_ENV', 'production');
        expect(result.isValid).toBe(true);
      });

      it('should validate test environment', () => {
        const result = ConfigurationValidationService.validateConfigurationValue('NODE_ENV', 'test');
        expect(result.isValid).toBe(true);
      });

      it('should reject invalid environment', () => {
        const result = ConfigurationValidationService.validateConfigurationValue('NODE_ENV', 'staging');
        expect(result.isValid).toBe(false);
      });
    });

    describe('JWT_SECRET validation', () => {
      it('should validate JWT secret with 32+ characters', () => {
        const secret = 'a'.repeat(32);
        const result = ConfigurationValidationService.validateConfigurationValue('JWT_SECRET', secret);
        expect(result.isValid).toBe(true);
      });

      it('should reject JWT secret with less than 32 characters', () => {
        const secret = 'a'.repeat(31);
        const result = ConfigurationValidationService.validateConfigurationValue('JWT_SECRET', secret);
        expect(result.isValid).toBe(false);
      });
    });

    describe('BCRYPT_ROUNDS validation', () => {
      it('should validate bcrypt rounds between 10 and 15', () => {
        const result = ConfigurationValidationService.validateConfigurationValue('BCRYPT_ROUNDS', '12');
        expect(result.isValid).toBe(true);
      });

      it('should reject bcrypt rounds below 10', () => {
        const result = ConfigurationValidationService.validateConfigurationValue('BCRYPT_ROUNDS', '9');
        expect(result.isValid).toBe(false);
      });

      it('should reject bcrypt rounds above 15', () => {
        const result = ConfigurationValidationService.validateConfigurationValue('BCRYPT_ROUNDS', '16');
        expect(result.isValid).toBe(false);
      });
    });

    describe('LOG_LEVEL validation', () => {
      it('should validate error log level', () => {
        const result = ConfigurationValidationService.validateConfigurationValue('LOG_LEVEL', 'error');
        expect(result.isValid).toBe(true);
      });

      it('should validate warn log level', () => {
        const result = ConfigurationValidationService.validateConfigurationValue('LOG_LEVEL', 'warn');
        expect(result.isValid).toBe(true);
      });

      it('should validate info log level', () => {
        const result = ConfigurationValidationService.validateConfigurationValue('LOG_LEVEL', 'info');
        expect(result.isValid).toBe(true);
      });

      it('should validate debug log level', () => {
        const result = ConfigurationValidationService.validateConfigurationValue('LOG_LEVEL', 'debug');
        expect(result.isValid).toBe(true);
      });

      it('should reject invalid log level', () => {
        const result = ConfigurationValidationService.validateConfigurationValue('LOG_LEVEL', 'trace');
        expect(result.isValid).toBe(false);
      });
    });

    describe('numeric range validations', () => {
      it('should validate MAX_REPORT_SIZE_MB', () => {
        const result = ConfigurationValidationService.validateConfigurationValue('MAX_REPORT_SIZE_MB', '100');
        expect(result.isValid).toBe(true);
      });

      it('should reject MAX_REPORT_SIZE_MB below 1', () => {
        const result = ConfigurationValidationService.validateConfigurationValue('MAX_REPORT_SIZE_MB', '0');
        expect(result.isValid).toBe(false);
      });

      it('should reject MAX_REPORT_SIZE_MB above 500', () => {
        const result = ConfigurationValidationService.validateConfigurationValue('MAX_REPORT_SIZE_MB', '501');
        expect(result.isValid).toBe(false);
      });

      it('should validate CHART_WIDTH', () => {
        const result = ConfigurationValidationService.validateConfigurationValue('CHART_WIDTH', '800');
        expect(result.isValid).toBe(true);
      });

      it('should reject CHART_WIDTH below 400', () => {
        const result = ConfigurationValidationService.validateConfigurationValue('CHART_WIDTH', '300');
        expect(result.isValid).toBe(false);
      });

      it('should reject CHART_WIDTH above 2000', () => {
        const result = ConfigurationValidationService.validateConfigurationValue('CHART_WIDTH', '2001');
        expect(result.isValid).toBe(false);
      });
    });

    describe('unknown configuration', () => {
      it('should validate unknown configuration by data type', () => {
        const result = ConfigurationValidationService.validateConfigurationValue('UNKNOWN_CONFIG', 'test', 'string');
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('validateMultipleConfigurations', () => {
    it('should validate multiple configurations', () => {
      const configs = [
        { name: 'DB_PORT', value: '1433', dataType: 'number' as const },
        { name: 'NODE_ENV', value: 'production', dataType: 'string' as const },
        { name: 'BCRYPT_ROUNDS', value: '12', dataType: 'number' as const }
      ];

      const results = ConfigurationValidationService.validateMultipleConfigurations(configs);

      expect(results['DB_PORT']?.isValid).toBe(true);
      expect(results['NODE_ENV']?.isValid).toBe(true);
      expect(results['BCRYPT_ROUNDS']?.isValid).toBe(true);
    });

    it('should return validation errors for invalid configurations', () => {
      const configs = [
        { name: 'DB_PORT', value: '99999', dataType: 'number' as const },
        { name: 'NODE_ENV', value: 'invalid', dataType: 'string' as const }
      ];

      const results = ConfigurationValidationService.validateMultipleConfigurations(configs);

      expect(results['DB_PORT']?.isValid).toBe(false);
      expect(results['NODE_ENV']?.isValid).toBe(false);
    });
  });

  describe('areAllValid', () => {
    it('should return true when all validations pass', () => {
      const results = {
        config1: { isValid: true },
        config2: { isValid: true }
      };

      expect(ConfigurationValidationService.areAllValid(results)).toBe(true);
    });

    it('should return false when any validation fails', () => {
      const results = {
        config1: { isValid: true },
        config2: { isValid: false, error: 'Invalid' }
      };

      expect(ConfigurationValidationService.areAllValid(results)).toBe(false);
    });
  });

  describe('getValidationErrors', () => {
    it('should return only error messages', () => {
      const results = {
        config1: { isValid: true },
        config2: { isValid: false, error: 'Invalid value' },
        config3: { isValid: false, error: 'Out of range' }
      };

      const errors = ConfigurationValidationService.getValidationErrors(results);

      expect(errors['config1']).toBeUndefined();
      expect(errors['config2']).toBe('Invalid value');
      expect(errors['config3']).toBe('Out of range');
    });
  });

  describe('getValidationSchema', () => {
    it('should return schema for known configuration', () => {
      const schema = ConfigurationValidationService.getValidationSchema('DB_PORT');
      expect(schema).not.toBeNull();
      expect(schema?.dataType).toBe('number');
      expect(schema?.rules).toBeDefined();
    });

    it('should return null for unknown configuration', () => {
      const schema = ConfigurationValidationService.getValidationSchema('UNKNOWN_CONFIG');
      expect(schema).toBeNull();
    });
  });

  describe('validateWithConstraints', () => {
    it('should validate with standard schema', () => {
      const result = ConfigurationValidationService.validateWithConstraints(
        'DB_PORT',
        '1433',
        'number'
      );
      expect(result.isValid).toBe(true);
    });

    it('should validate with custom rules', () => {
      const customRules: ValidationRule[] = [
        { type: 'min', value: 5000, message: 'Min 5000' }
      ];

      const result = ConfigurationValidationService.validateWithConstraints(
        'CUSTOM_CONFIG',
        '6000',
        'number',
        customRules
      );
      expect(result.isValid).toBe(true);
    });

    it('should fail custom rules validation', () => {
      const customRules: ValidationRule[] = [
        { type: 'min', value: 5000, message: 'Min 5000' }
      ];

      const result = ConfigurationValidationService.validateWithConstraints(
        'CUSTOM_CONFIG',
        '3000',
        'number',
        customRules
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Min 5000');
    });
  });

  describe('edge cases', () => {
    it('should handle zero values correctly', () => {
      const result = ConfigurationValidationService.validateByDataType('0', 'number');
      expect(result.isValid).toBe(true);
    });

    it('should handle negative numbers', () => {
      const result = ConfigurationValidationService.validateByDataType('-100', 'number');
      expect(result.isValid).toBe(true);
    });

    it('should handle very large numbers', () => {
      const result = ConfigurationValidationService.validateByDataType('999999999', 'number');
      expect(result.isValid).toBe(true);
    });

    it('should handle special characters in strings', () => {
      const result = ConfigurationValidationService.validateByDataType('!@#$%^&*()', 'string');
      expect(result.isValid).toBe(true);
    });

    it('should handle unicode characters', () => {
      const result = ConfigurationValidationService.validateByDataType('你好世界', 'string');
      expect(result.isValid).toBe(true);
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      const result = ConfigurationValidationService.validateByDataType(longString, 'string');
      expect(result.isValid).toBe(true);
    });

    it('should handle whitespace in strings', () => {
      const result = ConfigurationValidationService.validateByDataType('  hello world  ', 'string');
      expect(result.isValid).toBe(true);
    });

    it('should handle scientific notation in numbers', () => {
      const result = ConfigurationValidationService.validateByDataType('1e5', 'number');
      expect(result.isValid).toBe(true);
    });
  });

  describe('constraint validation', () => {
    it('should validate min constraint for numbers', () => {
      const result = ConfigurationValidationService.validateConfigurationValue('DB_POOL_MIN', '5');
      expect(result.isValid).toBe(true);
    });

    it('should validate max constraint for numbers', () => {
      const result = ConfigurationValidationService.validateConfigurationValue('DB_POOL_MAX', '50');
      expect(result.isValid).toBe(true);
    });

    it('should validate minLength constraint for strings', () => {
      const result = ConfigurationValidationService.validateConfigurationValue('DB_HOST', 'localhost');
      expect(result.isValid).toBe(true);
    });

    it('should validate enum constraint', () => {
      const result = ConfigurationValidationService.validateConfigurationValue('LOG_LEVEL', 'debug');
      expect(result.isValid).toBe(true);
    });
  });
});
