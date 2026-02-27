# CONTRIBUTING.md - Development Workflow

Welcome to the Historian Reports project! To ensure smooth collaboration and high code quality, please follow these guidelines when contributing.

> [!IMPORTANT]
> All code changes must conform to the authoritative [API Specification](./spec/api-spec.md) and [Use Cases](./spec/use-cases.md).

## 🚀 Getting Started

1.  **Environment Setup**:
    *   Install Node.js (>=18).
    *   Copy `.env.example` to `.env` and configure your database and JWT secret.
    *   Run `npm install` and `cd client && npm install`.

2.  **Running the Project**:
    *   Full development stack (Express + React): `npm run start:dev`
    *   Electron development: `npm run electron:dev`

## 🌿 Branching Strategy

- **`main`**: Production-ready code.
- **`develop`**: Integration branch for new features.
- **`feature/*`**: Individual feature work.
- **`bugfix/*`**: Bug fixes.
- **`OPCUA`**: Specialized branch for OPC UA development.

## 🛠️ Commit Guidelines

We follow a simplified [Conventional Commits](https://www.conventionalcommits.org/) pattern:
- `feat`: New features.
- `fix`: Bug fixes.
- `chore`: Maintenance (dependencies, config).
- `docs`: Documentation updates.
- `refactor`: Code changes that neither fix a bug nor add a feature.

## 🧪 Testing

- **Backend**: Always run tests before merging: `npm test`.
- **Frontend**: Verify dashboard and report previews manually after UI changes.
- **Property-based tests**: Use for critical logic: `npm run test:property`.

## 📦 Pull Request Process

1.  Create a branch from `develop`.
2.  Implement your changes following the standards in `AGENTS.md`.
3.  Ensure all tests pass.
4.  Update documentation (`README.md`, `MEMORY.md`, `walkthrough.md`) if necessary.
5.  Submit a PR for review.

## 💎 Code Quality

- **Linting**: Keep code clean with `npm run lint`.
- **Logging**: Use the central logger (`src/utils/logger.ts`) for important events, especially in services.
- **Type Safety**: Avoid using `any`. Use interfaces and types for all data structures.
