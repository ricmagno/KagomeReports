# Requirements Document

## Introduction

The Database Status feature provides real-time monitoring of the AVEVA Historian database health and performance through system tags. This feature enables administrators and operators to quickly assess the operational state of the Historian system, identify potential issues, and monitor key performance metrics without needing direct database access or external monitoring tools.

## Glossary

- **System_Tag**: A predefined tag automatically created by AVEVA Historian that monitors internal system variables and processes
- **Status_Dashboard**: A visual interface displaying real-time system tag values organized by category
- **Quality_Code**: A numeric indicator of data quality (192 = Good, 0 = Bad, 64 = Uncertain, 1 = Unknown)
- **Storage_Rate**: The frequency (in milliseconds) at which analog system tag values are sent to the Storage subsystem
- **IDAS**: Integrated Data Acquisition Server - a service that collects data from external sources
- **Historian_Service**: A Windows service component of AVEVA Historian (e.g., Storage, Retrieval, Indexing)
- **Discrete_Tag**: A tag with binary states (typically 0 = Bad, 1 = Good)
- **Analog_Tag**: A tag with numeric values that can vary continuously

## Requirements

### Requirement 1: System Tag Data Retrieval

**User Story:** As a system administrator, I want to query system tags from the AVEVA Historian database, so that I can monitor the current state of the system.

#### Acceptance Criteria

1. WHEN the system queries system tags, THE Data_Retrieval_Service SHALL retrieve current values from the History table
2. WHEN retrieving system tag data, THE Data_Retrieval_Service SHALL include timestamp, value, and quality code for each tag
3. WHEN a system tag does not exist or has no data, THE Data_Retrieval_Service SHALL return a null value with appropriate quality code
4. WHEN multiple system tags are requested, THE Data_Retrieval_Service SHALL batch the queries for optimal performance
5. THE Data_Retrieval_Service SHALL support filtering system tags by category (error counts, monitoring, performance, etc.)

### Requirement 2: Status Dashboard Display

**User Story:** As an operator, I want to view a dashboard showing database status information, so that I can quickly assess system health.

#### Acceptance Criteria

1. WHEN a user navigates to the status dashboard, THE Status_Dashboard SHALL display system tag values organized by category
2. THE Status_Dashboard SHALL display the following categories: Error Counts, System Monitoring, Storage Space, I/O Statistics, and Performance Metrics
3. WHEN displaying discrete tags, THE Status_Dashboard SHALL show visual indicators (Good/Bad status with color coding)
4. WHEN displaying analog tags, THE Status_Dashboard SHALL show numeric values with appropriate units
5. THE Status_Dashboard SHALL display the last update timestamp for each tag value
6. WHEN a tag value indicates a problem (e.g., error count > 0, service status = Bad), THE Status_Dashboard SHALL highlight it with warning colors

### Requirement 3: Error Count Monitoring

**User Story:** As a system administrator, I want to monitor error counts, so that I can identify and respond to system issues.

#### Acceptance Criteria

1. THE Status_Dashboard SHALL display the following error count tags: SysCritErrCnt, SysErrErrCnt, SysFatalErrCnt, SysWarnErrCnt
2. WHEN any error count is greater than zero, THE Status_Dashboard SHALL display it with warning styling
3. WHEN displaying error counts, THE Status_Dashboard SHALL show the count value and last update time
4. THE Status_Dashboard SHALL indicate that error counts are cumulative since last restart

### Requirement 4: Service Status Monitoring

**User Story:** As an operator, I want to monitor the status of Historian services, so that I can detect service failures quickly.

#### Acceptance Criteria

1. THE Status_Dashboard SHALL display status for key services: Storage, Retrieval, Indexing, Configuration, Replication, Event Storage
2. WHEN a service status tag has value 1, THE Status_Dashboard SHALL display "Good" with green indicator
3. WHEN a service status tag has value 0, THE Status_Dashboard SHALL display "Bad" with red indicator
4. WHEN a service status tag has null value, THE Status_Dashboard SHALL display "Unknown" with gray indicator
5. THE Status_Dashboard SHALL display the SysStatusMode tag showing operational state (Read-only/Read-write)

### Requirement 5: Storage Space Monitoring

**User Story:** As a system administrator, I want to monitor available storage space, so that I can prevent data loss due to insufficient disk space.

#### Acceptance Criteria

1. THE Status_Dashboard SHALL display storage space for: Main (circular), Permanent, Buffer, and Alternate paths
2. WHEN displaying storage space, THE Status_Dashboard SHALL show values in MB with appropriate formatting
3. WHEN storage space falls below 1000 MB, THE Status_Dashboard SHALL display a warning indicator
4. WHEN storage space falls below 500 MB, THE Status_Dashboard SHALL display a critical alert indicator
5. THE Status_Dashboard SHALL show the last update time for storage space metrics

### Requirement 6: I/O Statistics Display

**User Story:** As a system administrator, I want to view I/O statistics, so that I can monitor data throughput and identify bottlenecks.

#### Acceptance Criteria

1. THE Status_Dashboard SHALL display key I/O metrics: Overall items per second, Total items received, Bad values count
2. WHEN displaying items per second metrics, THE Status_Dashboard SHALL format values with appropriate precision
3. THE Status_Dashboard SHALL display the SysStatusTopicsRxData tag showing active data sources
4. WHEN bad values count exceeds 100, THE Status_Dashboard SHALL display a warning indicator

### Requirement 7: Performance Metrics Display

**User Story:** As a system administrator, I want to view performance metrics, so that I can monitor system resource utilization.

#### Acceptance Criteria

1. THE Status_Dashboard SHALL display CPU metrics: SysPerfCPUTotal and SysPerfCPUMax as percentages
2. THE Status_Dashboard SHALL display memory metrics: SysPerfAvailableMBytes formatted in MB
3. WHEN CPU usage exceeds 80%, THE Status_Dashboard SHALL display a warning indicator
4. WHEN available memory falls below 500 MB, THE Status_Dashboard SHALL display a warning indicator
5. THE Status_Dashboard SHALL display disk time percentage (SysPerfDiskTime)

### Requirement 8: Auto-Refresh Capability

**User Story:** As an operator, I want the status dashboard to automatically refresh, so that I always see current system state without manual intervention.

#### Acceptance Criteria

1. THE Status_Dashboard SHALL automatically refresh system tag values at a configurable interval
2. THE default refresh interval SHALL be 30 seconds
3. WHEN auto-refresh is enabled, THE Status_Dashboard SHALL display a countdown timer showing time until next refresh
4. THE Status_Dashboard SHALL provide a manual refresh button for immediate updates
5. THE Status_Dashboard SHALL allow users to pause and resume auto-refresh

### Requirement 9: API Endpoint for Status Data

**User Story:** As a developer, I want a REST API endpoint for system status data, so that I can integrate monitoring into other tools.

#### Acceptance Criteria

1. THE API SHALL provide an endpoint `/api/status/database` that returns system tag values
2. WHEN the endpoint is called, THE API SHALL return JSON data with all monitored system tags
3. THE API SHALL support query parameters to filter by category (errors, services, storage, io, performance)
4. WHEN authentication is required, THE API SHALL validate JWT tokens before returning data
5. THE API SHALL return appropriate HTTP status codes (200 for success, 401 for unauthorized, 500 for errors)

### Requirement 10: Historical Trend View

**User Story:** As a system administrator, I want to view historical trends for key metrics, so that I can identify patterns and predict issues.

#### Acceptance Criteria

1. THE Status_Dashboard SHALL provide a trend view showing historical values for selected system tags
2. WHEN viewing trends, THE Status_Dashboard SHALL support time ranges: Last hour, Last 24 hours, Last 7 days
3. THE Status_Dashboard SHALL display trends as line charts with time on X-axis and value on Y-axis
4. THE Status_Dashboard SHALL allow users to select multiple tags for comparison on the same chart
5. WHEN displaying trends for discrete tags, THE Status_Dashboard SHALL show state changes over time

### Requirement 11: Export Status Data

**User Story:** As a system administrator, I want to export status data, so that I can include it in reports or share with support teams.

#### Acceptance Criteria

1. THE Status_Dashboard SHALL provide an export button to download current status data
2. WHEN exporting, THE Status_Dashboard SHALL support CSV and JSON formats
3. THE exported data SHALL include tag names, current values, timestamps, and quality codes
4. THE exported file SHALL include metadata: export timestamp, Historian server name, and user who exported
5. WHEN export fails, THE Status_Dashboard SHALL display an error message with details

### Requirement 12: Responsive Layout

**User Story:** As an operator, I want the status dashboard to work on different screen sizes, so that I can monitor the system from various devices.

#### Acceptance Criteria

1. THE Status_Dashboard SHALL adapt layout for desktop, tablet, and mobile screen sizes
2. WHEN viewed on mobile devices, THE Status_Dashboard SHALL stack categories vertically
3. WHEN viewed on desktop, THE Status_Dashboard SHALL display categories in a grid layout
4. THE Status_Dashboard SHALL maintain readability of values and indicators at all screen sizes
5. THE Status_Dashboard SHALL support touch interactions on mobile devices
