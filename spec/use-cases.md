# Use Cases Spec

This document defines the authoritative use cases for the Historian Reports application.

## 1. Data Retrieval
- **Description**: Users or automated services query historical data from AVEVA Historian or real-time data from OPC UA servers.
- **Goal**: Provide accurate, timely data for reports and dashboards.
- **Actors**: End User, Scheduler Service.

## 2. Report Generation
- **Description**: The system generates PDF reports based on user-defined configurations (tags, time ranges, chart types).
- **Goal**: Produce a professional, printable document.
- **Constraints**: Must handle large datasets cleanly without crashing the Electron process.

### 3. Automated Scheduling
- **Description**: Reports are triggered automatically by a cron-based scheduler.
- **Goal**: Deliver reports to stakeholders via email without manual intervention.

### 4. Real-time Dashboarding
- **Description**: Live monitoring of tags via OPC UA or the "Live" Historian table.
- **Goal**: Update UI widgets with the most recent valid values.
