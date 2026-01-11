/**
 * Database Configuration Form Component
 * Provides interface for creating and editing database configurations
 */

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Select } from '../ui/Select';
import { 
  DatabaseConfig, 
  DatabaseConfigFormData, 
  DatabaseConfigFormErrors,
  ConnectionTestResult 
} from '../../types/databaseConfig';
import { apiService } from '../../services/api';

interface DatabaseConfigFormProps {
  config?: DatabaseConfig;
  onSave: (config: Omit<DatabaseConfig, 'id'>) => Promise<void>;
  onCancel: () => void;
  isEditing?: boolean;
  canModify?: boolean;
}

export const DatabaseConfigForm: React.FC<DatabaseConfigFormProps> = ({
  config,
  onSave,
  onCancel,
  isEditing = false,
  canModify = true
}) => {
  const [formData, setFormData] = useState<DatabaseConfigFormData>({
    name: config?.name || '',
    host: config?.host || 'localhost',
    port: config?.port || 1433,
    database: config?.database || '',
    username: config?.username || '',
    password: config?.password || '',
    encrypt: config?.encrypt ?? true,
    trustServerCertificate: config?.trustServerCertificate ?? false,
    connectionTimeout: config?.connectionTimeout || 30000,
    requestTimeout: config?.requestTimeout || 30000,
    confirmPassword: '',
    testConnection: false
  });

  const [errors, setErrors] = useState<DatabaseConfigFormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Clear confirm password when editing existing config
  useEffect(() => {
    if (isEditing && config) {
      setFormData(prev => ({ ...prev, confirmPassword: '' }));
    }
  }, [isEditing, config]);

  const validateForm = (): boolean => {
    const newErrors: DatabaseConfigFormErrors = {};

    // Required fields
    if (!formData.name.trim()) {
      newErrors.name = 'Configuration name is required';
    }

    if (!formData.host.trim()) {
      newErrors.host = 'Host is required';
    }

    if (!formData.database.trim()) {
      newErrors.database = 'Database name is required';
    }

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Password is required';
    }

    // Password confirmation for new configurations
    if (!isEditing && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Port validation
    if (formData.port < 1 || formData.port > 65535) {
      newErrors.port = 'Port must be between 1 and 65535';
    }

    // Timeout validation
    if (formData.connectionTimeout < 1000 || formData.connectionTimeout > 300000) {
      newErrors.connectionTimeout = 'Connection timeout must be between 1000ms and 300000ms';
    }

    if (formData.requestTimeout < 1000 || formData.requestTimeout > 300000) {
      newErrors.requestTimeout = 'Request timeout must be between 1000ms and 300000ms';
    }

    // Host format validation
    const hostRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$|^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^localhost$/;
    if (formData.host && !hostRegex.test(formData.host)) {
      newErrors.host = 'Invalid hostname format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof DatabaseConfigFormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }

    // Clear test result when form changes
    if (testResult) {
      setTestResult(null);
    }
  };

  const handleTestConnection = async () => {
    if (!validateForm()) {
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const testConfig = {
        name: formData.name,
        host: formData.host,
        port: formData.port,
        database: formData.database,
        username: formData.username,
        password: formData.password,
        encrypt: formData.encrypt,
        trustServerCertificate: formData.trustServerCertificate,
        connectionTimeout: formData.connectionTimeout,
        requestTimeout: formData.requestTimeout
      };

      const response = await apiService.testDatabaseConnection(testConfig);
      setTestResult(response.data);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
        testedAt: new Date()
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const configToSave = {
        name: formData.name,
        host: formData.host,
        port: formData.port,
        database: formData.database,
        username: formData.username,
        password: formData.password,
        encrypt: formData.encrypt,
        trustServerCertificate: formData.trustServerCertificate,
        connectionTimeout: formData.connectionTimeout,
        requestTimeout: formData.requestTimeout
      };

      await onSave(configToSave);
    } catch (error) {
      console.error('Failed to save configuration:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <div className="p-6">
        <h2 className="text-2xl font-semibold mb-6">
          {isEditing ? 'Edit Database Configuration' : 'New Database Configuration'}
          {!canModify && (
            <span className="block text-sm text-yellow-600 mt-1">
              ⚠️ Read-only mode - Administrator privileges required for modifications
            </span>
          )}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Basic Configuration</h3>
            
            <Input
              label="Configuration Name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              error={errors.name}
              placeholder="e.g., Production Historian"
              required
              disabled={!canModify}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Host"
                value={formData.host}
                onChange={(e) => handleInputChange('host', e.target.value)}
                error={errors.host}
                placeholder="localhost or IP address"
                required
                disabled={!canModify}
              />

              <Input
                label="Port"
                type="number"
                value={formData.port}
                onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 1433)}
                error={errors.port}
                min={1}
                max={65535}
                required
                disabled={!canModify}
              />
            </div>

            <Input
              label="Database Name"
              value={formData.database}
              onChange={(e) => handleInputChange('database', e.target.value)}
              error={errors.database}
              placeholder="e.g., Runtime"
              required
              disabled={!canModify}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Username"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                error={errors.username}
                placeholder="Database username"
                required
                disabled={!canModify}
              />

              <Input
                label="Password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                error={errors.password}
                placeholder={canModify ? "Database password" : "••••••••"}
                required
                disabled={!canModify}
              />
            </div>

            {!isEditing && canModify && (
              <Input
                label="Confirm Password"
                type="password"
                value={formData.confirmPassword || ''}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                error={errors.confirmPassword}
                placeholder="Confirm password"
                required
                disabled={!canModify}
              />
            )}
          </div>

          {/* Security Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Security Settings</h3>
            
            <div className="space-y-3">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={formData.encrypt}
                  onChange={(e) => handleInputChange('encrypt', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={!canModify}
                />
                <span className="text-sm font-medium text-gray-700">
                  Encrypt connection (TLS/SSL)
                </span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={formData.trustServerCertificate}
                  onChange={(e) => handleInputChange('trustServerCertificate', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={!canModify}
                />
                <span className="text-sm font-medium text-gray-700">
                  Trust server certificate
                </span>
              </label>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center space-x-2 text-sm font-medium text-blue-600 hover:text-blue-500"
              disabled={!canModify}
            >
              <span>{showAdvanced ? 'Hide' : 'Show'} Advanced Settings</span>
              <svg
                className={`h-4 w-4 transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showAdvanced && (
              <div className="space-y-4 pl-4 border-l-2 border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Connection Timeout (ms)"
                    type="number"
                    value={formData.connectionTimeout}
                    onChange={(e) => handleInputChange('connectionTimeout', parseInt(e.target.value) || 30000)}
                    error={errors.connectionTimeout}
                    min={1000}
                    max={300000}
                    disabled={!canModify}
                  />

                  <Input
                    label="Request Timeout (ms)"
                    type="number"
                    value={formData.requestTimeout}
                    onChange={(e) => handleInputChange('requestTimeout', parseInt(e.target.value) || 30000)}
                    error={errors.requestTimeout}
                    min={1000}
                    max={300000}
                    disabled={!canModify}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Connection Test */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Connection Test</h3>
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTesting || !canModify}
                className="min-w-[120px]"
              >
                {isTesting ? 'Testing...' : 'Test Connection'}
              </Button>
            </div>

            {testResult && (
              <div className={`p-4 rounded-md ${
                testResult.success 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-start space-x-3">
                  <div className={`flex-shrink-0 h-5 w-5 ${
                    testResult.success ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {testResult.success ? (
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${
                      testResult.success ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {testResult.message}
                    </p>
                    {testResult.responseTime && (
                      <p className="text-xs text-gray-600 mt-1">
                        Response time: {testResult.responseTime}ms
                      </p>
                    )}
                    {testResult.serverVersion && (
                      <p className="text-xs text-gray-600 mt-1">
                        Server version: {testResult.serverVersion}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              {canModify ? 'Cancel' : 'Close'}
            </Button>
            {canModify && (
              <Button
                type="submit"
                disabled={isLoading}
                className="min-w-[100px]"
              >
                {isLoading ? 'Saving...' : 'Save Configuration'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </Card>
  );
};