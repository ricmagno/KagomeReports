# Requirements Document: Advanced Chart Analytics and SPC

## Introduction

This feature enhances the PDF report charts in the Historian Reports application with advanced analytics capabilities including trend equations, statistical summaries displayed directly on charts, and Statistical Process Control (SPC) charts for process monitoring. The system will provide process engineers and quality managers with deeper insights into process behavior, trends, and capability metrics.

## Glossary

- **System**: The Historian Reports application
- **Chart**: A visual representation of time-series data in a PDF report
- **Trend_Line**: A linear regression line fitted to time-series data
- **SPC_Chart**: A Statistical Process Control chart showing data points with control limits
- **Control_Limits**: Upper and lower boundaries (UCL/LCL) calculated from process data
- **Analog_Tag**: A continuous measurement tag (temperature, pressure, flow, etc.)
- **Digital_Tag**: A binary state tag (on/off, true/false)
- **R²_Value**: Coefficient of determination indicating trend line fit quality (0-1)
- **Cp**: Process Capability Index measuring potential capability
- **Cpk**: Process Performance Index measuring actual capability
- **LSL**: Lower Specification Limit (configurable process boundary)
- **USL**: Upper Specification Limit (configurable process boundary)
- **UCL**: Upper Control Limit (calculated from process data)
- **LCL**: Lower Control Limit (calculated from process data)
- **σest**: Estimated process standard deviation
- **X̄**: Process average (mean)

## Requirements

### Requirement 1: Trend Line Display

**User Story:** As a process engineer, I want to see trend equations on charts, so that I can understand the rate of change and predict future values.

#### Acceptance Criteria

1. WHEN a chart is generated for an Analog_Tag, THE System SHALL calculate a linear regression trend line from the time-series data
2. WHEN a Trend_Line is calculated, THE System SHALL display the equation on the chart in the format "y = mx + b" with coefficients rounded to 2 decimal places
3. WHEN a Trend_Line is displayed, THE System SHALL show the R²_Value rounded to 3 decimal places
4. WHEN a Digital_Tag chart is generated, THE System SHALL NOT display a trend line or equation
5. WHEN the R²_Value is below 0.3, THE System SHALL display a visual indicator that the trend fit is weak

### Requirement 2: Statistical Summary on Charts

**User Story:** As an analyst, I want statistical summaries displayed directly on charts, so that I don't have to reference separate tables to understand the data distribution.

#### Acceptance Criteria

1. WHEN a chart is generated, THE System SHALL calculate and display the minimum value from the time-series data
2. WHEN a chart is generated, THE System SHALL calculate and display the maximum value from the time-series data
3. WHEN a chart is generated, THE System SHALL calculate and display the average (mean) value from the time-series data
4. WHEN a chart is generated, THE System SHALL calculate and display the standard deviation from the time-series data
5. WHEN statistical values are displayed, THE System SHALL format them with appropriate precision (2 decimal places for most values)
6. WHEN displaying statistics, THE System SHALL position them in a legend box that does not obscure the chart data
7. WHEN the chart is in grayscale mode, THE System SHALL ensure the statistics legend has sufficient contrast for printing

### Requirement 3: SPC Chart Generation

**User Story:** As a quality manager, I want SPC charts for each analog tag, so that I can identify process variations and out-of-control conditions.

#### Acceptance Criteria

1. WHEN a report is generated with Analog_Tags, THE System SHALL create an SPC_Chart for each Analog_Tag
2. WHEN an SPC_Chart is created, THE System SHALL calculate and display the center line (X̄) from the process data
3. WHEN an SPC_Chart is created, THE System SHALL calculate and display the Upper Control Limit (UCL) at X̄ + 3σest
4. WHEN an SPC_Chart is created, THE System SHALL calculate and display the Lower Control Limit (LCL) at X̄ - 3σest
5. WHEN data points exceed Control_Limits, THE System SHALL mark them with a distinct visual indicator
6. WHEN a Digital_Tag is encountered, THE System SHALL NOT generate an SPC_Chart
7. WHEN Control_Limits are displayed, THE System SHALL use dashed lines to distinguish them from the data series
8. WHEN the center line is displayed, THE System SHALL use a solid line distinct from the data series

### Requirement 4: SPC Metrics Calculation

**User Story:** As a plant manager, I want Cp and Cpk values calculated, so that I can assess whether our processes are capable of meeting specifications.

#### Acceptance Criteria

1. WHEN an Analog_Tag has specification limits configured, THE System SHALL calculate the Process Capability Index (Cp)
2. WHEN an Analog_Tag has specification limits configured, THE System SHALL calculate the Process Performance Index (Cpk)
3. WHEN calculating Cp, THE System SHALL use the formula: Cp = (USL - LSL) / (6 × σest)
4. WHEN calculating Cpk, THE System SHALL use the formula: Cpk = min((USL - X̄) / (3 × σest), (X̄ - LSL) / (3 × σest))
5. WHEN specification limits are not configured for a tag, THE System SHALL display "N/A" for Cp and Cpk values
6. WHEN SPC metrics are calculated, THE System SHALL display X̄, LSL, USL, σest, Cp, and Cpk in a summary table
7. WHEN Cp or Cpk values are below 1.0, THE System SHALL display a visual indicator that the process may not be capable
8. WHEN Cp or Cpk values are 1.33 or above, THE System SHALL display a visual indicator that the process is capable

### Requirement 5: Specification Limits Configuration

**User Story:** As a process engineer, I want to configure specification limits per tag, so that SPC metrics are calculated based on actual process requirements.

#### Acceptance Criteria

1. WHEN a user configures a report, THE System SHALL provide input fields for LSL and USL for each Analog_Tag
2. WHEN specification limits are provided, THE System SHALL validate that USL is greater than LSL
3. WHEN specification limits are not provided, THE System SHALL use default values or mark metrics as "N/A"
4. WHEN specification limits are saved with a report configuration, THE System SHALL persist them for future report generations
5. WHERE specification limits are configured, THE System SHALL display them on the SPC_Chart as horizontal reference lines

### Requirement 6: Tag Type Detection

**User Story:** As a system administrator, I want the system to automatically distinguish between analog and digital tags, so that appropriate analytics are applied to each tag type.

#### Acceptance Criteria

1. WHEN processing a tag, THE System SHALL determine if it is an Analog_Tag or Digital_Tag based on its data characteristics
2. WHEN a tag has only two distinct values (0/1, true/false), THE System SHALL classify it as a Digital_Tag
3. WHEN a tag has continuous numeric values, THE System SHALL classify it as an Analog_Tag
4. WHEN a Digital_Tag is detected, THE System SHALL exclude it from SPC analysis and trend line calculations
5. WHEN tag classification is uncertain, THE System SHALL default to Analog_Tag classification and log a warning

### Requirement 7: PDF Report Integration

**User Story:** As a report consumer, I want all analytics displayed in the PDF report, so that I have a complete analysis document for review and archival.

#### Acceptance Criteria

1. WHEN a PDF report is generated, THE System SHALL include trend equations on standard charts
2. WHEN a PDF report is generated, THE System SHALL include statistical summaries on standard charts
3. WHEN a PDF report is generated, THE System SHALL include SPC_Charts for all Analog_Tags
4. WHEN a PDF report is generated, THE System SHALL include an SPC metrics summary table
5. WHEN generating charts, THE System SHALL maintain the printer-friendly grayscale design
6. WHEN adding new chart elements, THE System SHALL ensure they do not significantly increase report generation time (maximum 20% increase)
7. WHEN charts are rendered, THE System SHALL ensure all text is legible at standard print sizes (minimum 8pt font)

### Requirement 8: Performance Requirements

**User Story:** As a system user, I want reports to generate in a reasonable time, so that I can quickly access the analytics I need.

#### Acceptance Criteria

1. WHEN calculating trend lines, THE System SHALL complete the calculation within 100ms per tag
2. WHEN calculating SPC metrics, THE System SHALL complete the calculation within 200ms per tag
3. WHEN generating a report with 10 tags, THE System SHALL complete within 30 seconds
4. WHEN processing large datasets (>10,000 points), THE System SHALL use efficient algorithms to maintain performance
5. IF calculations exceed time limits, THEN THE System SHALL log a performance warning and continue processing

### Requirement 9: Error Handling

**User Story:** As a system user, I want clear error messages when analytics cannot be calculated, so that I understand what data or configuration is missing.

#### Acceptance Criteria

1. WHEN insufficient data points exist for trend calculation (<3 points), THE System SHALL display "Insufficient data for trend analysis"
2. WHEN specification limits are invalid (USL ≤ LSL), THE System SHALL display an error message and prevent report generation
3. WHEN statistical calculations fail, THE System SHALL log the error and display "N/A" for affected metrics
4. WHEN chart rendering fails, THE System SHALL include a placeholder image with an error message in the PDF
5. IF any analytics calculation fails, THEN THE System SHALL continue generating the report with available data
