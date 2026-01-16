import React, { useState, useEffect, memo, useMemo } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { cn } from '../../utils/cn';
import {
  CRON_PRESETS,
  validateCronExpression,
  getCronDescription,
  getNextRunTimes,
  type CronPreset,
} from '../../utils/cronUtils';
import { formatTimestamp } from '../../utils/dateTimeUtils';

/**
 * Props for the CronBuilder component
 */
interface CronBuilderProps {
  /** Current cron expression value */
  value: string;
  /** Callback when cron expression changes */
  onChange: (cronExpression: string) => void;
  /** Validation error message to display */
  error?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * CronBuilder Component
 * 
 * Interactive cron expression builder with preset buttons, custom input,
 * human-readable descriptions, and next run times preview.
 * 
 * Features:
 * - Preset buttons for common schedules (Hourly, Daily, Weekly, Monthly, etc.)
 * - Custom cron expression input with validation
 * - Real-time human-readable description
 * - Preview of next 5 scheduled run times
 * - Inline help text and format guidance
 * 
 * @example
 * ```tsx
 * <CronBuilder
 *   value={cronExpression}
 *   onChange={setCronExpression}
 *   error={validationError}
 * />
 * ```
 * 
 * @see {@link CRON_GUIDE.md} for detailed cron expression documentation
 */

const CronBuilderComponent: React.FC<CronBuilderProps> = ({
  value,
  onChange,
  error,
  className,
}) => {
  const [customMode, setCustomMode] = useState(false);
  const [nextRuns, setNextRuns] = useState<Date[]>([]);

  // Memoize the cron description to avoid recalculation
  const cronDescription = useMemo(() => getCronDescription(value), [value]);

  // Memoize validation result
  const isValid = useMemo(() => validateCronExpression(value), [value]);

  useEffect(() => {
    // Calculate next run times using utility function
    const runs = getNextRunTimes(value, 5);
    setNextRuns(runs);
  }, [value]);

  const handlePresetClick = (preset: CronPreset) => {
    onChange(preset.value);
    setCustomMode(false);
  };

  const handleCustomChange = (newValue: string) => {
    onChange(newValue);
  };

  const isPresetSelected = (preset: CronPreset) => {
    return value === preset.value && !customMode;
  };

  return (
    <div className={cn('space-y-4', className)} role="group" aria-label="Cron expression builder">
      {/* Preset Buttons */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700" id="preset-label">
            Quick Presets
          </label>
          <button
            type="button"
            className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"
            onClick={() => window.open('/schedules/cron-guide', '_blank')}
            aria-label="Open cron expression guide in new tab"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Help Guide</span>
          </button>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2" role="group" aria-labelledby="preset-label">
          {CRON_PRESETS.map((preset) => (
            <Button
              key={preset.value}
              type="button"
              variant={isPresetSelected(preset) ? 'primary' : 'outline'}
              size="sm"
              onClick={() => handlePresetClick(preset)}
              className="text-xs whitespace-nowrap"
              aria-label={`Set schedule to ${preset.label}`}
              aria-pressed={isPresetSelected(preset)}
            >
              {preset.label}
            </Button>
          ))}
          <Button
            type="button"
            variant={customMode ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setCustomMode(true)}
            className="text-xs whitespace-nowrap"
            aria-label="Enter custom cron expression"
            aria-pressed={customMode}
          >
            Custom
          </Button>
        </div>
      </div>

      {/* Custom Cron Expression Input */}
      {customMode && (
        <div>
          <label htmlFor="custom-cron" className="block text-sm font-medium text-gray-700 mb-2">
            Custom Cron Expression
          </label>
          <Input
            id="custom-cron"
            type="text"
            value={value}
            onChange={(e) => handleCustomChange(e.target.value)}
            placeholder="0 9 * * *"
            className={cn(error && 'border-red-500')}
            aria-invalid={!!error}
            aria-describedby="cron-format-help cron-description"
          />
          <p className="mt-1 text-xs text-gray-500" id="cron-format-help">
            Format: minute hour day month weekday (e.g., "0 9 * * *" for daily at 9 AM)
          </p>
        </div>
      )}

      {/* Human-Readable Description */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md" role="status" aria-live="polite">
        <p className="text-sm font-medium text-blue-900 break-words" id="cron-description">
          {cronDescription}
        </p>
      </div>

      {/* Validation Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md" role="alert">
          <p className="text-sm text-red-800 break-words">{error}</p>
        </div>
      )}

      {/* Next Run Times Preview */}
      {isValid && nextRuns.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2" id="next-runs-label">
            Next 5 Scheduled Runs
          </label>
          <ul className="space-y-1" role="list" aria-labelledby="next-runs-label">
            {nextRuns.map((run, index) => (
              <li
                key={index}
                className="text-sm text-gray-600 flex items-start gap-2"
              >
                <svg
                  className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5"
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
                <time dateTime={run.toISOString()} className="break-words">
                  {formatTimestamp(run)}
                </time>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const CronBuilder = memo(CronBuilderComponent, (prevProps, nextProps) => {
  return (
    prevProps.value === nextProps.value &&
    prevProps.error === nextProps.error
  );
});

CronBuilder.displayName = 'CronBuilder';
