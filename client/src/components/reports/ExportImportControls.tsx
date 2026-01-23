/**
 * Export/Import Controls Component
 * 
 * Provides UI controls for exporting and importing report configurations.
 * Integrates with FormatSelectionDialog and ValidationErrorDialog for user interactions.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import React, { useState, useRef } from 'react';
import { Download, Upload, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { FormatSelectionDialog } from './FormatSelectionDialog';
import { ValidationErrorDialog, ValidationError } from './ValidationErrorDialog';
import { getFormatPreference, setFormatPreference } from '../../utils/formatPreference';
import { ReportConfig, ExportFormat, ImportResult } from '../../types/api';
import { apiService } from '../../services/api';

export interface ExportImportControlsProps {
  /** Current report configuration to export */
  currentConfig: ReportConfig;
  /** Callback when import completes successfully */
  onImportComplete: (config: ReportConfig) => void;
  /** Whether the controls should be disabled */
  disabled?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Optional toast notification handler */
  onToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string, description?: string) => void;
}


export const ExportImportControls: React.FC<ExportImportControlsProps> = ({
  currentConfig,
  onImportComplete,
  disabled = false,
  className = '',
  onToast,
}) => {
  // State for export
  const [isExporting, setIsExporting] = useState(false);
  const [showFormatDialog, setShowFormatDialog] = useState(false);

  // State for import
  const [isImporting, setIsImporting] = useState(false);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<ValidationError[]>([]);

  // State protection: Store original config before import attempt
  const [savedConfigBeforeImport, setSavedConfigBeforeImport] = useState<ReportConfig | null>(null);

  // File input ref for import
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Show toast notification
   */
  const showToast = (type: 'success' | 'error' | 'warning' | 'info', message: string, description?: string) => {
    if (onToast) {
      onToast(type, message, description);
    } else {
      // Fallback to console if no toast handler provided
      console.log(`[${type.toUpperCase()}] ${message}${description ? ': ' + description : ''}`);
    }
  };

  /**
   * Handle export button click
   * Opens format selection dialog
   */
  const handleExportClick = () => {
    if (disabled) return;
    setShowFormatDialog(true);
  };

  /**
   * Handle format selection and perform export
   */
  const handleFormatSelect = async (format: ExportFormat) => {
    setShowFormatDialog(false);
    setIsExporting(true);

    try {
      // Save format preference for next time
      setFormatPreference(format);

      // Make API call to export endpoint via service (handles auth)
      const { blob, filename } = await apiService.exportConfiguration(currentConfig, format);

      // Trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Show success notification
      showToast(
        'success',
        'Configuration exported successfully',
        `Saved as ${filename}`
      );
    } catch (error) {
      console.error('Export error:', error);
      showToast(
        'error',
        'Export failed',
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Handle import button click
   * Opens file browser
   */
  const handleImportClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  /**
   * Handle file selection and perform import
   */
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset file input so the same file can be selected again
    event.target.value = '';

    // Validate file type
    if (!file.name.endsWith('.json')) {
      showToast('error', 'Invalid file type', 'Please select a JSON file');
      return;
    }

    // Validate file size (10 MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_FILE_SIZE) {
      showToast('error', 'File too large', 'Maximum file size is 10 MB');
      return;
    }

    // STATE PROTECTION: Save current configuration before attempting import
    setSavedConfigBeforeImport(currentConfig);

    setIsImporting(true);

    try {
      // Read file content
      const fileContent = await file.text();

      // Make API call to import endpoint via service (handles auth)
      const result = await apiService.importConfiguration(fileContent);

      if (!result.success) {
        // Import failed - show validation errors
        // STATE PROTECTION: Configuration remains unchanged (onImportComplete not called)
        const errors = result.errors || [];
        const errorMessages = errors.filter(e => e.severity === 'error');
        const warningMessages = errors.filter(e => e.severity === 'warning');

        setValidationErrors(errorMessages);
        setValidationWarnings(warningMessages);
        setShowValidationDialog(true);

        // Clear saved config since we're not proceeding with import
        setSavedConfigBeforeImport(null);
        return;
      }

      // Import succeeded
      if (result.config) {
        // STATE PROTECTION: Only update configuration on successful validation
        onImportComplete(result.config);

        // Clear saved config since import was successful
        setSavedConfigBeforeImport(null);

        // Show success message with warnings if any
        if (result.warnings && result.warnings.length > 0) {
          showToast(
            'warning',
            'Configuration imported with warnings',
            result.warnings.join('; ')
          );
        } else {
          showToast(
            'success',
            'Configuration imported successfully',
            'Review the configuration before generating the report'
          );
        }
      } else {
        throw new Error('Import succeeded but no configuration was returned');
      }
    } catch (error) {
      console.error('Import error:', error);

      // STATE PROTECTION: Restore original configuration on unexpected error
      if (savedConfigBeforeImport) {
        onImportComplete(savedConfigBeforeImport);
        setSavedConfigBeforeImport(null);
      }

      showToast(
        'error',
        'Import failed',
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
    } finally {
      setIsImporting(false);
    }
  };

  /**
   * Handle validation dialog close
   */
  const handleValidationDialogClose = () => {
    setShowValidationDialog(false);
    setValidationErrors([]);
    setValidationWarnings([]);
  };

  /**
   * Handle "Try Again" from validation dialog
   */
  const handleTryAgain = () => {
    handleValidationDialogClose();
    handleImportClick();
  };

  return (
    <>
      <div className={`flex items-center gap-2 ${className}`}>
        {/* Export Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportClick}
          disabled={disabled || isExporting}
          loading={isExporting}
          className="inline-flex items-center gap-2"
          title="Export report configuration to file"
          aria-label="Export configuration"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="w-4 h-4" aria-hidden="true" />
          )}
          <span>Export</span>
        </Button>

        {/* Import Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleImportClick}
          disabled={disabled || isImporting}
          loading={isImporting}
          className="inline-flex items-center gap-2"
          title="Import report configuration from file"
          aria-label="Import configuration"
        >
          {isImporting ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="w-4 h-4" aria-hidden="true" />
          )}
          <span>Import</span>
        </Button>

        {/* Hidden file input for import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
          aria-hidden="true"
        />
      </div>

      {/* Format Selection Dialog */}
      <FormatSelectionDialog
        isOpen={showFormatDialog}
        onClose={() => setShowFormatDialog(false)}
        onSelectFormat={handleFormatSelect}
      />

      {/* Validation Error Dialog */}
      <ValidationErrorDialog
        isOpen={showValidationDialog}
        errors={validationErrors}
        warnings={validationWarnings}
        onClose={handleValidationDialogClose}
        onTryAgain={handleTryAgain}
      />
    </>
  );
};
