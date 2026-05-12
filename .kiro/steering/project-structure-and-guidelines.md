# Historian Reports - Project Structure & Agent Guidelines

This document provides comprehensive information about the project structure, coding conventions, architectural patterns, and technical constraints for AI agents working on the Historian Reports codebase.

## 🎯 Project Overview

**Historian Reports** is a professional reporting application designed to generate printable reports and trends from the AVEVA Historian database. The system connects directly to the AVEVA Historian database via SQL to extract historical time-series data, process it into meaningful trends, and generate professional printable reports.

### Technology Stack

**Frontend:**
- React.js with TypeScript
- Create React App (CRA) with Tailwind CSS
- Component-based architecture
- Chart.js for data visualization

**Backend:**
- Node.js with TypeScript
- Express.js for REST API
- SQL Server (AVEVA Historian)
- SQLite (Configuration storage)
- Prisma (PostgreSQL for user management)

**Desktop Application:**
- Electron for cross-platform desktop deployment
- Multi-architecture support (ARM64/AMD64)

**Build & Deployment:**
- Docker multi-stage builds
- Docker Compose for orchestration
- GitHub Actions for CI/CD

## 📁 Project Structure

```
historian-reports/
├── client/                     # React frontend application
│   ├── public/                 # Static assets
│   ├── src/
│   │   ├── components/         # React components
│   │   │   ├── ui/            # Basic UI components (Button, Input, Card, etc.)
│   │   │   ├── charts/        # Data visualization components
│   │   │   │   ├── MiniChart.tsx           # Individual tag chart
│   │   │   │   ├── MultiTrendChart.tsx     # Combined multi-tag chart
│   │   │   │   ├── InteractiveChart.tsx    # Chart with guide lines
│   │   │   │   ├── GuideLines.tsx          # Guide line container
│   │   │   │   └── GuideLine.tsx           # Individual guide line
│   │   │   ├── forms/         # Form-specific components
│   │   │   ├── layout/        # Layout components (Header, Sidebar, Dashboard)
│   │   │   ├── reports/       # Report-related components
│   │   │   ├── schedules/     # Scheduled reports components
│   │   │   ├── status/        # System status components
│   │   │   ├── users/         # User management components
│   │   │   └── configuration/ # Configuration management components
│   │   ├── pages/             # Page components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── services/          # API client services
│   │   ├── utils/             # Utility functions
│   │   ├── types/             # TypeScript type definitions
│   │   └── styles/            # Global styles and themes
│   └── package.json
│
├── src/                        # Backend source code
│   ├── server.ts              # Main application entry point
│   ├── dev-server.ts          # Mock server for development
│   ├── config/                # Configuration files
│   │   └── environment.ts     # Environment variable validation
│   ├── middleware/            # Express middleware
│   │   ├── auth.ts           # JWT authentication
│   │   ├── errorHandler.ts   # Centralized error handling
│   │   └── requestLogger.ts  # Request logging
│   ├── routes/                # API route definitions
│   │   ├── auth.ts           # Authentication endpoints
│   │   ├── reports.ts        # Report generation endpoints
│   │   ├── status.ts         # System status endpoints
│   │   ├── users.ts          # User management endpoints
│   │   ├── configuration.ts  # Configuration endpoints
│   │   ├── filesystem.ts     # File system browsing endpoints
│   │   └── health.ts         # Health check endpoints
│   ├── services/              # Business logic services
│   │   ├── authService.ts            # Authentication & JWT
│   │   ├── dataRetrieval.ts          # Historian data retrieval
│   │   ├── reportGeneration.ts       # PDF generation
│   │   ├── schedulerService.ts       # Cron job scheduling
│   │   ├── emailService.ts           # Email delivery
│   │   ├── databaseConfigService.ts  # Database configuration
│   │   ├── encryptionService.ts      # Credential encryption
│   │   ├── statisticalAnalysisService.ts # Data analysis
│   │   ├── chartGeneration.ts        # Chart generation for PDFs
│   │   ├── configurationService.ts   # Configuration management
│   │   ├── userManagementService.ts  # User CRUD operations
│   │   └── systemStatusService.ts    # System monitoring
│   ├── types/                 # TypeScript type definitions
│   │   ├── historian.ts      # Historian-specific types
│   │   ├── reports.ts        # Report-related types
│   │   └── systemStatus.ts   # System status types
│   └── utils/                 # Utility functions
│       ├── retryHandler.ts   # Network retry logic
│       └── logger.ts         # Logging utilities
│
├── reports/                   # Generated reports output directory
├── scripts/                   # Utility scripts
│   ├── setup-db.js           # Database setup
│   └── seed-initial-users.js # User seeding
├── tests/                     # Test files
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests
│   ├── properties/           # Property-based tests (25+ suites)
│   └── manual/               # Manual test scripts
├── Docs/                      # Documentation
├── .kiro/                     # Kiro AI configuration
│   ├── specs/                # Feature specifications
│   ├── steering/             # Agent steering files
│   └── hooks/                # Agent hooks
├── Dockerfile                 # Container build configuration
├── docker-compose.yml         # Multi-container orchestration
├── package.json               # Project dependencies
└── tsconfig.json              # TypeScript configuration
```

## 🏗️ Architectural Patterns

### Service-Oriented Architecture (SOA)

The project follows a modular Service-Oriented Architecture within a monolith:

1. **Frontend Layer**: React application communicating via REST API
2. **API Layer**: Express routes delegating to services
3. **Services Layer**: Business logic handling core functionality
4. **Data Layer**: Direct SQL connections to AVEVA Historian and local storage

### Key Architectural Principles

**Module Boundaries:**
- **Services Layer** (`src/services/`): Contains all business logic and data orchestration. Services should be mostly stateless and interact with databases via dedicated clients.
- **Utilities** (`src/utils/`): Pure functions and shared helpers (e.g., `retryHandler.ts`)
- **Middleware** (`src/middleware/`): Authentication, error handling, and request validation

**Data Flow:**
1. React Client makes API request
2. Middleware validates auth token and inputs
3. Routes dispatch to appropriate Service
4. Service performs business logic (e.g., query Historian, generate PDF)
5. Results are returned to client or emailed

### Chart Components Architecture

The frontend uses a modular chart component system:

**Core Components:**
- **MiniChart**: Individual tag chart with trend line and statistics
- **MultiTrendChart**: Combined view showing multiple tags
- **InteractiveChart**: Wrapper adding guide lines to charts
- **GuideLines**: Container managing all guide lines
- **GuideLine**: Individual draggable guide line

**Coordinate System:**
- Charts use SVG coordinate space with padding for axes
- Coordinate transformations convert between pixel and data space
- Utilities in `chartUtils.ts` handle conversions
- Chart bounds: `leftPad`, `rightPad`, `topPad`, `bottomPad`, `graphWidth`, `graphHeight`
- Chart scale: `xMin`, `xMax`, `yMin`, `yMax` (data value ranges)

**State Management:**
- Guide lines managed with React `useState`
- Each guide line: `id`, `type`, `position`, `color`
- Intersections calculated where guide lines cross data series
- Guide lines are session-only (not persisted)

## 🛠️ Specialized Knowledge

### AVEVA Historian Integration

The system integrates directly with AVEVA Historian database:

**Database Schema:**
- `History` table: Time-series data
- `Tag` table: Tag metadata

**Quality Codes:**
- 192 = Good
- 0 = Bad
- Other codes indicate various data quality states

**Connection Management:**
- Uses connection pool with configurable min/max settings
- Retry logic via `RetryHandler` utility
- Validates connectivity before use
- Handles reconnection gracefully
- Unlimited retry attempts with 30-second delays

**Data Retrieval:**
- Supports sampling modes: Cyclic, Delta, BestFit
- Pagination for large datasets
- Parameterized queries to prevent SQL injection
- Read-only database access enforced

### OPC UA Integration

**Connection Strategy:**
- Always use `RetryHandler` for `connect()` and `createSession()`
- Implement reconnection logic for dropped connections

**Authentication:**
- Industrial servers often require username format: `.\username` or `DOMAIN\username`
- Support for certificate-based authentication

**Security:**
- Prefer `SignAndEncrypt` with `Basic256Sha256`
- Many servers deny password-based login over `None` security mode
- Log discovered endpoints during connection for diagnostics

**Error Handling:**
- Descriptive error messages for network dependencies
- Handle `BadUserAccessDenied` errors gracefully

### Report Generation

**Supported Formats:**
- PDF (primary format)
- DOCX (secondary format)

**Features:**
- Customizable report templates
- Data visualization with charts
- Professional formatting and styling
- Tag selection with autocomplete
- Date/time inputs with validation
- Report preview before generation
- Version tracking for saved reports

**Report Preview Sections:**
1. **Trends Section**: Interactive line charts with guide lines
2. **Data Preview Section**: Tabular data with pagination

### Directory Browser & File System

**DirectoryBrowser Component:**
- Browse file system for report destinations
- Two base types: 'home' (user home) or 'reports' (reports directory)
- Returns paths relative to base directory
- Create new directories functionality

**File System API:**
- `/api/filesystem/browse`: Directory browsing
- `/api/filesystem/create-directory`: Directory creation
- `/api/filesystem/validate-path`: Path validation
- Security measures to stay within allowed directories

### Automation Features

**Scheduled Reports:**
- Intervals: Hourly, 6h, 8h, 12h, Daily, Weekly, Monthly
- Email delivery via SMTP
- Cron-based scheduling

## 📜 Coding Conventions

### TypeScript Style

**Strict Typing:**
- Use TypeScript strict mode
- Avoid `any` unless absolutely necessary (e.g., complex `node-opcua` objects)
- Define interfaces for all data structures

**Naming Conventions:**
- Services: `CamelCaseService.ts` (e.g., `DataRetrievalService`)
- Interfaces/Types: PascalCase (e.g., `TimeSeriesData`, `TagInfo`)
- Constants: UPPER_SNAKE_CASE (e.g., `QualityCode.Good`)
- Variables/Functions: camelCase (e.g., `validateTimeRange`, `getTimeSeriesData`)
- Utils: `camelCase.ts`

**Import Aliasing:**
- Use `@/` prefix for imports from src directory
- Examples: `@/config/environment`, `@/types/historian`
- Configured in `tsconfig.json`: `@/*`, `@/types/*`, `@/utils/*`, `@/services/*`

### React Conventions

**Component Structure:**
- Feature-based organization in `client/src/components/`
- Functional components with hooks
- Use `shadcn/ui` components or Tailwind patterns

**Component Patterns:**
```typescript
interface ComponentProps {
  variant: 'primary' | 'secondary'
  size: 'sm' | 'md' | 'lg'
  disabled?: boolean
  children: React.ReactNode
  onClick?: () => void
}

export const Component: React.FC<ComponentProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  children,
  onClick
}) => {
  // Implementation
}
```

### Database & SQL Patterns

**Query Safety:**
- Use parameterized queries to prevent SQL injection
- Named parameters: `@tagName`, `@startTime`, etc.

**Connection Handling:**
- Connection pooling for resource management
- Retry logic for transient failures
- Graceful error handling

### Error Handling

**Centralized Error Handling:**
- Use `errorHandler` middleware
- Provide descriptive error messages
- Use `RetryHandler.executeWithRetry` for network operations

**Error Types:**
- Operational errors: Database connection issues, network failures
- Validation errors: User input validation failures
- Programming errors: Bugs in code logic

### Logging Patterns

**Structured Logging:**
- Service-specific loggers with context
- Log levels: error, warn, info, debug
- Include relevant metadata for debugging

**Logger Examples:**
```typescript
const logger = createLogger('ServiceName');
logger.info('Operation started', { userId, operation });
logger.error('Operation failed', { error, context });
```

## 🧪 Testing Approach

### Test Types

**Unit Tests** (`tests/unit/`):
- Individual function or service testing
- Mock external dependencies
- Fast execution

**Integration Tests** (`tests/integration/`):
- Test service interactions
- Database integration
- API endpoint testing

**Property-Based Tests** (`tests/properties/`):
- 25+ test suites using fast-check
- Critical domains: anomaly detection, concurrent handling, schedule execution
- Core logic: data filtering, time-range retrieval, statistical calculations
- Infrastructure: database config, email delivery, connection testing

**Manual Tests** (`tests/manual/`):
- Manual verification scripts
- UI testing scenarios

### Test Configuration

- Framework: Jest
- TypeScript support: ts-jest
- Property-based testing: FastCheck
- Setup: `tests/setup.ts`

### Test Coverage Strategy

- All major services and methods
- Edge cases via property-based tests
- Database connection handling with retries
- Error conditions and validation failures

## 🔒 Security Best Practices

### Environment Configuration

**Validation:**
- Strict Zod schemas for environment variables
- Sensible defaults where appropriate
- Minimum security requirements enforced

**Categories:**
- Database configuration
- Application settings
- Email/SMTP settings
- Report generation settings
- Performance tuning
- Security parameters

### Authentication & Authorization

**JWT-based Authentication:**
- Token validation middleware
- User role management
- Session timeout configuration

**Database Security:**
- Read-only access enforced
- Parameterized queries only
- Connection credential encryption

### Data Protection

**Encryption:**
- Sensitive credentials encrypted at rest
- Secure credential storage
- Environment variable protection

## 🚀 Development Workflow

### Essential Commands

**Development:**
```bash
npm run dev              # Start backend dev server
npm run dev:mock         # Start with mock data
npm run start:dev        # Start full stack (backend + frontend)
npm run setup:db         # Run database setup
```

**Build & Production:**
```bash
npm run build            # Build backend
npm run build:client     # Build frontend
npm run build:all        # Build everything
npm start                # Start production server
```

**Docker:**
```bash
npm run docker:build     # Build Docker image
npm run docker:dev       # Run with Docker Compose
```

**Testing:**
```bash
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:property    # Run property-based tests
```

### Code Signing (macOS)

**OpenSSL Legacy:**
- Use `-legacy` flag in OpenSSL 3.x for `.p12` certificates
- Ensures compatibility with macOS `security` tool

**Trust Requirements:**
```bash
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain \
  build-secrets/self-signed.crt
```

## 📋 Important Gotchas

### Performance Considerations

1. **Time-series Data**: Use sampling modes for large datasets
2. **Pagination**: Implement for filtered data retrieval
3. **Connection Pooling**: Manage database resources efficiently
4. **Chart Rendering**:
   - Memoize coordinate transformations
   - Throttle mouse move events (~60fps)
   - Debounce intersection calculations
   - Limit maximum guide lines

### Configuration Management

1. **Environment Variables**: Validated with Zod schemas
2. **Default Values**: Sensible defaults provided
3. **Security**: Minimum requirements enforced (e.g., JWT secret length)

### Docker & Deployment

1. **Multi-architecture**: Support for AMD64 and ARM64
2. **Health Checks**: Proper health check endpoints
3. **Environment Injection**: Secure credential handling

## ✅ Definition of Done

When implementing features, ensure:

1. **Code Quality**:
   - Follows these conventions
   - TypeScript strict mode compliance
   - Proper error handling and logging

2. **Testing**:
   - Unit tests for new services
   - Integration tests for API endpoints
   - Property-based tests for critical logic

3. **Documentation**:
   - Update relevant documentation
   - Add inline code comments
   - Update API documentation if needed

4. **Version Management**:
   - Bump version in `package.json` if affecting released binary
   - Update `MEMORY.md` with significant technical learnings

5. **Security**:
   - Follow security best practices
   - Validate all inputs
   - Use parameterized queries
   - Encrypt sensitive data

## 🔗 Related Documentation

- **AGENTS.md**: Core agent guidelines (root directory)
- **design-system.md**: UI/UX design system rules
- **API.md**: API endpoint documentation
- **Docs/**: Additional project documentation
- **.kiro/specs/**: Feature specifications

---

This document should be consulted before making any significant changes to the codebase. It represents the collective knowledge and best practices for the Historian Reports project.
