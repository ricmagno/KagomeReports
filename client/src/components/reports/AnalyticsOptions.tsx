import React from 'react';
import { TrendingUp, BarChart3, PieChart } from 'lucide-react';
import { cn } from '../../utils/cn';

interface AnalyticsOptionsProps {
  includeTrendLines?: boolean;
  includeSPCCharts?: boolean;
  includeStatsSummary?: boolean;
  onIncludeTrendLinesChange: (value: boolean) => void;
  onIncludeSPCChartsChange: (value: boolean) => void;
  onIncludeStatsSummaryChange: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const AnalyticsOptions: React.FC<AnalyticsOptionsProps> = ({
  includeTrendLines = true,
  includeSPCCharts = true,
  includeStatsSummary = true,
  onIncludeTrendLinesChange,
  onIncludeSPCChartsChange,
  onIncludeStatsSummaryChange,
  disabled = false,
  className
}) => {
  return (
    <div className={cn("space-y-3", className)}>
      <h4 className="text-sm font-medium text-gray-900">Advanced Analytics</h4>
      <p className="text-xs text-gray-600">
        Select which analytics to include in your report
      </p>

      <div className="space-y-3">
        {/* Trend Lines Option */}
        <label 
          className={cn(
            "flex items-start p-3 border rounded-md cursor-pointer transition-colors",
            includeTrendLines 
              ? "border-primary-300 bg-primary-50" 
              : "border-gray-200 bg-white hover:bg-gray-50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <input
            type="checkbox"
            className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:cursor-not-allowed"
            checked={includeTrendLines}
            onChange={(e) => onIncludeTrendLinesChange(e.target.checked)}
            disabled={disabled}
            aria-describedby="trend-lines-description"
          />
          <div className="ml-3 flex-1">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-primary-600" />
              <span className="text-sm font-medium text-gray-900">
                Include Trend Lines
              </span>
            </div>
            <p 
              id="trend-lines-description"
              className="mt-1 text-xs text-gray-600"
            >
              Display linear regression trend lines with equations and R² values on charts 
              (analog tags only)
            </p>
          </div>
        </label>

        {/* SPC Charts Option */}
        <label 
          className={cn(
            "flex items-start p-3 border rounded-md cursor-pointer transition-colors",
            includeSPCCharts 
              ? "border-primary-300 bg-primary-50" 
              : "border-gray-200 bg-white hover:bg-gray-50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <input
            type="checkbox"
            className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:cursor-not-allowed"
            checked={includeSPCCharts}
            onChange={(e) => onIncludeSPCChartsChange(e.target.checked)}
            disabled={disabled}
            aria-describedby="spc-charts-description"
          />
          <div className="ml-3 flex-1">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4 text-primary-600" />
              <span className="text-sm font-medium text-gray-900">
                Include SPC Charts
              </span>
            </div>
            <p 
              id="spc-charts-description"
              className="mt-1 text-xs text-gray-600"
            >
              Generate Statistical Process Control charts with control limits (UCL/LCL) 
              and capability metrics (Cp/Cpk) for tags with specification limits
            </p>
          </div>
        </label>

        {/* Statistics Summary Option */}
        <label 
          className={cn(
            "flex items-start p-3 border rounded-md cursor-pointer transition-colors",
            includeStatsSummary 
              ? "border-primary-300 bg-primary-50" 
              : "border-gray-200 bg-white hover:bg-gray-50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <input
            type="checkbox"
            className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:cursor-not-allowed"
            checked={includeStatsSummary}
            onChange={(e) => onIncludeStatsSummaryChange(e.target.checked)}
            disabled={disabled}
            aria-describedby="stats-summary-description"
          />
          <div className="ml-3 flex-1">
            <div className="flex items-center space-x-2">
              <PieChart className="h-4 w-4 text-primary-600" />
              <span className="text-sm font-medium text-gray-900">
                Include Statistics Summary
              </span>
            </div>
            <p 
              id="stats-summary-description"
              className="mt-1 text-xs text-gray-600"
            >
              Display statistical summaries (min, max, mean, standard deviation) 
              directly on charts
            </p>
          </div>
        </label>
      </div>
    </div>
  );
};
