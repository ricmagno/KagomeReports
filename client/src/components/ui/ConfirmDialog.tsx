import React from 'react';
import { Button } from './Button';
import { AlertCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: 'text-red-600',
          button: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500',
        };
      case 'warning':
        return {
          icon: 'text-yellow-600',
          button: 'bg-yellow-600 hover:bg-yellow-700 focus-visible:ring-yellow-500',
        };
      case 'info':
        return {
          icon: 'text-blue-600',
          button: 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget && !loading) {
          onCancel();
        }
      }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-scale-in">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={cn('flex-shrink-0 mt-0.5', styles.icon)}>
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3
                id="dialog-title"
                className="text-lg font-semibold text-gray-900 mb-2"
              >
                {title}
              </h3>
              <p
                id="dialog-description"
                className="text-sm text-gray-600"
              >
                {message}
              </p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-lg">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            loading={loading}
            disabled={loading}
            className={styles.button}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
