/**
 * ErrorCountsCard Component
 * Displays error count system tags with warning highlighting
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import React from 'react';
import { ErrorCountData } from '../../types/systemStatus';
import { AlertTriangle, AlertCircle, XCircle, AlertOctagon, Info } from 'lucide-react';

interface ErrorCountsCardProps {
  data: ErrorCountData;
}

export const ErrorCountsCard: React.FC<ErrorCountsCardProps> = ({ data }) => {
  const errorItems = [
    {
      label: 'Critical Errors',
      value: data.critical.value,
      timestamp: data.critical.timestamp,
      icon: AlertOctagon,
      color: 'red'
    },
    {
      label: 'Fatal Errors',
      value: data.fatal.value,
      timestamp: data.fatal.timestamp,
      icon: XCircle,
      color: 'red'
    },
    {
      label: 'Errors',
      value: data.error.value,
      timestamp: data.error.timestamp,
      icon: AlertCircle,
      color: 'orange'
    },
    {
      label: 'Warnings',
      value: data.warning.value,
      timestamp: data.warning.timestamp,
      icon: AlertTriangle,
      color: 'yellow'
    }
  ];

  const hasErrors = errorItems.some(item => Number(item.value ?? 0) > 0);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Error Counts</h2>
        {hasErrors && (
          <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
            Errors Detected
          </span>
        )}
      </div>

      <div className="space-y-4">
        {errorItems.map((item, index) => {
          const count = Number(item.value ?? 0);
          const hasError = count > 0;
          const Icon = item.icon;

          return (
            <div
              key={index}
              className={`p-4 rounded-lg border-2 transition-colors ${hasError
                  ? 'border-red-200 bg-red-50'
                  : 'border-gray-200 bg-gray-50'
                }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-5 h-5 ${hasError ? 'text-red-600' : 'text-gray-400'
                      }`}
                  />
                  <div>
                    <div className="font-medium text-gray-900">{item.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Updated: {new Date(item.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <div
                  className={`text-2xl font-bold ${hasError ? 'text-red-600' : 'text-gray-600'
                    }`}
                >
                  {count}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info message about cumulative counts */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800">
          Error counts are cumulative since the last AVEVA Historian restart or error count reset.
        </p>
      </div>
    </div>
  );
};

export default ErrorCountsCard;
