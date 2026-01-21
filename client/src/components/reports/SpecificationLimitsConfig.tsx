import React, { useState, useEffect } from 'react';
import { AlertCircle, Info } from 'lucide-react';
import { SpecificationLimits } from '../../types/api';
import { Input } from '../ui/Input';
import { cn } from '../../utils/cn';

interface SpecificationLimitsConfigProps {
  tags: string[];
  specificationLimits?: Record<string, SpecificationLimits>;
  onChange: (limits: Record<string, SpecificationLimits>) => void;
  className?: string;
}

interface ValidationError {
  tagName: string;
  message: string;
}

export const SpecificationLimitsConfig: React.FC<SpecificationLimitsConfigProps> = ({
  tags,
  specificationLimits = {},
  onChange,
  className
}) => {
  const [limits, setLimits] = useState<Record<string, SpecificationLimits>>(specificationLimits);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Update local state when props change
  useEffect(() => {
    setLimits(specificationLimits);
  }, [specificationLimits]);

  // Validate specification limits
  const validateLimits = (tagName: string, lsl?: number, usl?: number): string | null => {
    // If both are undefined, no validation needed
    if (lsl === undefined && usl === undefined) {
      return null;
    }

    // If only one is defined, that's okay
    if (lsl === undefined || usl === undefined) {
      return null;
    }

    // Both are defined - validate USL > LSL
    if (usl <= lsl) {
      return 'USL must be greater than LSL';
    }

    return null;
  };

  // Handle LSL change
  const handleLSLChange = (tagName: string, value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value);
    
    const newLimits = {
      ...limits,
      [tagName]: {
        ...limits[tagName],
        lsl: numValue
      }
    };

    // Validate
    const error = validateLimits(tagName, numValue, newLimits[tagName]?.usl);
    updateValidationErrors(tagName, error);

    setLimits(newLimits);
    onChange(newLimits);
  };

  // Handle USL change
  const handleUSLChange = (tagName: string, value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value);
    
    const newLimits = {
      ...limits,
      [tagName]: {
        ...limits[tagName],
        usl: numValue
      }
    };

    // Validate
    const error = validateLimits(tagName, newLimits[tagName]?.lsl, numValue);
    updateValidationErrors(tagName, error);

    setLimits(newLimits);
    onChange(newLimits);
  };

  // Update validation errors
  const updateValidationErrors = (tagName: string, error: string | null) => {
    setValidationErrors(prev => {
      const filtered = prev.filter(e => e.tagName !== tagName);
      if (error) {
        return [...filtered, { tagName, message: error }];
      }
      return filtered;
    });
  };

  // Get validation error for a tag
  const getValidationError = (tagName: string): string | null => {
    const error = validationErrors.find(e => e.tagName === tagName);
    return error ? error.message : null;
  };

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-start space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Specification Limits (Optional)</p>
          <p>
            Configure LSL (Lower Specification Limit) and USL (Upper Specification Limit) for each tag 
            to enable SPC metrics calculation (Cp, Cpk). Leave blank to skip SPC analysis for a tag.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {tags.map(tagName => {
          const tagLimits = limits[tagName] || {};
          const error = getValidationError(tagName);

          return (
            <div 
              key={tagName} 
              className={cn(
                "p-4 border rounded-md",
                error ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-900">{tagName}</h4>
                {error && (
                  <div className="flex items-center space-x-1 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-xs font-medium">{error}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label 
                    htmlFor={`lsl-${tagName}`}
                    className="block text-xs font-medium text-gray-700"
                  >
                    LSL (Lower Specification Limit)
                  </label>
                  <Input
                    id={`lsl-${tagName}`}
                    type="number"
                    step="any"
                    placeholder="e.g., 0"
                    value={tagLimits.lsl !== undefined ? tagLimits.lsl : ''}
                    onChange={(e) => handleLSLChange(tagName, e.target.value)}
                    className={cn(
                      error && "border-red-300 focus:border-red-500 focus:ring-red-500"
                    )}
                    aria-invalid={!!error}
                    aria-describedby={error ? `error-${tagName}` : undefined}
                  />
                </div>

                <div className="space-y-1">
                  <label 
                    htmlFor={`usl-${tagName}`}
                    className="block text-xs font-medium text-gray-700"
                  >
                    USL (Upper Specification Limit)
                  </label>
                  <Input
                    id={`usl-${tagName}`}
                    type="number"
                    step="any"
                    placeholder="e.g., 100"
                    value={tagLimits.usl !== undefined ? tagLimits.usl : ''}
                    onChange={(e) => handleUSLChange(tagName, e.target.value)}
                    className={cn(
                      error && "border-red-300 focus:border-red-500 focus:ring-red-500"
                    )}
                    aria-invalid={!!error}
                    aria-describedby={error ? `error-${tagName}` : undefined}
                  />
                </div>
              </div>

              {error && (
                <p 
                  id={`error-${tagName}`}
                  className="mt-2 text-xs text-red-600"
                  role="alert"
                >
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {validationErrors.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">
              <p className="font-medium mb-1">Validation Errors</p>
              <p>Please fix the errors above before generating the report.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
