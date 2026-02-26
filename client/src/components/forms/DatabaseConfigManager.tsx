/**
 * Database Configuration Manager Component
 * Main component for managing database configurations
 */

import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { DatabaseConfigForm } from './DatabaseConfigForm';
import { DatabaseConfigList } from './DatabaseConfigList';
import { DatabaseConfig, DatabaseConfigSummary } from '../../types/databaseConfig';
import { apiService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

type ViewMode = 'list' | 'create' | 'edit';

interface DatabaseConfigManagerProps {
  className?: string;
}

export const DatabaseConfigManager: React.FC<DatabaseConfigManagerProps> = ({ className }) => {
  const { isAdmin, hasPermission } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingConfig, setEditingConfig] = useState<DatabaseConfig | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user has permission to modify database configurations
  const canModifyConfigs = isAdmin || hasPermission('database', 'write');
  const canViewConfigs = isAdmin || hasPermission('database', 'read');

  const handleCreateNew = () => {
    if (!canModifyConfigs) {
      setError('You do not have permission to create database configurations. Administrator access required.');
      return;
    }

    setEditingConfig(null);
    setViewMode('create');
    setError(null);
  };

  const handleEdit = async (configSummary: DatabaseConfigSummary) => {
    if (!canModifyConfigs) {
      setError('You do not have permission to edit database configurations. Administrator access required.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Load full configuration details for editing
      const response = await apiService.getDatabaseConfiguration(configSummary.id);
      setEditingConfig(response.data);
      setViewMode('edit');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (config: DatabaseConfigSummary) => {
    if (!canModifyConfigs) {
      setError('You do not have permission to delete database configurations. Administrator access required.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete the configuration "${config.name}"?`)) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      await apiService.deleteDatabaseConfiguration(config.id);
      setRefreshTrigger(prev => prev + 1);

      // Show success message
      alert('Configuration deleted successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete configuration';
      setError(errorMessage);
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivate = async (config: DatabaseConfigSummary) => {
    if (!canModifyConfigs) {
      setError('You do not have permission to activate database configurations. Administrator access required.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      await apiService.activateDatabaseConfiguration(config.id);
      setRefreshTrigger(prev => prev + 1);

      // Show success message
      alert(`Configuration "${config.name}" activated successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to activate configuration';
      setError(errorMessage);
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (configData: Omit<DatabaseConfig, 'id'>) => {
    try {
      setIsLoading(true);
      setError(null);

      if (viewMode === 'edit' && editingConfig?.id) {
        // Update existing configuration
        await apiService.updateDatabaseConfiguration(editingConfig.id, configData);
        alert('Configuration updated successfully');
      } else {
        // Create new configuration
        await apiService.saveDatabaseConfiguration(configData);
        alert('Configuration created successfully');
      }

      setViewMode('list');
      setEditingConfig(null);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save configuration';
      setError(errorMessage);
      throw error; // Re-throw to let the form handle it
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setViewMode('list');
    setEditingConfig(null);
    setError(null);
  };

  return (
    <div className={className}>
      {/* Access Control Check */}
      {!canViewConfigs && (
        <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Access Restricted</h3>
              <p className="text-sm text-yellow-700 mt-1">
                You do not have permission to view database configurations. Please contact your administrator.
              </p>
            </div>
          </div>
        </div>
      )}

      {canViewConfigs && (
        <>
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                {/* Header content removed for better nesting */}
              </div>

              {viewMode === 'list' && canModifyConfigs && (
                <Button onClick={handleCreateNew} disabled={isLoading}>
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Configuration
                </Button>
              )}
            </div>

            {/* Breadcrumb */}
            {viewMode !== 'list' && (
              <nav className="flex mt-4" aria-label="Breadcrumb">
                <ol className="flex items-center space-x-2">
                  <li>
                    <button
                      onClick={handleCancel}
                      className="text-blue-600 hover:text-blue-500 font-medium"
                    >
                      Database Configurations
                    </button>
                  </li>
                  <li className="flex items-center">
                    <svg className="h-4 w-4 text-gray-400 mx-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-500">
                      {viewMode === 'create' ? 'New Configuration' : 'Edit Configuration'}
                    </span>
                  </li>
                </ol>
              </nav>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
                <div className="ml-auto pl-3">
                  <button
                    onClick={() => setError(null)}
                    className="text-red-400 hover:text-red-500"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Content */}
          {viewMode === 'list' && (
            <DatabaseConfigList
              onEdit={handleEdit}
              onDelete={handleDelete}
              onActivate={handleActivate}
              refreshTrigger={refreshTrigger}
              canModify={canModifyConfigs}
            />
          )}

          {(viewMode === 'create' || viewMode === 'edit') && (
            <DatabaseConfigForm
              config={editingConfig || undefined}
              onSave={handleSave}
              onCancel={handleCancel}
              isEditing={viewMode === 'edit'}
              canModify={canModifyConfigs}
            />
          )}

          {/* Loading Overlay */}
          {isLoading && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="text-gray-900">Processing...</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};