/**
 * Unit tests for ExportImportControls component
 * 
 * Tests button rendering, export/import flows, loading states, and error handling
 * Requirements: 9.1, 9.4, 9.5
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExportImportControls } from '../ExportImportControls';
import { ReportConfig } from '../../../types/api';

// Mock the format preference utilities
jest.mock('../../../utils/formatPreference', () => ({
  getFormatPreference: jest.fn(() => 'json'),
  setFormatPreference: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

describe('ExportImportControls', () => {
  const mockConfig: ReportConfig = {
    name: 'Test Report',
    tags: ['Tag1', 'Tag2'],
    timeRange: {
      startTime: new Date('2024-01-01T00:00:00Z'),
      endTime: new Date('2024-01-02T00:00:00Z'),
    },
    chartTypes: ['line'],
    template: 'default',
  };

  const mockOnImportComplete = jest.fn();
  const mockOnToast = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    
    // Mock File.text() method for import tests
    if (!File.prototype.text) {
      File.prototype.text = function() {
        return Promise.resolve(this.toString());
      };
    }
  });

  describe('Rendering', () => {
    it('renders export and import buttons', () => {
      render(
        <ExportImportControls
          currentConfig={mockConfig}
          onImportComplete={mockOnImportComplete}
        />
      );

      expect(screen.getByText('Export')).toBeInTheDocument();
      expect(screen.getByText('Import')).toBeInTheDocument();
    });

    it('renders buttons with correct icons', () => {
      render(
        <ExportImportControls
          currentConfig={mockConfig}
          onImportComplete={mockOnImportComplete}
        />
      );

      // Check for aria-labels
      expect(screen.getByLabelText('Export configuration')).toBeInTheDocument();
      expect(screen.getByLabelText('Import configuration')).toBeInTheDocument();
    });

    it('renders buttons with tooltips', () => {
      render(
        <ExportImportControls
          currentConfig={mockConfig}
          onImportComplete={mockOnImportComplete}
        />
      );

      const exportButton = screen.getByLabelText('Export configuration');
      const importButton = screen.getByLabelText('Import configuration');

      expect(exportButton).toHaveAttribute('title', 'Export report configuration to file');
      expect(importButton).toHaveAttribute('title', 'Import report configuration from file');
    });

    it('applies custom className', () => {
      const { container } = render(
        <ExportImportControls
          currentConfig={mockConfig}
          onImportComplete={mockOnImportComplete}
          className="custom-class"
        />
      );

      const wrapper = container.querySelector('.custom-class');
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('disables buttons when disabled prop is true', () => {
      render(
        <ExportImportControls
          currentConfig={mockConfig}
          onImportComplete={mockOnImportComplete}
          disabled={true}
        />
      );

      expect(screen.getByText('Export')).toBeDisabled();
      expect(screen.getByText('Import')).toBeDisabled();
    });

    it('does not open format dialog when export is clicked while disabled', () => {
      render(
        <ExportImportControls
          currentConfig={mockConfig}
          onImportComplete={mockOnImportComplete}
          disabled={true}
        />
      );

      fireEvent.click(screen.getByText('Export'));
      expect(screen.queryByText('Select Export Format')).not.toBeInTheDocument();
    });
  });

  describe('Export Flow', () => {
    it('opens format selection dialog on export click', () => {
      render(
        <ExportImportControls
          currentConfig={mockConfig}
          onImportComplete={mockOnImportComplete}
        />
      );

      fireEvent.click(screen.getByText('Export'));
      expect(screen.getByText('Select Export Format')).toBeInTheDocument();
    });

    it('closes format dialog on cancel', () => {
      render(
        <ExportImportControls
          currentConfig={mockConfig}
          onImportComplete={mockOnImportComplete}
        />
      );

      fireEvent.click(screen.getByText('Export'));
      expect(screen.getByText('Select Export Format')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByText('Select Export Format')).not.toBeInTheDocument();
    });

    it('shows loading state during export', async () => {
      // Mock successful export
      (global.fetch as jest.Mock).mockImplementation(() =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              headers: new Map([['Content-Disposition', 'attachment; filename="test.json"']]),
              blob: () => Promise.resolve(new Blob(['test'], { type: 'application/json' })),
            });
          }, 100);
        })
      );

      render(
        <ExportImportControls
          currentConfig={mockConfig}
          onImportComplete={mockOnImportComplete}
          onToast={mockOnToast}
        />
      );

      // Open dialog and select format
      fireEvent.click(screen.getByText('Export'));
      fireEvent.click(screen.getByText('JSON'));
      fireEvent.click(screen.getAllByText('Export')[1]); // Click Export in dialog

      // Check for loading state
      await waitFor(() => {
        expect(screen.getByText('Export').closest('button')).toBeDisabled();
      });
    });

    it('calls export API with correct parameters', async () => {
      // Mock successful export
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Map([['Content-Disposition', 'attachment; filename="test.json"']]),
        blob: () => Promise.resolve(new Blob(['test'], { type: 'application/json' })),
      });

      // Mock URL.createObjectURL and related methods
      global.URL.createObjectURL = jest.fn(() => 'blob:test');
      global.URL.revokeObjectURL = jest.fn();

      render(
        <ExportImportControls
          currentConfig={mockConfig}
          onImportComplete={mockOnImportComplete}
          onToast={mockOnToast}
        />
      );

      // Open dialog and select JSON format
      fireEvent.click(screen.getByText('Export'));
      fireEvent.click(screen.getAllByText('Export')[1]); // Click Export in dialog

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/reports/export'),
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('"format":"json"'),
          })
        );
      });
    });

    it('shows success toast on successful export', async () => {
      // Mock successful export
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Map([['Content-Disposition', 'attachment; filename="test.json"']]),
        blob: () => Promise.resolve(new Blob(['test'], { type: 'application/json' })),
      });

      global.URL.createObjectURL = jest.fn(() => 'blob:test');
      global.URL.revokeObjectURL = jest.fn();

      render(
        <ExportImportControls
          currentConfig={mockConfig}
          onImportComplete={mockOnImportComplete}
          onToast={mockOnToast}
        />
      );

      fireEvent.click(screen.getByText('Export'));
      fireEvent.click(screen.getAllByText('Export')[1]);

      await waitFor(() => {
        expect(mockOnToast).toHaveBeenCalledWith(
          'success',
          'Configuration exported successfully',
          expect.any(String)
        );
      });
    });

    it('shows error toast on export failure', async () => {
      // Mock failed export
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Export failed' }),
      });

      render(
        <ExportImportControls
          currentConfig={mockConfig}
          onImportComplete={mockOnImportComplete}
          onToast={mockOnToast}
        />
      );

      fireEvent.click(screen.getByText('Export'));
      fireEvent.click(screen.getAllByText('Export')[1]);

      await waitFor(() => {
        expect(mockOnToast).toHaveBeenCalledWith(
          'error',
          'Export failed',
          expect.any(String)
        );
      });
    });
  });

  describe('Import Flow', () => {
    it('opens file browser on import click', () => {
      render(
        <ExportImportControls
          currentConfig={mockConfig}
          onImportComplete={mockOnImportComplete}
        />
      );

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = jest.spyOn(fileInput, 'click');

      fireEvent.click(screen.getByText('Import'));
      expect(clickSpy).toHaveBeenCalled();
    });

    it('accepts only JSON files', () => {
      render(
        <ExportImportControls
          currentConfig={mockConfig}
          onImportComplete={mockOnImportComplete}
        />
      );

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toHaveAttribute('accept', '.json');
    });

    it('rejects non-JSON files', async () => {
      render(
        <ExportImportControls
          currentConfig={mockConfig}
          onImportComplete={mockOnImportComplete}
          onToast={mockOnToast}
        />
      );

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockOnToast).toHaveBeenCalledWith(
          'error',
          'Invalid file type',
          'Please select a JSON file'
        );
      });
    });

    it('rejects files larger than 10 MB', async () => {
      render(
        <ExportImportControls
          currentConfig={mockConfig}
          onImportComplete={mockOnImportComplete}
          onToast={mockOnToast}
        />
      );

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      // Create a mock file with size > 10 MB
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.json', {
        type: 'application/json',
      });
      Object.defineProperty(largeFile, 'size', { value: 11 * 1024 * 1024 });

      fireEvent.change(fileInput, { target: { files: [largeFile] } });

      await waitFor(() => {
        expect(mockOnToast).toHaveBeenCalledWith(
          'error',
          'File too large',
          'Maximum file size is 10 MB'
        );
      });
    });

    it('calls import API with file content', async () => {
      const importedConfig = { ...mockConfig, name: 'Imported Report' };
      const fileContent = JSON.stringify(importedConfig);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          config: importedConfig,
        }),
      });

      render(
        <ExportImportControls
          currentConfig={mockConfig}
          onImportComplete={mockOnImportComplete}
          onToast={mockOnToast}
        />
      );

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File([fileContent], 'test.json', {
        type: 'application/json',
      });
      
      // Mock the text() method for this specific file
      file.text = jest.fn().mockResolvedValue(fileContent);

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/reports/import'),
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('"fileContent"'),
          })
        );
      });
    });

    it('calls onImportComplete on successful import', async () => {
      const importedConfig = { ...mockConfig, name: 'Imported Report' };
      const fileContent = JSON.stringify(importedConfig);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          config: importedConfig,
        }),
      });

      render(
        <ExportImportControls
          currentConfig={mockConfig}
          onImportComplete={mockOnImportComplete}
          onToast={mockOnToast}
        />
      );

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File([fileContent], 'test.json', {
        type: 'application/json',
      });
      file.text = jest.fn().mockResolvedValue(fileContent);

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockOnImportComplete).toHaveBeenCalledWith(importedConfig);
      });
    });

    it('shows success toast on successful import', async () => {
      const importedConfig = { ...mockConfig, name: 'Imported Report' };
      const fileContent = JSON.stringify(importedConfig);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          config: importedConfig,
        }),
      });

      render(
        <ExportImportControls
          currentConfig={mockConfig}
          onImportComplete={mockOnImportComplete}
          onToast={mockOnToast}
        />
      );

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File([fileContent], 'test.json', {
        type: 'application/json',
      });
      file.text = jest.fn().mockResolvedValue(fileContent);

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockOnToast).toHaveBeenCalledWith(
          'success',
          'Configuration imported successfully',
          expect.any(String)
        );
      });
    });

    it('shows validation dialog on import validation failure', async () => {
      const fileContent = '{"invalid": "config"}';
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({
          success: false,
          errors: [
            {
              code: 'INVALID_FIELD_VALUE',
              field: 'timeRange.startTime',
              message: 'Start time must be before end time',
              severity: 'error',
            },
          ],
        }),
      });

      render(
        <ExportImportControls
          currentConfig={mockConfig}
          onImportComplete={mockOnImportComplete}
          onToast={mockOnToast}
        />
      );

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File([fileContent], 'test.json', {
        type: 'application/json',
      });
      file.text = jest.fn().mockResolvedValue(fileContent);

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Configuration Validation Failed')).toBeInTheDocument();
      });
    });

    it('shows warning toast for import with warnings', async () => {
      const importedConfig = { ...mockConfig, name: 'Imported Report' };
      const fileContent = JSON.stringify(importedConfig);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          config: importedConfig,
          warnings: ['Tag "NonExistentTag" does not exist in the database'],
        }),
      });

      render(
        <ExportImportControls
          currentConfig={mockConfig}
          onImportComplete={mockOnImportComplete}
          onToast={mockOnToast}
        />
      );

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File([fileContent], 'test.json', {
        type: 'application/json',
      });
      file.text = jest.fn().mockResolvedValue(fileContent);

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockOnToast).toHaveBeenCalledWith(
          'warning',
          'Configuration imported with warnings',
          expect.stringContaining('NonExistentTag')
        );
      });
    });
  });

  describe('Loading States', () => {
    it('shows loading spinner during export', async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(
        <ExportImportControls
          currentConfig={mockConfig}
          onImportComplete={mockOnImportComplete}
        />
      );

      fireEvent.click(screen.getByText('Export'));
      fireEvent.click(screen.getAllByText('Export')[1]);

      // Should show loading state
      await waitFor(() => {
        const exportButton = screen.getByLabelText('Export configuration');
        expect(exportButton).toBeDisabled();
      });
    });

    it('shows loading spinner during import', async () => {
      const fileContent = '{}';
      
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(
        <ExportImportControls
          currentConfig={mockConfig}
          onImportComplete={mockOnImportComplete}
        />
      );

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File([fileContent], 'test.json', { type: 'application/json' });
      file.text = jest.fn().mockResolvedValue(fileContent);

      fireEvent.change(fileInput, { target: { files: [file] } });

      // Should show loading state
      await waitFor(() => {
        const importButton = screen.getByLabelText('Import configuration');
        expect(importButton).toBeDisabled();
      });
    });
  });

  describe('Toast Notifications', () => {
    it('falls back to console.log when no toast handler provided', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Map([['Content-Disposition', 'attachment; filename="test.json"']]),
        blob: () => Promise.resolve(new Blob(['test'], { type: 'application/json' })),
      });

      global.URL.createObjectURL = jest.fn(() => 'blob:test');
      global.URL.revokeObjectURL = jest.fn();

      render(
        <ExportImportControls
          currentConfig={mockConfig}
          onImportComplete={mockOnImportComplete}
          // No onToast provided
        />
      );

      fireEvent.click(screen.getByText('Export'));
      fireEvent.click(screen.getAllByText('Export')[1]);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('[SUCCESS]')
        );
      });

      consoleSpy.mockRestore();
    });
  });
});
