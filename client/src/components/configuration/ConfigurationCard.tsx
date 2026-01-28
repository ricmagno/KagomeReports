/**
 * ConfigurationCard Component
 * Individual configuration display and edit component
 * Requirements: 1.2, 3.1, 3.3, 3.4, 4.2, 4.3, 4.6, 5.6, 5.7, 5.8, 8.1, 8.3, 8.4, 8.5
 */

import React, { useState, useCallback } from 'react';
import { Configuration, ConfigurationEditState } from '../../types/configuration';
import { Eye, EyeOff, Copy, Check, Edit2, Save, X } from 'lucide-react';
import { getDataTypeDisplayName } from '../../utils/configurationUtils';
import { validateConfigurationValue } from '../../utils/configurationValidation';
import './ConfigurationCard.css';

interface ConfigurationCardProps {
  configuration: Configuration;
  isRevealed: boolean;
  isEditable: boolean;
  onReveal: (configName: string) => void;
  onEdit?: (configName: string, oldValue: string, newValue: string) => void;
  onCancel?: () => void;
}

export const ConfigurationCard: React.FC<ConfigurationCardProps> = ({
  configuration,
  isRevealed,
  isEditable,
  onReveal,
  onEdit,
  onCancel
}) => {
  const [copied, setCopied] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [editState, setEditState] = useState<ConfigurationEditState>({
    isEditing: false,
    editValue: configuration.value,
    validationError: undefined,
    isSaving: false,
    revealedDuringEdit: false
  });

  const handleReveal = async () => {
    setRevealing(true);
    try {
      await onReveal(configuration.environmentVariable);
    } finally {
      setRevealing(false);
    }
  };

  const handleCopyValue = () => {
    navigator.clipboard.writeText(configuration.value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyEnvVar = () => {
    navigator.clipboard.writeText(configuration.environmentVariable);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /**
   * Handle edit button click
   */
  const handleEditClick = useCallback(() => {
    setEditState(prev => ({
      ...prev,
      isEditing: true,
      editValue: configuration.value,
      validationError: undefined,
      revealedDuringEdit: false
    }));
  }, [configuration.value]);

  /**
   * Handle edit value change with real-time validation
   */
  const handleEditValueChange = useCallback((newValue: string) => {
    // Validate the new value
    const validation = validateConfigurationValue(
      configuration.environmentVariable,
      newValue,
      configuration.dataType
    );

    setEditState(prev => ({
      ...prev,
      editValue: newValue,
      validationError: validation.isValid ? undefined : validation.error
    }));
  }, [configuration.environmentVariable, configuration.dataType]);

  /**
   * Handle save button click
   */
  const handleSave = useCallback(async () => {
    // Validate before saving
    const validation = validateConfigurationValue(
      configuration.environmentVariable,
      editState.editValue,
      configuration.dataType
    );

    if (!validation.isValid) {
      setEditState(prev => ({
        ...prev,
        validationError: validation.error
      }));
      return;
    }

    setEditState(prev => ({ ...prev, isSaving: true }));

    try {
      if (onEdit) {
        await onEdit(
          configuration.environmentVariable,
          configuration.value,
          editState.editValue
        );
      }

      // Exit edit mode on success
      setEditState(prev => ({
        ...prev,
        isEditing: false,
        isSaving: false,
        editValue: configuration.value,
        validationError: undefined,
        revealedDuringEdit: false
      }));
    } catch (error) {
      setEditState(prev => ({
        ...prev,
        isSaving: false,
        validationError: error instanceof Error ? error.message : 'Failed to save'
      }));
    }
  }, [configuration.environmentVariable, configuration.value, configuration.dataType, editState.editValue, onEdit]);

  /**
   * Handle cancel button click
   */
  const handleCancel = useCallback(() => {
    setEditState(prev => ({
      ...prev,
      isEditing: false,
      editValue: configuration.value,
      validationError: undefined,
      revealedDuringEdit: false
    }));

    if (onCancel) {
      onCancel();
    }
  }, [configuration.value, onCancel]);

  /**
   * Handle reveal during edit
   */
  const handleRevealDuringEdit = useCallback(() => {
    setEditState(prev => ({
      ...prev,
      revealedDuringEdit: !prev.revealedDuringEdit
    }));
  }, []);

  /**
   * Render input field based on data type
   */
  const renderEditInput = () => {
    const inputValue = editState.revealedDuringEdit ? editState.editValue : editState.editValue;
    const inputType = configuration.isSensitive && !editState.revealedDuringEdit ? 'password' : 'text';

    switch (configuration.dataType) {
      case 'boolean':
        return (
          <select
            className="edit-input"
            value={editState.editValue}
            onChange={(e) => handleEditValueChange(e.target.value)}
            disabled={editState.isSaving}
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        );
      case 'number':
        return (
          <input
            type="number"
            className="edit-input"
            value={editState.editValue}
            onChange={(e) => handleEditValueChange(e.target.value)}
            disabled={editState.isSaving}
            placeholder="Enter a number"
          />
        );
      default:
        return (
          <input
            type={inputType}
            className="edit-input"
            value={inputValue}
            onChange={(e) => handleEditValueChange(e.target.value)}
            disabled={editState.isSaving}
            placeholder="Enter value"
          />
        );
    }
  };

  const displayValue = isRevealed ? configuration.value : configuration.value;
  const dataTypeDisplay = getDataTypeDisplayName(configuration.dataType);

  // If in edit mode, render edit UI
  if (editState.isEditing) {
    return (
      <div className="configuration-card editing">
        {/* Card Header */}
        <div className="card-header">
          <div className="header-left">
            <h3 className="config-name">{configuration.name}</h3>
            {configuration.isSensitive && (
              <span className="sensitive-badge" title="Sensitive configuration">
                🔒 Sensitive
              </span>
            )}
          </div>
        </div>

        {/* Card Description */}
        <p className="config-description">{configuration.description}</p>

        {/* Card Metadata */}
        <div className="card-metadata">
          <div className="metadata-item">
            <span className="metadata-label">Environment Variable:</span>
            <code className="env-var">{configuration.environmentVariable}</code>
          </div>

          <div className="metadata-item">
            <span className="metadata-label">Data Type:</span>
            <span className="metadata-value">{dataTypeDisplay}</span>
          </div>

          {configuration.constraints && (
            <div className="metadata-item">
              <span className="metadata-label">Constraints:</span>
              <span className="metadata-value">{configuration.constraints}</span>
            </div>
          )}
        </div>

        {/* Edit Value Section */}
        <div className="card-value-section editing">
          <div className="value-header">
            <span className="value-label">New Value:</span>
            {configuration.isSensitive && (
              <button
                className="reveal-button"
                onClick={handleRevealDuringEdit}
                disabled={editState.isSaving}
                title={editState.revealedDuringEdit ? 'Hide value' : 'Show value'}
                aria-label={editState.revealedDuringEdit ? 'Hide value' : 'Show value'}
              >
                {editState.revealedDuringEdit ? (
                  <>
                    <EyeOff size={16} />
                    Hide
                  </>
                ) : (
                  <>
                    <Eye size={16} />
                    Show
                  </>
                )}
              </button>
            )}
          </div>

          <div className="edit-input-wrapper">
            {renderEditInput()}
          </div>

          {/* Validation Error */}
          {editState.validationError && (
            <div className="validation-error">
              <span className="error-icon">⚠️</span>
              <span className="error-message">{editState.validationError}</span>
            </div>
          )}

          {/* Modified Indicator */}
          {editState.editValue !== configuration.value && (
            <div className="modified-indicator">
              <span className="modified-badge">Modified</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="edit-actions">
          <button
            className="save-button"
            onClick={handleSave}
            disabled={editState.isSaving || !!editState.validationError || editState.editValue === configuration.value}
            title="Save changes"
          >
            <Save size={16} />
            Save
          </button>
          <button
            className="cancel-button"
            onClick={handleCancel}
            disabled={editState.isSaving}
            title="Cancel editing"
          >
            <X size={16} />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Normal display mode
  return (
    <div className="configuration-card">
      {/* Card Header */}
      <div className="card-header">
        <div className="header-left">
          <h3 className="config-name">{configuration.name}</h3>
          {configuration.isSensitive && (
            <span className="sensitive-badge" title="Sensitive configuration">
              🔒 Sensitive
            </span>
          )}
          {configuration.isDefault && (
            <span className="default-badge" title="Default value">
              Default
            </span>
          )}
          {!configuration.isDefault && (
            <span className="customized-badge" title="Customized value">
              Customized
            </span>
          )}
        </div>
        {isEditable && (
          <button
            className="edit-button"
            onClick={handleEditClick}
            title="Edit configuration"
            aria-label={`Edit ${configuration.name}`}
          >
            <Edit2 size={16} />
            Edit
          </button>
        )}
      </div>

      {/* Card Description */}
      <p className="config-description">{configuration.description}</p>

      {/* Card Metadata */}
      <div className="card-metadata">
        <div className="metadata-item">
          <span className="metadata-label">Environment Variable:</span>
          <div className="metadata-value-with-copy">
            <code className="env-var">{configuration.environmentVariable}</code>
            <button
              className="copy-button"
              onClick={handleCopyEnvVar}
              title="Copy environment variable name"
              aria-label={`Copy ${configuration.environmentVariable}`}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </div>

        <div className="metadata-item">
          <span className="metadata-label">Data Type:</span>
          <span className="metadata-value">{dataTypeDisplay}</span>
        </div>

        {configuration.constraints && (
          <div className="metadata-item">
            <span className="metadata-label">Constraints:</span>
            <span className="metadata-value">{configuration.constraints}</span>
          </div>
        )}

        {configuration.requiresRestart && (
          <div className="metadata-item">
            <span className="metadata-label">Restart Required:</span>
            <span className="metadata-value restart-required">⚠️ Yes</span>
          </div>
        )}
      </div>

      {/* Card Value */}
      <div className="card-value-section">
        <div className="value-header">
          <span className="value-label">Current Value:</span>
          {configuration.isSensitive && (
            <button
              className="reveal-button"
              onClick={handleReveal}
              disabled={revealing}
              title={isRevealed ? 'Hide sensitive value' : 'Show sensitive value'}
              aria-label={isRevealed ? 'Hide sensitive value' : 'Show sensitive value'}
            >
              {isRevealed ? (
                <>
                  <EyeOff size={16} />
                  Hide
                </>
              ) : (
                <>
                  <Eye size={16} />
                  Reveal
                </>
              )}
            </button>
          )}
        </div>

        <div className="value-display">
          <code className={`config-value ${configuration.isSensitive ? 'sensitive' : ''}`}>
            {displayValue}
          </code>
          <button
            className="copy-button"
            onClick={handleCopyValue}
            title="Copy configuration value"
            aria-label={`Copy ${configuration.name} value`}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
      </div>

      {/* Read-Only or Editable Indicator */}
      {!isEditable && (
        <div className="read-only-indicator">
          <span className="lock-icon">🔒</span>
          <span className="read-only-text">Read-only</span>
        </div>
      )}
    </div>
  );
};

export default ConfigurationCard;
