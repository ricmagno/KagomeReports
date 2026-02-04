import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar, Clock, AlertCircle } from 'lucide-react';
import { TimeRange } from '../../types/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Card, CardContent, CardHeader } from '../ui/Card';

interface TimeRangePickerProps {
  value: TimeRange;
  onChange: (timeRange: TimeRange) => void;
  className?: string;
  onValidationChange?: (isValid: boolean) => void;
}

const PRESET_RANGES = [
  { value: 'last1h', label: 'Last 1 Hour' },
  { value: 'last2h', label: 'Last 2 Hours' },
  { value: 'last6h', label: 'Last 6 Hours' },
  { value: 'last12h', label: 'Last 12 Hours' },
  { value: 'last24h', label: 'Last 24 Hours' },
  { value: 'last7d', label: 'Last 7 Days' },
  { value: 'last30d', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom Range' },
] as const;

interface DateParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
}

const formatDateParts = (date: Date): DateParts => ({
  year: date.getFullYear().toString(),
  month: (date.getMonth() + 1).toString(),
  day: date.getDate().toString(),
  hour: date.getHours().toString(),
  minute: date.getMinutes().toString(),
  second: date.getSeconds().toString(),
});

const DatePartInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
  width?: string;
}> = ({ label, value, onChange, min, max, width = 'w-16' }) => (
  <div className="flex flex-col">
    <label className="text-xs text-gray-500 mb-1">{label}</label>
    <Input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${width} p-2 text-center`}
      placeholder={min.toString()}
    />
  </div>
);

const DateTimeInputGroup: React.FC<{
  label: string;
  date: Date;
  onChange: (date: Date) => void;
}> = ({ label, date, onChange }) => {
  const [parts, setParts] = useState<DateParts>(formatDateParts(date));

  // Sync with prop updates
  useEffect(() => {
    setParts(formatDateParts(date));
  }, [date]);

  const updatePart = (field: keyof DateParts, value: string) => {
    const newParts = { ...parts, [field]: value };
    setParts(newParts);

    // Try to construct a valid date
    const y = parseInt(newParts.year);
    const m = parseInt(newParts.month) - 1;
    const d = parseInt(newParts.day);
    const h = parseInt(newParts.hour);
    const min = parseInt(newParts.minute);
    const s = parseInt(newParts.second);

    // Allow typing freely, but propagate valid dates
    if (
      !isNaN(y) && !isNaN(m) && !isNaN(d) && !isNaN(h) && !isNaN(min) && !isNaN(s) &&
      y > 1900 && y < 2100 &&
      m >= 0 && m <= 11 &&
      d >= 1 && d <= 31 &&
      h >= 0 && h <= 23 &&
      min >= 0 && min <= 59 &&
      s >= 0 && s <= 59
    ) {
      const newDate = new Date(y, m, d, h, min, s);
      if (!isNaN(newDate.getTime())) {
        onChange(newDate);
      }
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex flex-wrap gap-2 items-end">
        <DatePartInput label="Year" value={parts.year} onChange={(v) => updatePart('year', v)} min={2000} max={2099} width="w-20" />
        <span className="pb-3 text-gray-400">/</span>
        <DatePartInput label="Month" value={parts.month} onChange={(v) => updatePart('month', v)} min={1} max={12} width="w-14" />
        <span className="pb-3 text-gray-400">/</span>
        <DatePartInput label="Day" value={parts.day} onChange={(v) => updatePart('day', v)} min={1} max={31} width="w-14" />
        <span className="w-4"></span>
        <DatePartInput label="Hour" value={parts.hour} onChange={(v) => updatePart('hour', v)} min={0} max={23} width="w-14" />
        <span className="pb-3 text-gray-400">:</span>
        <DatePartInput label="Minute" value={parts.minute} onChange={(v) => updatePart('minute', v)} min={0} max={59} width="w-14" />
        <span className="pb-3 text-gray-400">:</span>
        <DatePartInput label="Second" value={parts.second} onChange={(v) => updatePart('second', v)} min={0} max={59} width="w-14" />
      </div>
    </div>
  );
};

export const TimeRangePicker: React.FC<TimeRangePickerProps> = ({
  value,
  onChange,
  className,
  onValidationChange
}) => {
  const [mode, setMode] = useState<'preset' | 'custom'>(
    value.relativeRange ? 'preset' : 'custom'
  );

  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    // Validation logic
    let error = null;
    if (value.startTime > value.endTime) {
      error = "Start time cannot be after end time";
    }

    setValidationError(error);
    if (onValidationChange) {
      onValidationChange(error === null);
    }
  }, [value.startTime, value.endTime, onValidationChange]);

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
      case 'last2h':
        startTime = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        break;
      case 'last6h':
        startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case 'last12h':
        startTime = new Date(now.getTime() - 12 * 60 * 60 * 1000);
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
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  };

  const handleCustomDateChange = (type: 'start' | 'end', date: Date) => {
    onChange({
      ...value,
      [type === 'start' ? 'startTime' : 'endTime']: date,
      relativeRange: undefined,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  };

  const calculateDuration = (start: Date, end: Date) => {
    const diff = end.getTime() - start.getTime();
    const isNegative = diff < 0;
    const absDiff = Math.abs(diff);

    const hours = Math.floor(absDiff / (1000 * 60 * 60));
    const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((absDiff % (1000 * 60)) / 1000);

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return `${isNegative ? '-' : ''}${parts.join(' ')}`;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-medium">Time Range</h3>
          </div>
          {validationError && (
            <div className="flex items-center text-red-500 text-sm">
              <AlertCircle className="h-4 w-4 mr-1" />
              {validationError}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant={mode === 'preset' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setMode('preset')}
            className="w-full sm:w-auto flex justify-center"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Preset
          </Button>
          <Button
            variant={mode === 'custom' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setMode('custom')}
            className="w-full sm:w-auto flex justify-center"
          >
            <Clock className="h-4 w-4 mr-2" />
            Custom
          </Button>
        </div>

        {mode === 'preset' ? (
          <div className="pt-2">
            <Select
              label="Select Time Range"
              value={value.relativeRange || 'last24h'}
              onChange={(e) => handlePresetChange(e.target.value)}
              options={PRESET_RANGES.map(range => ({
                value: range.value,
                label: range.label,
              }))}
            />
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            <DateTimeInputGroup
              label="Start Time"
              date={value.startTime}
              onChange={(date) => handleCustomDateChange('start', date)}
            />

            <DateTimeInputGroup
              label="End Time"
              date={value.endTime}
              onChange={(date) => handleCustomDateChange('end', date)}
            />
          </div>
        )}

        <div className={`text-sm p-4 rounded-lg bg-gray-50 border border-gray-100 ${validationError ? 'bg-red-50 border-red-100 text-red-700' : 'text-gray-600'}`}>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="font-bold text-[10px] uppercase tracking-wider text-gray-400 mb-1">From</p>
                <p className="text-sm font-medium">{format(value.startTime, 'PPpp')}</p>
              </div>
              <div>
                <p className="font-bold text-[10px] uppercase tracking-wider text-gray-400 mb-1">To</p>
                <p className="text-sm font-medium">{format(value.endTime, 'PPpp')}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center bg-white p-3 rounded-md shadow-sm border border-gray-100">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Duration</span>
                <span className="font-mono font-bold text-lg text-primary-600">
                  {calculateDuration(value.startTime, value.endTime)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};