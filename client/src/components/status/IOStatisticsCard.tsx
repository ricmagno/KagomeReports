/**
 * IOStatisticsCard Component
 * Displays I/O statistics with warning indicators
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import React from 'react';
import { IOStatisticsData } from '../../types/systemStatus';
import { Activity, Database, AlertTriangle, Radio } from 'lucide-react';

interface IOStatisticsCardProps {
  io: IOStatisticsData;
}

export const IOStatisticsCard: React.FC<IOStatisticsCardProps> = ({ io }) => {
  const formatNumber = (value: number | string | null): string => {
    if (value === null) return 'N/A';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 'N/A';
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const badValuesCount = typeof io.badValues.value === 'number' ? io.badValues.value : 0;
  const hasBadValues = badValuesCount > 100;

  const stats = [
    {
      label: 'Items Per Second',
      value: io.itemsPerSecond.value,
      timestamp: io.itemsPerSecond.timestamp,
      icon: Activity,
      color: 'blue',
      suffix: '/sec'
    },
    {
      label: 'Total Items',
      value: io.totalItems.value,
      timestamp: io.totalItems.timestamp,
      icon: Database,
      color: 'green',
      suffix: ''
    },
    {
      label: 'Bad Values',
      value: io.badValues.value,
      timestamp: io.badValues.timestamp,
      icon: AlertTriangle,
      color: hasBadValues ? 'red' : 'gray',
      suffix: '',
      warning: hasBadValues
    },
    {
      label: 'Active Topics',
      value: io.activeTopics.value,
      timestamp: io.activeTopics.timestamp,
      icon: Radio,
      color: 'purple',
      suffix: ''
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">I/O Statistics</h2>
        {hasBadValues && (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            High Bad Values
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          
          return (
            <div
              key={index}
              className={`p-4 rounded-lg border-2 transition-colors ${
                stat.warning
                  ? 'border-yellow-200 bg-yellow-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 text-${stat.color}-600`} />
                <span className="text-sm font-medium text-gray-700">{stat.label}</span>
              </div>
              
              <div className={`text-2xl font-bold ${
                stat.warning ? 'text-yellow-600' : 'text-gray-900'
              }`}>
                {formatNumber(stat.value)}
                {stat.suffix && <span className="text-sm ml-1">{stat.suffix}</span>}
              </div>
              
              <div className="text-xs text-gray-500 mt-1">
                {new Date(stat.timestamp).toLocaleTimeString()}
              </div>
            </div>
          );
        })}
      </div>

      {hasBadValues && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            Bad values count exceeds threshold (100). Check data acquisition sources.
          </p>
        </div>
      )}
    </div>
  );
};

export default IOStatisticsCard;
