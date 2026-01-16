import React from 'react';
import { cn } from '../../utils/cn';
import { Spinner } from './Spinner';

interface ProgressIndicatorProps {
  message?: string;
  progress?: number; // 0-100 for determinate progress
  className?: string;
}

/**
 * Progress indicator for long-running operations
 * Supports both indeterminate (spinner) and determinate (progress bar) modes
 */
export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  message = 'Processing...',
  progress,
  className,
}) => {
  const isDeterminate = progress !== undefined;

  return (
    <div className={cn('flex flex-col items-center justify-center p-6', className)}>
      {isDeterminate ? (
        <>
          {/* Determinate progress bar */}
          <div className="w-full max-w-md mb-3">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-600 transition-all duration-300 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>
          <p className="text-sm text-gray-600">
            {message} ({Math.round(progress)}%)
          </p>
        </>
      ) : (
        <>
          {/* Indeterminate spinner */}
          <Spinner size="lg" className="text-primary-600 mb-3" />
          <p className="text-sm text-gray-600">{message}</p>
        </>
      )}
    </div>
  );
};
