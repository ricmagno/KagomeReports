import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ScheduleForm } from '../ScheduleForm';
import { Schedule } from '../../../types/schedule';
import { ReportConfig } from '../../../types/api';

// Mock the cn utility
jest.mock('../../../utils/cn', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

describe('ScheduleForm', () => {
  const mockReportConfigs: ReportConfig[] = [
    {
      id: 'report-1',
      name: 'Production Report',
      description: 'Daily production metrics',
      tags: ['tag1', 'tag2'],
      timeRange: {
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-01-02'),
      },
      chartTypes: ['line'],
      template: 'default',
      format: 'pdf',
    },
    {
      id: 'report-2',
      name: 'Quality Report',
      tags: ['quality'],
      timeRange: {
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-01-02'),
      },
      chartTypes: ['bar'],
      template: 'default',
      format: 'pdf',
    },
  ];

  const mockSchedule: Schedule = {
    id: 'schedule-1',
    name: 'Test Schedule',
    description: 'Test description',
    reportConfig: mockReportConfigs[0],
    cronExpression: '0 9 * * *',
    enabled: true,
    recipients: ['test@example.com'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockHandlers = {
    onSave: jest.fn().mockResolvedValue(undefined),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Form Validation', () => {
    it('should show error when name is empty', async () => {
      render(<ScheduleForm {...mockHandlers} reportConfigs={mockReportConfigs} />);
      
      const submitButton = screen.getByRole('button', { name: /Create schedule/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        const nameError = alerts.find(alert => alert.textContent?.includes('Schedule name is required'));
        expect(nameError).toBeInTheDocument();
      });
      
      expect(mockHandlers.onSave).not.toHaveBeenCalled();
    });

    it('should show error when name exceeds 100 characters', async () => {
      render(<ScheduleForm {...mockHandlers} reportConfigs={mockReportConfigs} />);
      
      const nameInput = screen.getByLabelText(/Schedule Name/i);
      fireEvent.change(nameInput, { target: { value: 'a'.repeat(101) } });
      
      const submitButton = screen.getByRole('button', { name: /Create schedule/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        const nameError = alerts.find(alert => alert.textContent?.includes('must be 100 characters or less'));
        expect(nameError).toBeInTheDocument();
      });
    });

    it('should show error when no report config is selected', async () => {
      render(<ScheduleForm {...mockHandlers} reportConfigs={mockReportConfigs} />);
      
      const nameInput = screen.getByLabelText(/Schedule Name/i);
      fireEvent.change(nameInput, { target: { value: 'Test Schedule' } });
      
      const submitButton = screen.getByRole('button', { name: /Create schedule/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Please select a report configuration/i)).toBeInTheDocument();
      });
    });

    it('should show error when no recipients are added', async () => {
      render(<ScheduleForm {...mockHandlers} reportConfigs={mockReportConfigs} />);
      
      const nameInput = screen.getByLabelText(/Schedule Name/i);
      fireEvent.change(nameInput, { target: { value: 'Test Schedule' } });
      
      const reportSelect = screen.getByLabelText(/Report Configuration/i);
      fireEvent.change(reportSelect, { target: { value: 'report-1' } });
      
      const submitButton = screen.getByRole('button', { name: /Create schedule/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/At least one recipient email is required/i)).toBeInTheDocument();
      });
    });

    it('should validate invalid cron expression', async () => {
      render(<ScheduleForm {...mockHandlers} reportConfigs={mockReportConfigs} />);
      
      const nameInput = screen.getByLabelText(/Schedule Name/i);
      fireEvent.change(nameInput, { target: { value: 'Test Schedule' } });
      
      const reportSelect = screen.getByLabelText(/Report Configuration/i);
      fireEvent.change(reportSelect, { target: { value: 'report-1' } });
      
      // Enter custom mode and set invalid cron
      const customButton = screen.getByRole('button', { name: /Enter custom cron expression/i });
      fireEvent.click(customButton);
      
      const cronInput = screen.getByRole('textbox', { name: /Custom Cron Expression/i });
      fireEvent.change(cronInput, { target: { value: 'invalid' } });
      
      // Add a recipient
      const emailInput = screen.getByLabelText(/Enter email address/i);
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      const addButton = screen.getByRole('button', { name: /Add email recipient/i });
      fireEvent.click(addButton);
      
      const submitButton = screen.getByRole('button', { name: /Create schedule/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Invalid cron expression format/i)).toBeInTheDocument();
      });
    });
  });

  describe('Create Mode', () => {
    it('should display "Create New Schedule" title', () => {
      render(<ScheduleForm {...mockHandlers} reportConfigs={mockReportConfigs} />);
      
      expect(screen.getByText('Create New Schedule')).toBeInTheDocument();
    });

    it('should have empty form fields initially', () => {
      render(<ScheduleForm {...mockHandlers} reportConfigs={mockReportConfigs} />);
      
      const nameInput = screen.getByLabelText(/Schedule Name/i) as HTMLInputElement;
      expect(nameInput.value).toBe('');
      
      const descriptionInput = screen.getByLabelText(/Description/i) as HTMLTextAreaElement;
      expect(descriptionInput.value).toBe('');
    });

    it('should have enabled toggle checked by default', () => {
      render(<ScheduleForm {...mockHandlers} reportConfigs={mockReportConfigs} />);
      
      const enabledToggle = screen.getByRole('checkbox', { name: /Enable or disable this schedule/i });
      expect(enabledToggle).toBeChecked();
    });

    it('should call onSave with correct data when form is submitted', async () => {
      render(<ScheduleForm {...mockHandlers} reportConfigs={mockReportConfigs} />);
      
      // Fill in form
      const nameInput = screen.getByLabelText(/Schedule Name/i);
      fireEvent.change(nameInput, { target: { value: 'New Schedule' } });
      
      const reportSelect = screen.getByLabelText(/Report Configuration/i);
      fireEvent.change(reportSelect, { target: { value: 'report-1' } });
      
      // Add recipient
      const emailInput = screen.getByLabelText(/Enter email address/i);
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      const addButton = screen.getByRole('button', { name: /Add email recipient/i });
      fireEvent.click(addButton);
      
      // Submit
      const submitButton = screen.getByRole('button', { name: /Create schedule/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockHandlers.onSave).toHaveBeenCalledTimes(1);
        expect(mockHandlers.onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'New Schedule',
            cronExpression: '0 9 * * *',
            enabled: true,
            recipients: ['test@example.com'],
            reportConfig: mockReportConfigs[0],
          })
        );
      });
    });
  });

  describe('Edit Mode', () => {
    it('should display "Edit Schedule" title', () => {
      render(<ScheduleForm schedule={mockSchedule} {...mockHandlers} reportConfigs={mockReportConfigs} />);
      
      expect(screen.getByText('Edit Schedule')).toBeInTheDocument();
    });

    it('should pre-fill form with schedule data', () => {
      render(<ScheduleForm schedule={mockSchedule} {...mockHandlers} reportConfigs={mockReportConfigs} />);
      
      const nameInput = screen.getByLabelText(/Schedule Name/i) as HTMLInputElement;
      expect(nameInput.value).toBe('Test Schedule');
      
      const descriptionInput = screen.getByLabelText(/Description/i) as HTMLTextAreaElement;
      expect(descriptionInput.value).toBe('Test description');
      
      const reportSelect = screen.getByLabelText(/Report Configuration/i) as HTMLSelectElement;
      expect(reportSelect.value).toBe('report-1');
    });

    it('should display existing recipients', () => {
      render(<ScheduleForm schedule={mockSchedule} {...mockHandlers} reportConfigs={mockReportConfigs} />);
      
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('should call onSave with updated data', async () => {
      render(<ScheduleForm schedule={mockSchedule} {...mockHandlers} reportConfigs={mockReportConfigs} />);
      
      // Update name
      const nameInput = screen.getByLabelText(/Schedule Name/i);
      fireEvent.change(nameInput, { target: { value: 'Updated Schedule' } });
      
      // Submit
      const submitButton = screen.getByRole('button', { name: /Update schedule/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockHandlers.onSave).toHaveBeenCalledTimes(1);
        expect(mockHandlers.onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Updated Schedule',
          })
        );
      });
    });
  });

  describe('Email Recipient Management', () => {
    it('should add recipient when Add button is clicked', () => {
      render(<ScheduleForm {...mockHandlers} reportConfigs={mockReportConfigs} />);
      
      const emailInput = screen.getByLabelText(/Enter email address/i);
      fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
      
      const addButton = screen.getByRole('button', { name: /Add email recipient/i });
      fireEvent.click(addButton);
      
      expect(screen.getByText('new@example.com')).toBeInTheDocument();
    });

    it('should add recipient when Enter key is pressed', () => {
      render(<ScheduleForm {...mockHandlers} reportConfigs={mockReportConfigs} />);
      
      const emailInput = screen.getByLabelText(/Enter email address/i);
      fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
      fireEvent.keyDown(emailInput, { key: 'Enter', code: 'Enter' });
      
      expect(screen.getByText('new@example.com')).toBeInTheDocument();
    });

    it('should clear input after adding recipient', () => {
      render(<ScheduleForm {...mockHandlers} reportConfigs={mockReportConfigs} />);
      
      const emailInput = screen.getByLabelText(/Enter email address/i) as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
      
      const addButton = screen.getByRole('button', { name: /Add email recipient/i });
      fireEvent.click(addButton);
      
      expect(emailInput.value).toBe('');
    });

    it('should show error for invalid email format', () => {
      render(<ScheduleForm {...mockHandlers} reportConfigs={mockReportConfigs} />);
      
      const emailInput = screen.getByLabelText(/Enter email address/i);
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      
      const addButton = screen.getByRole('button', { name: /Add email recipient/i });
      fireEvent.click(addButton);
      
      expect(screen.getByText(/Invalid email address format/i)).toBeInTheDocument();
    });

    it('should show error for duplicate email', () => {
      render(<ScheduleForm {...mockHandlers} reportConfigs={mockReportConfigs} />);
      
      const emailInput = screen.getByLabelText(/Enter email address/i);
      
      // Add first email
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      const addButton = screen.getByRole('button', { name: /Add email recipient/i });
      fireEvent.click(addButton);
      
      // Try to add same email again
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.click(addButton);
      
      expect(screen.getByText(/Email already added/i)).toBeInTheDocument();
    });

    it('should remove recipient when remove button is clicked', () => {
      render(<ScheduleForm schedule={mockSchedule} {...mockHandlers} reportConfigs={mockReportConfigs} />);
      
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
      
      const removeButton = screen.getByLabelText(/Remove test@example.com/i);
      fireEvent.click(removeButton);
      
      expect(screen.queryByText('test@example.com')).not.toBeInTheDocument();
    });

    it('should not add empty email', () => {
      render(<ScheduleForm {...mockHandlers} reportConfigs={mockReportConfigs} />);
      
      const addButton = screen.getByRole('button', { name: /Add email recipient/i });
      fireEvent.click(addButton);
      
      // Should not show any error or add anything
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Form Actions', () => {
    it('should call onCancel when Cancel button is clicked', () => {
      render(<ScheduleForm {...mockHandlers} reportConfigs={mockReportConfigs} />);
      
      const cancelButton = screen.getByRole('button', { name: /Cancel and return/i });
      fireEvent.click(cancelButton);
      
      expect(mockHandlers.onCancel).toHaveBeenCalledTimes(1);
    });

    it('should disable buttons while saving', async () => {
      const slowSave = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );
      
      render(<ScheduleForm {...mockHandlers} onSave={slowSave} reportConfigs={mockReportConfigs} />);
      
      // Fill in minimal valid form
      const nameInput = screen.getByLabelText(/Schedule Name/i);
      fireEvent.change(nameInput, { target: { value: 'Test' } });
      
      const reportSelect = screen.getByLabelText(/Report Configuration/i);
      fireEvent.change(reportSelect, { target: { value: 'report-1' } });
      
      const emailInput = screen.getByLabelText(/Enter email address/i);
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      const addButton = screen.getByRole('button', { name: /Add email recipient/i });
      fireEvent.click(addButton);
      
      const submitButton = screen.getByRole('button', { name: /Create schedule/i });
      fireEvent.click(submitButton);
      
      // Buttons should be disabled during save
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
        const cancelButton = screen.getByRole('button', { name: /Cancel and return/i });
        expect(cancelButton).toBeDisabled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper form structure', () => {
      render(<ScheduleForm {...mockHandlers} reportConfigs={mockReportConfigs} />);
      
      const form = screen.getByRole('form', { name: /Create New Schedule/i });
      expect(form).toBeInTheDocument();
    });

    it('should have required field indicators', () => {
      render(<ScheduleForm {...mockHandlers} reportConfigs={mockReportConfigs} />);
      
      const nameInput = screen.getByLabelText(/Schedule Name/i);
      expect(nameInput).toHaveAttribute('aria-required', 'true');
      
      const reportSelect = screen.getByLabelText(/Report Configuration/i);
      expect(reportSelect).toHaveAttribute('aria-required', 'true');
    });

    it('should have character count for description', () => {
      render(<ScheduleForm {...mockHandlers} reportConfigs={mockReportConfigs} />);
      
      expect(screen.getByText(/0\/500 characters/i)).toBeInTheDocument();
    });

    it('should update character count as user types', () => {
      render(<ScheduleForm {...mockHandlers} reportConfigs={mockReportConfigs} />);
      
      const descriptionInput = screen.getByLabelText(/Description/i);
      fireEvent.change(descriptionInput, { target: { value: 'Test description' } });
      
      expect(screen.getByText(/16\/500 characters/i)).toBeInTheDocument();
    });
  });
});
