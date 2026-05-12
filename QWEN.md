# Historian Reports Application - Context Guide

## Project Overview

**Historian Reports** (also known as **KagomeReports**) is a professional reporting application designed to generate printable reports and trends from the AVEVA Historian database. The system connects directly to the AVEVA Historian database via SQL to extract historical data, process it into meaningful trends, and generate professional printable reports.

### 🤖 AI-First Development
This repository is optimized for AI coding agents. Key documentation:
- **[AGENTS.md](./AGENTS.md)**: Coding conventions and architectural guardrails
- **[MEMORY.md](./MEMORY.md)**: Permanent project knowledge and learned technical behaviors
- **[CONTRIBUTING.md](./CONTRIBUTING.md)**: Workflow guidelines for the team
- **[spec/](./spec/)**: Authoritative specifications (deployment, API, database, use-cases)

### Core Features
- **Direct SQL connectivity** to AVEVA Historian database (no APIs required)
- **OPC UA integration** for additional data sources (tags starting with `opc.`)
- **Time-series data extraction** with various filtering and sampling options
- **Statistical analysis** and trend identification
- **Report generation** in PDF format with customizable templates
- **Dashboard management** with configurable widgets
- **Scheduled report generation** with multiple interval options
- **Email/SMS delivery capabilities** for automated report distribution
- **Auto-update system** with GitHub release integration
- **User management** with JWT-based authentication
- **Alert management** for threshold-based notifications

### Architecture
- **Backend**: Node.js/TypeScript with Express.js
- **Frontend**: React.js with Tailwind CSS
- **Desktop**: Electron (cross-platform: Windows, macOS)
- **Database**: AVEVA Historian (Microsoft SQL Server) + SQLite (config)
- **Caching**: Redis (optional)
- **Reporting**: PDFKit for PDF generation
- **Scheduling**: node-cron for automated report generation
- **Deployment**: Docker (multi-arch), Kubernetes (production with autodeploy)

---

## Technologies Used

### Runtime Dependencies

| Package | Purpose |
|---------|---------|
| `express` | Web framework |
| `mssql` | Microsoft SQL Server client for AVEVA Historian |
| `node-opcua` | OPC UA client for industrial data sources |
| `pdfkit` | PDF generation |
| `node-cron` | Scheduling for automated reports |
| `jsonwebtoken` | JWT-based authentication |
| `bcrypt` | Password hashing |
| `zod` | Runtime validation |
| `winston` | Logging |
| `redis` | Caching layer |
| `sqlite3` | Local configuration storage |
| `nodemailer` | Email delivery |
| `chart.js`, `apexcharts` | Data visualization |
| `handlebars` | Report templates |
| `canvas` | Chart rendering for PDFs |

### Development Dependencies

| Package | Purpose |
|---------|---------|
| `typescript` | Type checking |
| `tsx` | TypeScript execution |
| `jest`, `ts-jest` | Testing framework |
| `fast-check` | Property-based testing |
| `electron`, `electron-builder` | Desktop app packaging |
| `concurrently` | Run multiple commands |
| `eslint` | Code linting |

---

## Project Structure

```
KagomeReports/
├── spec/                       # Authoritative specifications
│   ├── deployment.md           # Docker & K8s architecture
│   ├── api-spec.md             # API endpoint definitions
│   ├── db-schema.md            # Database schema
│   └── use-cases.md            # User flows and requirements
├── src/
│   ├── server.ts               # Main application entry point
│   ├── dev-server.ts           # Development server
│   ├── config/
│   │   ├── environment.ts      # Environment validation with Zod
│   │   └── systemTags.ts       # System tag definitions
│   ├── middleware/
│   │   ├── errorHandler.ts     # Global error handling
│   │   └── requestLogger.ts    # Request logging middleware
│   ├── routes/
│   │   ├── index.ts            # Main router aggregation
│   │   ├── data.ts             # Data retrieval endpoints
│   │   ├── reports.ts          # Report generation endpoints
│   │   ├── dashboards.ts       # Dashboard management
│   │   ├── schedules.ts        # Scheduling endpoints
│   │   ├── auth.ts             # Authentication endpoints
│   │   ├── users.ts            # User management
│   │   ├── opcua.ts            # OPC UA configuration
│   │   └── ...                 # Other route modules
│   ├── services/               # Business logic layer
│   │   ├── historianConnection.ts  # AVEVA Historian connection
│   │   ├── opcuaService.ts     # OPC UA client service
│   │   ├── dataRetrieval.ts    # Time-series data retrieval
│   │   ├── dataFiltering.ts    # Data filtering operations
│   │   ├── statisticalAnalysis.ts  # Statistical analysis
│   │   ├── reportGeneration.ts # PDF report generation
│   │   ├── schedulerService.ts # Cron-based scheduling
│   │   ├── emailService.ts     # Email delivery
│   │   ├── authService.ts      # Authentication logic
│   │   ├── userManagementService.ts
│   │   ├── dashboardManagementService.ts
│   │   ├── cacheManager.ts     # Redis cache management
│   │   ├── versionManager.ts   # Version tracking
│   │   ├── updateChecker.ts    # Auto-update system
│   │   └── ...                 # Other services
│   ├── types/                  # TypeScript type definitions
│   ├── utils/
│   │   ├── logger.ts           # Winston logging utilities
│   │   └── retryHandler.ts     # Retry logic with exponential backoff
│   └── electron/               # Electron-specific code
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/         # UI components
│   │   ├── pages/              # Page components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── services/           # API client services
│   │   └── utils/              # Frontend utilities
│   ├── public/
│   └── package.json
├── Kubernetes/                 # Kubernetes deployment manifests
│   ├── autodeploy/             # Auto-deploy watchdog scripts
│   ├── historian-reports-*.yaml # K8s manifests
│   └── README.md
├── Docs/                       # Additional documentation
│   ├── KUBERNETES_SETUP_INSTRUCTIONS.md
│   ├── HTTPS_SETUP_GUIDE.md
│   └── ...
├── templates/                  # Report templates (Handlebars)
├── data/                       # SQLite database files
├── reports/                    # Generated PDF reports
├── logs/                       # Application logs
├── scripts/                    # Build and utility scripts
├── assets/                     # Static assets (icons, signing certs)
└── tests/                      # Test files
```

---

## Building and Running

### Prerequisites
- **Node.js**: >= 18.0.0
- **Database**: Microsoft SQL Server (AVEVA Historian)
- **Optional**: Redis for caching
- **For Electron builds**:
  - Windows: Wine + Mono (for cross-compilation from macOS)
  - macOS: Xcode command line tools

### Setup Instructions

1. **Install dependencies**:
```bash
npm install
cd client && npm install && cd ..
```

2. **Configure environment variables**:
```bash
cp .env.example .env
# Edit .env with your database credentials and secrets
```

3. **Build the application**:
```bash
npm run build          # Backend
npm run build:client   # Frontend
npm run build:all      # Both + Electron
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend in development mode |
| `npm run dev:mock` | Start backend with mock data |
| `npm run start:dev` | Run full stack (backend + frontend) |
| `npm run start` | Start production server |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run build:client` | Build React frontend |
| `npm run build:all` | Build backend + client + Electron |
| `npm run test` | Run Jest unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:property` | Run property-based tests |
| `npm run lint` | Run ESLint |
| `npm run electron:dev` | Run Electron app in development |
| `npm run electron:build:win` | Build Windows installer |
| `npm run electron:build:mac` | Build macOS installer |
| `npm run docker:build` | Build Docker image (multi-arch: AMD64 & ARM64) |
| `npm run docker:dev` | Start with Docker Compose |
| `./release.sh <version>` | Create release and trigger auto-deployment |

---

## Deployment

### Docker Deployment

#### Docker Compose (Development & Testing)

```bash
# Build and run with Docker Compose
docker-compose up --build

# Access application at http://localhost:3000
```

The Docker setup includes:
- Multi-stage build for optimized image size
- Redis cache service
- Persistent volumes for logs, reports, and data
- Health checks
- Non-root user for security

#### Dockerfile Architecture

The multi-stage Dockerfile (`/Dockerfile`) is optimized for security and multi-architecture builds:

| Stage | Purpose |
|-------|---------|
| `base` | Node.js 20 bookworm with system dependencies for canvas |
| `backend-builder` | Compiles TypeScript backend |
| `client-builder` | Builds React frontend |
| `prod-deps` | Prepares production-only node_modules |
| `production` | Final lightweight image with non-root `historian` user |

**Key Features:**
- Multi-architecture support (AMD64 & ARM64)
- Runs as non-root user (UID 1001) for security
- Health check endpoint configured
- Environment variable: `IS_DOCKER=true` for container-specific logic

---

### Kubernetes Deployment (Production)

> **Authoritative Source**: For complete deployment specifications, see [`spec/deployment.md`](./spec/deployment.md) and [`Docs/KUBERNETES_SETUP_INSTRUCTIONS.md`](./Docs/KUBERNETES_SETUP_INSTRUCTIONS.md).

#### Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   GitHub        │     │   GHCR           │     │   Kubernetes        │
│   (Release Tag) │────▶│   (Docker Image) │────▶│   Cluster           │
└─────────────────┘     └──────────────────┘     │   ┌─────────────┐   │
                                                 │   │  Watchdog   │   │
                                                 │   │  (systemd)  │   │
                                                 │   └──────┬──────┘   │
                                                 │          │          │
                                                 │          ▼          │
                                                 │   ┌─────────────┐   │
                                                 │   │  Auto-      │   │
                                                 │   │  Deploy     │   │
                                                 │   └─────────────┘   │
                                                 └─────────────────────┘
```

#### Core Kubernetes Components

| Component | File | Description |
|-----------|------|-------------|
| Namespace | `historian-reports-namespace.yaml` | Isolates all resources |
| Deployment | `historian-reports-deployment.yaml` | Application pods (1+ replicas) |
| HPA | `historian-reports-hpa.yaml` | Auto-scaling (2-10 replicas based on CPU/memory) |
| Service | `historian-reports-service.yaml` | ClusterIP service on port 3000 |
| Ingress | `historian-reports-ingress.yaml` | Traefik ingress with TLS |
| Secrets | `historian-reports-secret.yaml` | Database credentials and sensitive config |

#### Deployment Steps

1. **Create Namespace**:
```bash
kubectl apply -f Kubernetes/historian-reports-namespace.yaml
```

2. **Configure GHCR Access** (imagePullSecret):
```bash
kubectl create secret docker-registry ghcr-regcred \
  --docker-server=ghcr.io \
  --docker-username=ricmagno \
  --docker-password=<YOUR_GITHUB_PAT> \
  --docker-email=ricmagno@gmail.com \
  -n historian-reports
```

3. **Apply Secrets** (update values first):
```bash
kubectl apply -f Kubernetes/historian-reports-secret.yaml
```

4. **Deploy Application**:
```bash
kubectl apply -f Kubernetes/historian-reports-deployment.yaml
kubectl apply -f Kubernetes/historian-reports-service.yaml
kubectl apply -f Kubernetes/historian-reports-hpa.yaml
kubectl apply -f Kubernetes/historian-reports-ingress.yaml
```

#### Autodeploy Watchdog (Pull-Based CD)

The system uses a **pull-based continuous deployment** mechanism. A systemd timer on the host server polls GitHub every 5 minutes and automatically updates the cluster when a new release is detected.

**Component**: `Kubernetes/autodeploy/autodeploy.sh`

**How it Works**:
1. Reads current image tag from Kubernetes deployment
2. Queries GitHub API for latest release tag
3. If versions differ, runs `kubectl set image` to trigger rolling update
4. Waits for rollout completion

**Installation on SCADA Server**:
```bash
# 1. Copy autodeploy files to server
scp -r Kubernetes/autodeploy user@your-server:~/

# 2. Install script to system path
sudo cp ~/autodeploy/autodeploy.sh /usr/local/bin/autodeploy.sh
sudo chmod +x /usr/local/bin/autodeploy.sh

# 3. Install systemd service and timer
sudo cp ~/autodeploy/historian-autodeploy.* /etc/systemd/system/

# 4. Enable and start
sudo systemctl daemon-reload
sudo systemctl enable --now historian-autodeploy.timer
```

**Monitoring**:
```bash
# Check timer status
systemctl status historian-autodeploy.timer

# View logs
journalctl -u historian-autodeploy.service
```

#### Release Workflow

The complete release and deployment pipeline:

```
1. Run: ./release.sh 1.2.21
       │
       ▼
2. Updates: package.json, Dockerfile, K8s manifest
       │
       ▼
3. Commits & pushes to main + creates git tag
       │
       ▼
4. GitHub Actions builds & pushes image to GHCR
       │
       ▼
5. Watchdog detects new version (within 5 min)
       │
       ▼
6. Kubernetes auto-updates via kubectl set image
```

**To Release**:
```bash
# On your local Mac
./release.sh 1.2.21

# Wait ~5 minutes for GitHub Actions + watchdog
# Deployment happens automatically - no manual K8s commands needed
```

#### Environment Variables (Containerized)

| Variable | Purpose |
|----------|---------|
| `IS_DOCKER=true` | Enables container-specific logic |
| `DATA_DIR` | Path to persistent data volume |
| `REPORTS_DIR` | Path to reports volume |
| `LOG_FILE` | Path to log file |
| `TZ` | Timezone (default: Australia/Sydney) |

#### Persistent Volumes

The deployment uses `hostPath` volumes mounted to `/mnt/historian`:

| Mount Path | Purpose |
|------------|---------|
| `/home/historian/data` | SQLite databases, configuration |
| `/home/historian/reports` | Generated PDF reports |
| `/home/historian/logs` | Application logs |
| `/etc/localtime`, `/etc/timezone` | Timezone sync (read-only) |

---

## Configuration

### Environment Variables

#### Database Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | - | Database server hostname |
| `DB_PORT` | 1433 | Database port |
| `DB_NAME` | Runtime | Database name |
| `DB_USER` | - | Database username |
| `DB_PASSWORD` | - | Database password |
| `DB_ENCRYPT` | true | Enable encryption |
| `DB_TRUST_SERVER_CERTIFICATE` | false | Trust server certificate |

#### Application Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | development | Environment (development/production) |
| `PORT` | 3000 | HTTP server port |
| `JWT_SECRET` | - | Secret for JWT signing (min 32 chars) |
| `BCRYPT_ROUNDS` | 12 | Password hashing rounds |

#### Email Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST` | smtp.gmail.com | SMTP server hostname |
| `SMTP_PORT` | 587 | SMTP port |
| `SMTP_SECURE` | false | Use TLS |
| `SMTP_USER` | - | SMTP username |
| `SMTP_PASSWORD` | - | SMTP password |

#### Caching Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `CACHE_ENABLED` | false | Enable Redis caching |
| `REDIS_HOST` | localhost | Redis server hostname |
| `REDIS_PORT` | 6379 | Redis port |
| `CACHE_DEFAULT_TTL` | 300 | Default cache TTL (seconds) |

#### Performance Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `DB_POOL_MIN` | 2 | Minimum DB connections |
| `DB_POOL_MAX` | 10 | Maximum DB connections |
| `DB_TIMEOUT_MS` | 30000 | Database timeout (ms) |
| `MAX_CONCURRENT_REPORTS` | 5 | Max parallel report generation |

#### Security Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGIN` | http://localhost:3001 | Allowed CORS origin |
| `SESSION_TIMEOUT_HOURS` | 24 | JWT session timeout |
| `RATE_LIMIT_WINDOW_MS` | 900000 | Rate limit window (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | 100 | Max requests per window |

---

## Development Conventions

### Code Style
- **TypeScript**: Strict mode enabled
- **Import aliasing**: `@/` prefix for src directory (e.g., `@/services/historianConnection`)
- **Naming conventions**:
  - Services: `CamelCaseService.ts`
  - Utils: `camelCase.ts`
- **Error handling**: Centralized via `errorHandler` middleware
- **Logging**: Use `logger` from `@/utils/logger` with appropriate levels

### Testing Practices
- **Unit tests**: Jest with `ts-jest`
- **Property-based testing**: fast-check for critical logic
- **Test files**: Named with `.test.ts` or `.spec.ts` suffix, or in `__tests__` directories
- **Coverage**: Reports generated in `coverage/` directory

### Error Handling
- Use central `errorHandler` middleware
- Provide descriptive error messages for external services (OPC UA, Historian)
- Use `RetryHandler.executeWithRetry` for network-bound operations
- Distinguish between operational and programming errors

### Logging
- Structured logging with Winston
- Environment-aware log levels
- File rotation for production logs
- Separate loggers for different components

### Database Operations
- Connection pooling with configurable limits
- Retry logic with exponential backoff for transient failures
- Parameterized queries to prevent SQL injection
- Quality code handling for AVEVA Historian data

---

## Key Services

### HistorianConnection
Manages SQL Server connections to AVEVA Historian with:
- Connection pooling
- Retry logic
- Connection validation

### OpcuaService
OPC UA client for industrial data sources:
- Automatic endpoint discovery
- Retry strategy for connections
- Support for `SignAndEncrypt` security mode
- Username format: `.\username` or `DOMAIN\username`

### DataRetrievalService
Handles time-series data queries:
- Tag-based routing (opc.* → OPC UA, others → Historian)
- Multiple retrieval modes (Cyclic, Delta, Full, BestFit)
- High-resolution trending support

### ReportGeneration
PDF report creation with:
- Handlebars templates
- Chart.js integration
- Customizable layouts

### SchedulerService
Cron-based automation:
- Hourly, 6h, 8h, 12h, daily, weekly, monthly intervals
- Email/SMS delivery
- Error recovery

### CacheManager
Redis caching layer:
- Configurable TTL
- Cache key prefixing
- Health check support

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /api` | API info |
| `POST /api/auth/login` | User authentication |
| `GET /api/data` | Time-series data retrieval |
| `GET /api/reports` | Report generation |
| `GET /api/dashboards` | Dashboard management |
| `POST /api/schedules` | Schedule management |
| `GET /api/users` | User management |
| `GET /api/opcua` | OPC UA configuration |
| `GET /api/status` | System status |
| `GET /api/cache` | Cache management |
| `GET /api/updates` | Auto-update system |
| `GET /api/configuration` | Configuration management |
| `GET /api/alerts` | Alert management |

---

## Security Considerations

- Helmet.js for security headers
- Rate limiting with `express-rate-limit`
- Input validation with Zod and express-validator
- Parameterized queries to prevent SQL injection
- JWT-based authentication
- Secure password hashing with bcrypt
- CORS configuration
- Non-root Docker user
- Encryption for sensitive data at rest

---

## Specialized Knowledge

### OPC UA Integration
- **Connection Strategy**: Always use `RetryHandler` for `connect()` and `createSession()`
- **Authentication**: Industrial servers require `.\username` or `DOMAIN\username` format
- **Security**: Prefer `SignAndEncrypt` with `Basic256Sha256`
- **Endpoint Discovery**: Log discovered endpoints to diagnose `BadUserAccessDenied` errors

### Code Signing (macOS)
- Use `-legacy` flag with OpenSSL 3.x for `.p12` generation
- Add self-signed certificates to System Keychain as trusted root:
```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain build-secrets/self-signed.crt
```

### Data Retrieval Pattern
- Tags starting with `opc.` → routed to `OpcuaService`
- Other tags → routed to `HistorianConnection`
- High-resolution trending: point limits set to 1,000,000

---

## Future Enhancements

### In Progress (TODO.md)
- [ ] Fix vertical/horizontal bars on charts
- [ ] Implement Radial Gauge % widget
- [ ] Implement Value Blocks widget (variable, value, unit)
- [ ] Implement Radar Chart widget
- [ ] Fix Widget full screen functionality

### Planned
- Advanced analytics and forecasting
- Machine learning for anomaly detection
- Real-time data visualization
- Mobile application support
- Integration with other industrial IoT platforms
- Enhanced report templates

---

## Git Workflow

- **`main`**: Production-ready code
- **`develop`**: Integration branch
- **`feature/*`**: Individual features
- **`bugfix/*`**: Bug fixes
- **`OPCUA`**: Specialized OPC UA development

### Commit Convention
Simplified Conventional Commits:
- `feat`: New features
- `fix`: Bug fixes
- `chore`: Maintenance (dependencies, config)
- `docs`: Documentation updates
- `refactor`: Code changes that neither fix a bug nor add a feature

---

## Useful Commands

```bash
# Database setup
npm run setup:db

# Test database connections
npm run test:db

# View test reports
npm run test:property

# Clean build
rm -rf dist && npm run build:all

# Docker operations
docker-compose up -d
docker-compose down
docker-compose logs -f

# Kubernetes operations
kubectl get pods -n historian-reports
kubectl logs -n historian-reports -l app=historian-reports
kubectl describe deployment historian-reports -n historian-reports

# Autodeploy monitoring
systemctl status historian-autodeploy.timer
journalctl -u historian-autodeploy.service
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| **OPC UA Connection Failures** | Check endpoint security mode; try `SignAndEncrypt` |
| **Database Connection Timeout** | Increase `DB_TIMEOUT_MS` in environment |
| **PDF Generation Errors** | Verify canvas native module installation |
| **Electron Build Issues** | Check code signing certificates in `build-secrets/` |
| **Kubernetes Pod Not Starting** | Check `ghcr-regcred` secret; verify GitHub PAT has `read:packages` scope |
| **Autodeploy Not Triggering** | Check `systemctl status historian-autodeploy.timer`; verify network access to GitHub API |
| **Image Pull Errors** | Ensure image tag exists on GHCR; check `kubectl describe pod` for details |

### Logs Location

| Environment | Location |
|-------------|----------|
| Development | `logs/app.log` |
| Docker | Container stdout or mounted `./logs` volume |
| Kubernetes | `kubectl logs -n historian-reports -l app=historian-reports` |
| Autodeploy | `journalctl -u historian-autodeploy.service` |

### Deployment Documentation References

| Topic | Authoritative Source |
|-------|---------------------|
| Docker build strategy | [`spec/deployment.md`](./spec/deployment.md) |
| Kubernetes setup | [`Docs/KUBERNETES_SETUP_INSTRUCTIONS.md`](./Docs/KUBERNETES_SETUP_INSTRUCTIONS.md) |
| K8s manifest reference | [`Kubernetes/README.md`](./Kubernetes/README.md) |
| Autodeploy scripts | [`Kubernetes/autodeploy/`](./Kubernetes/autodeploy/) |
| Release process | [`release.sh`](./release.sh) |

---

## Authoritative Specifications

The `/spec` directory contains the authoritative source of truth for the project:

| File | Content |
|------|---------|
| `spec/deployment.md` | Docker and Kubernetes architecture |
| `spec/api-spec.md` | Backend endpoint definitions |
| `spec/db-schema.md` | Database table structures and relationships |
| `spec/use-cases.md` | Core user flows and requirements |

Always consult these files before making architectural or data-level changes.
