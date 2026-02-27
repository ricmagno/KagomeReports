# AGENTS.md - AI Agent Documentation & Guardrails

This document provides coding conventions, architectural intent, and technical constraints to guide AI coding agents. Follow these rules strictly when modifying the codebase.

## 🎯 Project Overview
**Historian Reports** is a specialized reporting platform for AVEVA (Wonderware) Historian.
- **Tech Stack**: Node.js, TypeScript, Express, Electron, SQL Server (AVEVA), SQLite (Config), Prisma (Postgres).
- **Core Domain**: Industrial time-series data retrieval, processing, and PDF/Dashboard visualization.

## 🏗️ Architectural Constraints

### 0. Authoritative Specifications (The `/spec` Directory)
Before making any architectural or data-level changes, consult the `/spec` directory. These files are the **authoritative sources of truth**:
- [use-cases.md](./spec/use-cases.md): Core user flows and requirements.
- [api-spec.md](./spec/api-spec.md): Backend endpoint definitions.
- [db-schema.md](./spec/db-schema.md): Database table structures and relationships.
- [deployment.md](./spec/deployment.md): Docker and Kubernetes specifications.

### 1. Module Boundaries
- **Services Layer (`src/services/`)**: Contains all business logic and data orchestration. Services should be mostly stateless and interact with databases via dedicated clients.
- **Utilities (`src/utils/`)**: Pure functions and shared helpers (e.g., `retryHandler.ts`).
- **Middleware (`src/middleware/`)**: Authentication, error handling, and request validation.

### 2. Error Handling
- Use the central `errorHandler` middleware.
- Always provide descriptive error messages in `OPC UA` and `Historian` services, as these involve external network dependencies.
- Use `RetryHandler.executeWithRetry` for network-bound operations.

## 🛠️ Specialized Knowledge

### OPC UA Integration
- **Connection Strategy**: Always use `RetryHandler` for `connect()` and `createSession()`.
- **Authentication**: Industrial servers (e.g., Kepware, Ignition) often require the username format `.\username` or `DOMAIN\username`.
- **Security**: Prefer `SignAndEncrypt` with `Basic256Sha256`. Many servers will deny password-based login over a `None` security mode.
- **Endpoint Discovery**: Always log discovered endpoints during the connection phase to help diagnose `BadUserAccessDenied` errors.

### Code Signing (macOS)
- **OpenSSL Legacy**: When generating `.p12` certificates for macOS, use the `-legacy` flag in OpenSSL 3.x to ensure compatibility with the macOS `security` tool.
- **Trust Requirements**: For self-signed certificates to work, they must be added to the System Keychain as a trusted root:
  ```bash
  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain build-secrets/self-signed.crt
  ```

## 📜 Coding Style
- **TypeScript**: Use strict typing. Avoid `any` unless absolutely necessary (e.g., complex `node-opcua` objects).
- **Naming**: 
  - Services: `CamelCaseService.ts`
  - Utils: `camelCase.ts`
- **React (Client)**:
  - Feature-based structure in `client/src/components/`.
  - Prefer functional components and hooks.
  - Use `shadcn/ui` components (if present) or follow existing Tailwind patterns.

## ✅ Definition of Done
1. Code follows these conventions.
2. New features include appropriate error handling and logging.
3. Version bumped in `package.json` if changes affect the released binary.
4. `MEMORY.md` updated with significant learned technical behaviors.
