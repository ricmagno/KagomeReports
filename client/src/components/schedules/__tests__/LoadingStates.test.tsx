/**
 * Loading States and Optimistic Updates Tests
 * Tests for skeleton loaders, loading spinners, and optimistic UI updates
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SchedulesList } from '../SchedulesList';
import { ScheduleCard } from '../ScheduleCard';
import { ScheduleCardSkeleton } from '../ScheduleCardSkeleton';
import { Spinner } from '../../ui/Spinner';
import { ProgressIndicator } from '../../ui/ProgressIndicator';
import { apiService } from '../../../services/api';
import { Schedule } from '../../../types/schedule';

// Mock API service
jest.mock('../../../services/api');
const mockedApiService = apiService as jest.Mocked<typeof apiService>;

// Mock schedule data
const mockSchedule: Schedule = {
  id: 'schedule-1',
  name: 'Test Schedule',
  description: 'Test description',
  reportConfig: {
    id: 'report-1',
    name: 'Test Report',
    tags: [],
    timeRange: { startTime: new Date(), endTime: new Date() },
    chartTypes: [],
    template: 'default',
    format: 'pdf',
  },
  cronExpression: '0 9 * * *',
  enabled: true,
  nextRun: new Date(),
  lastRun: new Date(),
  lastStatus: 'success',
  createdAt: new Date(),
  updatedAt: new Date(),
  recipients: ['test@example.com'],
};

describe('Loading States and Optimistic Updates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ScheduleCardSkeleton', () => {
    it('should render skeleton loader with proper structure', () => {
      const { container } = render(<ScheduleCardSkeleton />);

      // Check for skeleton elements
      const skeletonElements = container.querySelectorAll('.bg-gray-200');
      expect(skeletonElements.length).toBeGreaterThan(0);

      // Check for animation class
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('should have proper accessibility structure', () => {
      const { container } = render(<ScheduleCardSkeleton />);

      // Skeleton should be in a card structure
      expect(container.querySelector('.bg-white')).toBeInTheDocument();
      expect(container.querySelector('.rounded-lg')).toBeInTheDocument();
    });
  });

  describe('Spinner Component', () => {
    it('should render spinner with default size', () => {
      const { container } = render(<Spinner />);

      const spinner = container.querySelector('svg');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('animate-spin');
      expect(spinner).toHaveClass('h-6', 'w-6');
    });

    it('should render spinner with small size', () => {
      const { container } = render(<Spinner size="sm" />);

      const spinner = container.querySelector('svg');
      expect(spinner).toHaveClass('h-4', 'w-4');
    });

    it('should render spinner with large size', () => {
      const { container } = render(<Spinner size="lg" />);

      const spinner = container.querySelector('svg');
      expect(spinner).toHaveClass('h-8', 'w-8');
    });

    it('should have aria-hidden attribute', () => {
      const { container } = render(<Spinner />);

      const spinner = container.querySelector('svg');
      expect(spinner).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('ProgressIndicator Component', () => {
    it('should render indeterminate progress with spinner', () => {
      render(<ProgressIndicator message="Loading..." />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();

      // Should have spinner for indeterminate progress
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should render determinate progress with progress bar', () => {
      render(<ProgressIndicator message="Processing" progress={50} />);

      expect(screen.getByText(/Processing \(50%\)/)).toBeInTheDocument();

      // Should have progress bar
      const progressBar = document.querySelector('.bg-primary-600');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveStyle({ width: '50%' });
    });

    it('should clamp progress values between 0 and 100', () => {
      const { rerender } = render(<ProgressIndicator progress={-10} />);

      let progressBar = document.querySelector('.bg-primary-600');
      expect(progressBar).toHaveStyle({ width: '0%' });

      rerender(<ProgressIndicator progress={150} />);
      progressBar = document.querySelector('.bg-primary-600');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });
  });

  describe('ScheduleCard Loading States', () => {
    it('should show loading spinner when toggling enabled state', async () => {
      const mockToggle = jest.fn().mockResolvedValue(undefined);

      render(
        <ScheduleCard
          schedule={mockSchedule}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onToggleEnabled={mockToggle}
          onRunNow={jest.fn()}
          onViewHistory={jest.fn()}
          isTogglingEnabled={true}
        />
      );

      // Should show spinner when toggling
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should show loading state on Run Now button', async () => {
      const mockRunNow = jest.fn().mockResolvedValue(undefined);

      render(
        <ScheduleCard
          schedule={mockSchedule}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onToggleEnabled={jest.fn()}
          onRunNow={mockRunNow}
          onViewHistory={jest.fn()}
          isRunning={true}
        />
      );

      const runButton = screen.getByLabelText(`Run ${mockSchedule.name} now`);
      expect(runButton).toBeDisabled();
    });

    it('should disable toggle during loading', () => {
      render(
        <ScheduleCard
          schedule={mockSchedule}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onToggleEnabled={jest.fn()}
          onRunNow={jest.fn()}
          onViewHistory={jest.fn()}
          isTogglingEnabled={true}
        />
      );

      const toggle = screen.getByRole('checkbox');
      expect(toggle).toBeDisabled();
    });
  });

  describe('SchedulesList Skeleton Loaders', () => {
    it('should render skeleton loaders while loading', async () => {
      mockedApiService.getSchedules.mockResolvedValue({
        success: true,
        data: {
          schedules: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 1,
          },
        },
      });

      mockedApiService.getSavedReports.mockResolvedValue({
        success: true,
        data: [],
      });

      const { container } = render(<SchedulesList />);

      // Should show skeleton loaders initially
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should replace skeletons with actual cards after loading', async () => {
      mockedApiService.getSchedules.mockResolvedValue({
        success: true,
        data: {
          schedules: [mockSchedule],
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
          },
        },
      });

      mockedApiService.getSavedReports.mockResolvedValue({
        success: true,
        data: [],
      });

      const { container } = render(<SchedulesList />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText('Test Schedule')).toBeInTheDocument();
      });

      // Skeletons should be gone
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBe(0);
    });
  });

  describe('Optimistic Updates', () => {
    it('should update UI immediately when toggling schedule', async () => {
      const disabledSchedule = { ...mockSchedule, enabled: false };

      mockedApiService.getSchedules.mockResolvedValue({
        success: true,
        data: {
          schedules: [disabledSchedule],
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
          },
        },
      });

      mockedApiService.getSavedReports.mockResolvedValue({
        success: true,
        data: [],
      });

      mockedApiService.enableSchedule.mockResolvedValue({
        success: true,
        message: 'Schedule enabled',
        data: { schedule: mockSchedule, message: 'Schedule enabled' },
      });

      render(<SchedulesList />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Test Schedule')).toBeInTheDocument();
      });

      // Find and click the toggle
      const toggle = screen.getByRole('checkbox');
      expect(toggle).not.toBeChecked();

      fireEvent.click(toggle);

      // UI should update immediately (optimistic)
      await waitFor(() => {
        expect(toggle).toBeChecked();
      });
    });

    it('should revert optimistic update on error', async () => {
      const enabledSchedule = { ...mockSchedule, enabled: true };

      mockedApiService.getSchedules.mockResolvedValue({
        success: true,
        data: {
          schedules: [enabledSchedule],
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
          },
        },
      });

      mockedApiService.getSavedReports.mockResolvedValue({
        success: true,
        data: [],
      });

      // Mock API failure
      mockedApiService.disableSchedule.mockRejectedValue(
        new Error('Network error')
      );

      render(<SchedulesList />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Test Schedule')).toBeInTheDocument();
      });

      const toggle = screen.getByRole('checkbox');
      expect(toggle).toBeChecked();

      fireEvent.click(toggle);

      // Should revert back to enabled after error
      await waitFor(() => {
        expect(toggle).toBeChecked();
      });
    });
  });

  describe('Delete Modal Loading State', () => {
    it('should show loading state on delete button', async () => {
      mockedApiService.getSchedules.mockResolvedValue({
        success: true,
        data: {
          schedules: [mockSchedule],
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
          },
        },
      });

      mockedApiService.getSavedReports.mockResolvedValue({
        success: true,
        data: [],
      });

      // Mock slow delete
      mockedApiService.deleteSchedule.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true, message: 'Deleted', data: { message: 'Deleted' } }), 100))
      );

      render(<SchedulesList />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Test Schedule')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButton = screen.getByLabelText(`Delete ${mockSchedule.name}`);
      fireEvent.click(deleteButton);

      // Confirm delete in modal
      await waitFor(() => {
        expect(screen.getByText('Delete Schedule')).toBeInTheDocument();
      });

      const confirmButton = screen.getAllByRole('button', { name: /delete/i })[1]; // Get the modal button
      fireEvent.click(confirmButton);

      // Button should show loading state
      await waitFor(() => {
        expect(confirmButton).toBeDisabled();
      });
    });
  });
});
