import React from 'react';
import { render, screen } from '@testing-library/react';
import { SchedulesList } from '../SchedulesList';
import { ScheduleCard } from '../ScheduleCard';
import { ScheduleForm } from '../ScheduleForm';
import { CronBuilder } from '../CronBuilder';
import { ExecutionHistory } from '../ExecutionHistory';
import { StatusIndicator } from '../StatusIndicator';
import { Schedule } from '../../../types/schedule';

// Mock API service
jest.mock('../../../services/api', () => ({
  apiService: {
    getSchedules: jest.fn(),
    getSavedReports: jest.fn(),
  },
}));

describe('Accessibility Tests', () => {
  describe('SchedulesList', () => {
    it('should have main landmark with aria-label', () => {
      render(<SchedulesList />);
      const main = screen.getByRole('main');
      expect(main).toHaveAttribute('aria-label', 'Scheduled reports management');
    });

    it('should have search input with aria-label', () => {
      render(<SchedulesList />);
      const searchInput = screen.getByLabelText(/search schedules/i);
      expect(searchInput).toBeInTheDocument();
    });

    it('should have filter groups with role and aria-label', () => {
      render(<SchedulesList />);
      const filterGroups = screen.getAllByRole('group');
      expect(filterGroups.length).toBeGreaterThan(0);
    });
  });

  describe('ScheduleCard', () => {
    const mockSchedule: Schedule = {
      id: '1',
      name: 'Test Schedule',
      description: 'Test description',
      reportConfig: {
        id: '1',
        name: 'Test Report',
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
      lastStatus: 'success',
    };

    it('should have article role with aria-label', () => {
      render(
        <ScheduleCard
          schedule={mockSchedule}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onToggleEnabled={jest.fn()}
          onRunNow={jest.fn()}
          onViewHistory={jest.fn()}
        />
      );
      const article = screen.getByRole('article');
      expect(article).toHaveAttribute('aria-label', 'Schedule: Test Schedule');
    });

    it('should have toggle with descriptive aria-label', () => {
      render(
        <ScheduleCard
          schedule={mockSchedule}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onToggleEnabled={jest.fn()}
          onRunNow={jest.fn()}
          onViewHistory={jest.fn()}
        />
      );
      const toggle = screen.getByRole('checkbox');
      expect(toggle).toHaveAttribute('aria-label', expect.stringContaining('Test Schedule'));
    });

    it('should have action buttons with descriptive labels', () => {
      render(
        <ScheduleCard
          schedule={mockSchedule}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onToggleEnabled={jest.fn()}
          onRunNow={jest.fn()}
          onViewHistory={jest.fn()}
        />
      );
      expect(screen.getByLabelText(/edit schedule test schedule/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/run schedule test schedule now/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/view execution history for test schedule/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/delete schedule test schedule/i)).toBeInTheDocument();
    });
  });

  describe('ScheduleForm', () => {
    it('should have form with aria-labelledby', () => {
      render(
        <ScheduleForm
          reportConfigs={[]}
          onSave={jest.fn()}
          onCancel={jest.fn()}
        />
      );
      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('aria-labelledby', 'form-title');
    });

    it('should have required fields with aria-required', () => {
      render(
        <ScheduleForm
          reportConfigs={[]}
          onSave={jest.fn()}
          onCancel={jest.fn()}
        />
      );
      const nameInput = screen.getByLabelText(/schedule name/i);
      expect(nameInput).toHaveAttribute('aria-required', 'true');
    });

    it('should have recipients list with role', () => {
      const mockSchedule: Schedule = {
        id: '1',
        name: 'Test',
        reportConfig: {
          id: '1',
          name: 'Test Report',
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
      };

      render(
        <ScheduleForm
          schedule={mockSchedule}
          reportConfigs={[]}
          onSave={jest.fn()}
          onCancel={jest.fn()}
        />
      );
      const list = screen.getByRole('list', { name: /email recipients/i });
      expect(list).toBeInTheDocument();
    });
  });

  describe('CronBuilder', () => {
    it('should have group role with aria-label', () => {
      render(<CronBuilder value="0 9 * * *" onChange={jest.fn()} />);
      const group = screen.getByRole('group', { name: /cron expression builder/i });
      expect(group).toBeInTheDocument();
    });

    it('should have preset buttons with aria-pressed', () => {
      render(<CronBuilder value="0 9 * * *" onChange={jest.fn()} />);
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAttribute('aria-pressed');
      });
    });

    it('should have description with role status', () => {
      render(<CronBuilder value="0 9 * * *" onChange={jest.fn()} />);
      const status = screen.getByRole('status');
      expect(status).toBeInTheDocument();
    });
  });

  describe('ExecutionHistory', () => {
    it('should have statistics region with aria-label', () => {
      render(
        <ExecutionHistory
          scheduleId="1"
          scheduleName="Test Schedule"
          onClose={jest.fn()}
          onFetchHistory={jest.fn().mockResolvedValue({
            executions: [],
            total: 0,
            page: 1,
            totalPages: 1,
          })}
        />
      );
      const region = screen.getByRole('region', { name: /execution statistics/i });
      expect(region).toBeInTheDocument();
    });

    it('should have filter buttons with aria-pressed', () => {
      render(
        <ExecutionHistory
          scheduleId="1"
          scheduleName="Test Schedule"
          onClose={jest.fn()}
          onFetchHistory={jest.fn().mockResolvedValue({
            executions: [],
            total: 0,
            page: 1,
            totalPages: 1,
          })}
        />
      );
      const filterGroup = screen.getByRole('group', { name: /filter executions by status/i });
      expect(filterGroup).toBeInTheDocument();
    });
  });

  describe('StatusIndicator', () => {
    it('should have status role with aria-label', () => {
      render(<StatusIndicator status="success" />);
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-label', 'Status: Success');
    });

    it('should have screen reader text for all statuses', () => {
      const statuses: Array<'success' | 'failed' | 'running' | 'disabled'> = [
        'success',
        'failed',
        'running',
        'disabled',
      ];

      statuses.forEach(status => {
        const { container } = render(<StatusIndicator status={status} />);
        const srText = container.querySelector('.sr-only');
        expect(srText).toBeInTheDocument();
      });
    });

    it('should hide icons from screen readers', () => {
      const { container } = render(<StatusIndicator status="success" />);
      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should have visible focus indicators on buttons', () => {
      render(<SchedulesList />);
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button.className).toContain('focus-visible');
      });
    });
  });

  describe('Color Contrast', () => {
    it('should use semantic colors for status indicators', () => {
      const { container: successContainer } = render(<StatusIndicator status="success" />);
      const { container: failedContainer } = render(<StatusIndicator status="failed" />);
      const { container: runningContainer } = render(<StatusIndicator status="running" />);

      expect(successContainer.querySelector('.text-green-600')).toBeInTheDocument();
      expect(failedContainer.querySelector('.text-red-600')).toBeInTheDocument();
      expect(runningContainer.querySelector('.text-blue-600')).toBeInTheDocument();
    });
  });
});
