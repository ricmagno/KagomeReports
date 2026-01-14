/**
 * StorageSpaceCard Component
 * Displays storage space metrics with threshold warnings
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import React from 'react';
import { StorageSpaceData } from '../../types/systemStatus';
import { HardDrive, AlertTriangle } from 'lucide-react';

interface StorageSpaceCardProps {
  storage: StorageSpaceData;
}

export const StorageSpaceCard: React.FC<StorageSpaceCardProps> = ({ storage }) => {
  const storageItems = [
    { label: 'Main (Circular)', data: storage.main },
    { label: 'Permanent', data: storage.permanent },
    { label: 'Buffer', data: storage.buffer },
    { label: 'Alternate', data: storage.alternate }
  ];

  const getStorageStatus = (spaceMB: number | null) => {
    if (spaceMB === null) {
      return { level: 'unknown', color: 'gray', bgColor: 'bg-gray-200' };
    }
    if (spaceMB < 500) {
      return { level: 'critical', color: 'red', bgColor: 'bg-red-500' };
    }
    if (spaceMB < 1000) {
      return { level: 'warning', color: 'yellow', bgColor: 'bg-yellow-500' };
    }
    return { level: 'normal', color: 'green', bgColor: 'bg-green-500' };
  };

  const formatSpace = (spaceMB: number | null) => {
    if (spaceMB === null) return 'N/A';
    if (spaceMB >= 1000) {
      return `${(spaceMB / 1024).toFixed(2)} GB`;
    }
    return `${spaceMB.toFixed(0)} MB`;
  };

  const hasWarnings = storageItems.some(item => {
    const space = item.data.value as number | null;
    return space !== null && space < 1000;
  });

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Storage Space</h2>
        {hasWarnings && (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Low Space
          </span>
        )}
      </div>

      <div className="space-y-4">
        {storageItems.map((item, index) => {
          const spaceMB = item.data.value as number | null;
          const status = getStorageStatus(spaceMB);
          const percentage = spaceMB !== null ? Math.min((spaceMB / 5000) * 100, 100) : 0;

          return (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className={`w-4 h-4 text-${status.color}-600`} />
                  <span className="font-medium text-gray-900">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-lg font-bold ${
                      status.level === 'critical'
                        ? 'text-red-600'
                        : status.level === 'warning'
                        ? 'text-yellow-600'
                        : 'text-gray-900'
                    }`}
                  >
                    {formatSpace(spaceMB)}
                  </span>
                  {status.level === 'critical' && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs font-medium rounded">
                      CRITICAL
                    </span>
                  )}
                  {status.level === 'warning' && (
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
                      WARNING
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full ${status.bgColor} transition-all duration-300`}
                  style={{ width: `${percentage}%` }}
                />
              </div>

              <div className="text-xs text-gray-500">
                Updated: {new Date(item.data.timestamp).toLocaleTimeString()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Threshold info */}
      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span>Critical: &lt; 500 MB</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span>Warning: &lt; 1000 MB</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Normal: ≥ 1000 MB</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StorageSpaceCard;
