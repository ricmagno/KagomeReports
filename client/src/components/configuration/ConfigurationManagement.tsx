/**
 * ConfigurationManagement Component
 * Main component for displaying and managing application configurations
 * Requirements: 1.1, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 4.4, 5.1, 5.2, 5.3
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ConfigurationGroup,
  ConfigurationCategory,
  RevealedValues,
  Configuration,
  ConfigurationChange
} from '../../types/configuration';
import { AlertCircle, RefreshCw, Lock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { CategorySection } from './CategorySection';
import { ConfirmationDialog } from './ConfirmationDialog';
import { OpcuaConfiguration } from './OpcuaConfiguration';
import { cn } from '../../utils/cn';
import './ConfigurationManagement.css';

interface ConfigurationManagementState {
  configurations: ConfigurationGroup[];
  expandedCategories: Set<ConfigurationCategory>;
  revealedValues: RevealedValues;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  editingConfigs: Set<string>;
  successMessage: string | null;
  configTab: 'historian' | 'opcua';
  confirmationDialog: {
    isOpen: boolean;
    changes: ConfigurationChange[];
    isConfirming: boolean;
  };
}

export const ConfigurationManagement: React.FC = () => {
  const { isAdmin } = useAuth();
  const [state, setState] = useState<ConfigurationManagementState>({
    configurations: [],
    expandedCategories: new Set(),
    revealedValues: {},
    loading: true,
    error: null,
    refreshing: false,
    editingConfigs: new Set(),
    successMessage: null,
    configTab: 'historian',
    confirmationDialog: {
      isOpen: false,
      changes: [],
      isConfirming: false
    }
  });

  /**
   * Fetch configurations from API on component mount
   */
  useEffect(() => {
    fetchConfigurations();
  }, []);

  /**
   * Fetch configurations from backend API
   */
  const fetchConfigurations = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Use fetchWithRetry directly since apiService doesn't have a generic get method
      const response = await fetch('/api/configuration', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to retrieve configurations: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success || !data.data) {
        throw new Error('Failed to retrieve configurations');
      }

      setState(prev => ({
        ...prev,
        configurations: data.data || [],
        loading: false,
        error: null,
        // Initialize expanded categories - expand first category by default
        expandedCategories: data.data && data.data.length > 0
          ? new Set([data.data[0].category])
          : new Set()
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve configurations';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
    }
  }, []);

  /**
   * Handle category expand/collapse
   */
  const handleToggleCategory = useCallback((category: ConfigurationCategory) => {
    setState(prev => {
      const newExpanded = new Set(prev.expandedCategories);
      if (newExpanded.has(category)) {
        newExpanded.delete(category);
      } else {
        newExpanded.add(category);
      }
      return { ...prev, expandedCategories: newExpanded };
    });
  }, []);

  /**
   * Handle reveal sensitive value
   */
  const handleRevealValue = useCallback(async (configName: string) => {
    try {
      const response = await fetch('/api/configuration/reveal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
        },
        body: JSON.stringify({ configName })
      });

      if (!response.ok) {
        throw new Error('Failed to reveal sensitive value');
      }

      const data = await response.json();

      if (!data.success || !data.value) {
        throw new Error('Failed to reveal sensitive value');
      }

      // Update revealed values state
      setState(prev => ({
        ...prev,
        revealedValues: {
          ...prev.revealedValues,
          [configName]: true
        }
      }));

      // Auto-hide after 30 seconds
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          revealedValues: {
            ...prev.revealedValues,
            [configName]: false
          }
        }));
      }, 30000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reveal sensitive value';
      setState(prev => ({
        ...prev,
        error: errorMessage
      }));
    }
  }, []);

  /**
   * Handle refresh configurations
   */
  const handleRefresh = useCallback(async () => {
    setState(prev => ({ ...prev, refreshing: true }));
    await fetchConfigurations();
    setState(prev => ({ ...prev, refreshing: false }));
  }, [fetchConfigurations]);

  /**
   * Handle configuration edit
   */
  const handleEditConfiguration = useCallback(async (
    configName: string,
    oldValue: string,
    newValue: string
  ) => {
    if (!isAdmin) {
      setState(prev => ({
        ...prev,
        error: 'Only administrators can edit configurations'
      }));
      return;
    }

    try {
      // Show confirmation dialog
      setState(prev => ({
        ...prev,
        confirmationDialog: {
          isOpen: true,
          changes: [{
            name: configName,
            oldValue,
            newValue
          }],
          isConfirming: false
        }
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to edit configuration';
      setState(prev => ({
        ...prev,
        error: errorMessage
      }));
    }
  }, [isAdmin]);

  /**
   * Handle confirmation of configuration changes
   */
  const handleConfirmChanges = useCallback(async () => {
    try {
      setState(prev => ({
        ...prev,
        confirmationDialog: {
          ...prev.confirmationDialog,
          isConfirming: true
        }
      }));

      const response = await fetch('/api/configuration/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
        },
        body: JSON.stringify({
          changes: state.confirmationDialog.changes
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update configuration');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update configuration');
      }

      // Show success message
      setState(prev => ({
        ...prev,
        successMessage: 'Configuration updated successfully',
        confirmationDialog: {
          isOpen: false,
          changes: [],
          isConfirming: false
        }
      }));

      // Refresh configurations
      await fetchConfigurations();

      // Clear success message after 3 seconds
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          successMessage: null
        }));
      }, 3000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update configuration';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        confirmationDialog: {
          ...prev.confirmationDialog,
          isConfirming: false
        }
      }));
    }
  }, [state.confirmationDialog.changes, fetchConfigurations]);

  /**
   * Handle cancel changes
   */
  const handleCancelChanges = useCallback(() => {
    setState(prev => ({
      ...prev,
      confirmationDialog: {
        isOpen: false,
        changes: [],
        isConfirming: false
      }
    }));
  }, []);

  if (state.loading) {
    return (
      <div className="configuration-management loading">
        <div className="loading-spinner">
          <RefreshCw className="spinner-icon" />
          <p>Loading configurations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="configuration-management">
      {/* Header */}
      <div className="configuration-header">
        <div className="header-content">
          <h1>Application Configuration</h1>
          <p className="header-description">
            View and manage application settings.
          </p>
        </div>
        <div className="header-actions">
          <div className="config-tabs">
            <button
              className={cn("tab-button", state.configTab === 'historian' && "active")}
              onClick={() => setState(prev => ({ ...prev, configTab: 'historian' }))}
            >
              Historian
            </button>
            <button
              className={cn("tab-button", state.configTab === 'opcua' && "active")}
              onClick={() => setState(prev => ({ ...prev, configTab: 'opcua' }))}
            >
              OPC UA
            </button>
          </div>
          {state.configTab === 'historian' && (
            <button
              className="refresh-button"
              onClick={handleRefresh}
              disabled={state.refreshing}
              title="Refresh configurations"
            >
              <RefreshCw className={state.refreshing ? 'spinning' : ''} size={20} />
              Refresh
            </button>
          )}
        </div>
      </div>

      {state.configTab === 'historian' ? (
        <>
          {/* Read-Only Notice */}
          <div className="read-only-notice">
            <Lock size={20} />
            <div className="notice-content">
              <h3>Read-Only Configuration</h3>
              <p>
                Configurations are displayed in read-only mode. To modify settings, edit the <code>.env</code> file
                directly and restart the application.
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div className="configuration-instructions">
            <h3>How to Change Configurations</h3>
            <ol>
              <li>Edit the <code>.env</code> file in the application root directory</li>
              <li>Update the desired configuration values</li>
              <li>Save the file</li>
              <li>Restart the application for changes to take effect</li>
            </ol>
            <p className="instruction-note">
              For detailed configuration documentation, refer to the <code>.env.example</code> file or the application documentation.
            </p>
          </div>

          {/* Error Message */}
          {state.error && (
            <div className="error-message">
              <AlertCircle size={20} />
              <div>
                <h4>Error</h4>
                <p>{state.error}</p>
              </div>
              <button
                className="error-dismiss"
                onClick={() => setState(prev => ({ ...prev, error: null }))}
              >
                ✕
              </button>
            </div>
          )}

          {/* Success Message */}
          {state.successMessage && (
            <div className="success-message">
              <div>
                <h4>Success</h4>
                <p>{state.successMessage}</p>
              </div>
              <button
                className="success-dismiss"
                onClick={() => setState(prev => ({ ...prev, successMessage: null }))}
              >
                ✕
              </button>
            </div>
          )}

          {/* Configuration Categories */}
          <div className="configuration-categories">
            {state.configurations.length === 0 ? (
              <div className="no-configurations">
                <p>No configurations available</p>
              </div>
            ) : (
              state.configurations.map(group => (
                <CategorySection
                  key={group.category}
                  category={group.category}
                  configurations={group.configurations}
                  isExpanded={state.expandedCategories.has(group.category)}
                  onToggleExpand={handleToggleCategory}
                  revealedValues={state.revealedValues}
                  onRevealValue={handleRevealValue}
                  isEditable={isAdmin}
                  onEditConfiguration={handleEditConfiguration}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="configuration-footer">
            <p className="footer-text">
              Total configurations: <strong>{state.configurations.reduce((sum, g) => sum + g.configurations.length, 0)}</strong>
            </p>
          </div>

          {/* Confirmation Dialog */}
          <ConfirmationDialog
            isOpen={state.confirmationDialog.isOpen}
            changes={state.confirmationDialog.changes}
            isConfirming={state.confirmationDialog.isConfirming}
            onConfirm={handleConfirmChanges}
            onCancel={handleCancelChanges}
          />
        </>
      ) : (
        <div className="mt-6">
          <OpcuaConfiguration />
        </div>
      )}
    </div>
  );
};

export default ConfigurationManagement;
