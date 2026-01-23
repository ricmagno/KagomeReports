# ExportImportControls Component

## Overview

The `ExportImportControls` component provides UI controls for exporting and importing report configurations in the Historian Reports application. It integrates with the export/import API endpoints and provides a seamless user experience with format selection, validation feedback, and loading states.

## Features

- **Export Functionality**: Export report configurations to JSON or Power BI formats
- **Import Functionality**: Import previously exported JSON configurations
- **Format Selection**: Interactive dialog for choosing export format
- **Validation Feedback**: Detailed error and warning display for import validation
- **Loading States**: Visual feedback during export/import operations
- **Format Preference**: Remembers user's last selected export format
- **Accessibility**: Full keyboard navigation and screen reader support
- **Toast Notifications**: Success/error notifications for user feedback

## Usage

### Basic Usage

```tsx
import { ExportImportControls } from './components/reports/ExportImportControls';
import { useToast } from './hooks/useToast';

function ReportConfiguration() {
  const [config, setConfig] = useState<ReportConfig>({
    name: 'My Report',
    tags: ['Tag1', 'Tag2'],
    timeRange: { startTime: new Date(), endTime: new Date() },
    // ... other config fields
  });
  
  const { success, error, warning } = useToast();

  const handleImportComplete = (importedConfig: ReportConfig) => {
    setConfig(importedConfig);
    console.log('Configuration imported:', importedConfig);
  };

  const handleToast = (type, message, description) => {
    if (type === 'success') success(message, description);
    else if (type === 'error') error(message, description);
    else if (type === 'warning') warning(message, description);
  };

  return (
    <div>
      <h1>Report Configuration</h1>
      <ExportImportControls
        currentConfig={config}
        onImportComplete={handleImportComplete}
        onToast={handleToast}
      />
      {/* Rest of your form */}
    </div>
  );
}
```

### With Disabled State

```tsx
<ExportImportControls
  currentConfig={config}
  onImportComplete={handleImportComplete}
  disabled={isGeneratingReport}
  onToast={handleToast}
/>
```

### Custom Styling

```tsx
<ExportImportControls
  currentConfig={config}
  onImportComplete={handleImportComplete}
  className="my-4 justify-end"
  onToast={handleToast}
/>
```

## Props

### ExportImportControlsProps

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `currentConfig` | `ReportConfig` | Yes | - | The current report configuration to export |
| `onImportComplete` | `(config: ReportConfig) => void` | Yes | - | Callback when import completes successfully |
| `disabled` | `boolean` | No | `false` | Whether the controls should be disabled |
| `className` | `string` | No | `''` | Optional CSS class name for styling |
| `onToast` | `(type, message, description?) => void` | No | - | Optional toast notification handler |

## Component Behavior

### Export Flow

1. User clicks "Export" button
2. Format selection dialog appears with JSON and Power BI options
3. User selects format and clicks "Export"
4. Loading state is shown on the button
5. API call is made to `/api/reports/export`
6. File is downloaded to user's browser
7. Success notification is shown
8. Format preference is saved for next time

### Import Flow

1. User clicks "Import" button
2. File browser dialog appears (filtered to .json files)
3. User selects a JSON file
4. File size is validated (max 10 MB)
5. Loading state is shown on the button
6. File content is read and sent to `/api/reports/import`
7. If validation succeeds:
   - Configuration is passed to `onImportComplete` callback
   - Success notification is shown
   - Warnings are displayed if any
8. If validation fails:
   - Validation error dialog appears with detailed errors
   - User can close or try again with a different file

## API Integration

### Export Endpoint

**POST** `/api/reports/export`

Request body:
```json
{
  "config": { /* ReportConfig object */ },
  "format": "json" | "powerbi"
}
```

Response:
- Content-Type: `application/json` or `application/x-powerbi`
- Content-Disposition: `attachment; filename="..."`
- Body: File content

### Import Endpoint

**POST** `/api/reports/import`

Request body:
```json
{
  "fileContent": "{ /* JSON string */ }"
}
```

Response:
```json
{
  "success": true,
  "config": { /* ReportConfig object */ },
  "warnings": ["Optional warning messages"]
}
```

Or on validation failure:
```json
{
  "success": false,
  "errors": [
    {
      "code": "INVALID_FIELD_VALUE",
      "field": "timeRange.startTime",
      "message": "Start time must be before end time",
      "severity": "error"
    }
  ]
}
```

## Dependencies

### Internal Components
- `Button` - UI button component with loading states
- `FormatSelectionDialog` - Dialog for selecting export format
- `ValidationErrorDialog` - Dialog for displaying validation errors

### Utilities
- `getFormatPreference()` - Get user's last selected format
- `setFormatPreference()` - Save user's format preference

### Icons
- `Download` - Export button icon (from lucide-react)
- `Upload` - Import button icon (from lucide-react)
- `Loader2` - Loading spinner icon (from lucide-react)

## Accessibility

The component follows accessibility best practices:

- **Keyboard Navigation**: All buttons are keyboard accessible
- **ARIA Labels**: Descriptive labels for screen readers
- **Focus Management**: Proper focus handling in dialogs
- **Loading States**: Announced to screen readers
- **Error Messages**: Clear and descriptive validation errors

## Error Handling

The component handles various error scenarios:

1. **Network Errors**: API call failures are caught and displayed
2. **Validation Errors**: Import validation failures show detailed error dialog
3. **File Type Errors**: Non-JSON files are rejected with clear message
4. **File Size Errors**: Files over 10 MB are rejected
5. **Missing Configuration**: Gracefully handles missing config data

## Testing

### Unit Tests

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExportImportControls } from './ExportImportControls';

describe('ExportImportControls', () => {
  const mockConfig = {
    name: 'Test Report',
    tags: ['Tag1'],
    timeRange: { startTime: new Date(), endTime: new Date() },
  };

  it('renders export and import buttons', () => {
    render(
      <ExportImportControls
        currentConfig={mockConfig}
        onImportComplete={jest.fn()}
      />
    );
    
    expect(screen.getByText('Export')).toBeInTheDocument();
    expect(screen.getByText('Import')).toBeInTheDocument();
  });

  it('opens format dialog on export click', () => {
    render(
      <ExportImportControls
        currentConfig={mockConfig}
        onImportComplete={jest.fn()}
      />
    );
    
    fireEvent.click(screen.getByText('Export'));
    expect(screen.getByText('Select Export Format')).toBeInTheDocument();
  });

  it('disables buttons when disabled prop is true', () => {
    render(
      <ExportImportControls
        currentConfig={mockConfig}
        onImportComplete={jest.fn()}
        disabled={true}
      />
    );
    
    expect(screen.getByText('Export')).toBeDisabled();
    expect(screen.getByText('Import')).toBeDisabled();
  });
});
```

## Requirements Validation

This component satisfies the following requirements:

- **9.1**: Export and Import buttons displayed in Report Configuration header
- **9.2**: Export button positioned near Save button
- **9.3**: Import button positioned near Load button
- **9.4**: Clear, recognizable icons (Download/Upload)
- **9.5**: Tooltips explaining functionality on hover

## Future Enhancements

Potential improvements for future versions:

1. **Drag and Drop**: Support drag-and-drop for import
2. **Batch Import**: Import multiple configurations at once
3. **Export History**: Track recently exported configurations
4. **Format Preview**: Show preview of exported content before download
5. **Cloud Storage**: Export/import from cloud storage services
6. **Validation Preview**: Show validation results before applying import

## Related Components

- `FormatSelectionDialog` - Format selection UI
- `ValidationErrorDialog` - Validation error display
- `ReportManager` - Report configuration management
- `ReportPreview` - Report preview display

## Version History

- **1.0.0** (2024-01-15): Initial implementation
  - Export to JSON and Power BI formats
  - Import from JSON with validation
  - Format preference persistence
  - Loading states and error handling
