# MEMORY.md - Project Knowledge & Lessons Learned

This file stores persistent contextual knowledge, technical breakthroughs, and configuration decisions that might otherwise be lost across chat sessions.

## 🧠 Learned Technical Behaviors

### OPC UA Connection (Feb 2026)
- **Problem**: Persistent `premature disconnection` during `findEndpoint`.
- **Solution**: Implemented a retry strategy in `opcuaService.ts`. Increased session timeout and added `keepSessionAlive`.
- **Auth Pitfall**: `BadUserAccessDenied` often occurs because servers require `SignAndEncrypt` for password logins. Anonymous connections might work where username/password fails due to encryption requirements.
- **Username Format**: For industrial servers, use `.\username` or `DOMAIN\username`.

### macOS Application Signing (Feb 2026)
- **Problem**: macOS `security` tool failed to import `.p12` certificates created by OpenSSL 3.x with "MAC verification failed".
- **Solution**: Added the `-legacy` flag to the `openssl pkcs12` export command.
- **Problem**: Even after signing, build logs showed `skipped macOS application code signing` because the certificate was not trusted.
- **Solution**: The self-signed certificate must be manually added to the Mac's System Keychain as a trusted root using `add-trusted-cert`.

## ⚙️ Configuration Decisions

### Data Retrieval Service
- **Pattern**: Routes requests based on tag name. Tags starting with `opc.` are routed to `OpcuaService`, others to `HistorianConnection`.
- **Resolution**: High-resolution trending is forced by setting data point limits to a very high number (e.g., 1,000,000).

### User Session Security
- **JWT**: Used for authentication and authorization across the API.
- **Environment**: Sensitive configs (Database URLs, JWT Secrets) are validated using `zod` in `src/config/environment.ts`.

## 📁 Repository Structure
- **`.agents/`**: Contains AI-specific workflows.
- **`brain/`**: (Conversation-specific) Stores implementation plans, tasks, and walkthroughs.
- **`build-secrets/`**: Stores signing certificates (ignored by git).
