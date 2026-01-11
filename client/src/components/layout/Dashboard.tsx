import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  FileText,
  Settings,
  Calendar,
  Download,
  Plus,
  Save,
  History,
  AlertCircle,
  Tag,
  Database,
  LogIn,
  LogOut
} from 'lucide-react';
import { ReportConfig } from '../../types/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { TimeRangePicker } from '../forms/TimeRangePicker';
import { ReportPreview } from '../reports/ReportPreview';
import { apiService, getAuthToken, setAuthToken } from '../../services/api';
import { cn } from '../../utils/cn';

interface DashboardProps {
  className?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ className }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'reports' | 'schedules' | 'categories' | 'database'>('create');
  const [healthStatus, setHealthStatus] = useState<string>('checking...');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loginForm, setLoginForm] = useState({ username: 'admin', password: 'admin123' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [reportConfig, setReportConfig] = useState<Partial<ReportConfig>>({
    name: '',
    description: '',
    tags: [],
    timeRange: {
      startTime: new Date(Date.now() - 60 * 60 * 1000), // Default: 1 hour ago
      endTime: new Date(),   // Default: Current time
      relativeRange: undefined,
    },
    chartTypes: ['line'],
    template: 'default',
  });

  // Health check with polling for reconnection countdown
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const checkHealth = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

        const response = await fetch('http://127.0.0.1:3000/api/health/historian', {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();

          if (data.status === 'healthy') {
            setHealthStatus('✅ Backend connected & Ready');
          } else if (data.connection && data.connection.state === 'retrying' && data.connection.nextRetry) {
            const nextRetry = new Date(data.connection.nextRetry);
            const now = new Date();
            const diff = Math.ceil((nextRetry.getTime() - now.getTime()) / 1000);
            const seconds = diff > 0 ? diff : 0;
            setHealthStatus(`⚠️ Connection lost. Retrying in ${seconds}s...`);
          } else if (data.connection && data.connection.state === 'connecting') {
            setHealthStatus('⚠️ Connecting to database...');
          } else {
            setHealthStatus(`❌ Backend Connected - Database: ${data.status} (${data.connection?.state || 'unknown'})`);
          }
        } else {
          // If detailed check fails, try basic check
          const controllerBasic = new AbortController();
          const timeoutBasic = setTimeout(() => controllerBasic.abort(), 1000);

          try {
            const basicResponse = await fetch('http://127.0.0.1:3000/api/health', {
              signal: controllerBasic.signal
            });
            clearTimeout(timeoutBasic);

            if (basicResponse.ok) {
              setHealthStatus('⚠️ Backend connected - Database status unknown');
            } else {
              setHealthStatus(`❌ Backend error - Status: ${response.status}`);
            }
          } catch (e) {
            setHealthStatus(`❌ Backend error - Status: ${response.status}`);
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          setHealthStatus('❌ Backend connection timed out');
        } else {
          setHealthStatus(`❌ Backend connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    };

    checkHealth();
    intervalId = setInterval(checkHealth, 1000); // Poll every second to update countdown

    return () => clearInterval(intervalId);
  }, []);

  // Check if user is already authenticated
  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      // Verify token is still valid
      apiService.getCurrentUser()
        .then(response => {
          if (response.success) {
            setIsAuthenticated(true);
            setCurrentUser(response.data);
          }
        })
        .catch(() => {
          // Token is invalid, clear it
          setAuthToken(null);
        });
    }
  }, []);

  const handleLogin = async () => {
    if (!loginForm.username || !loginForm.password) {
      alert('Please enter username and password');
      return;
    }

    try {
      setLoginLoading(true);
      const response = await apiService.login({
        username: loginForm.username,
        password: loginForm.password
      });

      if (response.success && response.data) {
        setIsAuthenticated(true);
        setCurrentUser(response.data.user);
        // Token is automatically set by apiService.login
      } else {
        alert('Login failed: ' + (response.data || 'Unknown error'));
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiService.logout();
      setIsAuthenticated(false);
      setCurrentUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      // Clear local state anyway
      setIsAuthenticated(false);
      setCurrentUser(null);
    }
  };

  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [realTimeEnabled, setRealTimeEnabled] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // Simplified state management without complex hooks to avoid API call issues
  const reportsData: any = null;
  const reportsLoading = false;
  const reportsError: any = null;
  const loadReportsData = () => { };
  const tagsData: any = null;
  const tagsLoading = false;
  const loadTagsData = () => { };
  const healthData: any = null;
  const healthLoading = false;
  const checkHealth = () => { };

  // Mock real-time data state
  const realTimeData = {
    isActive: false,
    connected: false,
    loading: false,
    error: null as string | null,
    lastUpdate: null as Date | null,
    updateCount: 0,
  };

  // Mock data refresh state
  const dataRefresh = {
    isRefreshing: false,
    forceRefresh: () => { },
  };

  // Mock version control state
  const versionControl = {
    hasUnsavedChanges: false,
    currentVersion: null,
    loading: false,
    createVersion: async () => { },
    rollbackToVersion: async () => { },
    checkUnsavedChanges: () => { },
    getChangesSummary: () => [],
  };

  // Load initial data
  useEffect(() => {
    const loadTags = async () => {
      try {
        const response = await apiService.getTags();
        if (response.success && Array.isArray(response.data)) {
          setAvailableTags(response.data.map((tag: any) => tag.name));
        } else {
          // Fallback to known good tags if API fails
          setAvailableTags(['SysSpaceMain', 'Temperature_01', 'Pressure_01', 'Flow_01', 'Level_01', 'Status_01']);
        }
      } catch (error) {
        console.warn('Failed to load tags from API, using fallback:', error);
        setAvailableTags(['SysSpaceMain', 'Temperature_01', 'Pressure_01', 'Flow_01', 'Level_01', 'Status_01']);
      }
    };

    loadTags();
  }, []);

  // Update tags from API data
  useEffect(() => {
    // Temporarily disabled - using mock data instead
    /*
    if (tagsData?.data) {
      // Map API TagInfo to component TagInfo format
      const mappedTags = tagsData.data.map(tag => ({
        name: tag.name,
        count: 0, // Default count since API doesn't provide this
        category: undefined, // API doesn't provide category
      }));
      setTags(mappedTags);
    }
    */
  }, []);

  const handleTagsChange = (tags: string[]) => {
    setReportConfig(prev => ({
      ...prev,
      tags,
    }));
  };

  const handleGenerateReport = async () => {
    if (!reportConfig.name || !reportConfig.tags?.length) {
      alert('Please provide a report name and select at least one tag');
      return;
    }

    // Validate date range
    if (reportConfig.timeRange?.startTime && reportConfig.timeRange?.endTime) {
      if (reportConfig.timeRange.startTime > reportConfig.timeRange.endTime) {
        alert('Start time cannot be after end time');
        return;
      }
    } else {
      alert('Please provide both start and end times');
      return;
    }

    if (!isAuthenticated) {
      alert('Please log in to generate reports');
      return;
    }

    try {
      setIsLoading(true);

      // Generate real report with authentication
      const blob = await apiService.generateReport(reportConfig as ReportConfig);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${reportConfig.name}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      alert('Report generated successfully!');
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('Failed to generate report: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'create', label: 'Create Report', icon: Plus },
    { id: 'reports', label: 'My Reports', icon: FileText },
    { id: 'schedules', label: 'Schedules', icon: Calendar },
    { id: 'categories', label: 'Categories', icon: Tag },
    { id: 'database', label: 'Database Config', icon: Database },
  ] as const;

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className={cn('min-h-screen bg-gray-50 flex items-center justify-center', className)}>
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="text-center">
              <BarChart3 className="h-12 w-12 text-primary-600 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Historian Reports
              </h1>
              <p className="text-gray-600">
                Please log in to access the application
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Username"
              placeholder="Enter username"
              value={loginForm.username}
              onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            />
            <Input
              label="Password"
              type="password"
              placeholder="Enter password"
              value={loginForm.password}
              onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            />
            <Button
              onClick={handleLogin}
              disabled={loginLoading}
              loading={loginLoading}
              className="w-full"
            >
              <LogIn className="h-4 w-4 mr-2" />
              Log In
            </Button>
            <div className="text-center text-sm text-gray-500">
              <p>Default credentials:</p>
              <p>Username: <code>admin</code></p>
              <p>Password: <code>admin123</code></p>
            </div>
            <div className="text-center text-sm text-gray-600">
              Backend Status: {healthStatus}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('min-h-screen bg-gray-50', className)}>
      {/* Health Status Bar */}
      <div className="bg-blue-50 border-b border-blue-200 px-6 py-2">
        <div className="text-sm text-blue-800">
          Backend Status: {healthStatus}
        </div>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <BarChart3 className="h-8 w-8 text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900">
                Historian Reports
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>

              {/* User info and logout */}
              {currentUser && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    Welcome, {currentUser.firstName || currentUser.username}
                  </span>
                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </Button>
                </div>
              )}

              {/* System Health Indicator */}
              <div className="flex items-center space-x-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  healthStatus.includes('✅') ? "bg-green-500" : "bg-red-500"
                )} />
                <span className="text-sm text-gray-600">
                  {healthStatus}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm',
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'create' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  Create New Report
                </h2>
                <p className="text-gray-600">
                  Configure your report settings and generate professional reports from AVEVA Historian data.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Report Configuration */}
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <h3 className="text-lg font-medium">Report Details</h3>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Input
                      label="Report Name"
                      placeholder="Enter report name..."
                      value={reportConfig.name || ''}
                      onChange={(e) => setReportConfig(prev => ({
                        ...prev,
                        name: e.target.value,
                      }))}
                      required
                    />
                    <Input
                      label="Description"
                      placeholder="Enter report description..."
                      value={reportConfig.description || ''}
                      onChange={(e) => setReportConfig(prev => ({
                        ...prev,
                        description: e.target.value,
                      }))}
                    />
                  </CardContent>
                </Card>

                <TimeRangePicker
                  value={reportConfig.timeRange!}
                  onChange={(newTimeRange) => setReportConfig(prev => ({
                    ...prev,
                    timeRange: newTimeRange
                  }))}
                />
                {/* Validation Error Message - Handled inside TimeRangePicker but we check for button disable state */}
                {reportConfig.timeRange?.startTime && reportConfig.timeRange?.endTime &&
                  reportConfig.timeRange.startTime > reportConfig.timeRange.endTime && (
                    <div className="mt-2 text-sm text-red-600 bg-red-50 p-3 rounded-md hidden">
                      <div className="flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        <span>Warning: Start time is after end time</span>
                      </div>
                    </div>
                  )}
              </div>

              {/* Tag Selection and Version History */}
              <div className="space-y-6">
                {!showVersionHistory ? (
                  <>
                    {/* Simplified Tag Selection */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Tag className="h-5 w-5 text-gray-500" />
                            <h3 className="text-lg font-medium">Tag Selection</h3>
                          </div>
                          <span className="text-sm text-gray-500">
                            {reportConfig.tags?.length || 0}/10 selected
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Available Tags */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-700">Available Tags:</h4>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {availableTags.map((tag) => (
                              <button
                                key={tag}
                                onClick={() => handleTagsChange([...(reportConfig.tags || []), tag])}
                                disabled={reportConfig.tags?.includes(tag)}
                                className={cn(
                                  'w-full text-left px-3 py-2 text-sm rounded-md transition-colors',
                                  reportConfig.tags?.includes(tag)
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'hover:bg-gray-50 text-gray-700'
                                )}
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Selected Tags */}
                        {reportConfig.tags && reportConfig.tags.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-gray-700">Selected Tags:</h4>
                            <div className="flex flex-wrap gap-2">
                              {reportConfig.tags.map((tagName) => (
                                <div
                                  key={tagName}
                                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary-100 text-primary-800 border border-primary-200"
                                >
                                  <span className="mr-2">{tagName}</span>
                                  <button
                                    onClick={() => handleTagsChange(reportConfig.tags?.filter(tag => tag !== tagName) || [])}
                                    className="ml-1 hover:text-primary-900 focus:outline-none"
                                    aria-label={`Remove ${tagName}`}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Empty state */}
                        {(!reportConfig.tags || reportConfig.tags.length === 0) && (
                          <div className="text-center py-8 text-gray-500">
                            <Tag className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                            <p>No tags selected</p>
                            <p className="text-sm">Select tags from the list above</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Chart Options */}
                    <Card>
                      <CardHeader>
                        <h3 className="text-lg font-medium">Chart Options</h3>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Chart Types
                          </label>
                          <div className="space-y-2">
                            {[
                              { value: 'line', label: 'Line Chart' },
                              { value: 'bar', label: 'Bar Chart' },
                              { value: 'trend', label: 'Trend Analysis' },
                            ].map((option) => (
                              <label key={option.value} className="flex items-center">
                                <input
                                  type="checkbox"
                                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                  checked={reportConfig.chartTypes?.includes(option.value as any) || false}
                                  onChange={(e) => {
                                    const chartTypes = reportConfig.chartTypes || [];
                                    if (e.target.checked) {
                                      setReportConfig(prev => ({
                                        ...prev,
                                        chartTypes: [...chartTypes, option.value as any],
                                      }));
                                    } else {
                                      setReportConfig(prev => ({
                                        ...prev,
                                        chartTypes: chartTypes.filter(type => type !== option.value),
                                      }));
                                    }
                                  }}
                                />
                                <span className="ml-2 text-sm text-gray-700">
                                  {option.label}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Real-time data controls */}
                        <div className="border-t pt-4">
                          <div className="space-y-3">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                checked={realTimeEnabled}
                                onChange={(e) => setRealTimeEnabled(e.target.checked)}
                                disabled={!reportConfig.tags?.length}
                              />
                              <span className="ml-2 text-sm text-gray-700">
                                Enable Real-time Updates
                              </span>
                            </label>

                            {realTimeEnabled && (
                              <div className="ml-6 space-y-2 text-sm text-gray-600">
                                <div className="flex items-center justify-between">
                                  <span>Status:</span>
                                  <span className={cn(
                                    "font-medium",
                                    realTimeData.connected ? "text-green-600" :
                                      realTimeData.loading ? "text-yellow-600" : "text-red-600"
                                  )}>
                                    {realTimeData.loading ? 'Connecting...' :
                                      realTimeData.connected ? 'Connected' : 'Disconnected'}
                                  </span>
                                </div>

                                {realTimeData.lastUpdate && (
                                  <div className="flex items-center justify-between">
                                    <span>Last Update:</span>
                                    <span>{realTimeData.lastUpdate.toLocaleTimeString()}</span>
                                  </div>
                                )}

                                {realTimeData.error && (
                                  <div className="text-red-600 text-xs">
                                    Error: {realTimeData.error}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card>
                    <CardHeader>
                      <h3 className="text-lg font-medium">Version History</h3>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8 text-gray-500">
                        <History className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>Version history coming soon</p>
                        <p className="text-sm">Track changes to your report configurations</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4">
              <Button
                onClick={handleGenerateReport}
                disabled={
                  !reportConfig.name ||
                  !reportConfig.tags?.length ||
                  isLoading ||
                  (reportConfig.timeRange?.startTime &&
                    reportConfig.timeRange?.endTime &&
                    reportConfig.timeRange.startTime > reportConfig.timeRange.endTime)
                }
                loading={isLoading}
              >
                <Download className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
            </div>

            {/* Report Preview */}
            {reportConfig.name && reportConfig.tags?.length && (
              <div className="mt-8">
                <ReportPreview
                  config={{
                    id: 'preview',
                    name: reportConfig.name,
                    description: reportConfig.description || '',
                    tags: reportConfig.tags,
                    timeRange: reportConfig.timeRange!,
                    chartTypes: reportConfig.chartTypes as any[],
                    template: reportConfig.template || 'default'
                  }}
                  onGenerate={handleGenerateReport}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">My Reports</h2>
                <p className="text-gray-600">
                  Manage your saved report configurations and generated reports.
                </p>
              </div>
              <div className="flex items-center space-x-4">
                {/* Temporarily disabled loading indicator
                {reportsLoading && (
                  <div className="flex items-center space-x-2 text-blue-600">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Loading reports...</span>
                  </div>
                )}
                */}
                <Button onClick={() => setActiveTab('create')}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Report
                </Button>
              </div>
            </div>

            {/* Temporarily disabled error display
            {reportsError && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <div>
                      <h4 className="font-medium text-red-800">Failed to load reports</h4>
                      <p className="text-sm text-red-700">{reportsError.message}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            */}

            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-6 text-center text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No reports yet</p>
                <p>Create your first report to get started</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Categories & Tags</h2>
                <p className="text-gray-600">
                  Organize your reports with categories and tags for better management.
                </p>
              </div>
              {/* Temporarily disabled loading indicator
              {tagsLoading && (
                <div className="flex items-center space-x-2 text-blue-600">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Loading tags...</span>
                </div>
              )}
              */}
            </div>

            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-6 text-center text-gray-500">
                <Tag className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">Categories coming soon</p>
                <p>Organize your tags and reports with custom categories</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'schedules' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Scheduled Reports</h2>
                <p className="text-gray-600">
                  Manage automated report generation and delivery schedules.
                </p>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Schedule
              </Button>
            </div>

            {/* Schedules List */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-6 text-center text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No schedules configured</p>
                <p>Set up automated report generation to receive regular updates</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'database' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Database Configuration</h2>
                <p className="text-gray-600">
                  Manage your AVEVA Historian database connections.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-6 text-center text-gray-500">
                <Database className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">Database configuration</p>
                <p>Current connection: {healthStatus}</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};