import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ScheduleCard } from '../ScheduleCard';
import { Schedule } from '../../../types/schedule';

// Mock the cn utility
jest.mock('../../../utils/cn', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

describe('ScheduleCard', () => {
  const mockSchedule: Schedule = {
    id: 'test-schedule-1',
    name: 'Daily Production Report',
    description: 'Automated daily production metrics',
    reportConfig: {
      id: 'report-1',
      name: 'Production Report',
      tags: ['tag1', 'tag2'],
      timeRange: {
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-01-02'),
      },
      chartTypes: ['line'],
      template: 'default',
      format: 'pdf',
    },
    cronExpression: '0 9 * * *',
    enabled: true,
    nextRun: new Date('2026-01-17T09:00:00'),
    lastRun: new Date('2026-01-16T09:00:00'),
    lastStatus: 'success',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    recipients: ['user@example.com', 'admin@example.com'],
  };

  const mockHandlers = {
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onToggleEnabled: jest.fn().mockResolvedValue(undefined),
    onRunNow: jest.fn().mockResolvedValue(undefined),
    onViewHistory: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Schedule Information Display', () => {
    it('should display schedule name', () => {
      render(<ScheduleCard schedule={mockSchedule} {...mockHandlers} />);
      
      expect(screen.getByText('Daily Production Report')).toBeInTheDocument();
    });

    it('should display schedule description', () => {
      render(<ScheduleCard schedule={mockSchedule} {...mockHandlers} />);
      
      expect(screen.getByText('Automated daily production metrics')).toBeInTheDocument();
    });

    it('should not display description when not provided', () => {
      const scheduleWithoutDesc = { ...mockSchedule, description: undefined };
      render(<ScheduleCard schedule={scheduleWithoutDesc} {...mockHandlers} />);
      
      expect(screen.queryByText('Automated daily production metrics')).not.toBeInTheDocument();
    });

    it('should display cron frequency description', () => {
      render(<ScheduleCard schedule={mockSchedule} {...mockHandlers} />);
      
      // The component shows "Daily at 9:00" without AM/PM
      expect(screen.getByText(/Daily at 9:00/)).toBeInTheDocument();
    });

    it('should display next run time', () => {
      render(<ScheduleCard schedule={mockSchedule} {...mockHandlers} />);
      
      expect(screen.getByText(/Jan 17, 2026/)).toBeInTheDocument();
    });

    it('should display last run time', () => {
      render(<ScheduleCard schedule={mockSchedule} {...mockHandlers} />);
      
      expect(screen.getByText(/Jan 16, 2026/)).toBeInTheDocument();
    });

    it('should display recipients count', () => {
      render(<ScheduleCard schedule={mockSchedule} {...mockHandlers} />);
      
      expect(screen.getByText('2 recipient(s)')).toBeInTheDocument();
    });

    it('should display N/A for missing dates', () => {
      const scheduleWithoutDates = {
        ...mockSchedule,
        nextRun: undefined,
        lastRun: undefined,
      };
      render(<ScheduleCard schedule={scheduleWithoutDates} {...mockHandlers} />);
      
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThanOrEqual(2);
    });

    it('should display last status indicator', () => {
      render(<ScheduleCard schedule={mockSchedule} {...mockHandlers} />);
      
      const statusIndicator = screen.getByRole('status');
      expect(statusIndicator).toBeInTheDocument();
      expect(statusIndicator).toHaveAttribute('aria-label', 'Status: Success');
    });

    it('should display error message when last status is failed', () => {
      const failedSchedule = {
        ...mockSchedule,
        lastStatus: 'failed' as const,
        lastError: 'Database connection timeout',
      };
      render(<ScheduleCard schedule={failedSchedule} {...mockHandlers} />);
      
      expect(screen.getByText(/Database connection timeout/)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should not display error message when status is not failed', () => {
      render(<ScheduleCard schedule={mockSchedule} {...mockHandlers} />);
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Action Button Clicks', () => {
    it('should call onEdit when Edit button is clicked', () => {
      render(<ScheduleCard schedule={mockSchedule} {...mockHandlers} />);
      
      const editButton = screen.getByLabelText(/Edit schedule/);
      fireEvent.click(editButton);
      
      expect(mockHandlers.onEdit).toHaveBeenCalledTimes(1);
      expect(mockHandlers.onEdit).toHaveBeenCalledWith(mockSchedule);
    });

    it('should call onDelete when Delete button is clicked', () => {
      render(<ScheduleCard schedule={mockSchedule} {...mockHandlers} />);
      
      const deleteButton = screen.getByLabelText(/Delete schedule/);
      fireEvent.click(deleteButton);
      
      expect(mockHandlers.onDelete).toHaveBeenCalledTimes(1);
    });

    it('should call onRunNow when Run Now button is clicked', async () => {
      render(<ScheduleCard schedule={mockSchedule} {...mockHandlers} />);
      
      const runButton = screen.getByLabelText(/Run schedule.*now/);
      fireEvent.click(runButton);
      
      await waitFor(() => {
        expect(mockHandlers.onRunNow).toHaveBeenCalledTimes(1);
        expect(mockHandlers.onRunNow).toHaveBeenCalledWith(mockSchedule.id);
      });
    });

    it('should call onViewHistory when History button is clicked', () => {
      render(<ScheduleCard schedule={mockSchedule} {...mockHandlers} />);
      
      const historyButton = screen.getByLabelText(/View execution history/);
      fireEvent.click(historyButton);
      
      expect(mockHandlers.onViewHistory).toHaveBeenCalledTimes(1);
      expect(mockHandlers.onViewHistory).toHaveBeenCalledWith(mockSchedule);
    });

    it('should disable Run Now button when schedule is disabled', () => {
      const disabledSchedule = { ...mockSchedule, enabled: false };
      render(<ScheduleCard schedule={disabledSchedule} {...mockHandlers} />);
      
      const runButton = screen.getByLabelText(/Run schedule.*now/);
      expect(runButton).toBeDisabled();
    });

    it('should disable Run Now button when execution is in progress', () => {
      render(<ScheduleCard schedule={mockSchedule} {...mockHandlers} isRunning={true} />);
      
      const runButton = screen.getByLabelText(/Run schedule.*now/);
      expect(runButton).toBeDisabled();
    });
  });

  describe('Toggle Functionality', () => {
    it('should display enabled state correctly', () => {
      render(<ScheduleCard schedule={mockSchedule} {...mockHandlers} />);
      
      const toggle = screen.getByRole('checkbox', { name: /Disable schedule/ });
      expect(toggle).toBeChecked();
      expect(screen.getByText('Enabled')).toBeInTheDocument();
    });

    it('should display disabled state correctly', () => {
      const disabledSchedule = { ...mockSchedule, enabled: false };
      render(<ScheduleCard schedule={disabledSchedule} {...mockHandlers} />);
      
      const toggle = screen.getByRole('checkbox', { name: /Enable schedule/ });
      expect(toggle).not.toBeChecked();
      expect(screen.getByText('Disabled')).toBeInTheDocument();
    });

    it('should call onToggleEnabled when toggle is clicked', async () => {
      render(<ScheduleCard schedule={mockSchedule} {...mockHandlers} />);
      
      const toggle = screen.getByRole('checkbox', { name: /Disable schedule/ });
      fireEvent.click(toggle);
      
      await waitFor(() => {
        expect(mockHandlers.onToggleEnabled).toHaveBeenCalledTimes(1);
        expect(mockHandlers.onToggleEnabled).toHaveBeenCalledWith(mockSchedule.id, false);
      });
    });

    it('should disable toggle when toggling is in progress', () => {
      render(<ScheduleCard schedule={mockSchedule} {...mockHandlers} isTogglingEnabled={true} />);
      
      const toggle = screen.getByRole('checkbox');
      expect(toggle).toBeDisabled();
    });

    it('should show spinner when toggling', () => {
      render(<ScheduleCard schedule={mockSchedule} {...mockHandlers} isTogglingEnabled={true} />);
      
      // The spinner is rendered in the toggle label area
      const container = screen.getByText('Enabled').parentElement;
      const spinner = container?.querySelector('svg.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should handle toggle from disabled to enabled', async () => {
      const disabledSchedule = { ...mockSchedule, enabled: false };
      render(<ScheduleCard schedule={disabledSchedule} {...mockHandlers} />);
      
      const toggle = screen.getByRole('checkbox', { name: /Enable schedule/ });
      fireEvent.click(toggle);
      
      await waitFor(() => {
        expect(mockHandlers.onToggleEnabled).toHaveBeenCalledWith(mockSchedule.id, true);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper article role for card', () => {
      render(<ScheduleCard schedule={mockSchedule} {...mockHandlers} />);
      
      const card = screen.getByRole('article');
      expect(card).toBeInTheDocument();
      expect(card).toHaveAttribute('aria-label', 'Schedule: Daily Production Report');
    });

    it('should have action group with proper label', () => {
      render(<ScheduleCard schedule={mockSchedule} {...mockHandlers} />);
      
      const actionGroup = screen.getByRole('group', { name: /Actions for/ });
      expect(actionGroup).toBeInTheDocument();
    });

    it('should have descriptive button labels', () => {
      render(<ScheduleCard schedule={mockSchedule} {...mockHandlers} />);
      
      expect(screen.getByLabelText(/Edit schedule Daily Production Report/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Run schedule Daily Production Report now/)).toBeInTheDocument();
      expect(screen.getByLabelText(/View execution history for Daily Production Report/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Delete schedule Daily Production Report/)).toBeInTheDocument();
    });

    it('should have proper time elements with datetime attributes', () => {
      render(<ScheduleCard schedule={mockSchedule} {...mockHandlers} />);
      
      const timeElements = screen.getAllByRole('time');
      expect(timeElements.length).toBeGreaterThan(0);
      
      timeElements.forEach(timeEl => {
        expect(timeEl).toHaveAttribute('dateTime');
      });
    });

    it('should have aria-disabled on disabled Run Now button', () => {
      const disabledSchedule = { ...mockSchedule, enabled: false };
      render(<ScheduleCard schedule={disabledSchedule} {...mockHandlers} />);
      
      const runButton = screen.getByLabelText(/Run schedule.*now/);
      expect(runButton).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Responsive Design', () => {
    it('should apply responsive classes', () => {
      const { container } = render(<ScheduleCard schedule={mockSchedule} {...mockHandlers} />);
      
      // Check for responsive flex classes
      const flexElements = container.querySelectorAll('.sm\\:flex-row, .sm\\:items-start');
      expect(flexElements.length).toBeGreaterThan(0);
    });

    it('should have responsive text sizing', () => {
      const { container } = render(<ScheduleCard schedule={mockSchedule} {...mockHandlers} />);
      
      // Check for responsive text classes
      const responsiveText = container.querySelectorAll('.sm\\:text-lg, .sm\\:text-base');
      expect(responsiveText.length).toBeGreaterThan(0);
    });
  });

  describe('Custom className', () => {
    it('should apply custom className to card', () => {
      const { container } = render(
        <ScheduleCard schedule={mockSchedule} {...mockHandlers} className="custom-card-class" />
      );
      
      const card = container.querySelector('.custom-card-class');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading state on Run Now button when executing', () => {
      render(<ScheduleCard schedule={mockSchedule} {...mockHandlers} isRunning={true} />);
      
      const runButton = screen.getByLabelText(/Run schedule.*now/);
      // The button should be disabled when running
      expect(runButton).toBeDisabled();
    });

    it('should handle async toggle operation', async () => {
      const slowToggle = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );
      
      render(<ScheduleCard schedule={mockSchedule} {...mockHandlers} onToggleEnabled={slowToggle} />);
      
      const toggle = screen.getByRole('checkbox');
      fireEvent.click(toggle);
      
      // Should be disabled during operation
      expect(toggle).toBeDisabled();
      
      await waitFor(() => {
        expect(slowToggle).toHaveBeenCalled();
      });
    });
  });
});
