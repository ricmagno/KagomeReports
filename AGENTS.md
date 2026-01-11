# Historian Reports Agent Guide

This document provides essential information for agents working in the Historian Reports codebase. It covers project structure, commands, patterns, and conventions to help agents understand and work effectively with this system.

## Project Overview

Historian Reports is a professional reporting application designed to generate printable reports and trends from the AVEVA Historian database. The system connects directly to the AVEVA Historian database via SQL to extract historical time-series data, process it into meaningful trends, and generate professional printable reports.

## Project Structure

```
historian-reports/
├── client/                # React frontend application (CRA + Tailwind)
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── ...
│   └── package.json
├── reports/               # Generated reports output directory
├── scripts/               # Utility scripts (setup, testing)
├── src/                   # Backend source code
│   ├── server.ts          # Main application entry point
│   ├── dev-server.ts      # Mock server for development
│   ├── config/            # Configuration files
│   ├── middleware/        # Express middleware
│   ├── routes/            # API Route definitions
│   │   ├── auth.ts        # Authentication
│   │   ├── reports.ts     # Reports
│   │   └── ...
│   ├── services/          # Business logic services
│   │   ├── authService.ts     # Auth & JWT
│   │   ├── dataRetrieval.ts   # Historian Data
│   │   ├── reportGeneration.ts # PDF Generation
│   │   ├── schedulerService.ts # Cron Jobs
│   │   └── ...
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
├── tests/                 # Test files
│   └── properties/        # Property-based tests
├── Dockerfile             # Container build configuration
├── docker-compose.yml     # Multi-container orchestration
├── package.json           # Project dependencies
└── tsconfig.json          # TypeScript configuration
```

## Essential Commands

### Development
```bash
# Start backend development server
npm run dev

# Start backend with mock data
npm run dev:mock

# Start full stack (Backend + Frontend)
npm run start:dev

# Run database setup scripts
npm run setup:db
```

### Build & Production
```bash
# Build backend
npm run build

# Build frontend
npm run build:client

# Build everything
npm run build:all

# Start production server
npm start
```

### Docker
```bash
# Build Docker image
npm run docker:build

# Run with Docker Compose
npm run docker:dev
```

## Code Organization and Structure

### Architecture Pattern
The project follows a modular Service-Oriented Architecture (SOA) within a monolith:

1.  **Frontend**: React application in `client/` communicating via REST API.
2.  **API Layer**: Express routes in `src/routes/` delegating to services.
3.  **Services Layer**: Business logic in `src/services/` handling core functionality.
4.  **Data Layer**: Direct SQL connections to AVEVA Historian and local storage.

### Key Services and Responsibilities

-   **DataRetrievalService**: Interfaces with AVEVA Historian for time-series data.
-   **StatisticalAnalysisService**: Processes raw data into insights.
-   **AuthService**: Handles JWT authentication and user management.
-   **SchedulerService**: Manages automated report schedules with cron jobs.
-   **ReportGeneration**: Orchestrates document creation (PDF/DOCX).
-   **EmailService**: Handles report delivery via SMTP.
-   **DatabaseConfigService**: Manages dynamic database connection settings.
-   **EncryptionService**: Secures sensitive credentials.

### Middleware and Error Handling

-   **auth.ts**: Verifies JWT tokens and permissions.
-   **errorHandler.ts**: Centralized error interceptor.
-   **requestLogger.ts**: structured logging for all incoming requests.

### Data Flow
1.  React Client makes API request.
2.  Middleware validates auth token and inputs.
3.  Routes dispatch to appropriate `Service`.
4.  Service performs business logic (e.g., query Historian, generate PDF).
5.  Results are returned to client or emailed.

## Naming Conventions and Style Patterns

### TypeScript Naming
- Services end with `Service` (e.g., `DataRetrievalService`)
- Interfaces and types start with capital letters (e.g., `TimeSeriesData`, `TagInfo`)
- Constants are in UPPER_SNAKE_CASE (e.g., `QualityCode.Good`)
- Variables and functions use camelCase (e.g., `validateTimeRange`, `getTimeSeriesData`)

### Import Aliasing
- Use `@/` prefix for imports from the src directory (e.g., `@/config/environment`, `@/types/historian`)
- Specific aliases are configured in tsconfig.json: `@/*`, `@/types/*`, `@/utils/*`, `@/services/*`, `@/middleware/*`

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
2. **Property-Based Tests**: Extensive validation using fast-check (25+ suites) in `tests/properties/`.
   - **Critical Domains**:
     - `anomaly-detection`: Statistical outlier finding.
     - `concurrent-handling`: Race condition checks.
     - `schedule-execution`: Timer and job logic.
     - `memory-management`: Resource usage simulation.
     - `security-encryption`: Crypto correctness.
   - **Core Logic**:
     - `data-filtering`, `time-range-retrieval`, `statistical-calculations`.
   - **Infrastructure**:
     - `database-config`, `email-delivery`, `connection-testing`.

### Test Configuration
- Uses Jest as the test framework
- TypeScript support through ts-jest
- Property-based testing with FastCheck for robust validation
- Test setup in `tests/setup.ts` with environment configuration

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
5. In case of connection failure, the system will retry up to unlimited times with a 30-second delay between each attempt showing the remaining seconds before the next attempt.

### Report Generation
The system supports:
1. Printable report creation (PDF, DOCX)
2. Customizable report templates
3. Data visualization capabilities
4. Professional formatting and styling
6. Typed date and time inputs with post validation for precise window selection
5. Report preview after submit and before generation.
7. Validation happens after the user submit the query. The user should be free to type freely as long is a number.
8. Validation to ensure start date/time is not greater than end date/time.
9. Default end time is the current time.
10. Default start time is current time minus 1 hour.
11. Duration display showing the time difference between start and end dates

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