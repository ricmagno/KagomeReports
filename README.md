# Historian Reports Application

## Project Overview

This application is designed to generate printable reports and trends from the AVEVA Historian database. The system will provide a solution for extracting historical data, processing it into meaningful trends, and generating professional printable reports.

### 🤖 AI-First Development
This repository is optimized for AI coding agents. If you are using an AI assistant, please refer to:
- [AGENTS.md](./AGENTS.md): Coding conventions and architectural guardrails.
- [MEMORY.md](./MEMORY.md): Permanent project knowledge and learned technical behaviors.
- [CONTRIBUTING.md](./CONTRIBUTING.md): Workflow guidelines for the team.

## Goals

1. **Data Extraction**: Connect to and extract data from the AVEVA Historian database via SQL
2. **Trend Analysis**: Process historical data to identify and display trends
3. **Report Generation**: Create printable reports in various formats
4. **User Interface**: Provide an intuitive interface for report customization and generation
5. **Automation**: Support scheduled report generation and delivery

## Requirements

### Functional Requirements

1. **Database Connectivity**
   - Direct SQL connection to AVEVA Historian database (no APIs required)
   - Read-only access to database for data extraction
   - Support for various authentication methods
   - Data retrieval capabilities for historical time-series data

2. **Data Processing**
   - Query and filter historical data by time ranges
   - Data aggregation and statistical analysis
   - Trend identification and visualization

3. **Report Generation**
   - Printable report creation (PDF, DOCX, etc.)
   - Customizable report templates
   - Data visualization (charts, graphs, tables)
   - Professional formatting and styling

4. **User Interface**
   - Dashboard for report configuration
   - Time range selection
   - Data filtering options
   - Preview functionality

5. **Report Management**
   - Save and retrieve built reports
   - Report versioning and history tracking

6. **Automation Features**
   - Scheduled report generation with various intervals:
     - Hourly
     - Every 6 hours
     - Every 8 hours
     - Every 12 hours
     - Daily (24 hours)
     - Weekly
     - Monthly
   - Email delivery capabilities
   - Report distribution to stakeholders

### Technical Requirements

1. **Architecture**
   - Modular design for easy maintenance and extension
   - Scalable architecture to handle large datasets
   - Secure data handling and storage

2. **Integration**
   - Direct SQL connection to AVEVA Historian database
   - Support for standard database connections
   - RESTful API for external integrations

3. **Performance**
   - Efficient data retrieval and processing
   - Responsive user interface
   - Support for large historical datasets

4. **Security**
   - Secure database connections with read-only permissions
   - User authentication and authorization
   - Data encryption for sensitive information

### Non-Functional Requirements

1. **Reliability**
   - System uptime and availability
   - Error handling and recovery mechanisms
   - Data integrity preservation

2. **Usability**
   - Intuitive user interface
   - Comprehensive documentation
   - Easy configuration and setup

3. **Maintainability**
   - Clean, well-documented code
   - Modular architecture
   - Version control integration

## Technologies Used

- **Backend**: Node.js with Express and TypeScript
- **Frontend**: React.js with Tailwind CSS
- **Database**: AVEVA Historian (via MS SQL Server)
- **Desktop**: Electron
- **Containerization**: Docker

## Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **Database**: A running Microsoft SQL Server instance (AVEVA Historian)
- **OS (for building desktop)**: 
  - Windows 10+ (for Windows builds)
  - macOS (for Mac builds)

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd KagomeReports
   ```

2. **Install dependencies**:
   ```bash
   npm install
   cd client && npm install && cd ..
   ```

3. **Configure environment**:
   Create a `.env` file in the root directory (use `.env.example` as a template):
   ```bash
   cp .env.example .env
   ```
   Update the database credentials and JWT secrets in the `.env` file.

## Development

### Web Version
To run the backend and frontend concurrently in development mode:
```bash
npm run start:dev
```
- Backend runs on: `http://localhost:3000`
- Frontend runs on: `http://localhost:3001` (proxies to 3000)

### Desktop Version (Electron)
To run the application as a desktop app in development:
```bash
npm run electron:dev
```

## Building for Production

### 1. Web Deployment (Server)
To build the application for standard web hosting:
```bash
# Build backend and frontend
npm run build
npm run build:client

# Start production server
npm start
```

### 2. Desktop Application (Electron)
To package the application as a standalone desktop executable for the appropriate platform.

#### Prerequisites for Cross-Compilation (from Mac to Windows)
If you are building the Windows version on a macOS system, ensure you have the following installed via [Homebrew](https://brew.sh/):
```bash
brew install --cask wine-stable
brew install mono
```

#### Build Instructions

The Electron build follows a 3-step sequence:
1. **Application Build**: Compiles the Node.js backend and React frontend.
2. **Electron Source Build**: Compiles the Electron main and preload scripts.
3. **Packaging**: Bundles everything into an installer (`.exe` for Windows, `.dmg` for Mac).

| Action | Command | Output Directory |
| :--- | :--- | :--- |
| **Windows Build** | `npm run electron:build:win` | `dist/electron/*.exe` |
| **macOS Build** | `npm run electron:build:mac` | `dist/electron/*.dmg` |
| **Dev Mode** | `npm run electron:dev` | Interactive Window |

> **Note**: For a deep dive into Electron configuration, code signing, and troubleshooting, refer to the [ELECTRON_SETUP_GUIDE.md](./ELECTRON_SETUP_GUIDE.md).
> For the **authoritative deployment architecture** (Docker & Kubernetes), see [spec/deployment.md](./spec/deployment.md).

### 3. Docker Deployment
To build and run the application using Docker:

#### Build the Image
To build the multi-architecture Docker image (AMD64 & ARM64):
```bash
npm run docker:build
```

#### Run with Docker Compose (Recommended)
This starts the application along with a Redis cache and persistent volumes for logs and data:
```bash
docker-compose up -d
```
The application will be available at `http://localhost:3000`.

#### Stop and Remove Containers
```bash
docker-compose down
```

## Project Scope

This project will focus on creating a robust reporting solution that bridges the gap between AVEVA Historian data and business intelligence needs, providing users with professional, customizable reports that can be generated on-demand or on schedule with automated recurring reports.

## References

- [AVEVA Historian Documentation](https://docs.aveva.com/bundle/sp-historian/page/1393201.html) - Main source for database structure and data retrieval information

## Future Enhancements

1. Advanced analytics and forecasting
2. Mobile application support
3. Integration with other industrial IoT platforms
4. Machine learning for anomaly detection
5. Real-time data visualization capabilities