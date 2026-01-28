# Configuration Validation Service

## Overview

The Configuration Validation Service provides comprehensive validation logic for application configuration values. It validates configuration values based on their data type and applies constraint validation rules (min, max, pattern, enum, minLength, maxLength).

## Features

- **Type Validation**: Validates string, number, boolean, and array data types
- **Constraint Validation**: Enforces min/max values, string length, patterns, and enum constraints
- **Comprehensive Schemas**: Pre-defined validation schemas for all known configurations
- **Error Messages**: Clear, user-friendly error messages for validation failures
- **Batch Validation**: Validate multiple configurations at once
- **Custom Rules**: Support for custom validation rules beyond standard schemas

## Architecture

### Core Components

1. **ConfigurationValidationService**: Main service class with static methods for validation
2. **ValidationResult**: Interface for validation results with `isValid` boolean and optional `error` message
3. **ValidationRule**: Interface for defining validation rules
4. **ValidationSchema**: Interface for configuration validation schemas

### Validation Schemas

Pre-defined validation schemas are available for all known configurations in the `VALIDATION_SCHEMAS` registry. Each schema includes:

- **dataType**: The expected data type (string, number, boolean, array)
- **rules**: Array of validation rules to apply

Example schema:
```typescript
DB_PORT: {
  dataType: 'number',
  rules: [
    { type: 'required', message: 'Database port is required' },
    { type: 'min', value: 1, message: 'Port must be at least 1' },
    { type: 'max', value: 65535, message: 'Port must be at most 65535' }
  ]
}
```

## Usage

### Basic Validation

```typescript
import { ConfigurationValidationService } from '@/services/configurationValidationService';

// Validate a single configuration
const result = ConfigurationValidationService.validateConfigurationValue(
  'DB_PORT',
  '1433'
);

if (result.isValid) {
  console.log('Valid configuration');
} else {
  console.log('Validation error:', result.error);
}
```

### Validate by Data Type

```typescript
// Validate a value by its data type
const result = ConfigurationValidationService.validateByDataType('123', 'number');
```

### Validate Against Rules

```typescript
// Validate against specific rules
const rules = [
  { type: 'required', message: 'Value is required' },
  { type: 'min', value: 10, message: 'Minimum value is 10' },
  { type: 'max', value: 100, message: 'Maximum value is 100' }
];

const result = ConfigurationValidationService.validateAgainstRules(
  '50',
  'number',
  rules
);
```

### Batch Validation

```typescript
// Validate multiple configurations at once
const configs = [
  { name: 'DB_PORT', value: '1433', dataType: 'number' },
  { name: 'NODE_ENV', value: 'production', dataType: 'string' },
  { name: 'BCRYPT_ROUNDS', value: '12', dataType: 'number' }
];

const results = ConfigurationValidationService.validateMultipleConfigurations(configs);

// Check if all validations passed
if (ConfigurationValidationService.areAllValid(results)) {
  console.log('All configurations are valid');
} else {
  const errors = ConfigurationValidationService.getValidationErrors(results);
  console.log('Validation errors:', errors);
}
```

### Custom Validation Rules

```typescript
// Validate with custom rules
const customRules = [
  { type: 'min', value: 5000, message: 'Minimum timeout is 5000ms' }
];

const result = ConfigurationValidationService.validateWithConstraints(
  'CUSTOM_TIMEOUT',
  '10000',
  'number',
  customRules
);
```

## Validation Rules

### Supported Rule Types

1. **required**: Value must not be empty
   ```typescript
   { type: 'required', message: 'This field is required' }
   ```

2. **min**: Numeric value must be >= specified value
   ```typescript
   { type: 'min', value: 1, message: 'Minimum value is 1' }
   ```

3. **max**: Numeric value must be <= specified value
   ```typescript
   { type: 'max', value: 100, message: 'Maximum value is 100' }
   ```

4. **minLength**: String length must be >= specified value
   ```typescript
   { type: 'minLength', value: 8, message: 'Minimum 8 characters' }
   ```

5. **maxLength**: String length must be <= specified value
   ```typescript
   { type: 'maxLength', value: 255, message: 'Maximum 255 characters' }
   ```

6. **pattern**: Value must match regex pattern
   ```typescript
   { type: 'pattern', value: '^[0-9]+$', message: 'Numbers only' }
   ```

7. **enum**: Value must be in specified list
   ```typescript
   { type: 'enum', value: ['dev', 'prod', 'test'], message: 'Invalid environment' }
   ```

## Data Type Validation

### String Validation

```typescript
const result = ConfigurationValidationService.validateString('hello');
// Returns: { isValid: true }
```

### Number Validation

```typescript
const result = ConfigurationValidationService.validateNumber('123');
// Returns: { isValid: true }

const result = ConfigurationValidationService.validateNumber('abc');
// Returns: { isValid: false, error: 'Value must be a valid number' }
```

### Boolean Validation

```typescript
const result = ConfigurationValidationService.validateBoolean('true');
// Returns: { isValid: true }

const result = ConfigurationValidationService.validateBoolean('yes');
// Returns: { isValid: false, error: 'Value must be true or false' }
```

### Array Validation

```typescript
const result = ConfigurationValidationService.validateArray('["a", "b"]');
// Returns: { isValid: true }

const result = ConfigurationValidationService.validateArray('[invalid]');
// Returns: { isValid: false, error: 'Value must be a valid JSON array' }
```

## Utility Functions

The `configurationValidation.ts` utility module provides specialized validation functions for common configuration types:

### Specialized Validators

- `validatePort(value)`: Validates port numbers (1-65535)
- `validateHostname(value)`: Validates hostnames and IP addresses
- `validateEmail(value)`: Validates email addresses
- `validateUrl(value)`: Validates URLs
- `validateFilePath(value)`: Validates file paths
- `validateJwtSecret(value)`: Validates JWT secrets (min 32 chars)
- `validateCorsOrigin(value)`: Validates CORS origins
- `validateLogLevel(value)`: Validates log levels (error, warn, info, debug)
- `validateNodeEnvironment(value)`: Validates Node environments (dev, prod, test)
- `validatePercentage(value)`: Validates percentages (0-100)
- `validateTimeout(value, minMs, maxMs)`: Validates timeout values
- `validateMemorySize(value, minMb, maxMb)`: Validates memory sizes
- `validateCacheTtl(value)`: Validates cache TTL values
- `validateBcryptRounds(value)`: Validates bcrypt rounds (10-15)
- `validatePoolSize(value, minSize, maxSize)`: Validates connection pool sizes
- `validateRateLimit(value)`: Validates rate limit values
- `validateSessionTimeout(value)`: Validates session timeout values
- `validateChartDimension(value, minPixels, maxPixels)`: Validates chart dimensions
- `validateReportSizeLimit(value)`: Validates report size limits

### Usage Example

```typescript
import * as validationUtils from '@/utils/configurationValidation';

// Validate a port number
const portResult = validationUtils.validatePort('8080');

// Validate a JWT secret
const secretResult = validationUtils.validateJwtSecret('my-secret-key-with-32-characters');

// Validate with custom rules
const customRules = [
  { type: 'min', value: 10, message: 'Minimum 10' }
];
const result = validationUtils.validateWithCustomRules('15', 'number', customRules);
```

## Pre-defined Configuration Schemas

The service includes validation schemas for all known configurations:

### Database Configuration
- `DB_HOST`: String, required, max 255 chars
- `DB_PORT`: Number, required, 1-65535
- `DB_NAME`: String, required, max 128 chars
- `DB_USER`: String, required, max 128 chars
- `DB_PASSWORD`: String, required
- `DB_ENCRYPT`: Boolean, required
- `DB_TRUST_SERVER_CERTIFICATE`: Boolean, required

### Application Configuration
- `NODE_ENV`: String, required, enum: [development, production, test]
- `PORT`: Number, required, 1-65535
- `JWT_SECRET`: String, required, min 32 chars
- `BCRYPT_ROUNDS`: Number, required, 10-15

### Email Configuration
- `SMTP_HOST`: String, required, max 255 chars
- `SMTP_PORT`: Number, required, 1-65535
- `SMTP_SECURE`: Boolean, required
- `SMTP_USER`: String, required, max 255 chars
- `SMTP_PASSWORD`: String, required

### Report Configuration
- `REPORTS_DIR`: String, required
- `TEMP_DIR`: String, required
- `MAX_REPORT_SIZE_MB`: Number, required, 1-500
- `CHART_WIDTH`: Number, required, 400-2000
- `CHART_HEIGHT`: Number, required, 300-1500

### Performance Configuration
- `CACHE_ENABLED`: Boolean, required
- `REDIS_HOST`: String, max 255 chars
- `REDIS_PORT`: Number, 1-65535
- `REDIS_PASSWORD`: String
- `REDIS_DB`: Number, 0-15
- `CACHE_KEY_PREFIX`: String, max 50 chars
- `CACHE_DEFAULT_TTL`: Number, >= 0
- `DB_POOL_MIN`: Number, required, 1-50
- `DB_POOL_MAX`: Number, required, 2-100
- `DB_TIMEOUT_MS`: Number, required, 5000-300000
- `CACHE_TTL_SECONDS`: Number, required, 60-3600
- `MAX_CONCURRENT_REPORTS`: Number, required, 1-20

### Security Configuration
- `CORS_ORIGIN`: String, required
- `SESSION_TIMEOUT_HOURS`: Number, required, 1-168
- `RATE_LIMIT_WINDOW_MS`: Number, required, 60000-3600000
- `RATE_LIMIT_MAX_REQUESTS`: Number, required, 10-1000

### Logging Configuration
- `LOG_LEVEL`: String, required, enum: [error, warn, info, debug]
- `LOG_FILE`: String, required
- `LOG_MAX_SIZE`: String, required
- `LOG_MAX_FILES`: Number, required, 1-20

## Error Handling

All validation methods return a `ValidationResult` object:

```typescript
interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}
```

Example error handling:

```typescript
const result = ConfigurationValidationService.validateConfigurationValue(
  'DB_PORT',
  'invalid'
);

if (!result.isValid) {
  console.error('Validation failed:', result.error);
  // Display error to user
}
```

## Testing

The validation service includes comprehensive unit tests covering:

- All data type validations
- All validation rule types
- All pre-defined configuration schemas
- Edge cases (zero values, negative numbers, very large numbers, unicode, etc.)
- Batch validation
- Custom rules validation
- Error message generation

Run tests with:
```bash
npm test -- tests/unit/configurationValidation
```

## Integration with Configuration Management

The validation service is used by the configuration management feature to:

1. Validate configuration values before saving
2. Provide real-time validation feedback to users
3. Prevent invalid configurations from being persisted
4. Display clear error messages for validation failures
5. Support batch validation for multiple configuration changes

## Performance Considerations

- Validation is performed synchronously for immediate feedback
- Schemas are pre-compiled and cached
- Regex patterns are compiled once and reused
- Batch validation processes all configurations in a single pass

## Future Enhancements

Potential improvements for future versions:

1. Async validation for remote validation (e.g., checking if hostname is reachable)
2. Custom validation functions for complex rules
3. Validation schema versioning for backward compatibility
4. Validation result caching for repeated validations
5. Validation performance metrics and monitoring
