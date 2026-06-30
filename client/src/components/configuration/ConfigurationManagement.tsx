import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Lock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { OpcuaConfiguration } from './OpcuaConfiguration';
import { HistorianConfiguration } from './HistorianConfiguration';
import { DataManagement } from './DataManagement';
import { AlertDeliveryConfiguration } from './AlertDeliveryConfiguration';
import { cn } from '../../utils/cn';
import './ConfigurationManagement.css';

type ConfigTab = 'historian' | 'opcua' | 'alerts' | 'data-management';

export const ConfigurationManagement: React.FC = () => {
  const { isAdmin } = useAuth();
  const [configTab, setConfigTab] = useState<ConfigTab>('historian');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchConfigurations = useCallback(async () => {
    try {
      setLoading(true);
      await fetch('/api/configuration', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}` }
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigurations();
  }, [fetchConfigurations]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConfigurations();
    setRefreshing(false);
  }, [fetchConfigurations]);

  if (loading) {
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
      <div className="configuration-header">
        <div className="header-content">
          <h1>Application Configuration</h1>
          <p className="header-description">View and manage application settings.</p>
        </div>
        <div className="header-actions">
          <div className="config-tabs">
            <button
              className={cn("tab-button", configTab === 'historian' && "active")}
              onClick={() => setConfigTab('historian')}
            >
              Historian
            </button>
            <button
              className={cn("tab-button", configTab === 'opcua' && "active")}
              onClick={() => setConfigTab('opcua')}
            >
              OPC UA
            </button>
            {isAdmin && (
              <button
                className={cn("tab-button", configTab === 'alerts' && "active")}
                onClick={() => setConfigTab('alerts')}
              >
                Alerts
              </button>
            )}
            {isAdmin && (
              <button
                className={cn("tab-button", configTab === 'data-management' && "active")}
                onClick={() => setConfigTab('data-management')}
              >
                Data Management
              </button>
            )}
          </div>
          {configTab === 'historian' && (
            <button
              className="refresh-button"
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh configurations"
            >
              <RefreshCw className={refreshing ? 'spinning' : ''} size={20} />
              Refresh
            </button>
          )}
        </div>
      </div>

      {configTab === 'historian' ? (
        <HistorianConfiguration />
      ) : configTab === 'opcua' ? (
        <div className="mt-6">
          <OpcuaConfiguration />
        </div>
      ) : configTab === 'alerts' ? (
        isAdmin ? (
          <div className="mt-6">
            <AlertDeliveryConfiguration />
          </div>
        ) : (
          <div className="mt-6 p-8 text-center text-gray-500 bg-gray-50 rounded-lg border">
            <Lock className="mx-auto mb-3 text-gray-400" size={32} />
            <h3 className="text-lg font-medium text-gray-900">Administrator Access Required</h3>
            <p className="mt-1">Only administrators can configure alert delivery settings.</p>
          </div>
        )
      ) : isAdmin ? (
        <div className="mt-6">
          <DataManagement />
        </div>
      ) : (
        <div className="mt-6 p-8 text-center text-gray-500 bg-gray-50 rounded-lg border">
          <Lock className="mx-auto mb-3 text-gray-400" size={32} />
          <h3 className="text-lg font-medium text-gray-900">Administrator Access Required</h3>
          <p className="mt-1">Only users with the Administrator role can access Data Management.</p>
        </div>
      )}
    </div>
  );
};

export default ConfigurationManagement;
