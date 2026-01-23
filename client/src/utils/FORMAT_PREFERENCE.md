# Format Preference Storage

This module provides localStorage-based persistence for the user's last selected export format preference in the Report Configuration Export/Import feature.

## Overview

The format preference storage utility allows the application to remember which export format (JSON or Power BI) the user last selected, providing a better user experience by defaulting to their preferred format on subsequent exports.

## Features

- **Persistent Storage**: Uses browser localStorage to persist preferences across sessions
- **Graceful Degradation**: Handles localStorage errors gracefully (private browsing, quota exceeded, etc.)
- **Type-Safe**: Fully typed with TypeScript for compile-time safety
- **Default Behavior**: Defaults to 'json' format when no preference exists
- **Simple API**: Four straightforward functions for all operations

## API Reference

### `getFormatPreference(): ExportFormat`

Retrieves the user's last selected export format preference.

**Returns**: `'json' | 'powerbi'` - The last selected format, or `'json'` if no preference exists

**Example**:
```typescript
import { getFormatPreference } from './utils/formatPreference';

const format = getFormatPreference();
console.log(format); // 'json' or 'powerbi'
```

### `setFormatPreference(format: ExportFormat): void`

Saves the user's export format preference.

**Parameters**:
- `format`: `'json' | 'powerbi'` - The format to save as preference

**Example**:
```typescript
import { setFormatPreference } from './utils/formatPreference';

// User selected Power BI format
setFormatPreference('powerbi');
```

### `clearFormatPreference(): void`

Clears the user's export format preference. After calling this, `getFormatPreference()` will return the default `'json'` format.

**Example**:
```typescript
import { clearFormatPreference } from './utils/formatPreference';

// Reset to default
clearFormatPreference();
```

### `hasFormatPreference(): boolean`

Checks if a format preference has been set.

**Returns**: `boolean` - `true` if a valid preference exists, `false` otherwise

**Example**:
```typescript
import { hasFormatPreference } from './utils/formatPreference';

if (hasFormatPreference()) {
  console.log('User has a saved preference');
} else {
  console.log('Using default format');
}
```

## Usage in Components

### ExportImportControls Component

The primary use case is in the `ExportImportControls` component, where the format preference is retrieved when the export dialog opens and saved when the user selects a format:

```typescript
import { getFormatPreference, setFormatPreference } from '../../utils/formatPreference';

const ExportImportControls: React.FC<Props> = ({ currentConfig, onImportComplete }) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(() => 
    getFormatPreference() // Initialize with saved preference
  );

  const handleExport = () => {
    // Open format selection dialog with saved preference pre-selected
    setShowFormatDialog(true);
  };

  const handleFormatSelect = (format: ExportFormat) => {
    setSelectedFormat(format);
    setFormatPreference(format); // Save preference for next time
    // Proceed with export...
  };

  // ...
};
```

## Error Handling

All functions handle localStorage errors gracefully:

- **Private Browsing Mode**: When localStorage is unavailable, functions fall back to default behavior without throwing errors
- **Quota Exceeded**: When localStorage quota is exceeded, set operations fail silently with a console warning
- **Invalid Values**: Invalid stored values are ignored and the default is returned

Errors are logged to the console with `console.warn()` for debugging purposes, but do not interrupt the user experience.

## Storage Details

- **Key**: `reportExportFormatPreference`
- **Values**: `'json'` or `'powerbi'`
- **Default**: `'json'`
- **Scope**: Per-origin (shared across all tabs/windows for the same domain)

## Testing

The module includes comprehensive unit tests covering:

- ✅ Default behavior when no preference exists
- ✅ Storing and retrieving both format types
- ✅ Overwriting existing preferences
- ✅ localStorage error handling (unavailable, quota exceeded)
- ✅ Invalid value handling
- ✅ Integration scenarios (get/set/clear workflows)
- ✅ Edge cases (null, undefined, empty string, whitespace, case sensitivity)

Run tests with:
```bash
cd client
npm test -- --testPathPattern=formatPreference
```

## Requirements Validation

This implementation satisfies **Requirement 4.5**:

> **Requirement 4.5**: THE System SHALL remember the user's last selected format as the default for future exports

**Acceptance Criteria**:
- ✅ Last selected format is stored in localStorage
- ✅ Format preference is retrieved on export
- ✅ Defaults to JSON if no preference exists
- ✅ Handles localStorage errors gracefully

## Browser Compatibility

This utility works in all modern browsers that support localStorage (IE8+, all modern browsers). In environments where localStorage is unavailable (e.g., private browsing in some browsers), the utility gracefully falls back to default behavior.

## Future Enhancements

Potential future improvements:

1. **User Settings Page**: Add UI to view/change format preference
2. **Per-User Preferences**: Store preferences server-side for cross-device sync
3. **Format Usage Analytics**: Track which formats are most commonly used
4. **Preference Migration**: Handle preference migration if format options change

## Related Files

- **Type Definitions**: `src/types/reportExportImport.ts` - Defines `ExportFormat` type
- **Component Usage**: `client/src/components/reports/ExportImportControls.tsx` - Primary consumer
- **Tests**: `client/src/utils/__tests__/formatPreference.test.ts` - Comprehensive test suite
