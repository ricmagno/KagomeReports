import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SpecificationLimitsConfig } from '../SpecificationLimitsConfig';
import { SpecificationLimits } from '../../../types/api';

describe('SpecificationLimitsConfig', () => {
  const mockOnChange = jest.fn();
  const defaultTags = ['TAG001', 'TAG002'];

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  describe('Rendering', () => {
    it('should render nothing when no tags are provided', () => {
      const { container } = render(
        <SpecificationLimitsConfig
          tags={[]}
          onChange={mockOnChange}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render specification limit inputs for each tag', () => {
      render(
        <SpecificationLimitsConfig
          tags={defaultTags}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('TAG001')).toBeInTheDocument();
      expect(screen.getByText('TAG002')).toBeInTheDocument();
      expect(screen.getAllByLabelText(/LSL \(Lower Specification Limit\)/i)).toHaveLength(2);
      expect(screen.getAllByLabelText(/USL \(Upper Specification Limit\)/i)).toHaveLength(2);
    });

    it('should display info message about specification limits', () => {
      render(
        <SpecificationLimitsConfig
          tags={defaultTags}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/Specification Limits \(Optional\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Configure LSL/i)).toBeInTheDocument();
    });

    it('should render with existing specification limits', () => {
      const existingLimits: Record<string, SpecificationLimits> = {
        TAG001: { lsl: 10, usl: 90 },
        TAG002: { lsl: 0, usl: 100 }
      };

      render(
        <SpecificationLimitsConfig
          tags={defaultTags}
          specificationLimits={existingLimits}
          onChange={mockOnChange}
        />
      );

      const lslInputs = screen.getAllByLabelText(/LSL \(Lower Specification Limit\)/i);
      const uslInputs = screen.getAllByLabelText(/USL \(Upper Specification Limit\)/i);

      expect(lslInputs[0]).toHaveValue(10);
      expect(uslInputs[0]).toHaveValue(90);
      expect(lslInputs[1]).toHaveValue(0);
      expect(uslInputs[1]).toHaveValue(100);
    });
  });

  describe('User Interactions', () => {
    it('should call onChange when LSL is entered', async () => {
      render(
        <SpecificationLimitsConfig
          tags={['TAG001']}
          onChange={mockOnChange}
        />
      );

      const lslInput = screen.getByLabelText(/LSL \(Lower Specification Limit\)/i);
      fireEvent.change(lslInput, { target: { value: '10' } });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          TAG001: { lsl: 10 }
        });
      });
    });

    it('should call onChange when USL is entered', async () => {
      render(
        <SpecificationLimitsConfig
          tags={['TAG001']}
          onChange={mockOnChange}
        />
      );

      const uslInput = screen.getByLabelText(/USL \(Upper Specification Limit\)/i);
      fireEvent.change(uslInput, { target: { value: '100' } });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          TAG001: { usl: 100 }
        });
      });
    });

    it('should handle clearing input values', async () => {
      const existingLimits: Record<string, SpecificationLimits> = {
        TAG001: { lsl: 10, usl: 90 }
      };

      render(
        <SpecificationLimitsConfig
          tags={['TAG001']}
          specificationLimits={existingLimits}
          onChange={mockOnChange}
        />
      );

      const lslInput = screen.getByLabelText(/LSL \(Lower Specification Limit\)/i);
      fireEvent.change(lslInput, { target: { value: '' } });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          TAG001: { lsl: undefined, usl: 90 }
        });
      });
    });

    it('should handle decimal values', async () => {
      render(
        <SpecificationLimitsConfig
          tags={['TAG001']}
          onChange={mockOnChange}
        />
      );

      const lslInput = screen.getByLabelText(/LSL \(Lower Specification Limit\)/i);
      fireEvent.change(lslInput, { target: { value: '10.5' } });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          TAG001: { lsl: 10.5 }
        });
      });
    });

    it('should handle negative values', async () => {
      render(
        <SpecificationLimitsConfig
          tags={['TAG001']}
          onChange={mockOnChange}
        />
      );

      const lslInput = screen.getByLabelText(/LSL \(Lower Specification Limit\)/i);
      fireEvent.change(lslInput, { target: { value: '-10' } });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          TAG001: { lsl: -10 }
        });
      });
    });
  });

  describe('Validation', () => {
    it('should show error when USL is less than LSL', async () => {
      render(
        <SpecificationLimitsConfig
          tags={['TAG001']}
          onChange={mockOnChange}
        />
      );

      const lslInput = screen.getByLabelText(/LSL \(Lower Specification Limit\)/i);
      const uslInput = screen.getByLabelText(/USL \(Upper Specification Limit\)/i);

      fireEvent.change(lslInput, { target: { value: '100' } });
      fireEvent.change(uslInput, { target: { value: '50' } });

      await waitFor(() => {
        expect(screen.getByText('USL must be greater than LSL')).toBeInTheDocument();
      });
    });

    it('should show error when USL equals LSL', async () => {
      render(
        <SpecificationLimitsConfig
          tags={['TAG001']}
          onChange={mockOnChange}
        />
      );

      const lslInput = screen.getByLabelText(/LSL \(Lower Specification Limit\)/i);
      const uslInput = screen.getByLabelText(/USL \(Upper Specification Limit\)/i);

      fireEvent.change(lslInput, { target: { value: '50' } });
      fireEvent.change(uslInput, { target: { value: '50' } });

      await waitFor(() => {
        expect(screen.getByText('USL must be greater than LSL')).toBeInTheDocument();
      });
    });

    it('should not show error when USL is greater than LSL', async () => {
      render(
        <SpecificationLimitsConfig
          tags={['TAG001']}
          onChange={mockOnChange}
        />
      );

      const lslInput = screen.getByLabelText(/LSL \(Lower Specification Limit\)/i);
      const uslInput = screen.getByLabelText(/USL \(Upper Specification Limit\)/i);

      fireEvent.change(lslInput, { target: { value: '10' } });
      fireEvent.change(uslInput, { target: { value: '90' } });

      await waitFor(() => {
        expect(screen.queryByText('USL must be greater than LSL')).not.toBeInTheDocument();
      });
    });

    it('should not show error when only LSL is provided', async () => {
      render(
        <SpecificationLimitsConfig
          tags={['TAG001']}
          onChange={mockOnChange}
        />
      );

      const lslInput = screen.getByLabelText(/LSL \(Lower Specification Limit\)/i);
      fireEvent.change(lslInput, { target: { value: '10' } });

      await waitFor(() => {
        expect(screen.queryByText('USL must be greater than LSL')).not.toBeInTheDocument();
      });
    });

    it('should not show error when only USL is provided', async () => {
      render(
        <SpecificationLimitsConfig
          tags={['TAG001']}
          onChange={mockOnChange}
        />
      );

      const uslInput = screen.getByLabelText(/USL \(Upper Specification Limit\)/i);
      fireEvent.change(uslInput, { target: { value: '90' } });

      await waitFor(() => {
        expect(screen.queryByText('USL must be greater than LSL')).not.toBeInTheDocument();
      });
    });

    it('should clear error when values are corrected', async () => {
      render(
        <SpecificationLimitsConfig
          tags={['TAG001']}
          onChange={mockOnChange}
        />
      );

      const lslInput = screen.getByLabelText(/LSL \(Lower Specification Limit\)/i);
      const uslInput = screen.getByLabelText(/USL \(Upper Specification Limit\)/i);

      // Set invalid values
      fireEvent.change(lslInput, { target: { value: '100' } });
      fireEvent.change(uslInput, { target: { value: '50' } });

      await waitFor(() => {
        expect(screen.getByText('USL must be greater than LSL')).toBeInTheDocument();
      });

      // Correct the values
      fireEvent.change(uslInput, { target: { value: '150' } });

      await waitFor(() => {
        expect(screen.queryByText('USL must be greater than LSL')).not.toBeInTheDocument();
      });
    });

    it('should show validation errors summary when there are errors', async () => {
      render(
        <SpecificationLimitsConfig
          tags={['TAG001', 'TAG002']}
          onChange={mockOnChange}
        />
      );

      const lslInputs = screen.getAllByLabelText(/LSL \(Lower Specification Limit\)/i);
      const uslInputs = screen.getAllByLabelText(/USL \(Upper Specification Limit\)/i);

      // Set invalid values for TAG001
      fireEvent.change(lslInputs[0], { target: { value: '100' } });
      fireEvent.change(uslInputs[0], { target: { value: '50' } });

      await waitFor(() => {
        expect(screen.getByText('Validation Errors')).toBeInTheDocument();
        expect(screen.getByText(/Please fix the errors above/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper labels for inputs', () => {
      render(
        <SpecificationLimitsConfig
          tags={['TAG001']}
          onChange={mockOnChange}
        />
      );

      const lslInput = screen.getByLabelText(/LSL \(Lower Specification Limit\)/i);
      const uslInput = screen.getByLabelText(/USL \(Upper Specification Limit\)/i);

      expect(lslInput).toHaveAttribute('id', 'lsl-TAG001');
      expect(uslInput).toHaveAttribute('id', 'usl-TAG001');
    });

    it('should set aria-invalid when there is an error', async () => {
      render(
        <SpecificationLimitsConfig
          tags={['TAG001']}
          onChange={mockOnChange}
        />
      );

      const lslInput = screen.getByLabelText(/LSL \(Lower Specification Limit\)/i);
      const uslInput = screen.getByLabelText(/USL \(Upper Specification Limit\)/i);

      fireEvent.change(lslInput, { target: { value: '100' } });
      fireEvent.change(uslInput, { target: { value: '50' } });

      await waitFor(() => {
        expect(lslInput).toHaveAttribute('aria-invalid', 'true');
        expect(uslInput).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('should associate error message with inputs using aria-describedby', async () => {
      render(
        <SpecificationLimitsConfig
          tags={['TAG001']}
          onChange={mockOnChange}
        />
      );

      const lslInput = screen.getByLabelText(/LSL \(Lower Specification Limit\)/i);
      const uslInput = screen.getByLabelText(/USL \(Upper Specification Limit\)/i);

      fireEvent.change(lslInput, { target: { value: '100' } });
      fireEvent.change(uslInput, { target: { value: '50' } });

      await waitFor(() => {
        expect(lslInput).toHaveAttribute('aria-describedby', 'error-TAG001');
        expect(uslInput).toHaveAttribute('aria-describedby', 'error-TAG001');
      });
    });

    it('should have role="alert" on error messages', async () => {
      render(
        <SpecificationLimitsConfig
          tags={['TAG001']}
          onChange={mockOnChange}
        />
      );

      const lslInput = screen.getByLabelText(/LSL \(Lower Specification Limit\)/i);
      const uslInput = screen.getByLabelText(/USL \(Upper Specification Limit\)/i);

      fireEvent.change(lslInput, { target: { value: '100' } });
      fireEvent.change(uslInput, { target: { value: '50' } });

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        expect(errorMessage).toHaveTextContent('USL must be greater than LSL');
      });
    });
  });

  describe('Multiple Tags', () => {
    it('should handle specification limits for multiple tags independently', async () => {
      render(
        <SpecificationLimitsConfig
          tags={['TAG001', 'TAG002']}
          onChange={mockOnChange}
        />
      );

      const lslInputs = screen.getAllByLabelText(/LSL \(Lower Specification Limit\)/i);
      const uslInputs = screen.getAllByLabelText(/USL \(Upper Specification Limit\)/i);

      // Set limits for TAG001
      fireEvent.change(lslInputs[0], { target: { value: '10' } });
      fireEvent.change(uslInputs[0], { target: { value: '90' } });

      // Set limits for TAG002
      fireEvent.change(lslInputs[1], { target: { value: '0' } });
      fireEvent.change(uslInputs[1], { target: { value: '100' } });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenLastCalledWith({
          TAG001: { lsl: 10, usl: 90 },
          TAG002: { lsl: 0, usl: 100 }
        });
      });
    });

    it('should show errors only for tags with invalid limits', async () => {
      render(
        <SpecificationLimitsConfig
          tags={['TAG001', 'TAG002']}
          onChange={mockOnChange}
        />
      );

      const lslInputs = screen.getAllByLabelText(/LSL \(Lower Specification Limit\)/i);
      const uslInputs = screen.getAllByLabelText(/USL \(Upper Specification Limit\)/i);

      // Set valid limits for TAG001
      fireEvent.change(lslInputs[0], { target: { value: '10' } });
      fireEvent.change(uslInputs[0], { target: { value: '90' } });

      // Set invalid limits for TAG002
      fireEvent.change(lslInputs[1], { target: { value: '100' } });
      fireEvent.change(uslInputs[1], { target: { value: '50' } });

      await waitFor(() => {
        const errors = screen.getAllByText('USL must be greater than LSL');
        expect(errors).toHaveLength(1);
      });
    });
  });
});
