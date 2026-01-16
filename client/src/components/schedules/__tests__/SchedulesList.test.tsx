import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { SchedulesList } from '../SchedulesList';
import { apiService } from '../../../services/api';

// Mock the API service
jest.mock('../../../services/api', () => ({
  apiService: {
    getSchedules: jest.fn(),
    getSavedReports: jest.fn(),
    createSchedule: jest.fn(),
    updateSchedule: jest.fn(),
    deleteSchedule: jest.fn(),
    enableSchedule: jest.fn(),
    disableSchedule: jest.fn(),
    executeSchedule: jest.fn(),
    getExecutionHistory: jest.fn(),
  },
}));

describe('SchedulesList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    (apiService.getSchedules as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves to keep loading state
    );
    (apiService.getSavedReports as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });

    render(<SchedulesList />);
    
    // Check for skeleton loaders instead of text
    const skeletons = screen.getAllByTestId('schedule-card-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders empty state when no schedules exist', async () => {
    (apiService.getSchedules as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        schedules: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
      },
    });
    (apiService.getSavedReports as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });

    render(<SchedulesList />);

    await waitFor(() => {
      expect(screen.getByText(/no schedules found/i)).toBeInTheDocument();
    });
  });

  it('renders schedules list when data is available', async () => {
    const mockSchedules = [
      {
        id: '1',
        name: 'Daily Report',
        description: 'Daily production report',
        reportConfig: {
          id: 'report-1',
          name: 'Production Report',
          tags: [],
          timeRange: { startTime: new Date(), endTime: new Date() },
          chartTypes: [],
          template: 'default',
          format: 'pdf',
        },
        cronExpression: '0 9 * * *',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        recipients: ['test@example.com'],
      },
    ];

    (apiService.getSchedules as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        schedules: mockSchedules,
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      },
    });
    (apiService.getSavedReports as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });

    render(<SchedulesList />);

    await waitFor(() => {
      expect(screen.getByText('Daily Report')).toBeInTheDocument();
      expect(screen.getByText('Daily production report')).toBeInTheDocument();
    });
  });

  it('displays error state when API call fails', async () => {
    (apiService.getSchedules as jest.Mock).mockRejectedValue(
      new Error('API Error')
    );
    (apiService.getSavedReports as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });

    render(<SchedulesList />);

    await waitFor(() => {
      // The error message includes the context and the error message
      expect(
        screen.getByText(/Failed to load schedules: API Error/i)
      ).toBeInTheDocument();
    });
  });

  it('renders header with title and new schedule button', async () => {
    (apiService.getSchedules as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        schedules: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
      },
    });
    (apiService.getSavedReports as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });

    render(<SchedulesList />);

    await waitFor(() => {
      expect(screen.getByText('Scheduled Reports')).toBeInTheDocument();
      expect(screen.getByText('New Schedule')).toBeInTheDocument();
    });
  });

  it('renders search input', async () => {
    (apiService.getSchedules as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        schedules: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
      },
    });
    (apiService.getSavedReports as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });

    render(<SchedulesList />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/search schedules/i)
      ).toBeInTheDocument();
    });
  });

  it('renders filter buttons', async () => {
    (apiService.getSchedules as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        schedules: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
      },
    });
    (apiService.getSavedReports as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });

    render(<SchedulesList />);

    await waitFor(() => {
      // Status filters - there are multiple "All" buttons, so we need to get all of them
      const allButtons = screen.getAllByRole('button', { name: /^all$/i });
      expect(allButtons.length).toBeGreaterThanOrEqual(2); // At least 2 "All" buttons (status and last status)
      expect(screen.getByRole('button', { name: /^enabled$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^disabled$/i })).toBeInTheDocument();
      
      // Last status filters
      expect(screen.getByRole('button', { name: /^success$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^failed$/i })).toBeInTheDocument();
    });
  });
});
