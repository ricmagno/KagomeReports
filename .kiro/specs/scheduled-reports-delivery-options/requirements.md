# Requirements Document: Schedule Delivery Options

## Introduction

This feature enhances the Scheduled Reports functionality by adding flexible delivery options. Users can choose to save reports to a custom file path, send via email, or both. This provides greater control over how and where generated reports are delivered.

## Glossary

- **Schedule**: An automated report generation configuration with timing and delivery settings
- **Report_Destination**: A file system path where generated reports will be saved
- **Delivery_Option**: A method for delivering generated reports (file save or email)
- **System**: The Historian Reports application

## Requirements

### Requirement 1: Report Destination Path Selection

**User Story:** As a user, I want to specify where generated reports should be saved, so that I can organize reports according to my file system structure.

#### Acceptance Criteria

1. WHEN creating or editing a schedule, THE System SHALL provide a text input field for specifying a report destination path
2. WHEN a user enters a destination path, THE System SHALL validate that the path is a valid file system path format
3. WHEN a user enters a relative path, THE System SHALL interpret it relative to the default reports directory
4. WHEN a user enters an absolute path, THE System SHALL use the absolute path as specified
5. WHEN the destination path field is empty, THE System SHALL use the default reports directory
6. WHEN a schedule executes with a custom destination path, THE System SHALL create the directory structure if it does not exist
7. WHEN a schedule executes with a custom destination path, THE System SHALL save the generated report to that location

### Requirement 2: Save Report Toggle

**User Story:** As a user, I want to enable or disable saving reports to disk, so that I can control whether reports are stored locally.

#### Acceptance Criteria

1. WHEN creating or editing a schedule, THE System SHALL provide a toggle switch labeled "Save Report to Disk"
2. WHEN the "Save Report to Disk" toggle is enabled, THE System SHALL show the destination path input field
3. WHEN the "Save Report to Disk" toggle is disabled, THE System SHALL hide the destination path input field
4. WHEN the "Save Report to Disk" toggle is enabled and a schedule executes, THE System SHALL save the generated report to the specified destination
5. WHEN the "Save Report to Disk" toggle is disabled and a schedule executes, THE System SHALL NOT save the generated report to disk
6. THE System SHALL persist the "Save Report to Disk" toggle state with the schedule configuration

### Requirement 3: Email Delivery Toggle

**User Story:** As a user, I want to enable or disable email delivery independently, so that I can control whether reports are sent via email.

#### Acceptance Criteria

1. WHEN creating or editing a schedule, THE System SHALL provide a toggle switch labeled "Send via Email"
2. WHEN the "Send via Email" toggle is enabled, THE System SHALL show the email recipients input field
3. WHEN the "Send via Email" toggle is disabled, THE System SHALL hide the email recipients input field
4. WHEN the "Send via Email" toggle is enabled and a schedule executes, THE System SHALL send the generated report to the specified recipients
5. WHEN the "Send via Email" toggle is disabled and a schedule executes, THE System SHALL NOT send the report via email
6. THE System SHALL persist the "Send via Email" toggle state with the schedule configuration

### Requirement 4: Delivery Option Validation

**User Story:** As a user, I want the system to ensure at least one delivery method is enabled, so that generated reports are not lost.

#### Acceptance Criteria

1. WHEN both "Save Report to Disk" and "Send via Email" toggles are disabled, THE System SHALL display a validation error message
2. WHEN attempting to save a schedule with both delivery options disabled, THE System SHALL prevent the save operation
3. WHEN attempting to enable a schedule with both delivery options disabled, THE System SHALL prevent the enable operation
4. WHEN at least one delivery option is enabled, THE System SHALL allow the schedule to be saved and enabled
5. THE validation error message SHALL clearly state "At least one delivery method must be enabled (Save to Disk or Send via Email)"

### Requirement 5: Schedule Form UI Updates

**User Story:** As a user, I want a clear and intuitive interface for configuring delivery options, so that I can easily understand and configure how reports will be delivered.

#### Acceptance Criteria

1. WHEN viewing the schedule form, THE System SHALL display a "Delivery Options" section
2. THE "Delivery Options" section SHALL contain the "Save Report to Disk" toggle with its associated fields
3. THE "Delivery Options" section SHALL contain the "Send via Email" toggle with its associated fields
4. WHEN a toggle is disabled, THE System SHALL visually indicate that its associated fields are inactive
5. THE System SHALL display helpful text explaining each delivery option
6. THE System SHALL show the validation error prominently if no delivery method is enabled

### Requirement 6: Backward Compatibility

**User Story:** As a system administrator, I want existing schedules to continue working after the update, so that no manual intervention is required.

#### Acceptance Criteria

1. WHEN loading an existing schedule created before this feature, THE System SHALL default "Save Report to Disk" to enabled
2. WHEN loading an existing schedule with recipients, THE System SHALL default "Send via Email" to enabled
3. WHEN loading an existing schedule without recipients, THE System SHALL default "Send via Email" to disabled
4. WHEN loading an existing schedule without a custom destination path, THE System SHALL use the default reports directory
5. THE System SHALL migrate existing schedules to the new data structure without data loss

### Requirement 7: Schedule Execution with Delivery Options

**User Story:** As a user, I want the system to respect my delivery option choices when executing schedules, so that reports are delivered only through my selected methods.

#### Acceptance Criteria

1. WHEN a schedule executes with "Save Report to Disk" enabled, THE System SHALL save the report to the specified destination path
2. WHEN a schedule executes with "Send via Email" enabled, THE System SHALL send the report to all specified recipients
3. WHEN a schedule executes with both options enabled, THE System SHALL both save the report and send it via email
4. WHEN saving to disk fails, THE System SHALL log the error and continue with email delivery if enabled
5. WHEN email delivery fails, THE System SHALL log the error and continue with disk save if enabled
6. THE System SHALL record the delivery methods used in the execution history

### Requirement 8: Path Validation and Security

**User Story:** As a system administrator, I want the system to validate and restrict file paths, so that users cannot write to unauthorized locations.

#### Acceptance Criteria

1. WHEN a user enters a destination path, THE System SHALL validate that the path does not contain path traversal sequences (../)
2. WHEN a user enters a destination path outside allowed directories, THE System SHALL display a validation error
3. THE System SHALL sanitize file paths to prevent directory traversal attacks
4. THE System SHALL validate that the destination path is writable before saving the schedule
5. WHEN a destination path is not writable, THE System SHALL display a clear error message

## Non-Functional Requirements

### Performance
- Path validation should complete within 100ms
- Directory creation should not significantly impact report generation time

### Security
- All file paths must be validated and sanitized
- Users should not be able to write to system directories
- Path traversal attacks must be prevented

### Usability
- Toggle switches should provide immediate visual feedback
- Validation errors should be clear and actionable
- The form should guide users toward valid configurations

### Reliability
- Failed delivery through one method should not prevent delivery through another
- All delivery attempts should be logged for troubleshooting
- The system should gracefully handle file system errors
