import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ValidationErrorDialog, ValidationError } from '../ValidationErrorDialog';

describe('ValidationErrorDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnTryAgain = jest.fn();

  const defaultProps = {
    isOpen: true,
    errors: [] as ValidationError[],
    warnings: [] as ValidationError[],
    onClose: mockOnClose,
    onTryAgain: mockOnTryAgain,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(<ValidationErrorDialog {...defaultProps} isOpen={false} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(<ValidationErrorDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should render dialog title', () => {
      render(<ValidationErrorDialog {...defaultProps} />);
      expect(screen.getByText('Configuration Validation Failed')).toBeInTheDocument();
    });

    it('should render dialog description', () => {
      render(<ValidationErrorDialog {...defaultProps} />);
      expect(screen.getByText(/The imported configuration contains/)).toBeInTheDocument();
    });

    it('should render Close button', () => {
      render(<ValidationErrorDialog {...defaultProps} />);
      const closeButtons = screen.getAllByRole('button', { name: /close/i });
      expect(closeButtons.length).toBeGreaterThan(0);
    });

    it('should render Try Again button', () => {
      render(<ValidationErrorDialog {...defaultProps} />);
      expect(screen.getByRole('button', { name: /try importing again/i })).toBeInTheDocument();
    });
  });

  describe('Error Display', () => {
    it('should display errors section when errors are present', () => {
      const errors: ValidationError[] = [
        { field: 'tags', message: 'Tags array is required', severity: 'error' },
        { field: 'timeRange', message: 'Invalid time range', severity: 'error' },
      ];

      render(<ValidationErrorDialog {...defaultProps} errors={errors} />);
      
      expect(screen.getByText(/Errors \(2\)/)).toBeInTheDocument();
    });

    it('should display error messages', () => {
      const errors: ValidationError[] = [
        { field: 'tags', message: 'Tags array is required', severity: 'error' },
      ];

      render(<ValidationErrorDialog {...defaultProps} errors={errors} />);
      
      expect(screen.getByText('Tags array is required')).toBeInTheDocument();
    });

    it('should display error field names', () => {
      const errors: ValidationError[] = [
        { field: 'tags', message: 'Tags array is required', severity: 'error' },
      ];

      render(<ValidationErrorDialog {...defaultProps} errors={errors} />);
      
      expect(screen.getByText('Field: tags')).toBeInTheDocument();
    });

    it('should display errors without field names', () => {
      const errors: ValidationError[] = [
        { message: 'Invalid JSON format', severity: 'error' },
      ];

      render(<ValidationErrorDialog {...defaultProps} errors={errors} />);
      
      expect(screen.getByText('Invalid JSON format')).toBeInTheDocument();
      expect(screen.queryByText(/Field:/)).not.toBeInTheDocument();
    });

    it('should display multiple errors', () => {
      const errors: ValidationError[] = [
        { field: 'tags', message: 'Tags array is required', severity: 'error' },
        { field: 'timeRange.startTime', message: 'Start time is invalid', severity: 'error' },
        { field: 'sampling.mode', message: 'Invalid sampling mode', severity: 'error' },
      ];

      render(<ValidationErrorDialog {...defaultProps} errors={errors} />);
      
      expect(screen.getByText('Tags array is required')).toBeInTheDocument();
      expect(screen.getByText('Start time is invalid')).toBeInTheDocument();
      expect(screen.getByText('Invalid sampling mode')).toBeInTheDocument();
    });
  });

  describe('Warning Display', () => {
    it('should display warnings section when warnings are present', () => {
      const warnings: ValidationError[] = [
        { field: 'tags', message: 'Tag "Temperature" not found in database', severity: 'warning' },
      ];

      render(<ValidationErrorDialog {...defaultProps} warnings={warnings} />);
      
      expect(screen.getByText(/Warnings \(1\)/)).toBeInTheDocument();
    });

    it('should display warning messages', () => {
      const warnings: ValidationError[] = [
        { field: 'tags', message: 'Tag "Temperature" not found in database', severity: 'warning' },
      ];

      render(<ValidationErrorDialog {...defaultProps} warnings={warnings} />);
      
      expect(screen.getByText('Tag "Temperature" not found in database')).toBeInTheDocument();
    });

    it('should display warning field names', () => {
      const warnings: ValidationError[] = [
        { field: 'tags', message: 'Tag "Temperature" not found in database', severity: 'warning' },
      ];

      render(<ValidationErrorDialog {...defaultProps} warnings={warnings} />);
      
      expect(screen.getByText('Field: tags')).toBeInTheDocument();
    });

    it('should display multiple warnings', () => {
      const warnings: ValidationError[] = [
        { field: 'tags', message: 'Tag "Temperature" not found', severity: 'warning' },
        { field: 'tags', message: 'Tag "Pressure" not found', severity: 'warning' },
      ];

      render(<ValidationErrorDialog {...defaultProps} warnings={warnings} />);
      
      expect(screen.getByText('Tag "Temperature" not found')).toBeInTheDocument();
      expect(screen.getByText('Tag "Pressure" not found')).toBeInTheDocument();
    });
  });

  describe('Mixed Errors and Warnings', () => {
    it('should display both errors and warnings sections', () => {
      const errors: ValidationError[] = [
        { field: 'tags', message: 'Tags array is required', severity: 'error' },
      ];
      const warnings: ValidationError[] = [
        { field: 'tags', message: 'Tag "Temperature" not found', severity: 'warning' },
      ];

      render(<ValidationErrorDialog {...defaultProps} errors={errors} warnings={warnings} />);
      
      expect(screen.getByText(/Errors \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(/Warnings \(1\)/)).toBeInTheDocument();
    });

    it('should display errors before warnings', () => {
      const errors: ValidationError[] = [
        { field: 'tags', message: 'Tags array is required', severity: 'error' },
      ];
      const warnings: ValidationError[] = [
        { field: 'tags', message: 'Tag "Temperature" not found', severity: 'warning' },
      ];

      const { container } = render(
        <ValidationErrorDialog {...defaultProps} errors={errors} warnings={warnings} />
      );
      
      const sections = container.querySelectorAll('.space-y-6 > div');
      const firstSection = sections[0];
      const secondSection = sections[1];
      
      expect(within(firstSection as HTMLElement).getByText(/Errors/)).toBeInTheDocument();
      expect(within(secondSection as HTMLElement).getByText(/Warnings/)).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onClose when Close button is clicked', () => {
      render(<ValidationErrorDialog {...defaultProps} />);
      
      const closeButton = screen.getByRole('button', { name: 'Close dialog' });
      fireEvent.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onTryAgain when Try Again button is clicked', () => {
      render(<ValidationErrorDialog {...defaultProps} />);
      
      const tryAgainButton = screen.getByRole('button', { name: /try importing again/i });
      fireEvent.click(tryAgainButton);
      
      expect(mockOnTryAgain).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when X button is clicked', () => {
      render(<ValidationErrorDialog {...defaultProps} />);
      
      const xButton = screen.getByRole('button', { name: 'Close' });
      fireEvent.click(xButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', () => {
      const { container } = render(<ValidationErrorDialog {...defaultProps} />);
      
      const backdrop = container.firstChild as HTMLElement;
      fireEvent.click(backdrop);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not close when clicking inside dialog content', () => {
      render(<ValidationErrorDialog {...defaultProps} />);
      
      const dialog = screen.getByRole('dialog');
      fireEvent.click(dialog);
      
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should call onClose when Escape key is pressed', () => {
      render(<ValidationErrorDialog {...defaultProps} />);
      
      const dialog = screen.getByRole('dialog');
      fireEvent.keyDown(dialog, { key: 'Escape' });
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<ValidationErrorDialog {...defaultProps} />);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'validation-dialog-title');
      expect(dialog).toHaveAttribute('aria-describedby', 'validation-dialog-description');
    });

    it('should have accessible button labels', () => {
      render(<ValidationErrorDialog {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try importing again/i })).toBeInTheDocument();
    });

    it('should hide decorative icons from screen readers', () => {
      const errors: ValidationError[] = [
        { field: 'tags', message: 'Tags array is required', severity: 'error' },
      ];

      const { container } = render(<ValidationErrorDialog {...defaultProps} errors={errors} />);
      
      const icons = container.querySelectorAll('[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Help Text', () => {
    it('should display help text for errors', () => {
      const errors: ValidationError[] = [
        { field: 'tags', message: 'Tags array is required', severity: 'error' },
      ];

      render(<ValidationErrorDialog {...defaultProps} errors={errors} />);
      
      expect(screen.getByText(/What to do next:/)).toBeInTheDocument();
      expect(screen.getByText(/Please correct the errors in your configuration file/)).toBeInTheDocument();
    });

    it('should display help text for warnings only', () => {
      const warnings: ValidationError[] = [
        { field: 'tags', message: 'Tag "Temperature" not found', severity: 'warning' },
      ];

      render(<ValidationErrorDialog {...defaultProps} warnings={warnings} />);
      
      expect(screen.getByText(/What to do next:/)).toBeInTheDocument();
      expect(screen.getByText(/Warnings indicate potential issues but will not prevent import/)).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should apply error styling to error items', () => {
      const errors: ValidationError[] = [
        { field: 'tags', message: 'Tags array is required', severity: 'error' },
      ];

      const { container } = render(<ValidationErrorDialog {...defaultProps} errors={errors} />);
      
      const errorItem = container.querySelector('.bg-red-50');
      expect(errorItem).toBeInTheDocument();
      expect(errorItem).toHaveClass('border-red-200');
    });

    it('should apply warning styling to warning items', () => {
      const warnings: ValidationError[] = [
        { field: 'tags', message: 'Tag "Temperature" not found', severity: 'warning' },
      ];

      const { container } = render(<ValidationErrorDialog {...defaultProps} warnings={warnings} />);
      
      const warningItem = container.querySelector('.bg-yellow-50');
      expect(warningItem).toBeInTheDocument();
      expect(warningItem).toHaveClass('border-yellow-200');
    });

    it('should have scrollable content area', () => {
      const { container } = render(<ValidationErrorDialog {...defaultProps} />);
      
      const contentArea = container.querySelector('.overflow-y-auto');
      expect(contentArea).toBeInTheDocument();
    });

    it('should have max height constraint', () => {
      const { container } = render(<ValidationErrorDialog {...defaultProps} />);
      
      const dialog = container.querySelector('.max-h-\\[80vh\\]');
      expect(dialog).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty errors and warnings arrays', () => {
      render(<ValidationErrorDialog {...defaultProps} errors={[]} warnings={[]} />);
      
      expect(screen.queryByText(/Errors/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Warnings/)).not.toBeInTheDocument();
    });

    it('should handle very long error messages', () => {
      const errors: ValidationError[] = [
        {
          field: 'tags',
          message: 'This is a very long error message that should wrap properly and not break the layout. '.repeat(5),
          severity: 'error',
        },
      ];

      render(<ValidationErrorDialog {...defaultProps} errors={errors} />);
      
      expect(screen.getByText(/This is a very long error message/)).toBeInTheDocument();
    });

    it('should handle many errors', () => {
      const errors: ValidationError[] = Array.from({ length: 20 }, (_, i) => ({
        field: `field${i}`,
        message: `Error message ${i}`,
        severity: 'error' as const,
      }));

      render(<ValidationErrorDialog {...defaultProps} errors={errors} />);
      
      expect(screen.getByText(/Errors \(20\)/)).toBeInTheDocument();
    });

    it('should handle special characters in error messages', () => {
      const errors: ValidationError[] = [
        { field: 'tags', message: 'Error with <special> & "characters"', severity: 'error' },
      ];

      render(<ValidationErrorDialog {...defaultProps} errors={errors} />);
      
      expect(screen.getByText('Error with <special> & "characters"')).toBeInTheDocument();
    });
  });
});
