# Historian Reports

## Project Overview

This is a Node.js backend application for "Historian Reports", a professional reporting application for the AVEVA Historian database. The application is written in TypeScript and uses Express.js as the web framework. It connects to a Microsoft SQL Server database, which is likely the AVEVA Historian database.

The project is well-structured with a clear separation of concerns. It has dedicated folders for configuration, middleware, services, and utilities. It also includes a comprehensive testing setup using Jest.

## Building and Running

### Prerequisites

*   Node.js (>=18.0.0)
*   A running Microsoft SQL Server instance (for the AVEVA Historian database)

### Installation

1.  Clone the repository.
2.  Install the dependencies:
    ```bash
    npm install
    ```

### Configuration

1.  Create a `.env` file in the root of the project. You can use the `.env.example` file as a template.
2.  Fill in the required environment variables, such as database credentials and JWT secret.

### Running the Application

*   **Development:**
    ```bash
    npm run dev
    ```
    This will start the server in development mode with hot-reloading.

*   **Production:**
    ```bash
    npm run build
    npm start
    ```
    This will build the TypeScript code and start the server in production mode.

### Testing

*   Run all tests:
    ```bash
    npm test
    ```

*   Run tests in watch mode:
    ```bash
    npm run test:watch
    ```

*   Run property-based tests:
    ```bash
    npm run test:property
    ```

## Development Conventions

### Coding Style

The project uses ESLint to enforce a consistent coding style. You can run the linter with:

```bash
npm run lint
```

### Testing

The project uses Jest for testing. Tests are located in the `tests` directory. The project includes property-based tests, which are located in the `tests/properties` directory. The `tests/setup.ts` file is used to configure the test environment.

### Environment Variables

The project uses the `zod` library to validate environment variables. The schema for the environment variables is defined in `src/config/environment.ts`. This ensures that the application has all the required configuration before it starts.
