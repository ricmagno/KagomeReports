import React, { useState, useEffect, useCallback, memo } from 'react';
import { Schedule, ScheduleConfig } from '../../types/schedule';
import { ReportConfig } from '../../types/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { CronBuilder } from './CronBuilder';
import { cn } from '../../utils/cn';

/**
 * Props for the ScheduleForm component
 */
interface ScheduleFormProps {
  /** Existing schedule to edit (undefined for create mode) */
  schedule?: Schedule;
  /** Available report configurations to choose from */
  reportConfigs?: ReportConfig[];
  /** Callback when form is saved */
  onSave: (schedule: ScheduleConfig) => Promise<void>;
  /** Callback when form is cancelled */
  onCancel: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Form data interface
 */
interface FormData {
  name: string;
  description: string;
  reportConfigId: string;
  cronExpression: string;
  enabled: boolean;
  recipients: string[];
}

/**
 * Form validation errors interface
 */
interface FormErrors {
  name?: string;
  reportConfigId?: string;
  cronExpression?: string;
  recipients?: string;
}

/**
 * ScheduleForm Component
 * 
 * Form component for creating new schedules or editing existing ones.
 * Handles all form validation, email recipient management, and submission.
 * 
 * Features:
 * - Schedule name input (required, 1-100 characters)
 * - Description textarea (optional, max 500 characters)
 * - Report configuration selector
 * - Cron expression builder integration
 * - Enabled/disabled toggle
 * - Email recipients management (add/remove with validation)
 * - Comprehensive form validation
 * - Loading states during submission
 * - Error display for validation failures
 * 
 * Validation Rules:
 * - Name: 1-100 characters, required
 * - Description: max 500 characters, optional
 * - Report config: required
 * - Cron expression: valid cron syntax, required
 * - Recipients: at least one valid email, required
 * 
 * @example
 * ```tsx
 * <ScheduleForm
 *   schedule={selectedSchedule}
 *   reportConfigs={reportConfigs}
 *   onSave={handleSave}
 *   onCancel={handleCancel}
 * />
 * ```
 */

const ScheduleFormComponent: React.FC<ScheduleFormProps> = ({
  schedule,
  reportConfigs = [],
  onSave,
  onCancel,
  className,
}) => {
  const [formData, setFormData] = useState<FormData>({
    name: schedule?.name || '',
    description: schedule?.description || '',
    reportConfigId: schedule?.reportConfig?.id || '',
    cronExpression: schedule?.cronExpression || '0 9 * * *',
    enabled: schedule?.enabled ?? true,
    recipients: schedule?.recipients || [],
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [recipientInput, setRecipientInput] = useState('');
  const [loading, setLoading] = useState(false);

  const isEditMode = !!schedule;

  // Memoize validation functions
  const validateEmail = useCallback((email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }, []);

  const validateCron = useCallback((cron: string): boolean => {
    const parts = cron.split(' ');
    if (parts.length !== 5) return false;
    const pattern = /^(\*|[0-9]+|\*\/[0-9]+|[0-9]+-[0-9]+)$/;
    return parts.every(part => pattern.test(part));
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    // Validate name
    if (!formData.name.trim()) {
      newErrors.name = 'Schedule name is required';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Schedule name must be 100 characters or less';
    }

    // Validate report config
    if (!formData.reportConfigId) {
      newErrors.reportConfigId = 'Please select a report configuration';
    }

    // Validate cron expression
    if (!validateCron(formData.cronExpression)) {
      newErrors.cronExpression = 'Invalid cron expression format';
    }

    // Validate recipients
    if (formData.recipients.length === 0) {
      newErrors.recipients = 'At least one recipient email is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, validateCron]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const selectedReportConfig = reportConfigs.find(
        (config) => config.id === formData.reportConfigId
      );

      if (!selectedReportConfig) {
        setErrors({ reportConfigId: 'Selected report configuration not found' });
        return;
      }

      const scheduleConfig: ScheduleConfig = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        reportConfig: selectedReportConfig,
        cronExpression: formData.cronExpression,
        enabled: formData.enabled,
        recipients: formData.recipients,
      };

      await onSave(scheduleConfig);
    } catch (error) {
      console.error('Error saving schedule:', error);
    } finally {
      setLoading(false);
    }
  }, [formData, reportConfigs, validateForm, onSave]);

  const handleAddRecipient = useCallback(() => {
    const email = recipientInput.trim();

    if (!email) return;

    if (!validateEmail(email)) {
      setErrors({ ...errors, recipients: 'Invalid email address format' });
      return;
    }

    if (formData.recipients.includes(email)) {
      setErrors({ ...errors, recipients: 'Email already added' });
      return;
    }

    setFormData({
      ...formData,
      recipients: [...formData.recipients, email],
    });
    setRecipientInput('');
    setErrors({ ...errors, recipients: undefined });
  }, [recipientInput, formData, errors, validateEmail]);

  const handleRemoveRecipient = useCallback((email: string) => {
    setFormData({
      ...formData,
      recipients: formData.recipients.filter((r) => r !== email),
    });
  }, [formData]);

  const handleRecipientKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddRecipient();
    }
  }, [handleAddRecipient]);

  return (
    <Card className={cn('max-w-3xl mx-auto', className)}>
      <CardHeader>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900" id="form-title">
          {isEditMode ? 'Edit Schedule' : 'Create New Schedule'}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {isEditMode ? 'Update the schedule configuration' : 'Configure a new automated report schedule'}
        </p>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6" aria-labelledby="form-title">
          {/* Schedule Name */}
          <Input
            label="Schedule Name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={errors.name}
            placeholder="e.g., Daily Production Report"
            required
            maxLength={100}
            aria-required="true"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          {errors.name && <span id="name-error" className="sr-only">{errors.name}</span>}

          {/* Description */}
          <div>
            <label htmlFor="schedule-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="schedule-description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Optional description of this schedule"
              rows={3}
              maxLength={500}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm sm:text-base"
              aria-label="Schedule description"
            />
            <p className="mt-1 text-xs text-gray-500" aria-live="polite">
              {formData.description.length}/500 characters
            </p>
          </div>

          {/* Report Configuration Selector */}
          <div>
            <label htmlFor="report-config" className="block text-sm font-medium text-gray-700 mb-1">
              Report Configuration <span className="text-red-500">*</span>
            </label>
            <select
              id="report-config"
              value={formData.reportConfigId}
              onChange={(e) =>
                setFormData({ ...formData, reportConfigId: e.target.value })
              }
              className={cn(
                'block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm sm:text-base',
                errors.reportConfigId && 'border-red-500'
              )}
              required
              aria-required="true"
              aria-invalid={!!errors.reportConfigId}
              aria-describedby={errors.reportConfigId ? "report-config-error" : undefined}
            >
              <option value="">Select a report configuration</option>
              {reportConfigs.map((config) => (
                <option key={config.id} value={config.id}>
                  {config.name}
                  {config.description && ` - ${config.description}`}
                </option>
              ))}
            </select>
            {errors.reportConfigId && (
              <p className="mt-1 text-sm text-red-600" id="report-config-error" role="alert">
                {errors.reportConfigId}
              </p>
            )}
          </div>

          {/* Cron Expression Builder */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" id="cron-label">
              Schedule Frequency <span className="text-red-500">*</span>
            </label>
            <CronBuilder
              value={formData.cronExpression}
              onChange={(cron) => setFormData({ ...formData, cronExpression: cron })}
              error={errors.cronExpression}
              aria-labelledby="cron-label"
            />
          </div>

          {/* Email Recipients */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" id="recipients-label">
              Email Recipients <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-2 mb-2">
              <Input
                id="recipient-input"
                type="email"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddRecipient();
                  }
                }}
                placeholder="email@example.com"
                className="flex-1"
                aria-label="Enter email address"
                aria-describedby="recipients-label"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddRecipient}
                className="w-full sm:w-auto"
                aria-label="Add email recipient"
              >
                Add
              </Button>
            </div>

            {/* Recipients List */}
            {formData.recipients.length > 0 && (
              <div className="space-y-2" role="list" aria-label="Email recipients">
                {formData.recipients.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                    role="listitem"
                  >
                    <span className="text-sm text-gray-700 break-all">{email}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRecipient(email)}
                      className="text-red-600 hover:text-red-800 ml-2 flex-shrink-0 p-1 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                      aria-label={`Remove ${email} from recipients`}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {errors.recipients && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {errors.recipients}
              </p>
            )}
          </div>

          {/* Enabled Toggle */}
          <fieldset>
            <legend className="sr-only">Schedule status</legend>
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) =>
                    setFormData({ ...formData, enabled: e.target.checked })
                  }
                  className="sr-only peer"
                  aria-label="Enable or disable this schedule"
                  aria-describedby="enabled-description"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {formData.enabled ? 'Enabled' : 'Disabled'}
                </p>
                <p className="text-xs text-gray-500" id="enabled-description">
                  {formData.enabled
                    ? 'Schedule will run automatically'
                    : 'Schedule will not run until enabled'}
                </p>
              </div>
            </div>
          </fieldset>

          {/* Form Actions */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t border-gray-200" role="group" aria-label="Form actions">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
              className="w-full sm:w-auto"
              aria-label="Cancel and return to schedules list"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="primary" 
              loading={loading}
              className="w-full sm:w-auto"
              aria-label={isEditMode ? 'Update schedule' : 'Create schedule'}
            >
              {isEditMode ? 'Update Schedule' : 'Create Schedule'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const ScheduleForm = memo(ScheduleFormComponent, (prevProps, nextProps) => {
  return (
    prevProps.schedule?.id === nextProps.schedule?.id &&
    prevProps.reportConfigs?.length === nextProps.reportConfigs?.length
  );
});

ScheduleForm.displayName = 'ScheduleForm';
