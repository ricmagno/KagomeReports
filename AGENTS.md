# Kagome Reports Agent Guide

This document provides essential information for agents working in the Kagome Reports codebase. It covers project structure, commands, patterns, and conventions to help agents understand and work effectively with this system.

## Project Overview

Kagome Reports is a professional reporting application designed to generate printable reports and trends from the AVEVA Historian database. The system connects directly to the AVEVA Historian database via SQL to extract historical time-series data, process it into meaningful trends, and generate professional printable reports.

## Project Structure

```
kagome-reports/
├── src/                    # Source code
│   ├── server.ts          # Main application entry point
│   ├── config/            # Configuration files
│   │   ├── database.ts    # Database connection configuration
│   │   └── environment.ts # Environment variable validation
│   ├── types/             # TypeScript type definitions
│   │   └── historian.ts   # AVEVA Historian specific types
│   ├── utils/             # Utility functions
│   │   ├── logger.ts      # Logging configuration
│   │   └── retryHandler.ts# Retry logic for database operations
│   ├── services/          # Business logic services
│   │   ├── dataFiltering.ts # Data filtering and transformation
│   │   ├── dataRetrieval.ts # Time-series data retrieval from historian
│   │   ├── historianConnection.ts # Database connection management
│   │   └── statisticalAnalysis.ts # Statistical analysis and trend detection
│   └── middleware/        # Express middleware
│       ├── errorHandler.ts # Error handling
│       └── requestLogger.ts # Request logging
├── tests/                 # Test files
│   └── properties/        # Property-based tests
├── .gitignore             # Git ignore patterns
├── Dockerfile             # Container build configuration
├── docker-compose.yml     # Multi-container orchestration
├── package.json           # Project dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── README.md              # Project documentation
```

## Essential Commands

### Development
```bash
# Start development server with hot reloading
npm run dev

# Build the application
npm run build

# Start built application
npm start

# Run tests
npm test

# Run property-based tests
npm run test:property

# Run tests in watch mode
npm run test:watch

# Lint TypeScript code
npm run lint
```

### Docker
```bash
# Build Docker image for multiple architectures (AMD64 and ARM64)
npm run docker:build

# Run with Docker Compose (development environment)
npm run docker:dev
```

## Code Organization and Structure

### Architecture Pattern
The project follows a modular architecture with services, configuration, and utilities properly separated:

1. **Configuration Layer**: Database and environment configuration in `src/config/`
2. **Services Layer**: Business logic in `src/services/` with specific responsibilities:
   - Data retrieval from AVEVA Historian database (`dataRetrieval.ts`)
   - Database connection management (`historianConnection.ts`)
   - Statistical analysis and trend detection (`statisticalAnalysis.ts`)
3. **Types Layer**: Strong typing for AVEVA Historian data structures (`src/types/historian.ts`)
4. **Utilities Layer**: Common functionality like logging and retry logic (`src/utils/`)
5. **Middleware Layer**: Express middleware for error handling and request logging

### Key Services and Their Responsibilities

- **DataRetrievalService**: Handles time-series data queries, tag information retrieval, and filtered data retrieval
- **HistorianConnection**: Manages database connections with retry logic and connection pooling
- **StatisticalAnalysisService**: Provides mathematical functions for trend analysis, statistics, and anomaly detection

### Data Flow
1. Environment variables are validated using Zod schemas in `environment.ts`
2. Database connections are managed through the `database.ts` configuration and connection pool
3. Data retrieval services query the AVEVA Historian database using SQL
4. Results are transformed into standardized TypeScript types
5. Statistical analysis is performed on the retrieved data
6. Errors are handled through centralized error middleware

## Naming Conventions and Style Patterns

### TypeScript Naming
- Services end with `Service` (e.g., `DataRetrievalService`)
- Interfaces and types start with capital letters (e.g., `TimeSeriesData`, `TagInfo`)
- Constants are in UPPER_SNAKE_CASE (e.g., `QualityCode.Good`)
- Variables and functions use camelCase (e.g., `validateTimeRange`, `getTimeSeriesData`)

### Database and SQL Patterns
- SQL queries use proper parameter binding to prevent injection attacks
- Query parameters are named consistently (`@tagName`, `@startTime`, etc.)
- SQL queries follow AVEVA Historian table structure conventions:
  - `History` table for time-series data
  - `Tag` table for tag metadata

### Logging Patterns
- Service-specific loggers are created with context (e.g., `dbLogger`, `apiLogger`)
- Log levels follow standard conventions (error, warn, info, debug)
- Logs include relevant metadata for debugging and monitoring

## Testing Approach and Patterns

### Test Types
1. **Unit Tests**: Individual function or service testing in `tests/`
2. **Property-Based Tests**: Using FastCheck for comprehensive validation in `tests/properties/`

### Test Configuration
- Uses Jest as the test framework
- TypeScript support through ts-jest
- Property-based testing with FastCheck for robust validation

### Test Coverage Strategy
- Tests cover all major services and their methods
- Property-based tests validate edge cases and configuration combinations
- Tests for database connection handling with retries
- Tests for error conditions and validation failures

### Key Test Areas
1. **Database Authentication**: Validating connection with various configurations
2. **Data Retrieval**: Testing time-series data fetching and filtering
3. **Statistical Analysis**: Validating mathematical calculations and trend detection
4. **Error Handling**: Testing error conditions and graceful degradation

## Important Gotchas and Non-Obvious Patterns

### Database Connection Management
1. The system uses a connection pool with configurable min/max settings
2. Connection retry logic is implemented using `RetryHandler` utility
3. The system validates database connectivity before use and handles reconnection gracefully

### Data Validation and Security
1. All environment variables are strictly validated using Zod schemas with default values
2. SQL queries use parameterized statements to prevent injection attacks
3. The system enforces read-only database access permissions for security

### Performance Considerations
1. Time-series data queries support sampling modes (Cyclic, Delta, BestFit) to handle large datasets
2. Pagination is implemented for filtered data retrieval with cursor support
3. Connection pooling helps manage database resource usage efficiently

### Error Handling
1. Custom error handling middleware catches and properly formats errors for API responses
2. Operational errors (like database connection issues) are handled gracefully with appropriate HTTP status codes
3. Validation errors from Zod are specifically caught and formatted for user consumption

### Logging and Monitoring
1. Comprehensive logging with structured data for debugging and monitoring
2. Different loggers for different components (database, API, reports, etc.)
3. Log rotation and file size management to prevent disk space issues

### Environment Configuration
1. The system uses a strict Zod schema for environment validation with sensible defaults
2. Environment variables are categorized by function (Database, Application, Email, Report, Performance, Security)
3. The configuration enforces minimum security requirements (e.g., JWT secret length)

### Docker and Deployment
1. Multi-architecture Docker support for both AMD64 and ARM64 platforms
2. Production-ready configuration with proper health checks
3. Environment variable injection for database credentials and other sensitive settings

## Project-Specific Context

### AVEVA Historian Integration
The system is designed specifically for integration with AVEVA Historian database, using direct SQL connections. Key considerations:

1. Database schema expectations (History and Tag tables)
2. Quality code handling (192 = Good, 0 = Bad, etc.)
3. Time-series data formats and timestamp handling
4. Connection configuration for SQL Server (AVEVA Historian uses SQL Server)

### Report Generation
The system supports:
1. Printable report creation (PDF, DOCX)
2. Customizable report templates
3. Data visualization capabilities
4. Professional formatting and styling

### Automation Features
Support for scheduled report generation with various intervals:
- Hourly, Every 6 hours, Every 8 hours, Every 12 hours, Daily (24 hours)
- Weekly, Monthly intervals
- Email delivery capabilities

### Security Considerations
1. Read-only database access enforced by design
2. JWT-based authentication system (not yet fully implemented in the provided code)
3. Secure handling of database credentials and SMTP settings
4. Rate limiting and session timeout configurations

## Configuration Files

### Environment Variables (`.env.example`)
Key configuration includes:
- Database connection parameters (host, port, name, user, password)
- JWT secret for authentication
- SMTP settings for email notifications
- Report directory paths and size limits
- Performance and caching configuration

### Docker Configuration (`Dockerfile`)
- Multi-stage build for optimal image size
- Support for both ARM64 and AMD64 architectures
- Runtime dependencies for PDF generation capabilities
- Health check endpoint configuration

## Development Guidelines

### Code Quality
1. Use TypeScript strict mode for better type safety
2. Follow the existing code style and patterns consistently
3. Ensure proper error handling throughout services
4. Validate all inputs, especially database queries and parameters

### Performance Best Practices
1. Use connection pooling for database operations
2. Implement efficient query patterns to handle large time-series datasets
3. Consider sampling strategies for very large datasets
4. Use proper pagination when returning large result sets

### Security Best Practices
1. All environment variables are validated and sanitized
2. Use parameterized queries to prevent SQL injection
3. Enforce read-only access to database connections
4. Properly handle sensitive configuration like JWT secrets and database credentials

This guide should provide sufficient context for agents to understand the codebase structure, key patterns, and how to work effectively with this reporting system for AVEVA Historian data.