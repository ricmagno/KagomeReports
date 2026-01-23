# ValidationErrorDialog Component

## Overview

The `ValidationErrorDialog` component is a modal dialog that displays validation errors and warnings when importing report configurations. It provides a clear, user-friendly interface for understanding what went wrong during the import process and offers actions to close the dialog or try importing again.

## Purpose

This component is part of the Report Configuration Export/Import feature (Phase 3 - Frontend). It displays validation errors returned by the backend import service when a configuration file fails validation.

## Features

- **Error Display**: Shows validation errors with field names and messages
- **Warning Display**: Shows warnings separately from errors
- **Severity Separation**: Clearly distinguishes between errors (red) and warnings (yellow)
- **Scrollable Content**: Handles many errors/warnings with a scrollable content area
- **Keyboard Navigation**: Supports Escape key to close
- **Backdrop Click**: Closes when clicking outside the dialog
- **Accessibility**: Full ARIA support for screen readers
- **Help Text**: Provides guidance on what to do next

## Usage

```typescript
import { ValidationErrorDialog, ValidationError } from './ValidationErrorDialog';

function MyComponent() {
  const [showDialog, setShowDialog] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [warnings, setWarnings] = useState<ValidationError[]>([]);

  const handleImport = async () => {
    const result = await importConfiguration(fileContent);
    
    if (!result.success) {
      setErrors(result.errors || []);
      setWarnings(result.warnings || []);
      setShowDialog(true);
    }
  };

  const handleTryAgain = () => {
    setShowDialog(false);
    // Trigger file browser again
  };

  return (
    <ValidationErrorDialog
      isOpen={showDialog}
      errors={errors}
      warnings={warnings}
      onClose={() => setShowDialog(false)}
      onTryAgain={handleTryAgain}
    />
  );
}
```

## Props

### `ValidationErrorDialogProps`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | Yes | Controls whether the dialog is visible |
| `errors` | `ValidationError[]` | Yes | Array of validation errors to display |
| `warnings` | `ValidationError[]` | Yes | Array of validation warnings to display |
| `onClose` | `() => void` | Yes | Callback when dialog is closed |
| `onTryAgain` | `() => void` | Yes | Callback when "Try Again" button is clicked |

### `ValidationError`

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `field` | `string` | No | Name of the field that failed validation |
| `message` | `string` | Yes | Human-readable error message |
| `severity` | `'error' \| 'warning'` | Yes | Severity level of the validation issue |

## Visual Design

### Layout

```
┌─────────────────────────────────────────────────────────┐
│ [!] Configuration Validation Failed              [X]    │
│     The imported configuration contains errors...       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ [!] Errors (2)                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Field: tags                                         │ │
│ │ Tags array is required                              │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Field: timeRange.startTime                          │ │
│ │ Start time is invalid                               │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [⚠] Warnings (1)                                        │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Field: tags                                         │ │
│ │ Tag "Temperature" not found in database             │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [i] What to do next: Please correct the errors...      │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                    [Close] [Try Again]  │
└─────────────────────────────────────────────────────────┘
```

### Color Scheme

- **Errors**: Red background (`bg-red-50`), red border (`border-red-200`), red text (`text-red-700`)
- **Warnings**: Yellow background (`bg-yellow-50`), yellow border (`border-yellow-200`), yellow text (`text-yellow-700`)
- **Help Text**: Blue background (`bg-blue-50`), blue border (`border-blue-200`), blue text (`text-blue-800`)

## Behavior

### Opening the Dialog

The dialog appears when `isOpen` is set to `true`. It displays with a fade-in animation (`animate-scale-in`).

### Closing the Dialog

The dialog can be closed in multiple ways:

1. **Close Button**: Click the "Close" button in the footer
2. **X Button**: Click the X icon in the header
3. **Backdrop Click**: Click outside the dialog content
4. **Escape Key**: Press the Escape key

All closing methods trigger the `onClose` callback.

### Try Again Action

Clicking the "Try Again" button triggers the `onTryAgain` callback, which should:
1. Close the dialog
2. Re-open the file browser
3. Allow the user to select a different file or the same file after corrections

### Scrolling

When there are many errors or warnings, the content area becomes scrollable while the header and footer remain fixed. The dialog has a maximum height of 80vh to ensure it fits on screen.

## Accessibility

### ARIA Attributes

- `role="dialog"`: Identifies the element as a dialog
- `aria-modal="true"`: Indicates the dialog is modal
- `aria-labelledby`: References the dialog title
- `aria-describedby`: References the dialog description
- `aria-label`: Provides accessible labels for buttons
- `aria-hidden="true"`: Hides decorative icons from screen readers

### Keyboard Navigation

- **Escape**: Closes the dialog
- **Tab**: Navigates between interactive elements (X button, Close button, Try Again button)
- **Enter/Space**: Activates focused button

### Screen Reader Support

- Dialog title and description are announced when opened
- Error and warning counts are announced
- Field names and messages are read in order
- Button labels clearly indicate their purpose

## Integration with Backend

The component expects validation errors in the format returned by the backend import service:

```typescript
interface ImportResult {
  success: boolean;
  config?: ReportConfig;
  errors?: ValidationError[];
  warnings?: string[];
}
```

Note: The backend returns warnings as strings, but the component expects `ValidationError[]` objects. The parent component should transform warnings:

```typescript
const transformedWarnings = result.warnings?.map(msg => ({
  message: msg,
  severity: 'warning' as const
})) || [];
```

## Requirements Validation

This component validates the following requirements from the design document:

- **Requirement 3.7**: Display specific error messages indicating which fields are invalid or missing
- **Requirement 5.1**: Display error message for invalid JSON syntax
- **Requirement 5.2**: Display warning for schema version mismatch
- **Requirement 5.3**: List all missing field names in error message
- **Requirement 5.4**: Specify which fields contain invalid data and why

## Testing

The component has comprehensive unit tests covering:

- Rendering with different states (errors only, warnings only, both, neither)
- User interactions (button clicks, backdrop clicks, keyboard events)
- Accessibility features (ARIA attributes, keyboard navigation)
- Edge cases (empty arrays, long messages, many errors, special characters)
- Styling (error colors, warning colors, scrollable content)

Run tests with:

```bash
cd client
npm test -- ValidationErrorDialog.test.tsx
```

## Related Components

- **FormatSelectionDialog**: Modal for selecting export format
- **ConfirmDialog**: Generic confirmation dialog
- **Button**: Reusable button component used in footer

## Future Enhancements

Potential improvements for future versions:

1. **Grouping**: Group errors by field or category
2. **Filtering**: Allow filtering between errors and warnings
3. **Copy to Clipboard**: Add button to copy all errors for sharing
4. **Detailed View**: Expand/collapse detailed error information
5. **Suggestions**: Provide suggestions for fixing common errors
6. **Export Errors**: Allow exporting error list to file

## Design System Compliance

This component follows the Historian Reports design system:

- Uses Tailwind CSS utility classes
- Follows color palette (primary, gray, red, yellow, blue)
- Uses Lucide React icons
- Implements consistent spacing and typography
- Follows accessibility standards (WCAG 2.1 AA)
- Uses the Button component from the UI library
- Implements responsive design patterns
