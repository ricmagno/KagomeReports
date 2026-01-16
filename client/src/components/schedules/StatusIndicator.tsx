import React, { memo } from 'react';
import { cn } from '../../utils/cn';

/**
 * Schedule status type
 */
export type ScheduleStatus = 'success' | 'failed' | 'running' | 'disabled';

/**
 * Props for the StatusIndicator component
 */
interface StatusIndicatorProps {
  /** Status to display */
  status: ScheduleStatus;
  /** Size of the indicator icon */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the status label text */
  showLabel?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * StatusIndicator Component
 * 
 * Visual indicator for schedule/execution status with icons and colors.
 * Provides clear visual feedback about the current state of a schedule or execution.
 * 
 * Features:
 * - Status-specific icons and colors
 * - Multiple sizes (sm, md, lg)
 * - Optional label display
 * - Animated spinner for "running" status
 * - Accessible with ARIA labels
 * - Screen reader support
 * 
 * Status Styles:
 * - Success: Green checkmark icon
 * - Failed: Red X icon
 * - Running: Blue spinner icon (animated)
 * - Disabled: Gray pause icon
 * 
 * Accessibility:
 * - Includes ARIA labels for screen readers
 * - Visual and text indicators for all statuses
 * - Proper semantic HTML
 * 
 * Performance:
 * - Memoized to prevent unnecessary re-renders
 * - Lightweight and efficient
 * 
 * @example
 * ```tsx
 * <StatusIndicator 
 *   status="success" 
 *   size="md" 
 *   showLabel={true} 
 * />
 * ```
 */

const StatusIndicatorComponent: React.FC<StatusIndicatorProps> = ({
  status,
  size = 'md',
  showLabel = false,
  className,
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const iconSize = sizeClasses[size];

  const statusConfig = {
    success: {
      icon: (
        <svg
          className={cn(iconSize, 'text-green-600')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      label: 'Success',
      color: 'text-green-600',
    },
    failed: {
      icon: (
        <svg
          className={cn(iconSize, 'text-red-600')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      label: 'Failed',
      color: 'text-red-600',
    },
    running: {
      icon: (
        <svg
          className={cn(iconSize, 'text-blue-600 animate-spin')}
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ),
      label: 'Running',
      color: 'text-blue-600',
    },
    disabled: {
      icon: (
        <svg
          className={cn(iconSize, 'text-gray-400')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      label: 'Disabled',
      color: 'text-gray-400',
    },
  };

  const config = statusConfig[status];

  return (
    <div className={cn('inline-flex items-center gap-2', className)} role="status" aria-label={`Status: ${config.label}`}>
      {config.icon}
      {showLabel && (
        <span className={cn('text-sm font-medium', config.color)}>
          {config.label}
        </span>
      )}
      <span className="sr-only">{config.label}</span>
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const StatusIndicator = memo(StatusIndicatorComponent, (prevProps, nextProps) => {
  return (
    prevProps.status === nextProps.status &&
    prevProps.size === nextProps.size &&
    prevProps.showLabel === nextProps.showLabel
  );
});

StatusIndicator.displayName = 'StatusIndicator';
