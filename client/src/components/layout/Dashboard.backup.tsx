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
  Database
} from 'lucide-react';
import { ReportConfig, TimeRange } from '../../types/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { TimeRangePicker } from '../forms/TimeRangePicker';
import { TagSelector } from '../forms/TagSelector';
import { ReportVersionHistoryComponent } from '../forms/ReportVersionHistory';
import { VersionComparison } from '../forms/VersionComparison';
import { DatabaseConfigManager } from '../forms/DatabaseConfigManager';
import { ReportPreview } from '../reports/ReportPreview';
import { ReportManager } from '../reports/ReportManager';
import { ReportCategories, Category, TagInfo } from '../reports/ReportCategories';
import { useVersionControl } from '../../hooks/useVersionControl';
import { apiService } from '../../services/api';
import { useApi, usePaginatedApi } from '../../hooks/useApi';
import { useRealTimeData, useDataRefresh } from '../../hooks/useRealTimeData';
import { cn } from '../../utils/cn';

interface DashboardProps {
  className?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ className }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'reports' | 'schedules' | 'categories' | 'database'>('create');
  const [healthStatus, setHealthStatus] = useState<string>('checking...');
  const [reportConfig, setReportConfig] = useState<Partial<ReportConfig>>({
    name: '',
    description: '',
    tags: [],
    timeRange: {
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
      endTime: new Date(),
      relativeRange: 'last24h',
    },
    chartTypes: ['line'],
    template: 'default',
  });

  // Simple health check without using the complex API hooks
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/health');
        if (response.ok) {
          const data = await response.json();
          setHealthStatus(`✅ Backend connected - Status: ${data.status}`);
        } else {
          setHealthStatus(`❌ Backend error - Status: ${response.status}`);
        }
      } catch (error) {
        setHealthStatus(`❌ Backend connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };
    
    checkHealth();
  }, []);

  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showVersionComparison, setShowVersionComparison] = useState(false);
  const [comparisonVersions, setComparisonVersions] = useState<any>(null);
  const [saveDescription, setSaveDescription] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [realTimeEnabled, setRealTimeEnabled] = useState(false);

  // Temporarily disable complex API hooks to avoid authentication issues
  /*
  // API hooks for data management
  const {
    data: reportsData,
    loading: reportsLoading,
    error: reportsError,
    execute: loadReportsData,
  } = useApi(apiService.getReports);

  const {
    data: tagsData,
    loading: tagsLoading,
    execute: loadTagsData,
  } = useApi(apiService.getTags);

  const {
    data: healthData,
    loading: healthLoading,
    execute: checkHealth,
  } = useApi(apiService.checkHealth, {
    immediate: true,
    onError: (error) => {
      console.warn('Health check failed:', error.message);
    },
  });
  */

  // Simple state for now with proper types
  const reportsData: any = null;
  const reportsLoading = false;
  const reportsError: any = null;
  const loadReportsData = () => {};
  const tagsData: any = null;
  const tagsLoading = false;
  const loadTagsData = () => {};
  const healthData: any = null;
  const healthLoading = false;
  const checkHealth = () => {};

  // Real-time data hook
  const realTimeData = useRealTimeData({
    tags: reportConfig.tags || [],
    timeRange: reportConfig.timeRange || {
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endTime: new Date(),
    },
    interval: 30, // 30 seconds
    enabled: realTimeEnabled && (reportConfig.tags?.length || 0) > 0,
  });

  // Data refresh hook for periodic updates
  const dataRefresh = useDataRefresh(
    async () => {
      // Temporarily disabled
      /*
      await Promise.all([
        loadReportsData(),
        loadTagsData(),
        checkHealth(),
      ]);
      */
    },
    60000, // 1 minute
    { enabled: !realTimeEnabled }
  );

  // Version control hook
  const versionControl = useVersionControl({
    reportId: reportConfig.id || 'new-report',
    onVersionChange: (version) => {
      console.log('Version created:', version);
      setReportConfig(version.config);
    },
    onRollback: (version) => {
      console.log('Rolled back to version:', version);
      setReportConfig(version.config);
    },
  });

  // Check for unsaved changes when config changes
  useEffect(() => {
    if (reportConfig.name) {
      versionControl.checkUnsavedChanges(reportConfig as ReportConfig);
    }
  }, [reportConfig, versionControl]);

  // Load initial data
  useEffect(() => {
    // Temporarily disabled API calls
    /*
    loadReportsData();
    loadCategories();
    loadTagsData();
    */
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

  const loadReports = async () => {
    try {
      setIsLoading(true);
      // Temporarily disabled
      // await loadReportsData();
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      // Mock categories for now - in real implementation, this would be an API call
      const mockCategories: Category[] = [
        {
          id: '1',
          name: 'Production',
          description: 'Production-related reports',
          color: '#3B82F6',
          reportCount: 5,
          createdAt: new Date()
        },
        {
          id: '2',
          name: 'Quality',
          description: 'Quality control and analysis reports',
          color: '#10B981',
          reportCount: 3,
          createdAt: new Date()
        },
        {
          id: '3',
          name: 'Analysis',
          description: 'Trend analysis and forecasting reports',
          color: '#F59E0B',
          reportCount: 2,
          createdAt: new Date()
        }
      ];
      setCategories(mockCategories);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadTags = async () => {
    try {
      // Temporarily disabled
      // await loadTagsData();
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const handleTimeRangeChange = (timeRange: TimeRange) => {
    setReportConfig(prev => ({
      ...prev,
      timeRange,
    }));
  };

  const handleTagsChange = (tags: string[]) => {
    setReportConfig(prev => ({
      ...prev,
      tags,
    }));
  };

  const handleSaveVersion = async () => {
    if (!reportConfig.name) {
      alert('Please enter a report name');
      return;
    }

    try {
      const configToSave = {
        ...reportConfig,
        id: reportConfig.id || `report-${Date.now()}`,
        updatedAt: new Date(),
      } as ReportConfig;

      await versionControl.createVersion(configToSave, saveDescription || undefined);
      setSaveDescription('');
      alert('Version saved successfully!');
    } catch (error) {
      alert('Failed to save version: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleGenerateReport = async () => {
    if (!reportConfig.name || !reportConfig.tags?.length) {
      alert('Please provide a report name and select at least one tag');
      return;
    }

    try {
      setIsLoading(true);
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
      alert('Failed to generate report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveReport = async (config: ReportConfig) => {
    try {
      setIsLoading(true);
      await apiService.saveReport(config);
      // Temporarily disabled
      // await loadReportsData();
      alert('Report saved successfully!');
    } catch (error) {
      console.error('Failed to save report:', error);
      alert('Failed to save report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadReport = (config: ReportConfig) => {
    setReportConfig(config);
    setActiveTab('create');
  };

  const handleDeleteReport = async (reportId: string) => {
    try {
      setIsLoading(true);
      await apiService.deleteReport(reportId);
      // Temporarily disabled
      // await loadReportsData();
      alert('Report deleted successfully!');
    } catch (error) {
      console.error('Failed to delete report:', error);
      alert('Failed to delete report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportReports = (reports: ReportConfig[]) => {
    const dataStr = JSON.stringify(reports, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = window.URL.createObjectURL(dataBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'report-configurations.json';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleImportReports = async (file: File): Promise<ReportConfig[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const configs = JSON.parse(e.target?.result as string);
          // In a real implementation, you would save these to the backend
          resolve(configs);
        } catch (error) {
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const handleCreateCategory = async (category: Omit<Category, 'id' | 'reportCount' | 'createdAt'>) => {
    // Mock implementation - in real app, this would be an API call
    const newCategory: Category = {
      ...category,
      id: Date.now().toString(),
      reportCount: 0,
      createdAt: new Date()
    };
    setCategories(prev => [...prev, newCategory]);
  };

  const handleUpdateCategory = async (id: string, updates: Partial<Category>) => {
    setCategories(prev => prev.map(cat => 
      cat.id === id ? { ...cat, ...updates } : cat
    ));
  };

  const handleDeleteCategory = async (id: string) => {
    setCategories(prev => prev.filter(cat => cat.id !== id));
  };

  const handleCreateTag = async (tagName: string, category?: string) => {
    const newTag: TagInfo = {
      name: tagName,
      count: 0,
      category
    };
    setTags(prev => [...prev, newTag]);
  };

  const handleDeleteTag = async (tagName: string) => {
    setTags(prev => prev.filter(tag => tag.name !== tagName));
  };

  const handleVersionSelect = (version: any) => {
    setReportConfig(version.config);
    setShowVersionHistory(false);
  };

  const handleVersionRollback = async (version: number) => {
    try {
      await versionControl.rollbackToVersion(version);
      alert(`Successfully rolled back to version ${version}`);
    } catch (error) {
      alert('Failed to rollback: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const tabs = [
    { id: 'create', label: 'Create Report', icon: Plus },
    { id: 'reports', label: 'My Reports', icon: FileText },
    { id: 'schedules', label: 'Schedules', icon: Calendar },
    { id: 'categories', label: 'Categories', icon: Tag },
    { id: 'database', label: 'Database Config', icon: Database },
  ] as const;

  const changesSummary = versionControl.getChangesSummary(reportConfig as ReportConfig);

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
              
              {/* Version control indicators */}
              <div className="flex items-center space-x-4">
                {/* Real-time data indicator */}
                {realTimeData.isActive && (
                  <div className="flex items-center space-x-2 text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm">
                      Live Data ({realTimeData.updateCount} updates)
                    </span>
                  </div>
                )}
                
                {/* Data refresh indicator */}
                {dataRefresh.isRefreshing && (
                  <div className="flex items-center space-x-2 text-blue-600">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Refreshing...</span>
                  </div>
                )}
                
                {versionControl.hasUnsavedChanges && (
                  <div className="flex items-center space-x-2 text-warning">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">Unsaved changes</span>
                  </div>
                )}
                
                {versionControl.currentVersion && (
                  <div className="text-sm text-gray-500">
                    Version {versionControl.currentVersion.version}
                  </div>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVersionHistory(!showVersionHistory)}
                >
                  <History className="h-4 w-4 mr-2" />
                  History
                </Button>
              </div>
            </div>

            {/* Unsaved changes summary */}
            {versionControl.hasUnsavedChanges && changesSummary.length > 0 && (
              <Card className="border-warning bg-yellow-50">
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                    <div>
                      <h4 className="font-medium text-warning">Unsaved Changes</h4>
                      <ul className="text-sm text-gray-700 mt-1 space-y-1">
                        {changesSummary.map((change, index) => (
                          <li key={index}>• {change}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

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
                    
                    {/* Save version section */}
                    {versionControl.hasUnsavedChanges && (
                      <div className="border-t pt-4">
                        <Input
                          label="Change Description (Optional)"
                          placeholder="Describe what changed in this version..."
                          value={saveDescription}
                          onChange={(e) => setSaveDescription(e.target.value)}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <TimeRangePicker
                  value={reportConfig.timeRange!}
                  onChange={handleTimeRangeChange}
                />
              </div>

              {/* Tag Selection and Version History */}
              <div className="space-y-6">
                {!showVersionHistory ? (
                  <>
                    <TagSelector
                      selectedTags={reportConfig.tags || []}
                      onChange={handleTagsChange}
                    />

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
                  <ReportVersionHistoryComponent
                    reportId={reportConfig.id || 'new-report'}
                    currentConfig={reportConfig as ReportConfig}
                    onVersionSelect={handleVersionSelect}
                    onRollback={handleVersionRollback}
                  />
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4">
              {versionControl.hasUnsavedChanges && (
                <Button
                  variant="outline"
                  onClick={handleSaveVersion}
                  disabled={!reportConfig.name || versionControl.loading}
                  loading={versionControl.loading}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Version
                </Button>
              )}
              
              {/* Manual refresh button */}
              <Button
                variant="outline"
                onClick={dataRefresh.forceRefresh}
                disabled={dataRefresh.isRefreshing || realTimeEnabled}
                loading={dataRefresh.isRefreshing}
              >
                <Download className="h-4 w-4 mr-2" />
                Refresh Data
              </Button>
              
              <Button
                onClick={handleGenerateReport}
                disabled={!reportConfig.name || !reportConfig.tags?.length || isLoading}
                loading={isLoading}
              >
                <Download className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
            </div>

            {/* Report Preview */}
            {reportConfig.name && reportConfig.tags?.length && (
              <div className="mt-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Report Preview</h3>
                <ReportPreview
                  config={{
                    ...reportConfig,
                    name: reportConfig.name || '',
                    description: reportConfig.description || '',
                    tags: reportConfig.tags || [],
                    timeRange: reportConfig.timeRange!,
                    chartTypes: reportConfig.chartTypes || ['line'],
                    template: reportConfig.template || 'default'
                  } as ReportConfig}
                  onGenerate={handleGenerateReport}
                  onEdit={() => {
                    // Already in edit mode
                  }}
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

            <ReportManager
              currentConfig={reportConfig as ReportConfig}
              onSave={handleSaveReport}
              onLoad={handleLoadReport}
              onDelete={handleDeleteReport}
              onNew={() => {
                setReportConfig({
                  name: '',
                  description: '',
                  tags: [],
                  timeRange: {
                    startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    endTime: new Date(),
                    relativeRange: 'last24h',
                  },
                  chartTypes: ['line'],
                  template: 'default',
                });
                setActiveTab('create');
              }}
              onExport={handleExportReports}
              onImport={handleImportReports}
            />
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

            <ReportCategories
              categories={categories}
              tags={tags}
              onCreateCategory={handleCreateCategory}
              onUpdateCategory={handleUpdateCategory}
              onDeleteCategory={handleDeleteCategory}
              onCreateTag={handleCreateTag}
              onDeleteTag={handleDeleteTag}
            />
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
          <DatabaseConfigManager className="space-y-6" />
        )}
      </main>

      {/* Version Comparison Modal */}
      {showVersionComparison && comparisonVersions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <VersionComparison
              version1={comparisonVersions.version1}
              version2={comparisonVersions.version2}
              onClose={() => {
                setShowVersionComparison(false);
                setComparisonVersions(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};