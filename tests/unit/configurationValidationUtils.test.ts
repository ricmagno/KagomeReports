/**
 * Unit Tests for Configuration Validation Utilities
 */

import * as validationUtils from '@/utils/configurationValidation';

describe('Configuration Validation Utilities', () => {
  describe('validateString', () => {
    it('should validate valid strings', () => {
      const result = validationUtils.validateString('hello');
      expect(result.isValid).toBe(true);
    });

    it('should validate empty strings', () => {
      const result = validationUtils.validateString('');
      expect(result.isValid).toBe(true);
    });

    it('should validate strings with minLength', () => {
      const result = validationUtils.validateString('hello', 3);
      expect(result.isValid).toBe(true);
    });

    it('should reject strings shorter than minLength', () => {
      const result = validationUtils.validateString('hi', 3);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('at least 3 characters');
    });

    it('should validate strings with maxLength', () => {
      const result = validationUtils.validateString('hello', undefined, 10);
      expect(result.isValid).toBe(true);
    });

    it('should reject strings longer than maxLength', () => {
      const result = validationUtils.validateString('hello world', undefined, 5);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('at most 5 characters');
    });

    it('should validate strings with both min and max length', () => {
      const result = validationUtils.validateString('hello', 3, 10);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateNumber', () => {
    it('should validate valid numbers', () => {
      const result = validationUtils.validateNumber('123');
      expect(result.isValid).toBe(true);
    });

    it('should validate negative numbers', () => {
      const result = validationUtils.validateNumber('-123');
      expect(result.isValid).toBe(true);
    });

    it('should validate decimal numbers', () => {
      const result = validationUtils.validateNumber('123.45');
      expect(result.isValid).toBe(true);
    });

    it('should reject non-numeric strings', () => {
      const result = validationUtils.validateNumber('abc');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('valid number');
    });

    it('should validate numbers with min constraint', () => {
      const result = validationUtils.validateNumber('100', 50);
      expect(result.isValid).toBe(true);
    });

    it('should reject numbers below min', () => {
      const result = validationUtils.validateNumber('30', 50);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('at least 50');
    });

    it('should validate numbers with max constraint', () => {
      const result = validationUtils.validateNumber('100', undefined, 150);
      expect(result.isValid).toBe(true);
    });

    it('should reject numbers above max', () => {
      const result = validationUtils.validateNumber('200', undefined, 150);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('at most 150');
    });

    it('should validate numbers with both min and max', () => {
      const result = validationUtils.validateNumber('100', 50, 150);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateBoolean', () => {
    it('should validate true', () => {
      const result = validationUtils.validateBoolean('true');
      expect(result.isValid).toBe(true);
    });

    it('should validate false', () => {
      const result = validationUtils.validateBoolean('false');
      expect(result.isValid).toBe(true);
    });

    it('should validate 1 as true', () => {
      const result = validationUtils.validateBoolean('1');
      expect(result.isValid).toBe(true);
    });

    it('should validate 0 as false', () => {
      const result = validationUtils.validateBoolean('0');
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid boolean values', () => {
      const result = validationUtils.validateBoolean('yes');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('true or false');
    });

    it('should reject numeric values other than 0 and 1', () => {
      const result = validationUtils.validateBoolean('2');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateEnum', () => {
    it('should validate values in enum list', () => {
      const result = validationUtils.validateEnum('dev', ['dev', 'prod', 'test']);
      expect(result.isValid).toBe(true);
    });

    it('should reject values not in enum list', () => {
      const result = validationUtils.validateEnum('staging', ['dev', 'prod', 'test']);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('one of');
    });

    it('should be case-sensitive', () => {
      const result = validationUtils.validateEnum('DEV', ['dev', 'prod', 'test']);
      expect(result.isValid).toBe(false);
    });
  });

  describe('validatePattern', () => {
    it('should validate values matching pattern', () => {
      const result = validationUtils.validatePattern('12345', '^[0-9]+$');
      expect(result.isValid).toBe(true);
    });

    it('should reject values not matching pattern', () => {
      const result = validationUtils.validatePattern('abc123', '^[0-9]+$');
      expect(result.isValid).toBe(false);
    });

    it('should support RegExp objects', () => {
      const result = validationUtils.validatePattern('hello', /^[a-z]+$/);
      expect(result.isValid).toBe(true);
    });

    it('should reject values not matching RegExp', () => {
      const result = validationUtils.validatePattern('hello123', /^[a-z]+$/);
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateByDataType', () => {
    it('should validate string type', () => {
      const result = validationUtils.validateByDataType('hello', 'string');
      expect(result.isValid).toBe(true);
    });

    it('should validate number type', () => {
      const result = validationUtils.validateByDataType('123', 'number');
      expect(result.isValid).toBe(true);
    });

    it('should validate boolean type', () => {
      const result = validationUtils.validateByDataType('true', 'boolean');
      expect(result.isValid).toBe(true);
    });

    it('should validate array type', () => {
      const result = validationUtils.validateByDataType('["a", "b"]', 'array');
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid array', () => {
      const result = validationUtils.validateByDataType('[invalid]', 'array');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateRequired', () => {
    it('should pass for non-empty values', () => {
      const result = validationUtils.validateRequired('value');
      expect(result.isValid).toBe(true);
    });

    it('should fail for empty strings', () => {
      const result = validationUtils.validateRequired('');
      expect(result.isValid).toBe(false);
    });

    it('should fail for whitespace-only strings', () => {
      const result = validationUtils.validateRequired('   ');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validatePort', () => {
    it('should validate valid port numbers', () => {
      const result = validationUtils.validatePort('8080');
      expect(result.isValid).toBe(true);
    });

    it('should validate port 1', () => {
      const result = validationUtils.validatePort('1');
      expect(result.isValid).toBe(true);
    });

    it('should validate port 65535', () => {
      const result = validationUtils.validatePort('65535');
      expect(result.isValid).toBe(true);
    });

    it('should reject port 0', () => {
      const result = validationUtils.validatePort('0');
      expect(result.isValid).toBe(false);
    });

    it('should reject port 65536', () => {
      const result = validationUtils.validatePort('65536');
      expect(result.isValid).toBe(false);
    });

    it('should reject non-numeric ports', () => {
      const result = validationUtils.validatePort('abc');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateHostname', () => {
    it('should validate valid hostnames', () => {
      const result = validationUtils.validateHostname('localhost');
      expect(result.isValid).toBe(true);
    });

    it('should validate domain names', () => {
      const result = validationUtils.validateHostname('example.com');
      expect(result.isValid).toBe(true);
    });

    it('should validate IP addresses', () => {
      const result = validationUtils.validateHostname('192.168.1.1');
      expect(result.isValid).toBe(true);
    });

    it('should reject empty hostnames', () => {
      const result = validationUtils.validateHostname('');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('should validate valid email addresses', () => {
      const result = validationUtils.validateEmail('user@example.com');
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      const result = validationUtils.validateEmail('invalid.email');
      expect(result.isValid).toBe(false);
    });

    it('should reject emails without domain', () => {
      const result = validationUtils.validateEmail('user@');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateUrl', () => {
    it('should validate valid URLs', () => {
      const result = validationUtils.validateUrl('https://example.com');
      expect(result.isValid).toBe(true);
    });

    it('should validate URLs with paths', () => {
      const result = validationUtils.validateUrl('https://example.com/path');
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid URLs', () => {
      const result = validationUtils.validateUrl('not a url');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateFilePath', () => {
    it('should validate valid file paths', () => {
      const result = validationUtils.validateFilePath('/path/to/file.txt');
      expect(result.isValid).toBe(true);
    });

    it('should reject empty paths', () => {
      const result = validationUtils.validateFilePath('');
      expect(result.isValid).toBe(false);
    });

    it('should reject paths with invalid characters', () => {
      const result = validationUtils.validateFilePath('/path/to/<file>.txt');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateJwtSecret', () => {
    it('should validate JWT secret with 32+ characters', () => {
      const secret = 'a'.repeat(32);
      const result = validationUtils.validateJwtSecret(secret);
      expect(result.isValid).toBe(true);
    });

    it('should reject JWT secret with less than 32 characters', () => {
      const secret = 'a'.repeat(31);
      const result = validationUtils.validateJwtSecret(secret);
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateCorsOrigin', () => {
    it('should validate wildcard origin', () => {
      const result = validationUtils.validateCorsOrigin('*');
      expect(result.isValid).toBe(true);
    });

    it('should validate valid URL origins', () => {
      const result = validationUtils.validateCorsOrigin('https://example.com');
      expect(result.isValid).toBe(true);
    });

    it('should reject empty origins', () => {
      const result = validationUtils.validateCorsOrigin('');
      expect(result.isValid).toBe(false);
    });

    it('should reject invalid URL origins', () => {
      const result = validationUtils.validateCorsOrigin('not a url');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateLogLevel', () => {
    it('should validate error log level', () => {
      const result = validationUtils.validateLogLevel('error');
      expect(result.isValid).toBe(true);
    });

    it('should validate warn log level', () => {
      const result = validationUtils.validateLogLevel('warn');
      expect(result.isValid).toBe(true);
    });

    it('should validate info log level', () => {
      const result = validationUtils.validateLogLevel('info');
      expect(result.isValid).toBe(true);
    });

    it('should validate debug log level', () => {
      const result = validationUtils.validateLogLevel('debug');
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid log level', () => {
      const result = validationUtils.validateLogLevel('trace');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateNodeEnvironment', () => {
    it('should validate development environment', () => {
      const result = validationUtils.validateNodeEnvironment('development');
      expect(result.isValid).toBe(true);
    });

    it('should validate production environment', () => {
      const result = validationUtils.validateNodeEnvironment('production');
      expect(result.isValid).toBe(true);
    });

    it('should validate test environment', () => {
      const result = validationUtils.validateNodeEnvironment('test');
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid environment', () => {
      const result = validationUtils.validateNodeEnvironment('staging');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validatePercentage', () => {
    it('should validate valid percentages', () => {
      const result = validationUtils.validatePercentage('50');
      expect(result.isValid).toBe(true);
    });

    it('should validate 0 percent', () => {
      const result = validationUtils.validatePercentage('0');
      expect(result.isValid).toBe(true);
    });

    it('should validate 100 percent', () => {
      const result = validationUtils.validatePercentage('100');
      expect(result.isValid).toBe(true);
    });

    it('should reject negative percentages', () => {
      const result = validationUtils.validatePercentage('-10');
      expect(result.isValid).toBe(false);
    });

    it('should reject percentages above 100', () => {
      const result = validationUtils.validatePercentage('150');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateTimeout', () => {
    it('should validate valid timeout values', () => {
      const result = validationUtils.validateTimeout('5000');
      expect(result.isValid).toBe(true);
    });

    it('should validate timeout with custom min', () => {
      const result = validationUtils.validateTimeout('10000', 5000);
      expect(result.isValid).toBe(true);
    });

    it('should reject timeout below min', () => {
      const result = validationUtils.validateTimeout('1000', 5000);
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateMemorySize', () => {
    it('should validate valid memory sizes', () => {
      const result = validationUtils.validateMemorySize('512');
      expect(result.isValid).toBe(true);
    });

    it('should validate memory size with custom range', () => {
      const result = validationUtils.validateMemorySize('256', 128, 1024);
      expect(result.isValid).toBe(true);
    });

    it('should reject memory size below min', () => {
      const result = validationUtils.validateMemorySize('64', 128);
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateCacheTtl', () => {
    it('should validate valid cache TTL', () => {
      const result = validationUtils.validateCacheTtl('3600');
      expect(result.isValid).toBe(true);
    });

    it('should validate 0 TTL', () => {
      const result = validationUtils.validateCacheTtl('0');
      expect(result.isValid).toBe(true);
    });

    it('should reject TTL above 24 hours', () => {
      const result = validationUtils.validateCacheTtl('86401');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateBcryptRounds', () => {
    it('should validate valid bcrypt rounds', () => {
      const result = validationUtils.validateBcryptRounds('12');
      expect(result.isValid).toBe(true);
    });

    it('should validate minimum bcrypt rounds', () => {
      const result = validationUtils.validateBcryptRounds('10');
      expect(result.isValid).toBe(true);
    });

    it('should validate maximum bcrypt rounds', () => {
      const result = validationUtils.validateBcryptRounds('15');
      expect(result.isValid).toBe(true);
    });

    it('should reject bcrypt rounds below 10', () => {
      const result = validationUtils.validateBcryptRounds('9');
      expect(result.isValid).toBe(false);
    });

    it('should reject bcrypt rounds above 15', () => {
      const result = validationUtils.validateBcryptRounds('16');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validatePoolSize', () => {
    it('should validate valid pool sizes', () => {
      const result = validationUtils.validatePoolSize('10');
      expect(result.isValid).toBe(true);
    });

    it('should validate pool size with custom range', () => {
      const result = validationUtils.validatePoolSize('5', 2, 20);
      expect(result.isValid).toBe(true);
    });

    it('should reject pool size below min', () => {
      const result = validationUtils.validatePoolSize('0');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateRateLimit', () => {
    it('should validate valid rate limits', () => {
      const result = validationUtils.validateRateLimit('100');
      expect(result.isValid).toBe(true);
    });

    it('should reject rate limit of 0', () => {
      const result = validationUtils.validateRateLimit('0');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateSessionTimeout', () => {
    it('should validate valid session timeouts', () => {
      const result = validationUtils.validateSessionTimeout('24');
      expect(result.isValid).toBe(true);
    });

    it('should validate minimum session timeout', () => {
      const result = validationUtils.validateSessionTimeout('1');
      expect(result.isValid).toBe(true);
    });

    it('should validate maximum session timeout', () => {
      const result = validationUtils.validateSessionTimeout('168');
      expect(result.isValid).toBe(true);
    });

    it('should reject session timeout below 1 hour', () => {
      const result = validationUtils.validateSessionTimeout('0');
      expect(result.isValid).toBe(false);
    });

    it('should reject session timeout above 1 week', () => {
      const result = validationUtils.validateSessionTimeout('169');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateChartDimension', () => {
    it('should validate valid chart dimensions', () => {
      const result = validationUtils.validateChartDimension('800');
      expect(result.isValid).toBe(true);
    });

    it('should validate chart dimension with custom range', () => {
      const result = validationUtils.validateChartDimension('600', 400, 2000);
      expect(result.isValid).toBe(true);
    });

    it('should reject chart dimension below min', () => {
      const result = validationUtils.validateChartDimension('50');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateReportSizeLimit', () => {
    it('should validate valid report size limits', () => {
      const result = validationUtils.validateReportSizeLimit('100');
      expect(result.isValid).toBe(true);
    });

    it('should validate minimum report size', () => {
      const result = validationUtils.validateReportSizeLimit('1');
      expect(result.isValid).toBe(true);
    });

    it('should validate maximum report size', () => {
      const result = validationUtils.validateReportSizeLimit('1000');
      expect(result.isValid).toBe(true);
    });

    it('should reject report size below 1 MB', () => {
      const result = validationUtils.validateReportSizeLimit('0');
      expect(result.isValid).toBe(false);
    });

    it('should reject report size above 1 GB', () => {
      const result = validationUtils.validateReportSizeLimit('1001');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateWithCustomRules', () => {
    it('should validate with custom rules', () => {
      const rules = [
        { type: 'min', value: 10, message: 'Min 10' }
      ];

      const result = validationUtils.validateWithCustomRules('15', 'number', rules);
      expect(result.isValid).toBe(true);
    });

    it('should fail custom rules validation', () => {
      const rules = [
        { type: 'min', value: 10, message: 'Min 10' }
      ];

      const result = validationUtils.validateWithCustomRules('5', 'number', rules);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Min 10');
    });

    it('should validate multiple custom rules', () => {
      const rules = [
        { type: 'min', value: 10, message: 'Min 10' },
        { type: 'max', value: 100, message: 'Max 100' }
      ];

      const result = validationUtils.validateWithCustomRules('50', 'number', rules);
      expect(result.isValid).toBe(true);
    });

    it('should fail on first failing rule', () => {
      const rules = [
        { type: 'min', value: 10, message: 'Min 10' },
        { type: 'max', value: 100, message: 'Max 100' }
      ];

      const result = validationUtils.validateWithCustomRules('5', 'number', rules);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Min 10');
    });
  });
});
