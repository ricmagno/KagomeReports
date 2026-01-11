/**
 * Database Configuration List Component
 * Displays list of database configurations with management actions
 */

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { DatabaseConfigSummary } from '../../types/databaseConfig';
import { apiService } from '../../services/api';

interface DatabaseConfigListProps {
  onEdit: (config: DatabaseConfigSummary) => void;
  onDelete: (config: DatabaseConfigSummary) => void;
  onActivate: (config: DatabaseConfigSummary) => void;
  refreshTrigger?: number;
  canModify?: boolean;
}

export const DatabaseConfigList: React.FC<DatabaseConfigListProps> = ({
  onEdit,
  onDelete,
  onActivate,
  refreshTrigger,
  canModify = true
}) => {
  const [configurations, setConfigurations] = useState<DatabaseConfigSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const loadConfigurations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiService.getDatabaseConfigurations();
      setConfigurations(response.data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load configurations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfigurations();
  }, [refreshTrigger]);

  const handleActivate = async (config: DatabaseConfigSummary) => {
    if (config.isActive) return;

    setActivatingId(config.id);
    try {
      await onActivate(config);
      await loadConfigurations(); // Refresh the list
    } catch (error) {
      console.error('Failed to activate configuration:', error);
    } finally {
      setActivatingId(null);
    }
  };

  const getStatusColor = (status: DatabaseConfigSummary['status']) => {
    switch (status) {
      case 'connected':
        return 'text-green-600 bg-green-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      case 'disconnected':
        return 'text-yellow-600 bg-yellow-100';
      case 'untested':
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: DatabaseConfigSummary['status']) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'error':
        return 'Error';
      case 'disconnected':
        return 'Disconnected';
      case 'untested':
      default:
        return 'Untested';
    }
  };

  const formatLastTested = (date?: Date) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const tested = new Date(date);
    const diffMs = now.getTime() - tested.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return tested.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <Card>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="p-6">
          <div className="text-center">
            <div className="text-red-600 mb-2">
              <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Configurations</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadConfigurations} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (configurations.length === 0) {
    return (
      <Card>
        <div className="p-6">
          <div className="text-center">
            <div className="text-gray-400 mb-4">
              <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Database Configurations</h3>
            <p className="text-gray-600">
              Create your first database configuration to get started.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Database Configurations</h2>
          <Button onClick={loadConfigurations} variant="outline" size="sm">
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </Button>
        </div>

        <div className="space-y-4">
          {configurations.map((config) => (
            <div
              key={config.id}
              className={`border rounded-lg p-4 transition-colors ${
                config.isActive 
                  ? 'border-blue-200 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-medium text-gray-900">
                      {config.name}
                    </h3>
                    {config.isActive && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Active
                      </span>
                    )}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(config.status)}`}>
                      {getStatusText(config.status)}
                    </span>
                  </div>
                  
                  <div className="mt-2 text-sm text-gray-600">
                    <div className="flex items-center space-x-4">
                      <span>
                        <span className="font-medium">Host:</span> {config.host}
                      </span>
                      <span>
                        <span className="font-medium">Database:</span> {config.database}
                      </span>
                    </div>
                    <div className="mt-1">
                      <span className="font-medium">Last tested:</span> {formatLastTested(config.lastTested)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {!config.isActive && canModify && (
                    <Button
                      onClick={() => handleActivate(config)}
                      disabled={activatingId === config.id}
                      size="sm"
                      className="min-w-[80px]"
                    >
                      {activatingId === config.id ? 'Activating...' : 'Activate'}
                    </Button>
                  )}
                  
                  {canModify ? (
                    <Button
                      onClick={() => onEdit(config)}
                      variant="outline"
                      size="sm"
                    >
                      <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </Button>
                  ) : (
                    <Button
                      onClick={() => onEdit(config)}
                      variant="outline"
                      size="sm"
                    >
                      <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View
                    </Button>
                  )}
                  
                  {canModify && (
                    <Button
                      onClick={() => onDelete(config)}
                      variant="outline"
                      size="sm"
                      disabled={config.isActive}
                      className={config.isActive ? 'opacity-50 cursor-not-allowed' : 'text-red-600 hover:text-red-700 hover:border-red-300'}
                    >
                      <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};