import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormatSelectionDialog } from '../FormatSelectionDialog';

describe('FormatSelectionDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnSelectFormat = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(
        <FormatSelectionDialog
          isOpen={false}
          onClose={mockOnClose}
          onSelectFormat={mockOnSelectFormat}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(
        <FormatSelectionDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelectFormat={mockOnSelectFormat}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Select Export Format')).toBeInTheDocument();
    });

    it('should display both format options', () => {
      render(
        <FormatSelectionDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelectFormat={mockOnSelectFormat}
        />
      );

      expect(screen.getByText('JSON')).toBeInTheDocument();
      expect(screen.getByText('Power BI')).toBeInTheDocument();
    });

    it('should display format descriptions', () => {
      render(
        <FormatSelectionDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelectFormat={mockOnSelectFormat}
        />
      );

      expect(
        screen.getByText(/Friendly format for backup and sharing/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Connection file for Microsoft Power BI/)
      ).toBeInTheDocument();
    });

    it('should have JSON selected by default', () => {
      render(
        <FormatSelectionDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelectFormat={mockOnSelectFormat}
        />
      );

      const jsonButton = screen.getByLabelText('Select JSON format');
      expect(jsonButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Format Selection', () => {
    it('should allow selecting JSON format', () => {
      render(
        <FormatSelectionDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelectFormat={mockOnSelectFormat}
        />
      );

      const jsonButton = screen.getByLabelText('Select JSON format');
      fireEvent.click(jsonButton);

      expect(jsonButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should allow selecting Power BI format', () => {
      render(
        <FormatSelectionDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelectFormat={mockOnSelectFormat}
        />
      );

      const powerBIButton = screen.getByLabelText('Select Power BI format');
      fireEvent.click(powerBIButton);

      expect(powerBIButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should switch between formats', () => {
      render(
        <FormatSelectionDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelectFormat={mockOnSelectFormat}
        />
      );

      const jsonButton = screen.getByLabelText('Select JSON format');
      const powerBIButton = screen.getByLabelText('Select Power BI format');

      // Initially JSON is selected
      expect(jsonButton).toHaveAttribute('aria-pressed', 'true');
      expect(powerBIButton).toHaveAttribute('aria-pressed', 'false');

      // Select Power BI
      fireEvent.click(powerBIButton);
      expect(jsonButton).toHaveAttribute('aria-pressed', 'false');
      expect(powerBIButton).toHaveAttribute('aria-pressed', 'true');

      // Select JSON again
      fireEvent.click(jsonButton);
      expect(jsonButton).toHaveAttribute('aria-pressed', 'true');
      expect(powerBIButton).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('Actions', () => {
    it('should call onSelectFormat with json when Export is clicked', () => {
      render(
        <FormatSelectionDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelectFormat={mockOnSelectFormat}
        />
      );

      const exportButton = screen.getByRole('button', { name: /Export as JSON/i });
      fireEvent.click(exportButton);

      expect(mockOnSelectFormat).toHaveBeenCalledWith('json');
      expect(mockOnSelectFormat).toHaveBeenCalledTimes(1);
    });

    it('should call onSelectFormat with powerbi when Power BI is selected and Export is clicked', () => {
      render(
        <FormatSelectionDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelectFormat={mockOnSelectFormat}
        />
      );

      const powerBIButton = screen.getByLabelText('Select Power BI format');
      fireEvent.click(powerBIButton);

      const exportButton = screen.getByRole('button', { name: /Export as Power BI/i });
      fireEvent.click(exportButton);

      expect(mockOnSelectFormat).toHaveBeenCalledWith('powerbi');
      expect(mockOnSelectFormat).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when Cancel is clicked', () => {
      render(
        <FormatSelectionDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelectFormat={mockOnSelectFormat}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /Cancel export/i });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(mockOnSelectFormat).not.toHaveBeenCalled();
    });

    it('should call onClose when backdrop is clicked', () => {
      const { container } = render(
        <FormatSelectionDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelectFormat={mockOnSelectFormat}
        />
      );

      // The backdrop is the outermost div with the click handler
      const backdrop = container.querySelector('.fixed.inset-0');
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('Keyboard Navigation', () => {
    it('should close dialog when Escape key is pressed', () => {
      const { container } = render(
        <FormatSelectionDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelectFormat={mockOnSelectFormat}
        />
      );

      const backdrop = container.querySelector('.fixed.inset-0');
      if (backdrop) {
        fireEvent.keyDown(backdrop, { key: 'Escape' });
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      }
    });

    it('should confirm selection when Enter key is pressed', () => {
      const { container } = render(
        <FormatSelectionDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelectFormat={mockOnSelectFormat}
        />
      );

      const backdrop = container.querySelector('.fixed.inset-0');
      if (backdrop) {
        fireEvent.keyDown(backdrop, { key: 'Enter' });
        expect(mockOnSelectFormat).toHaveBeenCalledWith('json');
      }
    });

    it('should allow selecting format with Enter key', () => {
      render(
        <FormatSelectionDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelectFormat={mockOnSelectFormat}
        />
      );

      const powerBIButton = screen.getByLabelText('Select Power BI format');
      fireEvent.keyDown(powerBIButton, { key: 'Enter' });

      expect(powerBIButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should allow selecting format with Space key', () => {
      render(
        <FormatSelectionDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelectFormat={mockOnSelectFormat}
        />
      );

      const powerBIButton = screen.getByLabelText('Select Power BI format');
      fireEvent.keyDown(powerBIButton, { key: ' ' });

      expect(powerBIButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <FormatSelectionDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelectFormat={mockOnSelectFormat}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'format-dialog-title');
      expect(dialog).toHaveAttribute('aria-describedby', 'format-dialog-description');
    });

    it('should have accessible button labels', () => {
      render(
        <FormatSelectionDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelectFormat={mockOnSelectFormat}
        />
      );

      expect(screen.getByLabelText('Select JSON format')).toBeInTheDocument();
      expect(screen.getByLabelText('Select Power BI format')).toBeInTheDocument();
      expect(screen.getByLabelText('Cancel export')).toBeInTheDocument();
    });

    it('should indicate selected format with aria-pressed', () => {
      render(
        <FormatSelectionDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelectFormat={mockOnSelectFormat}
        />
      );

      const jsonButton = screen.getByLabelText('Select JSON format');
      const powerBIButton = screen.getByLabelText('Select Power BI format');

      expect(jsonButton).toHaveAttribute('aria-pressed', 'true');
      expect(powerBIButton).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('Visual Feedback', () => {
    it('should display check icon for selected format', () => {
      render(
        <FormatSelectionDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelectFormat={mockOnSelectFormat}
        />
      );

      // JSON is selected by default, so it should have a check icon
      const jsonButton = screen.getByLabelText('Select JSON format');
      const checkIcon = jsonButton.querySelector('svg[class*="text-primary-600"]');
      expect(checkIcon).toBeInTheDocument();
    });

    it('should update check icon when selection changes', () => {
      render(
        <FormatSelectionDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelectFormat={mockOnSelectFormat}
        />
      );

      const powerBIButton = screen.getByLabelText('Select Power BI format');
      fireEvent.click(powerBIButton);

      // Power BI should now have the check icon
      const checkIcon = powerBIButton.querySelector('svg[class*="text-primary-600"]');
      expect(checkIcon).toBeInTheDocument();
    });
  });
});
