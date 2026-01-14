/**
 * ServiceStatusCard Component
 * Displays Historian service status with visual indicators
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import React from 'react';
import { ServiceStatusData } from '../../types/systemStatus';
import { CheckCircle, XCircle, HelpCircle, Database } from 'lucide-react';

interface ServiceStatusCardProps {
  services: ServiceStatusData;
}

export const ServiceStatusCard: React.FC<ServiceStatusCardProps> = ({ services }) => {
  const serviceItems = [
    { label: 'Storage', data: services.storage },
    { label: 'Retrieval', data: services.retrieval },
    { label: 'Indexing', data: services.indexing },
    { label: 'Configuration', data: services.configuration },
    { label: 'Replication', data: services.replication },
    { label: 'Event Storage', data: services.eventStorage }
  ];

  const getStatusInfo = (value: number | string | null) => {
    if (value === 1) {
      return {
        text: 'Good',
        color: 'green',
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        icon: CheckCircle
      };
    } else if (value === 0) {
      return {
        text: 'Bad',
        color: 'red',
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        icon: XCircle
      };
    } else {
      return {
        text: 'Unknown',
        color: 'gray',
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-800',
        icon: HelpCircle
      };
    }
  };

  const getOperationalModeInfo = (value: number | string | null) => {
    if (value === 1) {
      return { text: 'Read-Write', color: 'green' };
    } else if (value === 0) {
      return { text: 'Read-Only', color: 'yellow' };
    } else {
      return { text: 'Stopped', color: 'gray' };
    }
  };

  const operationalMode = getOperationalModeInfo(services.operationalMode.value);
  const hasDownServices = serviceItems.some(item => item.data.value === 0);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Service Status</h2>
        {hasDownServices && (
          <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
            Services Down
          </span>
        )}
      </div>

      {/* Operational Mode */}
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-gray-900">Operational Mode</span>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              operationalMode.color === 'green'
                ? 'bg-green-100 text-green-800'
                : operationalMode.color === 'yellow'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {operationalMode.text}
          </span>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Updated: {new Date(services.operationalMode.timestamp).toLocaleTimeString()}
        </div>
      </div>

      {/* Service List */}
      <div className="space-y-2">
        {serviceItems.map((item, index) => {
          const status = getStatusInfo(item.data.value);
          const Icon = status.icon;

          return (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 text-${status.color}-600`} />
                <div>
                  <div className="font-medium text-gray-900">{item.label}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(item.data.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${status.bgColor} ${status.textColor}`}
              >
                {status.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ServiceStatusCard;
