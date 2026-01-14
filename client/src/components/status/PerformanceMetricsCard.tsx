/**
 * PerformanceMetricsCard Component
 * Displays performance metrics with threshold warnings
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import React from 'react';
import { PerformanceMetricsData } from '../../types/systemStatus';
import { Cpu, HardDrive, AlertTriangle } from 'lucide-react';

interface PerformanceMetricsCardProps {
  performance: PerformanceMetricsData;
}

export const PerformanceMetricsCard: React.FC<PerformanceMetricsCardProps> = ({ performance }) => {
  const formatPercentage = (value: number | string | null): string => {
    if (value === null) return 'N/A';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 'N/A';
    return `${num.toFixed(1)}%`;
  };

  const formatMemory = (value: number | string | null): string => {
    if (value === null) return 'N/A';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 'N/A';
    if (num >= 1024) {
      return `${(num / 1024).toFixed(2)} GB`;
    }
    return `${num.toFixed(0)} MB`;
  };

  const cpuTotal = typeof performance.cpuTotal.value === 'number' ? performance.cpuTotal.value : 0;
  const cpuMax = typeof performance.cpuMax.value === 'number' ? performance.cpuMax.value : 0;
  const memoryMB = typeof performance.availableMemory.value === 'number' ? performance.availableMemory.value : 0;
  const diskTime = typeof performance.diskTime.value === 'number' ? performance.diskTime.value : 0;

  const cpuWarning = cpuTotal > 80 || cpuMax > 80;
  const memoryWarning = memoryMB < 500;
  const diskWarning = diskTime > 80;

  const hasWarnings = cpuWarning || memoryWarning || diskWarning;

  const getGaugeColor = (value: number, threshold: number, inverse: boolean = false): string => {
    if (inverse) {
      // For memory - lower is worse
      if (value < threshold) return 'red';
      if (value < threshold * 2) return 'yellow';
      return 'green';
    } else {
      // For CPU/Disk - higher is worse
      if (value > threshold) return 'red';
      if (value > threshold * 0.75) return 'yellow';
      return 'green';
    }
  };

  const cpuTotalColor = getGaugeColor(cpuTotal, 80);
  const cpuMaxColor = getGaugeColor(cpuMax, 80);
  const memoryColor = getGaugeColor(memoryMB, 500, true);
  const diskColor = getGaugeColor(diskTime, 80);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Performance Metrics</h2>
        {hasWarnings && (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Performance Warning
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CPU Total */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className={`w-4 h-4 text-${cpuTotalColor}-600`} />
              <span className="font-medium text-gray-900">CPU Total</span>
            </div>
            <span className={`text-xl font-bold text-${cpuTotalColor}-600`}>
              {formatPercentage(performance.cpuTotal.value)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full bg-${cpuTotalColor}-500 transition-all duration-300`}
              style={{ width: `${Math.min(cpuTotal, 100)}%` }}
            />
          </div>
          <div className="text-xs text-gray-500">
            {new Date(performance.cpuTotal.timestamp).toLocaleTimeString()}
          </div>
        </div>

        {/* CPU Max */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className={`w-4 h-4 text-${cpuMaxColor}-600`} />
              <span className="font-medium text-gray-900">CPU Max (Single Core)</span>
            </div>
            <span className={`text-xl font-bold text-${cpuMaxColor}-600`}>
              {formatPercentage(performance.cpuMax.value)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full bg-${cpuMaxColor}-500 transition-all duration-300`}
              style={{ width: `${Math.min(cpuMax, 100)}%` }}
            />
          </div>
          <div className="text-xs text-gray-500">
            {new Date(performance.cpuMax.timestamp).toLocaleTimeString()}
          </div>
        </div>

        {/* Available Memory */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className={`w-4 h-4 text-${memoryColor}-600`} />
              <span className="font-medium text-gray-900">Available Memory</span>
            </div>
            <span className={`text-xl font-bold text-${memoryColor}-600`}>
              {formatMemory(performance.availableMemory.value)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full bg-${memoryColor}-500 transition-all duration-300`}
              style={{ width: `${Math.min((memoryMB / 2000) * 100, 100)}%` }}
            />
          </div>
          <div className="text-xs text-gray-500">
            {new Date(performance.availableMemory.timestamp).toLocaleTimeString()}
          </div>
        </div>

        {/* Disk Time */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className={`w-4 h-4 text-${diskColor}-600`} />
              <span className="font-medium text-gray-900">Disk Busy Time</span>
            </div>
            <span className={`text-xl font-bold text-${diskColor}-600`}>
              {formatPercentage(performance.diskTime.value)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full bg-${diskColor}-500 transition-all duration-300`}
              style={{ width: `${Math.min(diskTime, 100)}%` }}
            />
          </div>
          <div className="text-xs text-gray-500">
            {new Date(performance.diskTime.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Warning messages */}
      {hasWarnings && (
        <div className="mt-4 space-y-2">
          {cpuWarning && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                CPU usage is high (&gt; 80%). Consider investigating running processes.
              </p>
            </div>
          )}
          {memoryWarning && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                Available memory is low (&lt; 500 MB). System may experience performance issues.
              </p>
            </div>
          )}
          {diskWarning && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                Disk is busy (&gt; 80%). I/O operations may be slow.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Thresholds info */}
      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-xs text-gray-600 space-y-1">
          <div>CPU Warning: &gt; 80%</div>
          <div>Memory Warning: &lt; 500 MB</div>
          <div>Disk Warning: &gt; 80%</div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMetricsCard;
