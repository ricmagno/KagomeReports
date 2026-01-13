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
import { ReportConfig, TagInfo } from '../../types/api';
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

        // Try to parse JSON regardless of status code, as 503 might contain health info
        let data: any = {};
        try {
          data = await response.json();
        } catch (e) {
          // If JSON parsing fails, we'll rely on status code
        }

        if (response.ok || response.status === 503) {
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
          } else if (data.status) {
            // Fallback for other status messages
            setHealthStatus(`❌ Backend Connected - Database: ${data.status} (${data.connection?.state || 'unknown'})`);
          } else {
            setHealthStatus(`❌ Backend error - Status: ${response.status}`);
          }
        } else {
          // If detailed check fails hard (not 503), try basic check
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
  const [tagSearchTerm, setTagSearchTerm] = useState('');
  const [availableTags, setAvailableTags] = useState<TagInfo[]>([]);

  // Fetch tags from API when search term changes
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await apiService.getTags(tagSearchTerm);
        if (response.success && response.data) {
          setAvailableTags(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch tags:', error);
      }
    };

    const debounceTimer = setTimeout(() => {
      fetchTags();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [tagSearchTerm]);
  const [realTimeData] = useState({
    connected: false,
    loading: false,
    lastUpdate: null as Date | null,
    error: null as string | null
  });

  const handleTagsChange = (tags: string[]) => {
    setReportConfig(prev => ({ ...prev, tags }));
  };

  const handleGenerateReport = async () => {
    try {
      setIsLoading(true);
      // Mock report generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('Generating report with config:', reportConfig);
      setActiveTab('reports');
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("min-h-screen bg-gray-50", className)}>
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-6 w-6 text-primary-600" />
            <span className="text-xl font-bold text-gray-900">Historian Reports</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className={`text-sm px-3 py-1 rounded-full ${healthStatus.includes('✅') ? 'bg-green-100 text-green-800' :
              healthStatus.includes('⚠️') ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
              }`}>
              {healthStatus}
            </div>
            {isAuthenticated && (
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            )}
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        {!isAuthenticated ? (
          <div className="max-w-md mx-auto mt-20">
            <Card>
              <CardHeader>
                <h2 className="text-2xl font-bold text-center">Login</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <Input
                    value={loginForm.username}
                    onChange={e => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <Input
                    type="password"
                    value={loginForm.password}
                    onChange={e => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  />
                </div>
                <Button className="w-full" onClick={handleLogin} loading={loginLoading}>
                  <LogIn className="h-4 w-4 mr-2" />
                  Login
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <div className="mb-6 flex space-x-2 border-b border-gray-200 overflow-x-auto">
              {[
                { id: 'create', label: 'Create Report', icon: Plus },
                { id: 'reports', label: 'My Reports', icon: FileText },
                { id: 'schedules', label: 'Schedules', icon: Calendar },
                { id: 'categories', label: 'Categories', icon: Tag },
                { id: 'database', label: 'Database', icon: Database },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "flex items-center px-4 py-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors",
                    activeTab === tab.id
                      ? "border-primary-600 text-primary-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  )}
                >
                  <tab.icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'create' && (
              <div className="space-y-6">
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setShowVersionHistory(!showVersionHistory)}>
                    <History className="h-4 w-4 mr-2" />
                    {showVersionHistory ? 'Back to Editor' : 'Version History'}
                  </Button>
                </div>

                {!showVersionHistory ? (
                  <>
                    <Card>
                      <CardHeader>
                        <h3 className="text-lg font-medium">Report Configuration</h3>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">Report Name</label>
                          <Input
                            placeholder="Enter report name..."
                            value={reportConfig.name}
                            onChange={e => setReportConfig(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">Description</label>
                          <Input
                            placeholder="Optional description..."
                            value={reportConfig.description}
                            onChange={e => setReportConfig(prev => ({ ...prev, description: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">Time Range</label>
                          <TimeRangePicker
                            value={reportConfig.timeRange!}
                            onChange={range => setReportConfig(prev => ({ ...prev, timeRange: range }))}
                          />
                        </div>
                        {/* Search Tags */}
                        <div className="space-y-2">
                          <Input
                            placeholder="Search tags..."
                            value={tagSearchTerm}
                            onChange={(e) => setTagSearchTerm(e.target.value)}
                          />
                        </div>

                        {/* Available Tags */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-700">Available Tags:</h4>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {availableTags
                              .filter(tag => tag.name.toLowerCase().includes(tagSearchTerm.toLowerCase()) ||
                                tag.description.toLowerCase().includes(tagSearchTerm.toLowerCase()))
                              .map((tag) => (
                                <button
                                  key={tag.name}
                                  onClick={() => handleTagsChange([...(reportConfig.tags || []), tag.name])}
                                  disabled={reportConfig.tags?.includes(tag.name)}
                                  className={cn(
                                    'w-full text-left px-3 py-2 text-sm rounded-md transition-colors',
                                    reportConfig.tags?.includes(tag.name)
                                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                      : 'hover:bg-gray-50 text-gray-700'
                                  )}
                                >
                                  <div className="flex flex-col">
                                    <span className="font-medium">{tag.name}</span>
                                    {tag.description && (
                                      <span className="text-xs text-gray-500 truncate">{tag.description}</span>
                                    )}
                                  </div>
                                </button>
                              ))}
                            {availableTags.filter(tag => tag.name.toLowerCase().includes(tagSearchTerm.toLowerCase()) ||
                              tag.description.toLowerCase().includes(tagSearchTerm.toLowerCase())).length === 0 && (
                                <div className="px-3 py-2 text-sm text-gray-500 italic">No tags found</div>
                              )}
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
                {
                  reportConfig.name && reportConfig.tags?.length && (
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
                  )
                }
              </div>
            )}

            {
              activeTab === 'reports' && (
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
              )
            }

            {
              activeTab === 'categories' && (
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
              )
            }

            {
              activeTab === 'schedules' && (
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
              )
            }

            {
              activeTab === 'database' && (
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
              )
            }
          </>
        )}
      </main>
    </div>
  );
};