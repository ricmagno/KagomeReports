import React, { useState } from 'react';
import { format } from 'date-fns';
import { Calendar, Clock } from 'lucide-react';
import { TimeRange } from '../../types/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Card, CardContent, CardHeader } from '../ui/Card';

interface TimeRangePickerProps {
  value: TimeRange;
  onChange: (timeRange: TimeRange) => void;
  className?: string;
}

const PRESET_RANGES = [
  { value: 'last1h', label: 'Last 1 Hour' },
  { value: 'last24h', label: 'Last 24 Hours' },
  { value: 'last7d', label: 'Last 7 Days' },
  { value: 'last30d', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom Range' },
] as const;

export const TimeRangePicker: React.FC<TimeRangePickerProps> = ({
  value,
  onChange,
  className,
}) => {
  const [mode, setMode] = useState<'preset' | 'custom'>(
    value.relativeRange ? 'preset' : 'custom'
  );

  const handlePresetChange = (preset: string) => {
    if (preset === 'custom') {
      setMode('custom');
      return;
    }

    const now = new Date();
    let startTime: Date;

    switch (preset) {
      case 'last1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'last24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'last7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    onChange({
      startTime,
      endTime: now,
      relativeRange: preset as TimeRange['relativeRange'],
    });
  };

  const handleCustomTimeChange = (field: 'startTime' | 'endTime', dateTimeString: string) => {
    const newDate = new Date(dateTimeString);
    if (isNaN(newDate.getTime())) return;

    onChange({
      ...value,
      [field]: newDate,
      relativeRange: undefined,
    });
  };

  const formatDateTimeLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Clock className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-medium">Time Range</h3>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex space-x-2">
          <Button
            variant={mode === 'preset' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setMode('preset')}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Preset
          </Button>
          <Button
            variant={mode === 'custom' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setMode('custom')}
          >
            <Clock className="h-4 w-4 mr-2" />
            Custom
          </Button>
        </div>

        {mode === 'preset' ? (
          <Select
            label="Select Time Range"
            value={value.relativeRange || 'last24h'}
            onChange={(e) => handlePresetChange(e.target.value)}
            options={PRESET_RANGES.map(range => ({
              value: range.value,
              label: range.label,
            }))}
          />
        ) : (
          <div className="space-y-4">
            <Input
              type="datetime-local"
              label="Start Time"
              value={formatDateTimeLocal(value.startTime)}
              onChange={(e) => handleCustomTimeChange('startTime', e.target.value)}
              max={formatDateTimeLocal(value.endTime)}
            />
            <Input
              type="datetime-local"
              label="End Time"
              value={formatDateTimeLocal(value.endTime)}
              onChange={(e) => handleCustomTimeChange('endTime', e.target.value)}
              min={formatDateTimeLocal(value.startTime)}
              max={formatDateTimeLocal(new Date())}
            />
          </div>
        )}

        <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md">
          <p className="font-medium">Selected Range:</p>
          <p>From: {format(value.startTime, 'PPpp')}</p>
          <p>To: {format(value.endTime, 'PPpp')}</p>
          <p>Duration: {Math.round((value.endTime.getTime() - value.startTime.getTime()) / (1000 * 60 * 60))} hours</p>
        </div>
      </CardContent>
    </Card>
  );
};