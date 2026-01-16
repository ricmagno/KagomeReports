import React, { useState, memo } from 'react';
import { Schedule } from '../../types/schedule';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusIndicator } from './StatusIndicator';
import { Spinner } from '../ui/Spinner';
import { cn } from '../../utils/cn';

/**
 * Props for the ScheduleCard component
 */
interface ScheduleCardProps {
  /** Schedule object to display */
  schedule: Schedule;
  /** Callback when edit button is clicked */
  onEdit: (schedule: Schedule) => void;
  /** Callback when delete button is clicked */
  onDelete: () => void;
  /** Callback when enabled/disabled toggle is changed */
  onToggleEnabled: (scheduleId: string, enabled: boolean) => Promise<void>;
  /** Callback when "Run Now" button is clicked */
  onRunNow: (scheduleId: string) => Promise<void>;
  /** Callback when "View History" button is clicked */
  onViewHistory: (schedule: Schedule) => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether the schedule is currently being toggled */
  isTogglingEnabled?: boolean;
  /** Whether the schedule is currently being executed */
  isRunning?: boolean;
}

/**
 * ScheduleCard Component
 * 
 * Displays an individual schedule with all its information and action buttons.
 * Provides a comprehensive view of schedule status, timing, and controls.
 * 
 * Features:
 * - Schedule name and description display
 * - Human-readable cron expression
 * - Next run time and last run time
 * - Last execution status with visual indicator
 * - Enable/disable toggle with optimistic updates
 * - Action buttons (Edit, Delete, Run Now, View History)
 * - Recipients count display
 * - Error message display for failed executions
 * - Loading states for async operations
 * - Responsive design for mobile and desktop
 * 
 * Performance:
 * - Memoized with custom comparison function
 * - Prevents unnecessary re-renders
 * - Optimistic UI updates for better UX
 * 
 * @example
 * ```tsx
 * <ScheduleCard
 *   schedule={schedule}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 *   onToggleEnabled={handleToggle}
 *   onRunNow={handleRunNow}
 *   onViewHistory={handleViewHistory}
 *   isTogglingEnabled={togglingSchedules.has(schedule.id)}
 *   isRunning={runningSchedules.has(schedule.id)}
 * />
 * ```
 */

const ScheduleCardComponent: React.FC<ScheduleCardProps> = ({
  schedule,
  onEdit,
  onDelete,
  onToggleEnabled,
  onRunNow,
  onViewHistory,
  className,
  isTogglingEnabled = false,
  isRunning = false,
}) => {
  // Local loading states for individual actions
  const [isLocalToggling, setIsLocalToggling] = useState(false);
  const [isLocalRunning, setIsLocalRunning] = useState(false);

  const formatDate = (date?: Date | string) => {
    if (!date) return 'N/A';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCronDescription = (cron: string): string => {
    // Simple cron description - can be enhanced with a library
    const parts = cron.split(' ');
    if (parts.length < 5) return cron;

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    if (minute === '0' && hour === '*') return 'Every hour';
    if (minute === '0' && hour.startsWith('*/')) {
      const hours = hour.split('/')[1];
      return `Every ${hours} hours`;
    }
    if (minute === '0' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      return `Daily at ${hour}:00`;
    }
    if (minute === '0' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return `Weekly on ${days[parseInt(dayOfWeek)]} at ${hour}:00`;
    }
    if (minute === '0' && hour !== '*' && dayOfMonth !== '*' && month === '*' && dayOfWeek === '*') {
      return `Monthly on day ${dayOfMonth} at ${hour}:00`;
    }

    return cron;
  };

  const handleToggle = async (checked: boolean) => {
    setIsLocalToggling(true);
    try {
      await onToggleEnabled(schedule.id, checked);
    } finally {
      setIsLocalToggling(false);
    }
  };

  const handleRunNow = async () => {
    setIsLocalRunning(true);
    try {
      await onRunNow(schedule.id);
    } finally {
      setIsLocalRunning(false);
    }
  };

  const isToggling = isTogglingEnabled || isLocalToggling;
  const isExecuting = isRunning || isLocalRunning;

  return (
    <Card className={cn('hover:shadow-md transition-shadow', className)} role="article" aria-label={`Schedule: ${schedule.name}`}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 break-words">
                {schedule.name}
              </h3>
              {schedule.lastStatus && (
                <StatusIndicator status={schedule.lastStatus} size="sm" />
              )}
            </div>
            {schedule.description && (
              <p className="text-sm text-gray-600 mb-3 break-words">
                {schedule.description}
              </p>
            )}
          </div>

          {/* Enable/Disable Toggle */}
          <div className="sm:ml-4">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={schedule.enabled}
                onChange={(e) => handleToggle(e.target.checked)}
                disabled={isToggling}
                className="sr-only peer"
                aria-label={`${schedule.enabled ? 'Disable' : 'Enable'} schedule ${schedule.name}`}
                aria-describedby={`toggle-description-${schedule.id}`}
              />
              <div className={cn(
                "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600",
                isToggling && "opacity-50 cursor-not-allowed"
              )}></div>
              <span className="ml-3 text-sm font-medium text-gray-700 flex items-center gap-2" id={`toggle-description-${schedule.id}`}>
                {schedule.enabled ? 'Enabled' : 'Disabled'}
                {isToggling && <Spinner size="sm" aria-label="Toggling schedule status" />}
              </span>
            </label>
          </div>
        </div>

        {/* Schedule Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 text-sm">
          <div>
            <span className="text-gray-500">Frequency:</span>
            <p className="font-medium text-gray-900 break-words">
              {getCronDescription(schedule.cronExpression)}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Next Run:</span>
            <p className="font-medium text-gray-900 break-words">
              <time dateTime={schedule.nextRun ? (schedule.nextRun instanceof Date ? schedule.nextRun.toISOString() : schedule.nextRun) : undefined}>
                {formatDate(schedule.nextRun)}
              </time>
            </p>
          </div>
          <div>
            <span className="text-gray-500">Last Run:</span>
            <p className="font-medium text-gray-900 break-words">
              <time dateTime={schedule.lastRun ? (schedule.lastRun instanceof Date ? schedule.lastRun.toISOString() : schedule.lastRun) : undefined}>
                {formatDate(schedule.lastRun)}
              </time>
            </p>
          </div>
          <div>
            <span className="text-gray-500">Recipients:</span>
            <p className="font-medium text-gray-900">
              {schedule.recipients?.length || 0} recipient(s)
            </p>
          </div>
        </div>

        {/* Error Message */}
        {schedule.lastError && schedule.lastStatus === 'failed' && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md" role="alert">
            <p className="text-sm text-red-800 break-words">
              <span className="font-medium">Error:</span> {schedule.lastError}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200" role="group" aria-label={`Actions for ${schedule.name}`}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(schedule)}
            aria-label={`Edit schedule ${schedule.name}`}
            className="flex-shrink-0"
          >
            <svg
              className="w-4 h-4 sm:mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            <span className="hidden sm:inline">Edit</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRunNow}
            disabled={!schedule.enabled || isExecuting}
            loading={isExecuting}
            aria-label={`Run schedule ${schedule.name} now`}
            aria-disabled={!schedule.enabled || isExecuting}
            className="flex-shrink-0"
          >
            <svg
              className="w-4 h-4 sm:mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="hidden sm:inline">Run Now</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewHistory(schedule)}
            aria-label={`View execution history for ${schedule.name}`}
            className="flex-shrink-0"
          >
            <svg
              className="w-4 h-4 sm:mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="hidden sm:inline">History</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="text-red-600 hover:bg-red-50 hover:border-red-300 flex-shrink-0"
            aria-label={`Delete schedule ${schedule.name}`}
          >
            <svg
              className="w-4 h-4 sm:mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            <span className="hidden sm:inline">Delete</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const ScheduleCard = memo(ScheduleCardComponent, (prevProps, nextProps) => {
  // Custom comparison function to optimize re-renders
  return (
    prevProps.schedule.id === nextProps.schedule.id &&
    prevProps.schedule.name === nextProps.schedule.name &&
    prevProps.schedule.description === nextProps.schedule.description &&
    prevProps.schedule.enabled === nextProps.schedule.enabled &&
    prevProps.schedule.lastStatus === nextProps.schedule.lastStatus &&
    prevProps.schedule.nextRun?.getTime() === nextProps.schedule.nextRun?.getTime() &&
    prevProps.schedule.lastRun?.getTime() === nextProps.schedule.lastRun?.getTime() &&
    prevProps.schedule.lastError === nextProps.schedule.lastError &&
    prevProps.schedule.recipients?.length === nextProps.schedule.recipients?.length &&
    prevProps.isTogglingEnabled === nextProps.isTogglingEnabled &&
    prevProps.isRunning === nextProps.isRunning
  );
});

ScheduleCard.displayName = 'ScheduleCard';
