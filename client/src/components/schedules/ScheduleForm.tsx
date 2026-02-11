import React, { useCallback, memo, useReducer } from 'react';
import { Schedule, ScheduleConfig } from '../../types/schedule';
import { ReportConfig } from '../../types/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { CronBuilder } from './CronBuilder';
import { DirectoryBrowser } from './DirectoryBrowser';
import { cn } from '../../utils/cn';
import { useToast } from '../../hooks/useToast';

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
  saveToFile: boolean;
  sendEmail: boolean;
  destinationPath: string;
}

/**
 * Form validation errors interface
 */
interface FormErrors {
  name?: string;
  reportConfigId?: string;
  cronExpression?: string;
  recipients?: string;
  deliveryOptions?: string;
  destinationPath?: string;
}

interface FormState {
  formData: FormData;
  errors: FormErrors;
  recipientInput: string;
  loading: boolean;
  showDirectoryBrowser: boolean;
}

type FormAction =
  | { type: 'SET_FIELD'; field: keyof FormData; value: any }
  | { type: 'SET_ERRORS'; payload: FormErrors }
  | { type: 'SET_RECIPIENT_INPUT'; payload: string }
  | { type: 'ADD_RECIPIENT'; payload: string }
  | { type: 'REMOVE_RECIPIENT'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SHOW_BROWSER'; payload: boolean };

const initialFormState = (schedule?: Schedule): FormState => ({
  formData: {
    name: schedule?.name || '',
    description: schedule?.description || '',
    reportConfigId: schedule?.reportConfig?.id || '',
    cronExpression: schedule?.cronExpression || '0 9 * * *',
    enabled: schedule?.enabled ?? true,
    recipients: schedule?.recipients || [],
    saveToFile: schedule?.saveToFile !== undefined ? schedule.saveToFile : true,
    sendEmail: schedule?.sendEmail !== undefined ? schedule.sendEmail : !!(schedule?.recipients && schedule.recipients.length > 0),
    destinationPath: schedule?.destinationPath || '',
  },
  errors: {},
  recipientInput: '',
  loading: false,
  showDirectoryBrowser: false,
});

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_FIELD':
      return {
        ...state,
        formData: { ...state.formData, [action.field]: action.value }
      };
    case 'SET_ERRORS':
      return { ...state, errors: action.payload };
    case 'SET_RECIPIENT_INPUT':
      return { ...state, recipientInput: action.payload };
    case 'ADD_RECIPIENT':
      return {
        ...state,
        formData: {
          ...state.formData,
          recipients: [...state.formData.recipients, action.payload]
        },
        recipientInput: '',
        errors: { ...state.errors, recipients: undefined }
      };
    case 'REMOVE_RECIPIENT':
      return {
        ...state,
        formData: {
          ...state.formData,
          recipients: state.formData.recipients.filter(r => r !== action.payload)
        }
      };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_SHOW_BROWSER':
      return { ...state, showDirectoryBrowser: action.payload };
    default:
      return state;
  }
}

const ScheduleFormComponent: React.FC<ScheduleFormProps> = ({
  schedule,
  reportConfigs = [],
  onSave,
  onCancel,
  className,
}) => {
  const isEditMode = !!schedule;
  const [state, dispatch] = useReducer(formReducer, schedule, initialFormState);
  const { formData, errors, recipientInput, loading, showDirectoryBrowser } = state;

  const { success: showSuccess } = useToast();

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

    if (!formData.name.trim()) {
      newErrors.name = 'Schedule name is required';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Schedule name must be 100 characters or less';
    }

    if (!formData.reportConfigId) {
      newErrors.reportConfigId = 'Please select a report configuration';
    }

    if (!validateCron(formData.cronExpression)) {
      newErrors.cronExpression = 'Invalid cron expression format';
    }

    if (formData.sendEmail && formData.recipients.length === 0) {
      newErrors.recipients = 'At least one recipient email is required when email delivery is enabled';
    }

    if (!formData.saveToFile && !formData.sendEmail) {
      newErrors.deliveryOptions = 'At least one delivery method must be enabled (Save to Disk or Send via Email)';
    }

    dispatch({ type: 'SET_ERRORS', payload: newErrors });
    return Object.keys(newErrors).length === 0;
  }, [formData, validateCron]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      let selectedReportConfig: ReportConfig | undefined;

      selectedReportConfig = reportConfigs.find(
        (config) => config.id === formData.reportConfigId
      );

      if (!selectedReportConfig && isEditMode && schedule?.reportConfig) {
        if (formData.reportConfigId === schedule.reportConfig.id) {
          selectedReportConfig = schedule.reportConfig;
        }
      }

      if (!selectedReportConfig) {
        dispatch({ type: 'SET_ERRORS', payload: { reportConfigId: 'Selected report configuration not found' } });
        return;
      }

      const scheduleConfig: ScheduleConfig = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        reportConfig: selectedReportConfig,
        cronExpression: formData.cronExpression,
        enabled: formData.enabled,
        recipients: formData.sendEmail ? formData.recipients : undefined,
        saveToFile: formData.saveToFile,
        sendEmail: formData.sendEmail,
        destinationPath: formData.saveToFile && formData.destinationPath ? formData.destinationPath.trim() : undefined,
      };

      await onSave(scheduleConfig);
    } catch (error) {
      console.error('Error saving schedule:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [formData, reportConfigs, validateForm, onSave, isEditMode, schedule]);

  const handleAddRecipient = useCallback(() => {
    const email = recipientInput.trim();

    if (!email) return;

    if (!validateEmail(email)) {
      dispatch({ type: 'SET_ERRORS', payload: { ...errors, recipients: 'Invalid email address format' } });
      return;
    }

    if (formData.recipients.includes(email)) {
      dispatch({ type: 'SET_ERRORS', payload: { ...errors, recipients: 'Email already added' } });
      return;
    }

    dispatch({ type: 'ADD_RECIPIENT', payload: email });
  }, [recipientInput, formData.recipients, errors, validateEmail]);

  const handleRemoveRecipient = useCallback((email: string) => {
    dispatch({ type: 'REMOVE_RECIPIENT', payload: email });
  }, []);

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
          <Input
            label="Schedule Name"
            type="text"
            value={formData.name}
            onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'name', value: e.target.value })}
            error={errors.name}
            placeholder="e.g., Daily Production Report"
            required
            maxLength={100}
            aria-required="true"
            aria-invalid={!!errors.name}
          />

          <div>
            <label htmlFor="schedule-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="schedule-description"
              value={formData.description}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'description', value: e.target.value })}
              placeholder="Optional description of this schedule"
              rows={3}
              maxLength={500}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm sm:text-base"
            />
            <p className="mt-1 text-xs text-gray-500">
              {formData.description.length}/500 characters
            </p>
          </div>

          <div>
            <label htmlFor="report-config" className="block text-sm font-medium text-gray-700 mb-1">
              Report Configuration <span className="text-red-500">*</span>
            </label>
            <select
              id="report-config"
              value={formData.reportConfigId}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'reportConfigId', value: e.target.value })}
              className={cn(
                'block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm sm:text-base',
                errors.reportConfigId && 'border-red-500'
              )}
              required
            >
              <option value="">Select a report configuration</option>
              {isEditMode && schedule?.reportConfig && !reportConfigs.find(c => c.id === schedule.reportConfig.id) && (
                <option key={schedule.reportConfig.id} value={schedule.reportConfig.id}>
                  {schedule.reportConfig.name} (Current)
                </option>
              )}
              {reportConfigs.map((config) => (
                <option key={config.id} value={config.id}>
                  {config.name}
                </option>
              ))}
            </select>
            {errors.reportConfigId && <p className="mt-1 text-sm text-red-600" role="alert">{errors.reportConfigId}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Schedule Frequency <span className="text-red-500">*</span>
            </label>
            <CronBuilder
              value={formData.cronExpression}
              onChange={(cron) => dispatch({ type: 'SET_FIELD', field: 'cronExpression', value: cron })}
              error={errors.cronExpression}
            />
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Delivery Options</h3>

            {errors.deliveryOptions && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md" role="alert">
                <p className="text-sm text-red-800">{errors.deliveryOptions}</p>
              </div>
            )}

            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.saveToFile}
                    onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'saveToFile', value: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
                <div>
                  <p className="text-sm font-medium text-gray-700">Save Report to Disk</p>
                </div>
              </div>

              {formData.saveToFile && (
                <div className="ml-14">
                  <label htmlFor="destination-path" className="block text-sm font-medium text-gray-700 mb-1">
                    Destination Path (optional)
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="destination-path"
                      type="text"
                      value={formData.destinationPath}
                      onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'destinationPath', value: e.target.value })}
                      error={errors.destinationPath}
                      placeholder="e.g., /reports/production"
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" onClick={() => dispatch({ type: 'SET_SHOW_BROWSER', payload: true })}>
                      Browse
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-3 mb-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.sendEmail}
                    onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'sendEmail', value: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
                <div>
                  <p className="text-sm font-medium text-gray-700">Send via Email</p>
                </div>
              </div>

              {formData.sendEmail && (
                <div className="ml-14">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Recipients <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2 mb-2">
                    <Input
                      id="recipient-input"
                      type="email"
                      value={recipientInput}
                      onChange={(e) => dispatch({ type: 'SET_RECIPIENT_INPUT', payload: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddRecipient();
                        }
                      }}
                      placeholder="email@example.com"
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" onClick={handleAddRecipient} className="w-full sm:w-auto">
                      Add
                    </Button>
                  </div>

                  {formData.recipients.length > 0 && (
                    <div className="space-y-2">
                      {formData.recipients.map((email) => (
                        <div key={email} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                          <span className="text-sm text-gray-700 break-all">{email}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRecipient(email)}
                            className="text-red-600 hover:text-red-800 ml-2"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {errors.recipients && <p className="mt-1 text-sm text-red-600" role="alert">{errors.recipients}</p>}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'enabled', value: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            <p className="text-sm font-medium text-gray-700">{formData.enabled ? 'Enabled' : 'Disabled'}</p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="w-full sm:w-auto"
            >
              {isEditMode ? 'Update Schedule' : 'Create Schedule'}
            </Button>
          </div>
        </form>

        {showDirectoryBrowser && (
          <DirectoryBrowser
            value={formData.destinationPath}
            onChange={(path) => {
              dispatch({ type: 'SET_FIELD', field: 'destinationPath', value: path });
              dispatch({ type: 'SET_SHOW_BROWSER', payload: false });
              showSuccess('Location Selected', `Destination path set to: ${path || 'Default root'}`);
            }}
            onClose={() => dispatch({ type: 'SET_SHOW_BROWSER', payload: false })}
            baseType="home"
          />
        )}
      </CardContent>
    </Card>
  );
};

export const ScheduleForm = memo(ScheduleFormComponent, (prevProps, nextProps) => {
  return (
    prevProps.schedule?.id === nextProps.schedule?.id &&
    prevProps.reportConfigs?.length === nextProps.reportConfigs?.length
  );
});

ScheduleForm.displayName = 'ScheduleForm';
