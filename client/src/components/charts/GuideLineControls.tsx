/**
 * GuideLineControls Component
 * Control panel for adding and removing guide lines
 */

import React from 'react';
import { ArrowLeftRight, ArrowUpDown, Trash2 } from 'lucide-react';

interface GuideLineControlsProps {
  /** Current number of horizontal lines */
  horizontalCount: number;
  
  /** Current number of vertical lines */
  verticalCount: number;
  
  /** Maximum horizontal lines allowed */
  maxHorizontal: number;
  
  /** Maximum vertical lines allowed */
  maxVertical: number;
  
  /** Callback to add horizontal line */
  onAddHorizontal: () => void;
  
  /** Callback to add vertical line */
  onAddVertical: () => void;
  
  /** Callback to clear all lines */
  onClearAll: () => void;
  
  /** Optional class name */
  className?: string;
}

export const GuideLineControls: React.FC<GuideLineControlsProps> = ({
  horizontalCount,
  verticalCount,
  maxHorizontal,
  maxVertical,
  onAddHorizontal,
  onAddVertical,
  onClearAll,
  className = '',
}) => {
  const horizontalDisabled = horizontalCount >= maxHorizontal;
  const verticalDisabled = verticalCount >= maxVertical;
  const clearDisabled = horizontalCount === 0 && verticalCount === 0;
  
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Add Horizontal Line Button */}
      <button
        onClick={onAddHorizontal}
        disabled={horizontalDisabled}
        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title={horizontalDisabled ? `Maximum ${maxHorizontal} horizontal lines` : 'Add horizontal guide line'}
        aria-label="Add horizontal guide line"
      >
        <ArrowLeftRight className="w-3 h-3 mr-1.5" />
        Horizontal
        <span className="ml-1.5 text-[10px] text-blue-600">
          ({horizontalCount}/{maxHorizontal})
        </span>
      </button>
      
      {/* Add Vertical Line Button */}
      <button
        onClick={onAddVertical}
        disabled={verticalDisabled}
        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title={verticalDisabled ? `Maximum ${maxVertical} vertical lines` : 'Add vertical guide line'}
        aria-label="Add vertical guide line"
      >
        <ArrowUpDown className="w-3 h-3 mr-1.5" />
        Vertical
        <span className="ml-1.5 text-[10px] text-green-600">
          ({verticalCount}/{maxVertical})
        </span>
      </button>
      
      {/* Clear All Button */}
      <button
        onClick={onClearAll}
        disabled={clearDisabled}
        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Clear all guide lines"
        aria-label="Clear all guide lines"
      >
        <Trash2 className="w-3 h-3 mr-1.5" />
        Clear All
      </button>
      
      {/* Info text */}
      {!clearDisabled && (
        <span className="text-xs text-gray-500 ml-2">
          {horizontalCount + verticalCount} guide line{horizontalCount + verticalCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
};
