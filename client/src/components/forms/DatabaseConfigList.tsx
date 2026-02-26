/**
 * Database Configuration List Component
 * Displays list of database configurations with management actions
 */

import React, { useState, useEffect } from 'react';
import {
  Play,
  Pencil,
  Trash2,
  CheckCircle2,
  Activity,
  Database,
  RefreshCw,
  Globe,
  AlertTriangle
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { DatabaseConfigSummary } from '../../types/databaseConfig';
import { apiService } from '../../services/api';
import { cn } from '../../utils/cn';

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

        <div className="grid grid-cols-1 gap-4">
          {configurations.map((config) => (
            <Card
              key={config.id}
              className={cn(
                "border-l-4 transition-shadow hover:shadow-md",
                config.isActive ? "border-l-green-500" : "border-l-gray-300"
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-bold text-gray-900">{config.name}</h4>
                      {config.isActive && (
                        <span className="flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">
                          <Activity className="h-2.5 w-2.5 mr-1" /> ACTIVE
                        </span>
                      )}
                      <span className={cn(
                        "flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold",
                        config.status === 'connected' ? "bg-green-100 text-green-800" :
                          config.status === 'error' ? "bg-red-100 text-red-800" :
                            "bg-gray-100 text-gray-800"
                      )}>
                        {getStatusText(config.status).toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 font-mono flex items-center">
                      <Globe className="h-3 w-3 mr-1" /> {config.host}
                    </p>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                      <span className="flex items-center">
                        <Database className="h-3 w-3 mr-1" />
                        {config.database}
                      </span>
                      <span className="flex items-center">
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Last tested: {formatLastTested(config.lastTested)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleActivate(config)} // Reusing handleActivate which calls onActivate and reloads
                      disabled={activatingId === config.id}
                      title="Test Connection"
                    >
                      <Play className={cn("h-4 w-4", activatingId === config.id && "animate-spin")} />
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(config)}
                      title={canModify ? "Edit Configuration" : "View Configuration"}
                    >
                      {canModify ? <Pencil className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                    </Button>

                    {!config.isActive && canModify && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleActivate(config)}
                        title="Activate Connection"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}

                    {canModify && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => onDelete(config)}
                        disabled={config.isActive}
                        title="Delete Configuration"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {config.status === 'error' && (
                  <div className="mt-3 p-2 bg-red-50 border border-red-100 rounded text-xs text-red-700 flex items-start">
                    <AlertTriangle className="h-3.5 w-3.5 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Connection failed. Please check your credentials and network settings.</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Card>
  );
};