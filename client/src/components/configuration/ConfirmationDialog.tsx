/**
 * ConfirmationDialog Component
 * Displays confirmation dialog for configuration changes
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */

import React, { useMemo } from 'react';
import { ConfigurationChange } from '../../types/configuration';
import { AlertTriangle, X } from 'lucide-react';
import './ConfirmationDialog.css';

interface ConfirmationDialogProps {
  isOpen: boolean;
  changes: ConfigurationChange[];
  isConfirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Dangerous configuration changes that require extra warning
 */
const DANGEROUS_CONFIGS = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'NODE_ENV',
  'PORT',
  'JWT_SECRET'
];

/**
 * Check if a configuration change is dangerous
 */
function isDangerousChange(configName: string): boolean {
  return DANGEROUS_CONFIGS.includes(configName);
}

/**
 * Get warning message for dangerous changes
 */
function getWarningMessage(configName: string): string {
  switch (configName) {
    case 'DB_HOST':
    case 'DB_PORT':
    case 'DB_NAME':
    case 'DB_USER':
    case 'DB_PASSWORD':
      return 'This change affects database connectivity. The application may fail to start if incorrect values are provided.';
    case 'NODE_ENV':
      return 'Changing the environment may affect application behavior and security settings.';
    case 'PORT':
      return 'Changing the port may make the application inaccessible. Ensure the new port is available.';
    case 'JWT_SECRET':
      return 'Changing the JWT secret will invalidate all existing authentication tokens.';
    default:
      return '';
  }
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  changes,
  isConfirming,
  onConfirm,
  onCancel
}) => {
  const dangerousChanges = useMemo(() => {
    return changes.filter(change => isDangerousChange(change.name));
  }, [changes]);

  const hasDangerousChanges = dangerousChanges.length > 0;

  if (!isOpen) {
    return null;
  }

  return (
    <div className="confirmation-dialog-overlay">
      <div className="confirmation-dialog">
        {/* Header */}
        <div className="dialog-header">
          <h2 className="dialog-title">Confirm Configuration Changes</h2>
          <button
            className="close-button"
            onClick={onCancel}
            disabled={isConfirming}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="dialog-content">
          {/* Warning for dangerous changes */}
          {hasDangerousChanges && (
            <div className="danger-warning">
              <AlertTriangle size={20} className="warning-icon" />
              <div className="warning-content">
                <h3>⚠️ Dangerous Changes Detected</h3>
                <p>
                  The following changes may affect application functionality. Please review carefully:
                </p>
                <ul className="dangerous-list">
                  {dangerousChanges.map(change => (
                    <li key={change.name}>
                      <strong>{change.name}</strong>: {getWarningMessage(change.name)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Changes Summary */}
          <div className="changes-summary">
            <h3>Changes to be applied:</h3>
            <div className="changes-list">
              {changes.map((change, index) => (
                <div key={index} className="change-item">
                  <div className="change-header">
                    <span className="config-name">{change.name}</span>
                    {isDangerousChange(change.name) && (
                      <span className="danger-badge">⚠️ Dangerous</span>
                    )}
                  </div>
                  <div className="change-values">
                    <div className="value-pair">
                      <span className="label">Old Value:</span>
                      <code className="old-value">{change.oldValue || '(empty)'}</code>
                    </div>
                    <div className="arrow">→</div>
                    <div className="value-pair">
                      <span className="label">New Value:</span>
                      <code className="new-value">{change.newValue || '(empty)'}</code>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Restart Notice */}
          <div className="restart-notice">
            <p>
              <strong>Note:</strong> Some changes may require the application to be restarted to take effect.
            </p>
          </div>

          {/* Backup Notice */}
          <div className="backup-notice">
            <p>
              A backup of the current configuration will be created before applying these changes.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="dialog-footer">
          <button
            className="cancel-button"
            onClick={onCancel}
            disabled={isConfirming}
          >
            Cancel
          </button>
          <button
            className="confirm-button"
            onClick={onConfirm}
            disabled={isConfirming}
          >
            {isConfirming ? 'Applying Changes...' : 'Apply Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog;
