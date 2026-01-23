import React from 'react';

interface StatusIndicatorProps {
  isActive: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ isActive }) => {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
      isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
    }`}>
      <span className={`w-2 h-2 rounded-full mr-1.5 ${
        isActive ? 'bg-green-500' : 'bg-gray-400'
      }`} />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
};
