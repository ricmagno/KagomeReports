import React from 'react';
import { Button } from '../ui/Button';
import { AlertCircle, AlertTriangle, X } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface ValidationError {
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationErrorDialogProps {
  isOpen: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  onClose: () => void;
  onTryAgain: () => void;
}

export const ValidationErrorDialog: React.FC<ValidationErrorDialogProps> = ({
  isOpen,
  errors,
  warnings,
  onClose,
  onTryAgain,
}) => {
  if (!isOpen) return null;

  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="validation-dialog-title"
        aria-describedby="validation-dialog-description"
        onKeyDown={handleKeyDown}
        tabIndex={-1}
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <AlertCircle className="w-6 h-6 text-red-600" aria-hidden="true" />
            </div>
            <div>
              <h3
                id="validation-dialog-title"
                className="text-xl font-semibold text-gray-900"
              >
                Configuration Validation Failed
              </h3>
              <p
                id="validation-dialog-description"
                className="text-sm text-gray-600 mt-1"
              >
                The imported configuration contains {hasErrors ? 'errors' : 'issues'} that must be addressed
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Errors Section */}
          {hasErrors && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-red-600" aria-hidden="true" />
                <h4 className="text-base font-semibold text-gray-900">
                  Errors ({errors.length})
                </h4>
              </div>
              <div className="space-y-2">
                {errors.map((error, index) => (
                  <div
                    key={`error-${index}`}
                    className="bg-red-50 border border-red-200 rounded-md p-3"
                  >
                    {error.field && (
                      <div className="text-xs font-medium text-red-800 mb-1">
                        Field: {error.field}
                      </div>
                    )}
                    <div className="text-sm text-red-700">
                      {error.message}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings Section */}
          {hasWarnings && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600" aria-hidden="true" />
                <h4 className="text-base font-semibold text-gray-900">
                  Warnings ({warnings.length})
                </h4>
              </div>
              <div className="space-y-2">
                {warnings.map((warning, index) => (
                  <div
                    key={`warning-${index}`}
                    className="bg-yellow-50 border border-yellow-200 rounded-md p-3"
                  >
                    {warning.field && (
                      <div className="text-xs font-medium text-yellow-800 mb-1">
                        Field: {warning.field}
                      </div>
                    )}
                    <div className="text-sm text-yellow-700">
                      {warning.message}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Help Text */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <p className="text-sm text-blue-800">
              <strong>What to do next:</strong> Please correct the errors in your configuration file and try importing again. 
              {hasWarnings && !hasErrors && ' Warnings indicate potential issues but will not prevent import.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          <Button
            variant="outline"
            onClick={onClose}
            aria-label="Close dialog"
          >
            Close
          </Button>
          <Button
            variant="primary"
            onClick={onTryAgain}
            aria-label="Try importing again"
          >
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
};
