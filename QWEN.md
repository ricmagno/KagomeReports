# Historian Reports Application - Context Guide

## Project Overview

Historian Reports is a professional reporting application designed to generate printable reports and trends from the AVEVA Historian database. The system connects directly to the AVEVA Historian database via SQL to extract historical data, process it into meaningful trends, and generate professional printable reports.

### Key Features
- **Direct SQL connectivity** to AVEVA Historian database (no APIs required)
- **Time-series data extraction** with various filtering and sampling options
- **Statistical analysis** and trend identification
- **Report generation** in various formats (PDF, DOCX, etc.)
- **Scheduled report generation** with multiple interval options
- **Email delivery capabilities** for automated report distribution

### Architecture
- **Backend**: Node.js/TypeScript with Express.js
- **Database**: Direct connection to AVEVA Historian (Microsoft SQL Server)
- **Frontend**: Planned React.js or Vue.js interface
- **Reporting**: PDF generation using PDFKit
- **Authentication**: JWT-based authentication
- **Scheduling**: node-cron for automated report generation

## Technologies Used

### Runtime Dependencies
- `express`: Web framework
- `mssql`: Microsoft SQL Server client for AVEVA Historian connectivity
- `pdfkit`: PDF generation
- `node-cron`: Scheduling for automated reports
- `jsonwebtoken`: JWT-based authentication
- `zod`: Runtime validation
- `winston`: Logging
- `dotenv`: Environment variable management
- `helmet`, `cors`, `compression`: Security and performance middleware

### Development Dependencies
- `typescript`: Type checking
- `tsx`: TypeScript execution
- `jest`, `ts-jest`: Testing framework
- `@types/*`: TypeScript definitions
- `eslint`: Code linting

## Project Structure

```
src/
├── server.ts                 # Main application entry point
├── config/
│   ├── environment.ts        # Environment validation with Zod
│   └── database.ts           # Database connection configuration
├── middleware/
│   ├── errorHandler.ts       # Global error handling
│   └── requestLogger.ts      # Request logging middleware
├── services/
│   ├── dataRetrieval.ts      # Time-series data retrieval
│   ├── dataFiltering.ts      # Data filtering operations
│   ├── historianConnection.ts # AVEVA Historian connection management
│   └── statisticalAnalysis.ts # Statistical analysis functions
├── types/
│   └── historian.ts          # Type definitions for AVEVA Historian
├── utils/
│   ├── logger.ts             # Logging utilities with Winston
│   └── retryHandler.ts       # Retry logic with exponential backoff
```

## Building and Running

### Prerequisites
- Node.js >= 18.0.0
- Access to AVEVA Historian database (Microsoft SQL Server)

### Setup Instructions

1. **Install dependencies**:
```bash
npm install
```

2. **Configure environment variables**:
Copy `.env.example` to `.env` and update with your database credentials:
```bash
cp .env.example .env
```

3. **Build the application**:
```bash
npm run build
```

4. **Run the application**:
```bash
# Development mode with auto-reload
npm run dev

# Production build and start
npm run build && npm start
```

### Docker Deployment

The application supports Docker deployment:

```bash
# Build and run with Docker Compose
docker-compose up --build

# Or build multi-platform Docker image
npm run docker:build
```

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Start production server
- `npm run test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint
- `npm run docker:dev` - Start with Docker Compose

## Configuration

### Environment Variables

The application uses extensive environment configuration validated with Zod:

#### Database Configuration
- `DB_HOST`: Database server hostname
- `DB_PORT`: Database port (default: 1433)
- `DB_NAME`: Database name (default: Runtime)
- `DB_USER`: Database username
- `DB_PASSWORD`: Database password
- `DB_ENCRYPT`: Enable encryption (default: true)
- `DB_TRUST_SERVER_CERTIFICATE`: Trust server certificate (default: false)

#### Application Configuration
- `NODE_ENV`: Environment (development/production/test)
- `PORT`: HTTP server port (default: 3000)
- `JWT_SECRET`: Secret for JWT signing (min 32 chars)
- `BCRYPT_ROUNDS`: Password hashing rounds (default: 12)

#### Email Configuration
- `SMTP_HOST`: SMTP server hostname
- `SMTP_PORT`: SMTP port (default: 587)
- `SMTP_USER`: SMTP username
- `SMTP_PASSWORD`: SMTP password

#### Report Configuration
- `REPORTS_DIR`: Directory for generated reports (default: ./reports)
- `TEMP_DIR`: Temporary files directory (default: ./temp)
- `MAX_REPORT_SIZE_MB`: Maximum report size in MB (default: 50)

#### Performance Configuration
- `DB_POOL_MIN`: Minimum database connections (default: 2)
- `DB_POOL_MAX`: Maximum database connections (default: 10)
- `DB_TIMEOUT_MS`: Database timeout in milliseconds (default: 30000)

## Development Conventions

### Code Style
- TypeScript with strict mode enabled
- ESLint for code linting
- Import aliasing with `@/` prefix (e.g., `@/config/environment`)
- Consistent error handling with custom error types
- Comprehensive logging with Winston

### Testing
- Jest for unit testing
- Property-based testing with fast-check
- Test files named with `.test.ts` or `.spec.ts` suffix
- Environment-specific test configuration

### Error Handling
- Centralized error handling middleware
- Operational vs. programming errors distinction
- Detailed error logging with context
- Client-friendly error responses

### Logging
- Structured logging with Winston
- Different loggers for different components (database, API, reports, etc.)
- Environment-aware log levels
- File rotation for production logs

### Database Operations
- Connection pooling with configurable limits
- Retry logic with exponential backoff for transient failures
- Input validation and parameterized queries
- Quality code handling for AVEVA Historian data

## Key Services

### HistorianConnection
Manages database connections to AVEVA Historian with retry logic and connection validation.

### DataRetrievalService
Handles time-series data queries, tag information retrieval, and data filtering with multiple retrieval modes (Cyclic, Delta, Full, BestFit).

### Statistical Analysis
Provides statistical calculations and trend analysis for time-series data.

### Report Generation
Generates printable reports in various formats with customizable templates.

## API Endpoints

- `GET /health` - Health check endpoint
- `POST /api/login` - Authentication (planned)
- `/api/reports` - Report generation endpoints (planned)
- `/api/tags` - Tag information endpoints (planned)
- `/api/data` - Data retrieval endpoints (planned)

## Security Considerations

- Helmet.js for security headers
- Rate limiting (planned)
- Input validation with Zod
- Parameterized queries to prevent SQL injection
- JWT-based authentication (planned)
- Secure password hashing with bcrypt

## Future Enhancements

- Advanced analytics and forecasting
- Machine learning for anomaly detection
- Real-time data visualization
- Mobile application support
- Integration with other industrial IoT platforms
- Enhanced report templates and customization options