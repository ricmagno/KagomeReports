import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { FileJson, Database, Check } from 'lucide-react';
import { cn } from '../../utils/cn';

export type ExportFormat = 'json' | 'powerbi';

export interface FormatSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFormat: (format: ExportFormat) => void;
}

interface FormatOption {
  id: ExportFormat;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const formatOptions: FormatOption[] = [
  {
    id: 'json',
    title: 'JSON',
    description: 'Friendly format for backup and sharing. Can be re-imported into this application.',
    icon: <FileJson className="w-6 h-6" />,
  },
  {
    id: 'powerbi',
    title: 'Power BI',
    description: 'Connection file for Microsoft Power BI. Enables independent data analysis.',
    icon: <Database className="w-6 h-6" />,
  },
];

export const FormatSelectionDialog: React.FC<FormatSelectionDialogProps> = ({
  isOpen,
  onClose,
  onSelectFormat,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('json');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onSelectFormat(selectedFormat);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      handleConfirm();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="format-dialog-title"
      aria-describedby="format-dialog-description"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full animate-scale-in">
        <div className="p-6">
          <h3
            id="format-dialog-title"
            className="text-xl font-semibold text-gray-900 mb-2"
          >
            Select Export Format
          </h3>
          <p
            id="format-dialog-description"
            className="text-sm text-gray-600 mb-6"
          >
            Choose the format that best suits your needs
          </p>

          <div className="space-y-3">
            {formatOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedFormat(option.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedFormat(option.id);
                  }
                }}
                className={cn(
                  'w-full flex items-start gap-4 p-4 rounded-lg border-2 transition-all',
                  'hover:border-primary-300 hover:bg-primary-50',
                  'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                  selectedFormat === option.id
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 bg-white'
                )}
                aria-pressed={selectedFormat === option.id}
                aria-label={`Select ${option.title} format`}
              >
                <div
                  className={cn(
                    'flex-shrink-0 mt-0.5',
                    selectedFormat === option.id
                      ? 'text-primary-600'
                      : 'text-gray-400'
                  )}
                >
                  {option.icon}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-base font-semibold text-gray-900">
                      {option.title}
                    </h4>
                    {selectedFormat === option.id && (
                      <Check
                        className="w-5 h-5 text-primary-600 flex-shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {option.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-lg">
          <Button
            variant="outline"
            onClick={onClose}
            aria-label="Cancel export"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            aria-label={`Export as ${selectedFormat === 'json' ? 'JSON' : 'Power BI'}`}
          >
            Export
          </Button>
        </div>
      </div>
    </div>
  );
};
