import React from 'react';
import { getQualityStatus, getQualityDescription } from '../../utils/tableUtils';

interface QualityIndicatorProps {
  qualityCode: number | string;
  showTooltip?: boolean;
}

export const QualityIndicator: React.FC<QualityIndicatorProps> = ({
  qualityCode,
  showTooltip = true,
}) => {
  const status = getQualityStatus(qualityCode);
  const description = getQualityDescription(qualityCode);

  // Determine color classes based on quality status
  const colorClasses = {
    good: 'bg-green-100 text-green-800 border-green-300',
    bad: 'bg-red-100 text-red-800 border-red-300',
    uncertain: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  };

  const dotColorClasses = {
    good: 'bg-green-500',
    bad: 'bg-red-500',
    uncertain: 'bg-yellow-500',
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-2 py-1 rounded-md border ${colorClasses[status]}`}
      title={showTooltip ? description : undefined}
      aria-label={description}
    >
      {/* Status dot */}
      <span
        className={`w-2 h-2 rounded-full ${dotColorClasses[status]}`}
        aria-hidden="true"
      />
      
      {/* Quality code */}
      <span className="text-sm font-medium">
        {typeof qualityCode === 'number' ? qualityCode : qualityCode}
      </span>
    </div>
  );
};
