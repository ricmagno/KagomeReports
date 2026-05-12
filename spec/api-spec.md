# API Specification

This document defines the core API endpoints for the Historian Reports backend.

## 🔐 Authentication
- `POST /api/auth/login`: Authenticate user and return JWT.
- `POST /api/auth/logout`: Invalidate session.

## 📊 Data & Reports
- `POST /api/data/query`: Query historical data from Historian.
- `GET /api/reports`: List all report configurations.
- `POST /api/reports/generate`: Trigger manual PDF generation.
- `GET /api/reports/:id/download`: Download a generated PDF.

## ⚙️ Configuration
- `GET /api/configuration`: Fetch global settings.
- `PUT /api/configuration`: Update settings (DB connections, SMTP, etc.).
- `GET /api/database-config`: Manage Historian SQL connections.
- `GET /api/opcua-config`: Manage OPC UA server connections.

## 🕒 Schedules
- `GET /api/schedules`: List automated report schedules.
- `POST /api/schedules`: Create/Update a schedule.

## 👤 User Management
- `GET /api/users`: List system users (Admin only).
- `POST /api/users`: Manage user roles and permissions.
