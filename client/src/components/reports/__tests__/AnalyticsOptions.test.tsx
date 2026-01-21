import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AnalyticsOptions } from '../AnalyticsOptions';

describe('AnalyticsOptions', () => {
  const mockOnIncludeTrendLinesChange = jest.fn();
  const mockOnIncludeSPCChartsChange = jest.fn();
  const mockOnIncludeStatsSummaryChange = jest.fn();

  beforeEach(() => {
    mockOnIncludeTrendLinesChange.mockClear();
    mockOnIncludeSPCChartsChange.mockClear();
    mockOnIncludeStatsSummaryChange.mockClear();
  });

  describe('Rendering', () => {
    it('should render all three analytics options', () => {
      render(
        <AnalyticsOptions
          onIncludeTrendLinesChange={mockOnIncludeTrendLinesChange}
          onIncludeSPCChartsChange={mockOnIncludeSPCChartsChange}
          onIncludeStatsSummaryChange={mockOnIncludeStatsSummaryChange}
        />
      );

      expect(screen.getByText('Include Trend Lines')).toBeInTheDocument();
      expect(screen.getByText('Include SPC Charts')).toBeInTheDocument();
      expect(screen.getByText('Include Statistics Summary')).toBeInTheDocument();
    });

    it('should render with default checked state (all true)', () => {
      render(
        <AnalyticsOptions
          includeTrendLines={true}
          includeSPCCharts={true}
          includeStatsSummary={true}
          onIncludeTrendLinesChange={mockOnIncludeTrendLinesChange}
          onIncludeSPCChartsChange={mockOnIncludeSPCChartsChange}
          onIncludeStatsSummaryChange={mockOnIncludeStatsSummaryChange}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).toBeChecked(); // Trend Lines
      expect(checkboxes[1]).toBeChecked(); // SPC Charts
      expect(checkboxes[2]).toBeChecked(); // Statistics Summary
    });

    it('should render with custom checked states', () => {
      render(
        <AnalyticsOptions
          includeTrendLines={false}
          includeSPCCharts={true}
          includeStatsSummary={false}
          onIncludeTrendLinesChange={mockOnIncludeTrendLinesChange}
          onIncludeSPCChartsChange={mockOnIncludeSPCChartsChange}
          onIncludeStatsSummaryChange={mockOnIncludeStatsSummaryChange}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).not.toBeChecked(); // Trend Lines
      expect(checkboxes[1]).toBeChecked();     // SPC Charts
      expect(checkboxes[2]).not.toBeChecked(); // Statistics Summary
    });

    it('should display descriptions for each option', () => {
      render(
        <AnalyticsOptions
          onIncludeTrendLinesChange={mockOnIncludeTrendLinesChange}
          onIncludeSPCChartsChange={mockOnIncludeSPCChartsChange}
          onIncludeStatsSummaryChange={mockOnIncludeStatsSummaryChange}
        />
      );

      expect(screen.getByText(/linear regression trend lines/i)).toBeInTheDocument();
      expect(screen.getByText(/Statistical Process Control charts/i)).toBeInTheDocument();
      expect(screen.getByText(/statistical summaries/i)).toBeInTheDocument();
    });

    it('should display icons for each option', () => {
      const { container } = render(
        <AnalyticsOptions
          onIncludeTrendLinesChange={mockOnIncludeTrendLinesChange}
          onIncludeSPCChartsChange={mockOnIncludeSPCChartsChange}
          onIncludeStatsSummaryChange={mockOnIncludeStatsSummaryChange}
        />
      );

      // Check for SVG icons (lucide-react icons)
      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('User Interactions', () => {
    it('should call onIncludeTrendLinesChange when trend lines checkbox is clicked', () => {
      render(
        <AnalyticsOptions
          includeTrendLines={true}
          onIncludeTrendLinesChange={mockOnIncludeTrendLinesChange}
          onIncludeSPCChartsChange={mockOnIncludeSPCChartsChange}
          onIncludeStatsSummaryChange={mockOnIncludeStatsSummaryChange}
        />
      );

      const trendLinesCheckbox = screen.getAllByRole('checkbox')[0];
      fireEvent.click(trendLinesCheckbox);

      expect(mockOnIncludeTrendLinesChange).toHaveBeenCalledWith(false);
      expect(mockOnIncludeTrendLinesChange).toHaveBeenCalledTimes(1);
    });

    it('should call onIncludeSPCChartsChange when SPC charts checkbox is clicked', () => {
      render(
        <AnalyticsOptions
          includeSPCCharts={true}
          onIncludeTrendLinesChange={mockOnIncludeTrendLinesChange}
          onIncludeSPCChartsChange={mockOnIncludeSPCChartsChange}
          onIncludeStatsSummaryChange={mockOnIncludeStatsSummaryChange}
        />
      );

      const spcChartsCheckbox = screen.getAllByRole('checkbox')[1];
      fireEvent.click(spcChartsCheckbox);

      expect(mockOnIncludeSPCChartsChange).toHaveBeenCalledWith(false);
      expect(mockOnIncludeSPCChartsChange).toHaveBeenCalledTimes(1);
    });

    it('should call onIncludeStatsSummaryChange when statistics summary checkbox is clicked', () => {
      render(
        <AnalyticsOptions
          includeStatsSummary={true}
          onIncludeTrendLinesChange={mockOnIncludeTrendLinesChange}
          onIncludeSPCChartsChange={mockOnIncludeSPCChartsChange}
          onIncludeStatsSummaryChange={mockOnIncludeStatsSummaryChange}
        />
      );

      const statsSummaryCheckbox = screen.getAllByRole('checkbox')[2];
      fireEvent.click(statsSummaryCheckbox);

      expect(mockOnIncludeStatsSummaryChange).toHaveBeenCalledWith(false);
      expect(mockOnIncludeStatsSummaryChange).toHaveBeenCalledTimes(1);
    });

    it('should toggle from unchecked to checked', () => {
      render(
        <AnalyticsOptions
          includeTrendLines={false}
          onIncludeTrendLinesChange={mockOnIncludeTrendLinesChange}
          onIncludeSPCChartsChange={mockOnIncludeSPCChartsChange}
          onIncludeStatsSummaryChange={mockOnIncludeStatsSummaryChange}
        />
      );

      const trendLinesCheckbox = screen.getAllByRole('checkbox')[0];
      fireEvent.click(trendLinesCheckbox);

      expect(mockOnIncludeTrendLinesChange).toHaveBeenCalledWith(true);
    });

    it('should handle multiple checkbox clicks', () => {
      render(
        <AnalyticsOptions
          includeTrendLines={true}
          includeSPCCharts={true}
          includeStatsSummary={true}
          onIncludeTrendLinesChange={mockOnIncludeTrendLinesChange}
          onIncludeSPCChartsChange={mockOnIncludeSPCChartsChange}
          onIncludeStatsSummaryChange={mockOnIncludeStatsSummaryChange}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);
      fireEvent.click(checkboxes[2]);

      expect(mockOnIncludeTrendLinesChange).toHaveBeenCalledTimes(1);
      expect(mockOnIncludeSPCChartsChange).toHaveBeenCalledTimes(1);
      expect(mockOnIncludeStatsSummaryChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('Disabled State', () => {
    it('should disable all checkboxes when disabled prop is true', () => {
      render(
        <AnalyticsOptions
          disabled={true}
          onIncludeTrendLinesChange={mockOnIncludeTrendLinesChange}
          onIncludeSPCChartsChange={mockOnIncludeSPCChartsChange}
          onIncludeStatsSummaryChange={mockOnIncludeStatsSummaryChange}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).toBeDisabled();
      expect(checkboxes[1]).toBeDisabled();
      expect(checkboxes[2]).toBeDisabled();
    });

    it('should not call onChange handlers when disabled', () => {
      render(
        <AnalyticsOptions
          disabled={true}
          onIncludeTrendLinesChange={mockOnIncludeTrendLinesChange}
          onIncludeSPCChartsChange={mockOnIncludeSPCChartsChange}
          onIncludeStatsSummaryChange={mockOnIncludeStatsSummaryChange}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);

      expect(mockOnIncludeTrendLinesChange).not.toHaveBeenCalled();
    });

    it('should apply disabled styling when disabled', () => {
      const { container } = render(
        <AnalyticsOptions
          disabled={true}
          onIncludeTrendLinesChange={mockOnIncludeTrendLinesChange}
          onIncludeSPCChartsChange={mockOnIncludeSPCChartsChange}
          onIncludeStatsSummaryChange={mockOnIncludeStatsSummaryChange}
        />
      );

      const labels = container.querySelectorAll('label');
      labels.forEach(label => {
        expect(label).toHaveClass('opacity-50');
        expect(label).toHaveClass('cursor-not-allowed');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-describedby for each checkbox', () => {
      render(
        <AnalyticsOptions
          onIncludeTrendLinesChange={mockOnIncludeTrendLinesChange}
          onIncludeSPCChartsChange={mockOnIncludeSPCChartsChange}
          onIncludeStatsSummaryChange={mockOnIncludeStatsSummaryChange}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).toHaveAttribute('aria-describedby', 'trend-lines-description');
      expect(checkboxes[1]).toHaveAttribute('aria-describedby', 'spc-charts-description');
      expect(checkboxes[2]).toHaveAttribute('aria-describedby', 'stats-summary-description');
    });

    it('should have description elements with correct ids', () => {
      render(
        <AnalyticsOptions
          onIncludeTrendLinesChange={mockOnIncludeTrendLinesChange}
          onIncludeSPCChartsChange={mockOnIncludeSPCChartsChange}
          onIncludeStatsSummaryChange={mockOnIncludeStatsSummaryChange}
        />
      );

      expect(screen.getByText(/linear regression trend lines/i)).toHaveAttribute('id', 'trend-lines-description');
      expect(screen.getByText(/Statistical Process Control charts/i)).toHaveAttribute('id', 'spc-charts-description');
      expect(screen.getByText(/statistical summaries/i)).toHaveAttribute('id', 'stats-summary-description');
    });

    it('should be keyboard accessible', () => {
      render(
        <AnalyticsOptions
          includeTrendLines={false}
          onIncludeTrendLinesChange={mockOnIncludeTrendLinesChange}
          onIncludeSPCChartsChange={mockOnIncludeSPCChartsChange}
          onIncludeStatsSummaryChange={mockOnIncludeStatsSummaryChange}
        />
      );

      const trendLinesCheckbox = screen.getAllByRole('checkbox')[0];
      trendLinesCheckbox.focus();
      
      expect(trendLinesCheckbox).toHaveFocus();
      
      // Simulate space key press
      fireEvent.keyDown(trendLinesCheckbox, { key: ' ', code: 'Space' });
      fireEvent.click(trendLinesCheckbox);
      
      expect(mockOnIncludeTrendLinesChange).toHaveBeenCalled();
    });
  });

  describe('Visual Feedback', () => {
    it('should apply selected styling when option is checked', () => {
      const { container } = render(
        <AnalyticsOptions
          includeTrendLines={true}
          includeSPCCharts={false}
          includeStatsSummary={true}
          onIncludeTrendLinesChange={mockOnIncludeTrendLinesChange}
          onIncludeSPCChartsChange={mockOnIncludeSPCChartsChange}
          onIncludeStatsSummaryChange={mockOnIncludeStatsSummaryChange}
        />
      );

      const labels = container.querySelectorAll('label');
      
      // First option (checked) should have primary styling
      expect(labels[0]).toHaveClass('border-primary-300');
      expect(labels[0]).toHaveClass('bg-primary-50');
      
      // Second option (unchecked) should have default styling
      expect(labels[1]).toHaveClass('border-gray-200');
      expect(labels[1]).toHaveClass('bg-white');
      
      // Third option (checked) should have primary styling
      expect(labels[2]).toHaveClass('border-primary-300');
      expect(labels[2]).toHaveClass('bg-primary-50');
    });
  });

  describe('Custom className', () => {
    it('should apply custom className to container', () => {
      const { container } = render(
        <AnalyticsOptions
          className="custom-class"
          onIncludeTrendLinesChange={mockOnIncludeTrendLinesChange}
          onIncludeSPCChartsChange={mockOnIncludeSPCChartsChange}
          onIncludeStatsSummaryChange={mockOnIncludeStatsSummaryChange}
        />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});
