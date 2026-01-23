# FormatSelectionDialog Component

## Overview

The `FormatSelectionDialog` is a modal dialog component that allows users to select an export format for their report configurations. It provides a user-friendly interface for choosing between JSON and Power BI export formats.

## Features

- **Two Format Options**: JSON and Power BI
- **Visual Selection**: Card-based selection with icons and descriptions
- **Keyboard Navigation**: Full keyboard support (Escape to close, Enter to confirm, Space/Enter to select)
- **Accessibility**: WCAG 2.1 AA compliant with proper ARIA attributes
- **Responsive Design**: Works on all screen sizes
- **Visual Feedback**: Check icon indicates selected format

## Usage

```typescript
import { FormatSelectionDialog } from './components/reports';

function MyComponent() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSelectFormat = (format: 'json' | 'powerbi') => {
    console.log('Selected format:', format);
    // Proceed with export using the selected format
    setIsDialogOpen(false);
  };

  return (
    <>
      <button onClick={() => setIsDialogOpen(true)}>
        Export Configuration
      </button>
      
      <FormatSelectionDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSelectFormat={handleSelectFormat}
      />
    </>
  );
}
```

## Props

### `isOpen: boolean`
Controls whether the dialog is visible.

### `onClose: () => void`
Callback function called when the user cancels or closes the dialog.

### `onSelectFormat: (format: ExportFormat) => void`
Callback function called when the user confirms their format selection.
- `format`: Either `'json'` or `'powerbi'`

## Format Options

### JSON Format
- **Title**: JSON
- **Description**: "Friendly format for backup and sharing. Can be re-imported into this application."
- **Icon**: FileJson (from lucide-react)
- **Use Case**: Saving configurations for later use, sharing with colleagues, backup purposes

### Power BI Format
- **Title**: Power BI
- **Description**: "Connection file for Microsoft Power BI. Enables independent data analysis."
- **Icon**: Database (from lucide-react)
- **Use Case**: Exporting data connections for use in Microsoft Power BI

## Keyboard Shortcuts

- **Escape**: Close the dialog without selecting
- **Enter**: Confirm the current selection
- **Space/Enter** (on format option): Select that format
- **Tab**: Navigate between interactive elements

## Accessibility

The component follows WCAG 2.1 AA guidelines:

- **ARIA Attributes**: Proper `role="dialog"`, `aria-modal`, `aria-labelledby`, and `aria-describedby`
- **Keyboard Navigation**: Full keyboard support for all interactions
- **Focus Management**: Proper focus indicators on all interactive elements
- **Screen Reader Support**: Descriptive labels and ARIA attributes for screen readers
- **Visual Indicators**: Check icon and color changes indicate selected state

## Styling

The component uses Tailwind CSS classes following the design system:

- **Colors**: Primary blue for selected state, gray for unselected
- **Spacing**: Consistent padding and margins
- **Typography**: Clear hierarchy with semibold titles and regular descriptions
- **Animations**: Smooth transitions and scale-in animation on open
- **Hover States**: Visual feedback on hover

## Testing

The component includes comprehensive tests covering:

- Rendering behavior
- Format selection
- User interactions (click, keyboard)
- Accessibility features
- Visual feedback

Run tests with:
```bash
npm test -- FormatSelectionDialog
```

## Design Decisions

1. **Default Selection**: JSON is selected by default as it's the most common use case for backup and re-import.

2. **Card-Based Selection**: Uses large, clickable cards instead of radio buttons for better visual hierarchy and easier interaction.

3. **Visual Feedback**: Check icon and color changes provide clear indication of the selected format.

4. **Backdrop Click**: Clicking outside the dialog closes it, following common modal patterns.

5. **No Loading State**: The dialog itself doesn't handle loading states; the parent component should handle the export process after format selection.

## Integration with Export Flow

This dialog is designed to be used as part of the export workflow:

1. User clicks "Export" button
2. `FormatSelectionDialog` opens
3. User selects format and clicks "Export"
4. Parent component receives format via `onSelectFormat` callback
5. Parent component initiates export with selected format
6. Dialog closes

## Related Components

- **ExportImportControls**: Parent component that manages export/import buttons
- **ReportConfiguration**: Main form where export/import controls are displayed

## Requirements Validation

This component satisfies the following requirements from the spec:

- **Requirement 4.1**: Display format selection dialog with options
- **Requirement 4.2**: Provide descriptions for each format
- **Requirement 4.3**: Implement confirm and cancel actions
- **Requirement 4.4**: Style with Tailwind CSS following design system

## Future Enhancements

Potential improvements for future versions:

1. **Format Preference Persistence**: Remember user's last selected format
2. **Additional Formats**: Support for CSV, Excel, or other formats
3. **Format Preview**: Show a preview of what the exported file will look like
4. **Advanced Options**: Per-format configuration options (e.g., include metadata, compression)
