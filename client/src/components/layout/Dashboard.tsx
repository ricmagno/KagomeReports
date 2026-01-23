import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  FileText,
  Calendar,
  Download,
  Plus,
  Save,
  History,
  Tag,
  Database,
  LogIn,
  LogOut,
  Activity,
  Users,
  Trash2
} from 'lucide-react';
import { ReportConfig, TagInfo, ReportVersion } from '../../types/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { TimeRangePicker } from '../forms/TimeRangePicker';
import { ReportPreview } from '../reports/ReportPreview';
import { VersionHistory } from '../reports/VersionHistory';
import { SpecificationLimitsConfig } from '../reports/SpecificationLimitsConfig';
import { AnalyticsOptions } from '../reports/AnalyticsOptions';
import { ExportImportControls } from '../reports/ExportImportControls';
import { StatusDashboard } from '../status/StatusDashboard';
import { SchedulesList, SchedulesErrorBoundary } from '../schedules';
import { UserManagement } from '../users';
import { apiService, getAuthToken, setAuthToken } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../ui/ToastContainer';
import { cn } from '../../utils/cn';

interface DashboardProps {
  className?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ className }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'reports' | 'schedules' | 'categories' | 'database' | 'status' | 'users'>('create');
  const [healthStatus, setHealthStatus] = useState<string>('checking...');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loginForm, setLoginForm] = useState({ username: 'admin', password: 'admin123' });
  const [loginLoading, setLoginLoading] = useState(false);
  const { toasts, removeToast, success, error: toastError, warning, info } = useToast();
  const [reportConfig, setReportConfig] = useState<Partial<ReportConfig>>({
    name: '',
    description: '',
    tags: [],
    timeRange: {
      startTime: new Date(Date.now() - 60 * 60 * 1000), // Default: 1 hour ago
      endTime: new Date(),   // Default: Current time
      relativeRange: 'last1h',
    },
    chartTypes: ['line'],
    template: 'default',
    version: undefined, // Track version number
    // Advanced analytics options (default to true)
    includeTrendLines: true,
    includeSPCCharts: true,
    includeStatsSummary: true,
    specificationLimits: {},
  });
  const [savedConfig, setSavedConfig] = useState<Partial<ReportConfig> | null>(null);

  // Compare current config with saved config to detect changes
  const hasChanges = React.useMemo(() => {
    if (!savedConfig) return !!(reportConfig.name || (reportConfig.tags && reportConfig.tags.length > 0));

    // Basic fields comparison
    if (reportConfig.name !== savedConfig.name) return true;
    if (reportConfig.description !== savedConfig.description) return true;
    if (reportConfig.template !== savedConfig.template) return true;
    if (reportConfig.includeTrendLines !== savedConfig.includeTrendLines) return true;
    if (reportConfig.includeSPCCharts !== savedConfig.includeSPCCharts) return true;
    if (reportConfig.includeStatsSummary !== savedConfig.includeStatsSummary) return true;

    // Array comparisons (tags, chartTypes)
    if (JSON.stringify(reportConfig.tags?.sort()) !== JSON.stringify(savedConfig.tags?.sort())) return true;
    if (JSON.stringify(reportConfig.chartTypes?.sort()) !== JSON.stringify(savedConfig.chartTypes?.sort())) return true;

    // Nested object comparison (specificationLimits)
    if (JSON.stringify(reportConfig.specificationLimits) !== JSON.stringify(savedConfig.specificationLimits)) return true;

    // Time range comparison
    const tr1 = reportConfig.timeRange;
    const tr2 = savedConfig.timeRange;
    if (tr1?.relativeRange !== tr2?.relativeRange) return true;
    if (tr1?.startTime.getTime() !== new Date(tr2?.startTime || 0).getTime()) return true;
    if (tr1?.endTime.getTime() !== new Date(tr2?.endTime || 0).getTime()) return true;

    return false;
  }, [reportConfig, savedConfig]);

  // Health check with polling for reconnection countdown
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const checkHealth = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

        const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3000/api'}/health/historian`, {
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
            const basicResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3000/api'}/health`, {
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
  const [selectedReportForHistory, setSelectedReportForHistory] = useState<{ id: string; name: string } | null>(null);
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

  const [savedReports, setSavedReports] = useState<Array<{
    id: string;
    name: string;
    description: string;
    version: number;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    isLatestVersion: boolean;
    totalVersions: number;
  }>>([]);
  const [savedReportsLoading, setSavedReportsLoading] = useState(false);

  const handleTagsChange = (tags: string[]) => {
    setReportConfig(prev => ({ ...prev, tags }));
  };

  // Validate specification limits
  const hasSpecificationLimitErrors = (): boolean => {
    if (!reportConfig.specificationLimits || !reportConfig.includeSPCCharts) {
      return false;
    }

    for (const [tagName, limits] of Object.entries(reportConfig.specificationLimits)) {
      if (limits.lsl !== undefined && limits.usl !== undefined) {
        if (limits.usl <= limits.lsl) {
          return true;
        }
      }
    }

    return false;
  };

  const handleGenerateReport = async () => {
    if (!reportConfig.name || !reportConfig.tags?.length) {
      alert('Please provide a report name and select at least one tag');
      return;
    }

    try {
      setIsLoading(true);

      // Prepare report generation request
      const generateRequest = {
        name: reportConfig.name,
        description: reportConfig.description || '',
        tags: reportConfig.tags,
        timeRange: {
          startTime: reportConfig.timeRange!.startTime.toISOString(),
          endTime: reportConfig.timeRange!.endTime.toISOString(),
          relativeRange: reportConfig.timeRange!.relativeRange
        },
        chartTypes: reportConfig.chartTypes || ['line'],
        template: reportConfig.template || 'default',
        format: 'pdf' as const,
        includeStatistics: true,
        includeTrends: true,
        includeAnomalies: false,
        // Advanced analytics options
        includeTrendLines: reportConfig.includeTrendLines ?? true,
        includeSPCCharts: reportConfig.includeSPCCharts ?? true,
        includeStatsSummary: reportConfig.includeStatsSummary ?? true,
        specificationLimits: reportConfig.specificationLimits || {},
        version: reportConfig.version
      };

      console.log('Generating report with config:', generateRequest);

      const response = await apiService.generateReport(generateRequest);

      if (response.success && response.data) {
        const reportId = response.data.reportId;

        // Show success message
        alert(`Report "${reportConfig.name}" generated successfully! Click OK to download.`);

        // Download the generated report using the API service
        try {
          const blob = await apiService.downloadReport(reportId);

          // Create download link
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${reportConfig.name}_${new Date().toISOString().split('T')[0]}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          console.log('Report downloaded successfully');
        } catch (downloadError) {
          console.error('Failed to download report:', downloadError);
          alert('Report generated but download failed. Please try downloading from the Reports tab.');
        }
      } else {
        alert('Failed to generate report: ' + (response.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('Failed to generate report: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveReport = async () => {
    if (!reportConfig.name || !reportConfig.tags?.length) {
      alert('Please provide a report name and select at least one tag');
      return;
    }

    try {
      setIsLoading(true);

      const saveRequest = {
        name: reportConfig.name,
        description: reportConfig.description || '',
        config: {
          name: reportConfig.name,
          description: reportConfig.description || '',
          tags: reportConfig.tags,
          timeRange: reportConfig.timeRange!,
          chartTypes: reportConfig.chartTypes || ['line'],
          template: reportConfig.template || 'default',
          // Advanced analytics options
          includeTrendLines: reportConfig.includeTrendLines ?? true,
          includeSPCCharts: reportConfig.includeSPCCharts ?? true,
          includeStatsSummary: reportConfig.includeStatsSummary ?? true,
          specificationLimits: reportConfig.specificationLimits || {}
        }
      };

      const response = await apiService.saveReport(saveRequest);

      if (response.success) {
        // Update the version in the current config
        setReportConfig(prev => ({
          ...prev,
          version: response.data.version
        }));
        alert(`Report "${reportConfig.name}" saved successfully as version ${response.data.version}`);
        console.log('Report saved:', response.data);
        // Refresh saved reports list if we're on the reports tab
        if (activeTab === 'reports') {
          loadSavedReports();
        }
        // Update savedConfig to current state after successful save
        setSavedConfig({ ...reportConfig, version: response.data.version });
      } else {
        alert('Failed to save report: ' + response.data);
      }
    } catch (error) {
      console.error('Failed to save report:', error);
      alert('Failed to save report: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const loadSavedReports = async () => {
    try {
      setSavedReportsLoading(true);
      const response = await apiService.getSavedReports();
      if (response.success && response.data) {
        setSavedReports(response.data);
      }
    } catch (error) {
      console.error('Failed to load saved reports:', error);
    } finally {
      setSavedReportsLoading(false);
    }
  };

  const handleLoadReport = async (reportId: string) => {
    try {
      setIsLoading(true);
      const response = await apiService.loadSavedReport(reportId);
      if (response.success && response.data) {
        const loadedReport = response.data;
        setReportConfig({
          name: loadedReport.config.name,
          description: loadedReport.config.description,
          tags: loadedReport.config.tags,
          timeRange: {
            ...loadedReport.config.timeRange,
            startTime: new Date(loadedReport.config.timeRange.startTime),
            endTime: new Date(loadedReport.config.timeRange.endTime)
          },
          chartTypes: loadedReport.config.chartTypes,
          template: loadedReport.config.template,
          version: loadedReport.version, // Set the version number
          // Advanced analytics options
          includeTrendLines: loadedReport.config.includeTrendLines ?? true,
          includeSPCCharts: loadedReport.config.includeSPCCharts ?? true,
          includeStatsSummary: loadedReport.config.includeStatsSummary ?? true,
          specificationLimits: loadedReport.config.specificationLimits || {}
        });
        setSavedConfig(response.data.config);
        setActiveTab('create');
        alert(`Report "${loadedReport.name}" loaded successfully`);
      }
    } catch (error) {
      console.error('Failed to load report:', error);
      alert('Failed to load report: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowVersionHistory = (reportId: string, reportName: string) => {
    setSelectedReportForHistory({ id: reportId, name: reportName });
  };

  const handleVersionLoad = (versionInfo: ReportVersion) => {
    setReportConfig({
      name: versionInfo.config.name,
      description: versionInfo.config.description,
      tags: versionInfo.config.tags,
      timeRange: {
        ...versionInfo.config.timeRange!,
        startTime: new Date(versionInfo.config.timeRange!.startTime),
        endTime: new Date(versionInfo.config.timeRange!.endTime)
      },
      chartTypes: versionInfo.config.chartTypes,
      template: versionInfo.config.template,
      version: versionInfo.version, // Set the version number
      // Advanced analytics options
      includeTrendLines: versionInfo.config.includeTrendLines ?? true,
      includeSPCCharts: versionInfo.config.includeSPCCharts ?? true,
      includeStatsSummary: versionInfo.config.includeStatsSummary ?? true,
      specificationLimits: versionInfo.config.specificationLimits || {}
    });
    setSavedConfig(versionInfo.config);
    setSelectedReportForHistory(null);
    setActiveTab('create');
    alert(`Version ${versionInfo.version} loaded successfully`);
  };

  /**
   * Handle import completion from ExportImportControls
   * Populates the form with imported configuration
   */
  const handleImportComplete = (importedConfig: ReportConfig) => {
    // Map imported config to form state
    setReportConfig({
      name: importedConfig.name,
      description: importedConfig.description,
      tags: importedConfig.tags,
      timeRange: {
        startTime: new Date(importedConfig.timeRange.startTime),
        endTime: new Date(importedConfig.timeRange.endTime),
        relativeRange: importedConfig.timeRange.relativeRange,
      },
      chartTypes: importedConfig.chartTypes,
      template: importedConfig.template,
      version: undefined, // Clear version since this is an imported config (not saved yet)
      // Advanced analytics options
      includeTrendLines: importedConfig.includeTrendLines ?? true,
      includeSPCCharts: importedConfig.includeSPCCharts ?? true,
      includeStatsSummary: importedConfig.includeStatsSummary ?? true,
      specificationLimits: importedConfig.specificationLimits || {},
    });

    // Clear saved config since this is a new imported configuration
    setSavedConfig(null);

    // Switch to create tab if not already there
    if (activeTab !== 'create') {
      setActiveTab('create');
    }
  };

  /**
   * Handle export report configuration
   * Opens format selection dialog for the selected report
   */
  const handleExportReport = async (report: any) => {
    try {
      // Load the full report configuration first
      const reportResponse = await apiService.getReportVersion(report.id, report.version);
      const fullConfig = reportResponse.data.config;

      // Export the configuration
      const { blob, filename } = await apiService.exportConfiguration(fullConfig, 'json');

      // Trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      success('Export successful', `Report "${report.name}" has been exported`);
    } catch (err: any) {
      console.error('Export error:', err);
      toastError('Export failed', err.response?.data?.message || 'Failed to export report configuration');
    }
  };

  /**
   * Handle delete report
   * Confirms and deletes the selected report
   */
  const handleDeleteReport = async (reportId: string, reportName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${reportName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setIsLoading(true);
      await apiService.deleteReport(reportId);
      
      // Reload saved reports list
      await loadSavedReports();
      
      success('Report deleted', `"${reportName}" has been deleted successfully`);
    } catch (err: any) {
      console.error('Delete error:', err);
      toastError('Delete failed', err.response?.data?.message || 'Failed to delete report');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToast = (type: 'success' | 'error' | 'warning' | 'info', message: string, description?: string) => {
    switch (type) {
      case 'success': success(message, description); break;
      case 'error': toastError(message, description); break;
      case 'warning': warning(message, description); break;
      case 'info': info(message, description); break;
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
                { id: 'status', label: 'Status', icon: Activity },
                { id: 'database', label: 'Database', icon: Database },
                ...(currentUser?.role === 'admin' ? [{ id: 'users', label: 'Users', icon: Users }] : []),
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    if (tab.id === 'reports') {
                      loadSavedReports();
                    }
                  }}
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
                {!showVersionHistory ? (
                  <>
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-medium">Report Configuration</h3>
                          <div className="flex items-center gap-3">
                            {/* Export/Import Controls */}
                            <ExportImportControls
                              currentConfig={reportConfig as ReportConfig}
                              onImportComplete={handleImportComplete}
                              onToast={handleToast}
                              disabled={false}
                            />
                            {/* Version Indicator */}
                            <div className={cn(
                              "px-3 py-1 rounded-full text-sm font-medium",
                              reportConfig.version
                                ? "bg-blue-100 text-blue-800 border border-blue-200"
                                : "bg-green-100 text-green-800 border border-green-200"
                            )}>
                              {reportConfig.version ? `Version ${reportConfig.version}` : 'New'}
                            </div>
                          </div>
                        </div>
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

                        {/* Retrieval Mode */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Retrieval Mode
                          </label>
                          <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            value={reportConfig.retrievalMode || 'Delta'}
                            onChange={(e) => setReportConfig(prev => ({ ...prev, retrievalMode: e.target.value as 'Delta' | 'Cyclic' | 'AVG' | 'RoundTrip' }))}
                          >
                            <option value="Delta">Delta - Actual stored values</option>
                            <option value="Cyclic">Cyclic - Interpolated at intervals</option>
                            <option value="AVG">AVG - Average values</option>
                            <option value="RoundTrip">RoundTrip - Round trip values</option>
                          </select>
                          <p className="text-xs text-gray-500">
                            Delta mode returns actual stored values (recommended for most cases)
                          </p>
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
                                (tag.description || '').toLowerCase().includes(tagSearchTerm.toLowerCase()))
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

                    {/* Advanced Analytics Options */}
                    <Card>
                      <CardHeader>
                        <h3 className="text-lg font-medium">Advanced Analytics</h3>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <AnalyticsOptions
                          includeTrendLines={reportConfig.includeTrendLines}
                          includeSPCCharts={reportConfig.includeSPCCharts}
                          includeStatsSummary={reportConfig.includeStatsSummary}
                          onIncludeTrendLinesChange={(value) =>
                            setReportConfig(prev => ({ ...prev, includeTrendLines: value }))
                          }
                          onIncludeSPCChartsChange={(value) =>
                            setReportConfig(prev => ({ ...prev, includeSPCCharts: value }))
                          }
                          onIncludeStatsSummaryChange={(value) =>
                            setReportConfig(prev => ({ ...prev, includeStatsSummary: value }))
                          }
                          disabled={!reportConfig.tags?.length}
                        />
                      </CardContent>
                    </Card>

                    {/* Specification Limits Configuration */}
                    {reportConfig.tags && reportConfig.tags.length > 0 && reportConfig.includeSPCCharts && (
                      <Card>
                        <CardHeader>
                          <h3 className="text-lg font-medium">Specification Limits</h3>
                          <p className="text-sm text-gray-600 mt-1">
                            Configure specification limits for SPC analysis
                          </p>
                        </CardHeader>
                        <CardContent>
                          <SpecificationLimitsConfig
                            tags={reportConfig.tags}
                            specificationLimits={reportConfig.specificationLimits}
                            onChange={(limits) =>
                              setReportConfig(prev => ({ ...prev, specificationLimits: limits }))
                            }
                          />
                        </CardContent>
                      </Card>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <History className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">Version history is available for saved reports</p>
                    <p className="text-sm">Save this report first, then view its version history from the My Reports tab</p>
                  </div>
                )}


                {/* Action Buttons */}
                <div className="flex justify-end space-x-4">
                  <Button
                    variant="outline"
                    onClick={handleSaveReport}
                    disabled={
                      !reportConfig.name ||
                      !reportConfig.tags?.length ||
                      isLoading ||
                      hasSpecificationLimitErrors() ||
                      (reportConfig.timeRange?.startTime &&
                        reportConfig.timeRange?.endTime &&
                        reportConfig.timeRange.startTime > reportConfig.timeRange.endTime) ||
                      !hasChanges
                    }
                    loading={isLoading}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Report
                  </Button>
                  <Button
                    onClick={handleGenerateReport}
                    disabled={
                      !reportConfig.name ||
                      !reportConfig.tags?.length ||
                      isLoading ||
                      hasSpecificationLimitErrors() ||
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
                          template: reportConfig.template || 'default',
                          retrievalMode: reportConfig.retrievalMode || 'Delta'
                        }}
                      />
                    </div>
                  )
                }
              </div>
            )}

            {
              activeTab === 'reports' && (
                <div className="space-y-6">
                  {selectedReportForHistory ? (
                    <VersionHistory
                      reportId={selectedReportForHistory.name}
                      reportName={selectedReportForHistory.name}
                      onClose={() => setSelectedReportForHistory(null)}
                      onVersionLoad={handleVersionLoad}
                    />
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-3xl font-bold text-gray-900">My Reports</h2>
                          <p className="text-gray-600">
                            Manage your saved report configurations and generated reports.
                          </p>
                        </div>
                        <div className="flex items-center space-x-4">
                          {savedReportsLoading && (
                            <div className="flex items-center space-x-2 text-blue-600">
                              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                              <span className="text-sm">Loading reports...</span>
                            </div>
                          )}
                          <Button onClick={() => setActiveTab('create')}>
                            <Plus className="h-4 w-4 mr-2" />
                            New Report
                          </Button>
                        </div>
                      </div>

                      {savedReports.length > 0 ? (
                        <div className="bg-white rounded-lg border border-gray-200">
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Report Name
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Description
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Version
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Created
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {savedReports.map((report) => (
                                  <tr key={report.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="text-sm font-medium text-gray-900">{report.name}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                      <div className="text-sm text-gray-500 max-w-xs truncate">
                                        {report.description || 'No description'}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="text-sm text-gray-900">v{report.version}</div>
                                      {report.totalVersions > 1 && (
                                        <div className="text-xs text-gray-500">
                                          {report.totalVersions} versions
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="text-sm text-gray-500">
                                        {new Date(report.createdAt).toLocaleDateString()}
                                      </div>
                                      <div className="text-xs text-gray-400">
                                        by {report.createdBy}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                      <div className="flex space-x-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleLoadReport(report.id)}
                                          disabled={isLoading}
                                        >
                                          Load
                                        </Button>
                                        {report.totalVersions > 1 && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleShowVersionHistory(report.id, report.name)}
                                          >
                                            <History className="h-4 w-4 mr-1" />
                                            History
                                          </Button>
                                        )}
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleExportReport(report)}
                                          disabled={isLoading}
                                          title="Export report configuration"
                                        >
                                          <Download className="h-4 w-4 mr-1" />
                                          Export
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteReport(report.id, report.name)}
                                          disabled={isLoading}
                                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                          title="Delete report"
                                        >
                                          <Trash2 className="h-4 w-4 mr-1" />
                                          Delete
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white rounded-lg border border-gray-200">
                          <div className="p-6 text-center text-gray-500">
                            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                            <p className="text-lg font-medium">No reports yet</p>
                            <p>Create your first report to get started</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
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
                <SchedulesErrorBoundary>
                  <SchedulesList />
                </SchedulesErrorBoundary>
              )
            }

            {
              activeTab === 'status' && (
                <StatusDashboard />
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

            {
              activeTab === 'users' && currentUser?.role === 'admin' && (
                <UserManagement />
              )
            }
          </>
        )}
      </main>
      <ToastContainer toasts={toasts} onClose={id => removeToast(id)} />
    </div>
  );
};