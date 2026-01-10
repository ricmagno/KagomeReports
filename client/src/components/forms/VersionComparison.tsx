import React from 'react';
import { format } from 'date-fns';
import { 
  GitCompare, 
  Plus, 
  Minus, 
  Edit3,
  Calendar,
  Tag,
  BarChart3,
  Settings
} from 'lucide-react';
import { ReportVersion, ReportConfig } from '../../types/api';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { cn } from '../../utils/cn';

interface VersionComparisonProps {
  version1: ReportVersion;
  version2: ReportVersion;
  onClose?: () => void;
  className?: string;
}

interface ConfigDifference {
  field: string;
  label: string;
  icon: React.ReactNode;
  oldValue: any;
  newValue: any;
  type: 'added' | 'removed' | 'modified' | 'unchanged';
}

export const VersionComparison: React.FC<VersionComparisonProps> = ({
  version1,
  version2,
  onClose,
  className,
}) => {
  const compareConfigs = (config1: ReportConfig, config2: ReportConfig): ConfigDifference[] => {
    const differences: ConfigDifference[] = [];

    // Compare basic fields
    const basicFields = [
      { key: 'name', label: 'Report Name', icon: <Edit3 className="h-4 w-4" /> },
      { key: 'description', label: 'Description', icon: <Edit3 className="h-4 w-4" /> },
      { key: 'template', label: 'Template', icon: <Settings className="h-4 w-4" /> },
    ];

    basicFields.forEach(field => {
      const oldValue = config1[field.key as keyof ReportConfig];
      const newValue = config2[field.key as keyof ReportConfig];
      
      if (oldValue !== newValue) {
        differences.push({
          field: field.key,
          label: field.label,
          icon: field.icon,
          oldValue,
          newValue,
          type: 'modified',
        });
      }
    });

    // Compare tags
    const oldTags = config1.tags || [];
    const newTags = config2.tags || [];
    
    if (JSON.stringify(oldTags.sort()) !== JSON.stringify(newTags.sort())) {
      const addedTags = newTags.filter(tag => !oldTags.includes(tag));
      const removedTags = oldTags.filter(tag => !newTags.includes(tag));
      
      differences.push({
        field: 'tags',
        label: 'Tags',
        icon: <Tag className="h-4 w-4" />,
        oldValue: oldTags,
        newValue: newTags,
        type: addedTags.length > 0 || removedTags.length > 0 ? 'modified' : 'unchanged',
      });
    }

    // Compare chart types
    const oldChartTypes = config1.chartTypes || [];
    const newChartTypes = config2.chartTypes || [];
    
    if (JSON.stringify(oldChartTypes.sort()) !== JSON.stringify(newChartTypes.sort())) {
      differences.push({
        field: 'chartTypes',
        label: 'Chart Types',
        icon: <BarChart3 className="h-4 w-4" />,
        oldValue: oldChartTypes,
        newValue: newChartTypes,
        type: 'modified',
      });
    }

    // Compare time range
    const oldTimeRange = config1.timeRange;
    const newTimeRange = config2.timeRange;
    
    if (oldTimeRange && newTimeRange) {
      const timeRangeChanged = 
        oldTimeRange.startTime.getTime() !== newTimeRange.startTime.getTime() ||
        oldTimeRange.endTime.getTime() !== newTimeRange.endTime.getTime() ||
        oldTimeRange.relativeRange !== newTimeRange.relativeRange;
      
      if (timeRangeChanged) {
        differences.push({
          field: 'timeRange',
          label: 'Time Range',
          icon: <Calendar className="h-4 w-4" />,
          oldValue: oldTimeRange,
          newValue: newTimeRange,
          type: 'modified',
        });
      }
    }

    return differences;
  };

  const differences = compareConfigs(version1.config, version2.config);

  const renderValue = (value: any, field: string): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400 italic">Not set</span>;
    }

    switch (field) {
      case 'tags':
      case 'chartTypes':
        if (Array.isArray(value)) {
          return (
            <div className="flex flex-wrap gap-1">
              {value.map((item, index) => (
                <span
                  key={index}
                  className="inline-block bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded"
                >
                  {item}
                </span>
              ))}
            </div>
          );
        }
        break;
      case 'timeRange':
        if (value && typeof value === 'object') {
          return (
            <div className="text-sm">
              <div>From: {format(new Date(value.startTime), 'MMM dd, yyyy HH:mm')}</div>
              <div>To: {format(new Date(value.endTime), 'MMM dd, yyyy HH:mm')}</div>
              {value.relativeRange && (
                <div className="text-gray-500">Preset: {value.relativeRange}</div>
              )}
            </div>
          );
        }
        break;
      default:
        return <span>{String(value)}</span>;
    }

    return <span>{String(value)}</span>;
  };

  const getChangeTypeColor = (type: ConfigDifference['type']) => {
    switch (type) {
      case 'added':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'removed':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'modified':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getChangeTypeIcon = (type: ConfigDifference['type']) => {
    switch (type) {
      case 'added':
        return <Plus className="h-3 w-3" />;
      case 'removed':
        return <Minus className="h-3 w-3" />;
      case 'modified':
        return <Edit3 className="h-3 w-3" />;
      default:
        return null;
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <GitCompare className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-medium">Version Comparison</h3>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          )}
        </div>
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            <span className="font-medium">Version {version1.version}</span>
            <span className="ml-2">{format(new Date(version1.createdAt), 'MMM dd, yyyy HH:mm')}</span>
          </div>
          <span className="mx-4">vs</span>
          <div>
            <span className="font-medium">Version {version2.version}</span>
            <span className="ml-2">{format(new Date(version2.createdAt), 'MMM dd, yyyy HH:mm')}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {differences.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <GitCompare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No differences found between these versions</p>
          </div>
        ) : (
          <div className="space-y-4">
            {differences.map((diff, index) => (
              <div
                key={index}
                className={cn(
                  'border rounded-lg p-4',
                  getChangeTypeColor(diff.type)
                )}
              >
                <div className="flex items-center space-x-2 mb-3">
                  {diff.icon}
                  <span className="font-medium">{diff.label}</span>
                  {getChangeTypeIcon(diff.type)}
                  <span className="text-xs uppercase font-medium">
                    {diff.type}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-2">
                      Version {version1.version}
                    </div>
                    <div className="bg-white rounded border p-3">
                      {renderValue(diff.oldValue, diff.field)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-2">
                      Version {version2.version}
                    </div>
                    <div className="bg-white rounded border p-3">
                      {renderValue(diff.newValue, diff.field)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};