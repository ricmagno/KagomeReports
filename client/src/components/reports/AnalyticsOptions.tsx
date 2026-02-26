import React, { useState, useRef, useEffect } from 'react';
import { TrendingUp, BarChart3, PieChart, ChevronDown, Settings, X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface AnalyticsOptionsProps {
  includeTrendLines?: boolean;
  includeMultiTrend?: boolean;
  includeSPCCharts?: boolean;
  includeStatsSummary?: boolean;
  includeDataTable?: boolean;
  onIncludeTrendLinesChange: (value: boolean) => void;
  onIncludeMultiTrendChange?: (value: boolean) => void;
  onIncludeSPCChartsChange: (value: boolean) => void;
  onIncludeStatsSummaryChange: (value: boolean) => void;
  onIncludeDataTableChange?: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const AnalyticsOptions: React.FC<AnalyticsOptionsProps> = ({
  includeTrendLines = false,
  includeMultiTrend = true,
  includeSPCCharts = false,
  includeStatsSummary = false,
  includeDataTable = false,
  onIncludeTrendLinesChange,
  onIncludeMultiTrendChange,
  onIncludeSPCChartsChange,
  onIncludeStatsSummaryChange,
  onIncludeDataTableChange,
  disabled = false,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const activeCount = [
    includeTrendLines,
    includeMultiTrend,
    includeSPCCharts,
    includeStatsSummary,
    includeDataTable
  ].filter(Boolean).length;

  return (
    <div className={cn("relative w-full", className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex items-center justify-between w-full px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg border shadow-sm",
          disabled
            ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
            : "bg-white text-gray-700 border-gray-300 hover:border-primary-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2",
          isOpen && "ring-2 ring-primary-500 border-primary-500 shadow-md bg-white"
        )}
      >
        <div className="flex items-center">
          <div className={cn(
            "p-1.5 rounded-md mr-3 transition-colors",
            isOpen ? "bg-primary-100 text-primary-600" : "bg-gray-100 text-gray-500"
          )}>
            <Settings className="w-4 h-4" />
          </div>
          <div className="flex flex-col items-start">
            <span className="font-semibold">Advanced Analytics</span>
            <span className="text-[0.7rem] text-gray-500 font-normal">
              {activeCount === 0 ? 'None selected' : `${activeCount} option${activeCount > 1 ? 's' : ''} active`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!disabled && activeCount > 0 && !isOpen && (
            <span className="flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-[0.65rem] font-bold bg-primary-600 text-white rounded-full">
              {activeCount}
            </span>
          )}
          <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform duration-200", isOpen && "transform rotate-180 text-primary-500")} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 w-full mt-2 origin-top-right bg-white border border-gray-200 rounded-xl shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <span className="px-1 text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest">Configuration</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-gray-200 rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </div>
          <div className="p-3 space-y-2">
            {/* Statistics Summary Option — 1st (Section II) */}
            <label className={cn(
              "flex items-start p-3 rounded-lg cursor-pointer transition-all border group",
              includeStatsSummary ? "bg-primary-50/50 border-primary-200" : "hover:bg-gray-50 border-transparent"
            )}>
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                  checked={includeStatsSummary}
                  onChange={(e) => onIncludeStatsSummaryChange(e.target.checked)}
                />
              </div>
              <div className="ml-3 flex-1">
                <div className="flex items-center">
                  <PieChart className={cn("w-3.5 h-3.5 mr-2", includeStatsSummary ? "text-primary-600" : "text-gray-400")} />
                  <span className={cn("text-xs font-bold", includeStatsSummary ? "text-primary-900" : "text-gray-700")}>Include Statistics Summary</span>
                </div>
                <p className="mt-1 text-[0.65rem] text-gray-500 leading-relaxed">Comprehensive statistical analysis including mean, median, min, max, standard deviation, count, and data quality metrics</p>
              </div>
            </label>

            {/* Multi-Trend Option — Section III (Combined Trends) */}
            <label className={cn(
              "flex items-start p-3 rounded-lg cursor-pointer transition-all border group",
              includeMultiTrend ? "bg-primary-50/50 border-primary-200" : "hover:bg-gray-50 border-transparent"
            )}>
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                  checked={includeMultiTrend}
                  onChange={(e) => onIncludeMultiTrendChange && onIncludeMultiTrendChange(e.target.checked)}
                />
              </div>
              <div className="ml-3 flex-1">
                <div className="flex items-center">
                  <TrendingUp className={cn("w-3.5 h-3.5 mr-2", includeMultiTrend ? "text-primary-600" : "text-gray-400")} />
                  <span className={cn("text-xs font-bold", includeMultiTrend ? "text-primary-900" : "text-gray-700")}>Include Combined Trends</span>
                </div>
                <p className="mt-1 text-[0.65rem] text-gray-500 leading-relaxed">Comparative multi-trend overview chart for all selected analog tags</p>
              </div>
            </label>

            {/* Trend Lines Option — 2nd (Section IV) */}
            <label className={cn(
              "flex items-start p-3 rounded-lg cursor-pointer transition-all border group",
              includeTrendLines ? "bg-primary-50/50 border-primary-200" : "hover:bg-gray-50 border-transparent"
            )}>
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                  checked={includeTrendLines}
                  onChange={(e) => onIncludeTrendLinesChange(e.target.checked)}
                />
              </div>
              <div className="ml-3 flex-1">
                <div className="flex items-center">
                  <TrendingUp className={cn("w-3.5 h-3.5 mr-2", includeTrendLines ? "text-primary-600" : "text-gray-400")} />
                  <span className={cn("text-xs font-bold", includeTrendLines ? "text-primary-900" : "text-gray-700")}>Include Trend Lines</span>
                </div>
                <p className="mt-1 text-[0.65rem] text-gray-500 leading-relaxed">Linear regression trend lines with equations and R² values (analog tags only)</p>
              </div>
            </label>

            {/* SPC Charts Option — 3rd (Section V) */}
            <label className={cn(
              "flex items-start p-3 rounded-lg cursor-pointer transition-all border group",
              includeSPCCharts ? "bg-primary-50/50 border-primary-200" : "hover:bg-gray-50 border-transparent"
            )}>
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                  checked={includeSPCCharts}
                  onChange={(e) => onIncludeSPCChartsChange(e.target.checked)}
                />
              </div>
              <div className="ml-3 flex-1">
                <div className="flex items-center">
                  <BarChart3 className={cn("w-3.5 h-3.5 mr-2", includeSPCCharts ? "text-primary-600" : "text-gray-400")} />
                  <span className={cn("text-xs font-bold", includeSPCCharts ? "text-primary-900" : "text-gray-700")}>Include SPC Charts</span>
                </div>
                <p className="mt-1 text-[0.65rem] text-gray-500 leading-relaxed">Statistical Process Control charts with control limits (UCL/LCL) and capability metrics</p>
              </div>
            </label>

            {/* Data Table Option — 4th (Section VI) */}
            <label className={cn(
              "flex items-start p-3 rounded-lg cursor-pointer transition-all border group",
              includeDataTable ? "bg-primary-50/50 border-primary-200" : "hover:bg-gray-50 border-transparent"
            )}>
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                  checked={includeDataTable}
                  onChange={(e) => onIncludeDataTableChange && onIncludeDataTableChange(e.target.checked)}
                />
              </div>
              <div className="ml-3 flex-1">
                <div className="flex items-center">
                  <Settings className={cn("w-3.5 h-3.5 mr-2", includeDataTable ? "text-primary-600" : "text-gray-400")} />
                  <span className={cn("text-xs font-bold", includeDataTable ? "text-primary-900" : "text-gray-700")}>Include Data Table</span>
                </div>
                <p className="mt-1 text-[0.65rem] text-gray-500 leading-relaxed">Displays the table(s) of data queried</p>
              </div>
            </label>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full py-2 text-[0.7rem] font-bold text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors border border-primary-100"
              >
                Apply Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
