# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Historian Reports** is a full-stack reporting platform for **AVEVA (Wonderware) Historian** — an industrial time-series database. It extracts historical tag data via SQL, renders PDF reports and live dashboards, and can be deployed as a web app, Docker container, or Electron desktop app.

## Commands

### Development
```bash
npm run start:dev          # Backend (tsx watch) + React frontend concurrently
npm run dev:mock           # Backend using mock data (no real DB required)
npm run electron:dev       # Electron desktop app in dev mode
```

### Build
```bash
npm run build              # Compile backend TypeScript → dist/
npm run build:client       # Build React frontend → client/build/
npm run build:all          # Build backend + electron + frontend
npm run electron:build:win # Full Windows installer (.exe)
npm run electron:build:mac # Full macOS DMG
```

### Test & Lint
```bash
npm test                          # Run all Jest tests
npm run test:watch                # Jest in watch mode
npm run test:property             # Property-based tests only
jest --testPathPattern="<file>"   # Run a single test file
npm run lint                      # ESLint on src/**/*.ts
```

### Utilities
```bash
npm run setup:db           # Interactive DB config setup
npm run test:db            # Test database connections
```

## Architecture

### Authoritative Sources of Truth
Before any architectural or data-model change, consult `/spec/`:
- `spec/api-spec.md` — all API endpoint contracts
- `spec/db-schema.md` — SQLite config DB and Historian DB schema
- `spec/use-cases.md` — core user flows
- `spec/deployment.md` — Docker and Kubernetes specs

### Backend (`src/`)

**Entry point**: `src/server.ts` — starts Express + Socket.io, calls `validateStartupDependencies()`, mounts all route modules under `/api`.

**Layer structure**:
- `src/routes/` — thin Express routers; each file maps to one API namespace (e.g., `reports.ts`, `data.ts`). All mounted via `src/routes/index.ts`.
- `src/services/` — all business logic. Stateless classes with `CamelCaseService.ts` naming.
- `src/middleware/` — `auth.ts` (JWT), `errorHandler.ts` (central), `requestLogger.ts`, `progressTracker.ts`, `validation.ts`.
- `src/utils/` — pure helpers: `logger.ts` (winston), `retryHandler.ts`, `qualityUtils.ts`, etc.
- `src/config/environment.ts` — all env vars parsed and validated with **zod**; import `env` from here everywhere.
- `src/types/` — shared TypeScript interfaces (e.g., `historian.ts` defines `TimeSeriesData`, `TagInfo`, `ReportConfig`).

**Key services**:
- `historianConnection.ts` — singleton MS SQL connection pool to AVEVA Historian; wraps `mssql`.
- `dataRetrieval.ts` — routes tag queries: tags prefixed `opcua:` go to `opcuaService`; all others go to `historianConnection`. Handles streaming for large datasets (`STREAM_BATCH_SIZE = 1000`).
- `opcuaService.ts` — OPC UA client via `node-opcua`; always use `RetryHandler` for `connect()` and `createSession()`.
- `reportGeneration.ts` — PDF output using **PDFKit** + **Handlebars** templates + chart images from `chartGeneration.ts`.
- `chartGeneration.ts` — renders charts to PNG buffers via `canvas` + `chart.js` (server-side, no browser).
- `schedulerService.ts` — cron-based automated report delivery via `node-cron`.
- `cacheManager.ts` — optional Redis cache (disabled by default; enabled via `CACHE_ENABLED=true`).
- `authService.ts` — JWT auth backed by SQLite (`scheduler.db`).
- `alertEvalService.ts` — polls OPC UA tags every 5 seconds for threshold alerts.

**Two databases**:
1. **AVEVA Historian** (MS SQL, read-only) — external industrial DB; connection managed by `historianConnection.ts`.
2. **SQLite** (`scheduler.db`) — local config store for users, schedules, configurations, and dashboards.

**Path aliases**: `@/` maps to `src/` (configured in `tsconfig.json` and `jest.config.js`).

### Frontend (`client/src/`)

React SPA with Tailwind CSS. Feature-based component structure under `client/src/components/`:
- `reports/` — report builder, preview, category management, data table, version history.
- `dashboards/` — live dashboard editor, widget/gauge/chart components.
- `alerts/`, `schedules/`, `users/`, `configuration/` — management UIs.
- `client/src/services/api.ts` — all fetch calls to the backend; custom hooks in `client/src/hooks/`.

In production, the backend serves the built React app as static files from `client/build/`.

### Electron (`src/electron/`)
Electron main and preload scripts compiled separately with `tsconfig.electron.json`. The `electron.js` root file is the app entry point for the desktop build.

## Key Conventions

- **Error handling**: Always use `createError()` from `errorHandler.ts` to produce structured API errors. Use `RetryHandler.executeWithRetry` for all network-bound calls (DB, OPC UA).
- **Logging**: Import named loggers from `src/utils/logger.ts` (`dbLogger`, `reportLogger`, `apiLogger`, etc.). Never use `console.log`.
- **TypeScript**: Strict mode is on (`noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`). Avoid `any`.
- **Version bumps**: Bump `package.json` version before changes that affect the distributed binary.
- **OPC UA auth**: Industrial servers typically require `SignAndEncrypt` mode and `.\username` or `DOMAIN\username` format.
- **Cross-platform paths**: For Citect/PlantScada `.HST` files, use `.split(/[/\\]/).pop()` — never `path.basename` — due to embedded Windows backslashes.

## Environment Configuration

Copy `.env.example` to `.env`. Required variables include `JWT_SECRET` (≥32 chars), SMTP credentials, `CORS_ORIGIN`, and optionally `DB_SERVER`/`DB_NAME` for the Historian connection. All vars are validated at startup via `src/config/environment.ts`.

The Historian DB connection is **optional** — the server starts in degraded mode if it cannot connect, allowing development without a live AVEVA instance (`npm run dev:mock` uses mock data entirely).
