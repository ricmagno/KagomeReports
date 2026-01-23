/**
 * Integration Example: Format Preference in ExportImportControls
 * 
 * This file demonstrates how the format preference utility integrates
 * with the ExportImportControls component to provide a seamless user experience.
 * 
 * This is NOT a test file - it's documentation showing the integration pattern.
 */

import { getFormatPreference, setFormatPreference } from '../formatPreference';
import { ExportFormat } from '../../../../src/types/reportExportImport';

/**
 * Example: Component initialization with saved preference
 * 
 * When the ExportImportControls component mounts, it should initialize
 * the selected format with the user's saved preference.
 */
function exampleComponentInitialization() {
  // In the component's useState initializer:
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(() => {
    // Get the user's last selected format, or 'json' if none exists
    return getFormatPreference();
  });
  
  console.log('Component initialized with format:', selectedFormat);
  // Output: "Component initialized with format: json" (or "powerbi" if previously saved)
}

/**
 * Example: Handling export button click
 * 
 * When the user clicks the Export button, the format selection dialog
 * should open with the saved preference pre-selected.
 */
function exampleHandleExportClick() {
  // Get saved preference to pre-select in dialog
  const savedFormat = getFormatPreference();
  
  // Open format selection dialog with saved format pre-selected
  openFormatSelectionDialog({
    defaultFormat: savedFormat,
    onSelect: handleFormatSelect
  });
}

/**
 * Example: Handling format selection
 * 
 * When the user selects a format in the dialog, save their preference
 * before proceeding with the export.
 */
function exampleHandleFormatSelect(format: ExportFormat) {
  // Save the user's selection for future exports
  setFormatPreference(format);
  
  // Update component state
  setSelectedFormat(format);
  
  // Proceed with export using selected format
  proceedWithExport(format);
  
  console.log(`Format preference saved: ${format}`);
}

/**
 * Example: Complete export flow
 * 
 * This shows the complete flow from button click to export completion,
 * including preference management.
 */
async function exampleCompleteExportFlow() {
  // 1. User clicks Export button
  console.log('User clicked Export button');
  
  // 2. Get saved preference
  const savedFormat = getFormatPreference();
  console.log('Saved preference:', savedFormat);
  
  // 3. Show format selection dialog with saved format pre-selected
  const selectedFormat = await showFormatDialog(savedFormat);
  console.log('User selected:', selectedFormat);
  
  // 4. Save the selection (even if it's the same as before)
  setFormatPreference(selectedFormat);
  
  // 5. Perform the export
  const result = await exportConfiguration(currentConfig, selectedFormat);
  
  // 6. Show success message
  if (result.success) {
    console.log(`Export successful! File: ${result.filename}`);
    console.log(`Preference saved for next time: ${selectedFormat}`);
  }
}

/**
 * Example: First-time user experience
 * 
 * When a user exports for the first time, they get the default 'json' format,
 * and their selection is saved for future exports.
 */
function exampleFirstTimeUser() {
  // First export - no preference exists
  console.log('Has preference?', hasFormatPreference()); // false
  console.log('Default format:', getFormatPreference()); // 'json'
  
  // User selects Power BI format
  setFormatPreference('powerbi');
  
  // Next export - preference exists
  console.log('Has preference?', hasFormatPreference()); // true
  console.log('Saved format:', getFormatPreference()); // 'powerbi'
}

/**
 * Example: Handling localStorage errors
 * 
 * The utility handles localStorage errors gracefully, ensuring the
 * export feature works even when localStorage is unavailable.
 */
function exampleLocalStorageError() {
  // Simulate localStorage being unavailable (e.g., private browsing)
  // The utility will log a warning but continue working
  
  try {
    // This will work even if localStorage throws an error
    const format = getFormatPreference();
    console.log('Format (with error handling):', format); // 'json'
    
    // This will also work, just won't persist
    setFormatPreference('powerbi');
    console.log('Preference set (may not persist if localStorage unavailable)');
    
  } catch (error) {
    // This catch block will never execute because the utility
    // handles all localStorage errors internally
    console.error('This should never happen:', error);
  }
}

/**
 * Example: Testing the preference flow
 * 
 * This shows how to test the preference flow in component tests.
 */
function exampleTestingPattern() {
  // In your test file:
  
  beforeEach(() => {
    // Clear preference before each test
    clearFormatPreference();
  });
  
  it('should use saved preference on mount', () => {
    // Set up: Save a preference
    setFormatPreference('powerbi');
    
    // Act: Mount component
    const { getByRole } = render(<ExportImportControls {...props} />);
    
    // Assert: Component should use saved preference
    expect(getFormatPreference()).toBe('powerbi');
  });
  
  it('should save preference when user selects format', () => {
    // Act: User selects format
    handleFormatSelect('powerbi');
    
    // Assert: Preference should be saved
    expect(getFormatPreference()).toBe('powerbi');
  });
}

/**
 * Example: Component implementation snippet
 * 
 * This shows how the ExportImportControls component should use the utility.
 */
const ExampleExportImportControls = ({ currentConfig, onImportComplete }) => {
  // Initialize with saved preference
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(() => 
    getFormatPreference()
  );
  const [showFormatDialog, setShowFormatDialog] = useState(false);
  
  const handleExport = () => {
    // Open dialog with current format (which is the saved preference)
    setShowFormatDialog(true);
  };
  
  const handleFormatSelect = async (format: ExportFormat) => {
    // Save preference
    setFormatPreference(format);
    
    // Update state
    setSelectedFormat(format);
    
    // Close dialog
    setShowFormatDialog(false);
    
    // Perform export
    try {
      const result = await exportConfig(currentConfig, format);
      showSuccessNotification(`Exported as ${format.toUpperCase()}`);
    } catch (error) {
      showErrorNotification('Export failed');
    }
  };
  
  return (
    <div>
      <button onClick={handleExport}>Export</button>
      
      {showFormatDialog && (
        <FormatSelectionDialog
          defaultFormat={selectedFormat}
          onSelect={handleFormatSelect}
          onCancel={() => setShowFormatDialog(false)}
        />
      )}
    </div>
  );
};

// Mock functions for the examples
function useState<T>(initialValue: T | (() => T)): [T, (value: T) => void] {
  return [typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue, () => {}];
}
function openFormatSelectionDialog(options: any) {}
function handleFormatSelect(format: ExportFormat) {}
function setSelectedFormat(format: ExportFormat) {}
function proceedWithExport(format: ExportFormat) {}
function showFormatDialog(defaultFormat: ExportFormat): Promise<ExportFormat> {
  return Promise.resolve(defaultFormat);
}
function exportConfiguration(config: any, format: ExportFormat): Promise<any> {
  return Promise.resolve({ success: true, filename: 'test.json' });
}
function hasFormatPreference(): boolean { return false; }
function clearFormatPreference() {}
const currentConfig = {};
function exportConfig(config: any, format: ExportFormat): Promise<any> {
  return Promise.resolve({});
}
function showSuccessNotification(message: string) {}
function showErrorNotification(message: string) {}
const FormatSelectionDialog = ({ defaultFormat, onSelect, onCancel }: any) => null;
const props = {};
function render(component: any) { return { getByRole: () => {} }; }
