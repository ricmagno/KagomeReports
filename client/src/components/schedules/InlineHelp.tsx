import React, { useState } from 'react';
import { cn } from '../../utils/cn';

/**
 * Props for the InlineHelp component
 */
interface InlineHelpProps {
  /** Help text content to display */
  content: string;
  /** Additional CSS classes */
  className?: string;
  /** Position of the tooltip */
  position?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * InlineHelp Component
 * 
 * Displays a help icon with a tooltip that shows helpful information
 * when hovered or focused. Useful for providing contextual help without
 * cluttering the UI.
 * 
 * Features:
 * - Help icon with hover/focus tooltip
 * - Configurable tooltip position
 * - Keyboard accessible
 * - Screen reader compatible
 * - Responsive design
 * 
 * @example
 * ```tsx
 * <InlineHelp 
 *   content="Cron expressions define when your schedule runs. Use the presets or enter a custom expression."
 *   position="right"
 * />
 * ```
 */
export const InlineHelp: React.FC<InlineHelpProps> = ({
  content,
  className,
  position = 'top',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className={cn('relative inline-block', className)}>
      <button
        type="button"
        className="inline-flex items-center justify-center w-5 h-5 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full transition-colors"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        aria-label="Help information"
        aria-describedby="inline-help-tooltip"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {/* Tooltip */}
      {isVisible && (
        <div
          id="inline-help-tooltip"
          role="tooltip"
          className={cn(
            'absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg max-w-xs',
            'whitespace-normal break-words',
            positionClasses[position]
          )}
        >
          {content}
          {/* Arrow */}
          <div
            className={cn(
              'absolute w-2 h-2 bg-gray-900 transform rotate-45',
              position === 'top' && 'bottom-[-4px] left-1/2 -translate-x-1/2',
              position === 'bottom' && 'top-[-4px] left-1/2 -translate-x-1/2',
              position === 'left' && 'right-[-4px] top-1/2 -translate-y-1/2',
              position === 'right' && 'left-[-4px] top-1/2 -translate-y-1/2'
            )}
          />
        </div>
      )}
    </div>
  );
};
