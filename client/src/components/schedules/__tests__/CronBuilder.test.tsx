import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CronBuilder } from '../CronBuilder';
import { CRON_PRESETS } from '../../../utils/cronUtils';

// Mock the cn utility
jest.mock('../../../utils/cn', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

describe('CronBuilder', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Preset Selection', () => {
    it('should render all preset buttons', () => {
      render(<CronBuilder value="0 9 * * *" onChange={mockOnChange} />);
      
      CRON_PRESETS.forEach(preset => {
        expect(screen.getByText(preset.label)).toBeInTheDocument();
      });
      
      // Custom button should also be present
      expect(screen.getByText('Custom')).toBeInTheDocument();
    });

    it('should call onChange when preset button is clicked', () => {
      render(<CronBuilder value="0 9 * * *" onChange={mockOnChange} />);
      
      const hourlyButton = screen.getByText('Hourly');
      fireEvent.click(hourlyButton);
      
      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith('0 * * * *');
    });

    it('should highlight selected preset', () => {
      render(<CronBuilder value="0 9 * * *" onChange={mockOnChange} />);
      
      const dailyButton = screen.getByText('Daily');
      expect(dailyButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should not highlight non-selected presets', () => {
      render(<CronBuilder value="0 9 * * *" onChange={mockOnChange} />);
      
      const hourlyButton = screen.getByText('Hourly');
      expect(hourlyButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('should switch between presets', () => {
      const { rerender } = render(<CronBuilder value="0 * * * *" onChange={mockOnChange} />);
      
      let hourlyButton = screen.getByText('Hourly');
      expect(hourlyButton).toHaveAttribute('aria-pressed', 'true');
      
      // Click daily preset
      const dailyButton = screen.getByText('Daily');
      fireEvent.click(dailyButton);
      
      expect(mockOnChange).toHaveBeenCalledWith('0 9 * * *');
      
      // Rerender with new value
      rerender(<CronBuilder value="0 9 * * *" onChange={mockOnChange} />);
      
      expect(dailyButton).toHaveAttribute('aria-pressed', 'true');
      hourlyButton = screen.getByText('Hourly');
      expect(hourlyButton).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('Custom Expression Input', () => {
    it('should not show custom input by default', () => {
      render(<CronBuilder value="0 9 * * *" onChange={mockOnChange} />);
      
      expect(screen.queryByLabelText('Custom Cron Expression')).not.toBeInTheDocument();
    });

    it('should show custom input when Custom button is clicked', () => {
      render(<CronBuilder value="0 9 * * *" onChange={mockOnChange} />);
      
      const customButton = screen.getByText('Custom');
      fireEvent.click(customButton);
      
      expect(screen.getByLabelText('Custom Cron Expression')).toBeInTheDocument();
    });

    it('should call onChange when custom expression is typed', () => {
      render(<CronBuilder value="0 9 * * *" onChange={mockOnChange} />);
      
      const customButton = screen.getByText('Custom');
      fireEvent.click(customButton);
      
      const input = screen.getByLabelText('Custom Cron Expression');
      fireEvent.change(input, { target: { value: '0 12 * * *' } });
      
      expect(mockOnChange).toHaveBeenCalledWith('0 12 * * *');
    });

    it('should display current value in custom input', () => {
      render(<CronBuilder value="0 15 * * *" onChange={mockOnChange} />);
      
      const customButton = screen.getByText('Custom');
      fireEvent.click(customButton);
      
      const input = screen.getByLabelText('Custom Cron Expression') as HTMLInputElement;
      expect(input.value).toBe('0 15 * * *');
    });

    it('should have placeholder text in custom input', () => {
      render(<CronBuilder value="0 9 * * *" onChange={mockOnChange} />);
      
      const customButton = screen.getByText('Custom');
      fireEvent.click(customButton);
      
      const input = screen.getByLabelText('Custom Cron Expression');
      expect(input).toHaveAttribute('placeholder', '0 9 * * *');
    });

    it('should highlight Custom button when in custom mode', () => {
      render(<CronBuilder value="0 9 * * *" onChange={mockOnChange} />);
      
      const customButton = screen.getByText('Custom');
      fireEvent.click(customButton);
      
      expect(customButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Validation', () => {
    it('should display validation error when provided', () => {
      render(<CronBuilder value="invalid" onChange={mockOnChange} error="Invalid cron expression" />);
      
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Invalid cron expression');
    });

    it('should not display error when error prop is not provided', () => {
      render(<CronBuilder value="0 9 * * *" onChange={mockOnChange} />);
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should mark input as invalid when error is present', () => {
      render(<CronBuilder value="invalid" onChange={mockOnChange} error="Invalid cron expression" />);
      
      const customButton = screen.getByText('Custom');
      fireEvent.click(customButton);
      
      const input = screen.getByLabelText('Custom Cron Expression');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('should associate error with input via aria-describedby', () => {
      render(<CronBuilder value="invalid" onChange={mockOnChange} error="Invalid cron expression" />);
      
      const customButton = screen.getByText('Custom');
      fireEvent.click(customButton);
      
      const input = screen.getByLabelText('Custom Cron Expression');
      expect(input).toHaveAttribute('aria-describedby');
    });
  });

  describe('Next Run Times Calculation', () => {
    it('should display next run times for valid cron expression', () => {
      render(<CronBuilder value="0 9 * * *" onChange={mockOnChange} />);
      
      expect(screen.getByText('Next 5 Scheduled Runs')).toBeInTheDocument();
      
      // Should have a list of run times
      const list = screen.getByRole('list', { name: /Next 5 Scheduled Runs/i });
      expect(list).toBeInTheDocument();
    });

    it('should not display next run times for invalid cron expression', () => {
      render(<CronBuilder value="invalid" onChange={mockOnChange} />);
      
      expect(screen.queryByText('Next 5 Scheduled Runs')).not.toBeInTheDocument();
    });

    it('should update next run times when cron expression changes', () => {
      const { rerender } = render(<CronBuilder value="0 9 * * *" onChange={mockOnChange} />);
      
      // Initial render should show next runs
      expect(screen.getByText('Next 5 Scheduled Runs')).toBeInTheDocument();
      
      // Change to invalid expression
      rerender(<CronBuilder value="invalid" onChange={mockOnChange} />);
      
      // Should not show next runs
      expect(screen.queryByText('Next 5 Scheduled Runs')).not.toBeInTheDocument();
    });

    it('should display time elements with datetime attributes', () => {
      render(<CronBuilder value="0 9 * * *" onChange={mockOnChange} />);
      
      const timeElements = screen.getAllByRole('time');
      expect(timeElements.length).toBeGreaterThan(0);
      
      timeElements.forEach(timeEl => {
        expect(timeEl).toHaveAttribute('dateTime');
      });
    });
  });

  describe('Human-Readable Description', () => {
    it('should display description for valid cron expression', () => {
      render(<CronBuilder value="0 9 * * *" onChange={mockOnChange} />);
      
      // Should show "Every day at 9:00 AM" or similar
      const description = screen.getByRole('status');
      expect(description).toBeInTheDocument();
      expect(description).toHaveTextContent(/Every day at 9:00 AM/i);
    });

    it('should update description when cron expression changes', () => {
      const { rerender } = render(<CronBuilder value="0 * * * *" onChange={mockOnChange} />);
      
      let description = screen.getByRole('status');
      expect(description).toHaveTextContent(/Every hour/i);
      
      rerender(<CronBuilder value="0 9 * * *" onChange={mockOnChange} />);
      
      description = screen.getByRole('status');
      expect(description).toHaveTextContent(/Every day at 9:00 AM/i);
    });

    it('should display "Invalid cron expression" for invalid input', () => {
      render(<CronBuilder value="invalid" onChange={mockOnChange} />);
      
      const description = screen.getByRole('status');
      expect(description).toHaveTextContent('Invalid cron expression');
    });

    it('should have aria-live attribute for dynamic updates', () => {
      render(<CronBuilder value="0 9 * * *" onChange={mockOnChange} />);
      
      const description = screen.getByRole('status');
      expect(description).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Accessibility', () => {
    it('should have proper group role for presets', () => {
      render(<CronBuilder value="0 9 * * *" onChange={mockOnChange} />);
      
      const presetGroup = screen.getByRole('group', { name: /Quick Presets/i });
      expect(presetGroup).toBeInTheDocument();
    });

    it('should have proper group role for main component', () => {
      render(<CronBuilder value="0 9 * * *" onChange={mockOnChange} />);
      
      const mainGroup = screen.getByRole('group', { name: /Cron expression builder/i });
      expect(mainGroup).toBeInTheDocument();
    });

    it('should have descriptive labels for preset buttons', () => {
      render(<CronBuilder value="0 9 * * *" onChange={mockOnChange} />);
      
      const hourlyButton = screen.getByLabelText('Set schedule to Hourly');
      expect(hourlyButton).toBeInTheDocument();
    });

    it('should have label for custom input', () => {
      render(<CronBuilder value="0 9 * * *" onChange={mockOnChange} />);
      
      const customButton = screen.getByText('Custom');
      fireEvent.click(customButton);
      
      const input = screen.getByLabelText('Custom Cron Expression');
      expect(input).toBeInTheDocument();
    });

    it('should have help text for custom input', () => {
      render(<CronBuilder value="0 9 * * *" onChange={mockOnChange} />);
      
      const customButton = screen.getByText('Custom');
      fireEvent.click(customButton);
      
      expect(screen.getByText(/Format: minute hour day month weekday/i)).toBeInTheDocument();
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <CronBuilder value="0 9 * * *" onChange={mockOnChange} className="custom-cron-class" />
      );
      
      const cronBuilder = container.querySelector('.custom-cron-class');
      expect(cronBuilder).toBeInTheDocument();
    });
  });

  describe('Preset to Custom Mode Transition', () => {
    it('should maintain value when switching to custom mode', () => {
      render(<CronBuilder value="0 9 * * *" onChange={mockOnChange} />);
      
      const customButton = screen.getByText('Custom');
      fireEvent.click(customButton);
      
      const input = screen.getByLabelText('Custom Cron Expression') as HTMLInputElement;
      expect(input.value).toBe('0 9 * * *');
    });

    it('should exit custom mode when preset is clicked', () => {
      render(<CronBuilder value="0 9 * * *" onChange={mockOnChange} />);
      
      // Enter custom mode
      const customButton = screen.getByText('Custom');
      fireEvent.click(customButton);
      
      expect(screen.getByLabelText('Custom Cron Expression')).toBeInTheDocument();
      
      // Click a preset
      const hourlyButton = screen.getByText('Hourly');
      fireEvent.click(hourlyButton);
      
      // Custom input should be hidden
      expect(screen.queryByLabelText('Custom Cron Expression')).not.toBeInTheDocument();
    });
  });
});
