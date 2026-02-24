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
  Trash2,
  Info,
  Settings,
  Menu,
  X,
  ChevronRight
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
import { ChartOptions } from '../reports/ChartOptions';
import { ExportImportControls } from '../reports/ExportImportControls';
import { FormatSelectionDialog, ExportFormat } from '../reports/FormatSelectionDialog';
import { StatusDashboard } from '../status/StatusDashboard';
import { SchedulesList, SchedulesErrorBoundary } from '../schedules';
import { UserManagement } from '../users';
import { ConfigurationManagement } from '../configuration/ConfigurationManagement';
import { AboutSection } from '../about/AboutSection';
import { DashboardList } from '../dashboards/DashboardList';
import { DashboardView } from '../dashboards/DashboardView';
import { DashboardEditor } from '../dashboards/DashboardEditor';
import { apiService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../ui/ToastContainer';
import { cn } from '../../utils/cn';

interface DashboardProps {
  className?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ className }) => {
  const { user, isAuthenticated, login: authLogin, logout: authLogout, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'create' | 'reports' | 'dashboards' | 'schedules' | 'database' | 'users' | 'configuration' | 'about'>('create');
  const [dashboardViewMode, setDashboardViewMode] = useState<'list' | 'view' | 'edit'>('list');
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);
  const [dbActiveTab, setDbActiveTab] = useState<'status' | 'config'>('status');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string>('checking...');
  const [serverTime, setServerTime] = useState<{ local: string, timezone: string } | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
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
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    chartTypes: ['line'],
    template: 'default',
    retrievalMode: 'Delta',
    version: undefined, // Track version number
    // Advanced analytics options (default to true)
    includeTrendLines: true,
    includeMultiTrend: true,
    includeSPCCharts: true,
    includeStatsSummary: true,
    includeDataTable: false,
    specificationLimits: {},
  });
  const [savedConfig, setSavedConfig] = useState<Partial<ReportConfig> | null>(null);
  const reportPreviewRef = React.useRef<import('../reports/ReportPreview').ReportPreviewRef>(null);

  // Compare current config with saved config to detect changes
  const hasChanges = React.useMemo(() => {
    if (!savedConfig) return !!(reportConfig.name || (reportConfig.tags && reportConfig.tags.length > 0));

    // Basic fields comparison
    if (reportConfig.name !== savedConfig.name) return true;
    if (reportConfig.description !== savedConfig.description) return true;
    if (reportConfig.template !== savedConfig.template) return true;
    if (reportConfig.includeTrendLines !== savedConfig.includeTrendLines) return true;
    if (reportConfig.includeMultiTrend !== savedConfig.includeMultiTrend) return true;
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

        const response = await fetch(`${process.env.REACT_APP_API_URL || '/api'}/health/historian`, {
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
          if (data.serverTime) {
            setServerTime({
              local: data.serverTime.local,
              timezone: data.serverTime.timezone
            });
          }
          if (data.status === 'healthy') {
            setHealthStatus('✅ Backend');
          } else if (data.connection && data.connection.state === 'retrying' && data.connection.nextRetry) {
            const nextRetry = new Date(data.connection.nextRetry);
            const now = new Date();
            const diff = Math.ceil((nextRetry.getTime() - now.getTime()) / 1000);
            const seconds = diff > 0 ? diff : 0;
            setHealthStatus(`⚠️ Retry ${seconds}s`);
          } else if (data.connection && data.connection.state === 'connecting') {
            setHealthStatus('⚠️ Connecting...');
          } else if (data.status) {
            setHealthStatus('❌ Backend - DB Offline');
          } else {
            setHealthStatus(`❌ Backend Error`);
          }
        } else {
          // If detailed check fails hard (not 503), try basic check
          const controllerBasic = new AbortController();
          const timeoutBasic = setTimeout(() => controllerBasic.abort(), 1000);

          try {
            const basicResponse = await fetch(`${process.env.REACT_APP_API_URL || '/api'}/health`, {
              signal: controllerBasic.signal
            });
            clearTimeout(timeoutBasic);

            if (basicResponse.ok) {
              setHealthStatus('⚠️ Connecting');
            } else {
              setHealthStatus('❌ Offline');
            }
          } catch (e) {
            setHealthStatus('❌ Offline');
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          setHealthStatus('❌ Timeout');
        } else {
          setHealthStatus('❌ Offline');
        }
      }
    };

    checkHealth();
    intervalId = setInterval(checkHealth, 1000); // Poll every second to update countdown

    return () => clearInterval(intervalId);
  }, []);

  // Use current user from auth hook
  const currentUser = user;

  const handleLogin = async () => {
    if (!loginForm.username || !loginForm.password) {
      alert('Please enter username and password');
      return;
    }

    try {
      setLoginLoading(true);
      await authLogin(loginForm.username, loginForm.password);
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authLogout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [selectedReportForHistory, setSelectedReportForHistory] = useState<{ id: string; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [realTimeEnabled, setRealTimeEnabled] = useState(false);
  const [tagSearchTerm, setTagSearchTerm] = useState('');
  const [availableTags, setAvailableTags] = useState<TagInfo[]>([]);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportingReport, setExportingReport] = useState<any>(null);

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
  const [realTimeData, setRealTimeData] = useState({
    connected: false,
    loading: false,
    lastUpdate: null as Date | null,
    error: null as string | null
  });

  // Real-time update effect
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    if (realTimeEnabled && reportConfig.tags && reportConfig.tags.length > 0) {
      setRealTimeData(prev => ({ ...prev, loading: true, connected: true }));

      timer = setInterval(() => {
        setReportConfig(prev => {
          if (!prev.timeRange) return prev;

          const now = new Date();
          const duration = prev.timeRange.endTime.getTime() - prev.timeRange.startTime.getTime();

          return {
            ...prev,
            timeRange: {
              ...prev.timeRange,
              endTime: now,
              startTime: new Date(now.getTime() - duration)
            }
          };
        });
        setRealTimeData(prev => ({ ...prev, lastUpdate: new Date(), loading: false }));
      }, 5000); // Update every 5 seconds
    } else {
      setRealTimeData(prev => ({ ...prev, connected: false, loading: false }));
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [realTimeEnabled, reportConfig.tags]);

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
      let capturedCharts: Record<string, string> = {};
      try {
        if (reportPreviewRef.current) {
          capturedCharts = await reportPreviewRef.current.getCapturedCharts();
        }
      } catch (e) {
        console.warn('Failed to capture charts for report:', e);
      }

      const generateRequest = {
        name: reportConfig.name,
        description: reportConfig.description || '',
        tags: reportConfig.tags,
        timeRange: reportConfig.timeRange!,
        chartTypes: reportConfig.chartTypes || ['line'],
        template: reportConfig.template || 'default',
        format: 'pdf' as const,
        includeStatistics: true,
        includeTrends: true,
        includeAnomalies: false,
        // Advanced analytics options
        includeTrendLines: reportConfig.includeTrendLines ?? true,
        includeMultiTrend: reportConfig.includeMultiTrend ?? true,
        includeSPCCharts: reportConfig.includeSPCCharts ?? true,
        includeStatsSummary: reportConfig.includeStatsSummary ?? true,
        includeDataTable: reportConfig.includeDataTable ?? false,
        specificationLimits: reportConfig.specificationLimits || {},
        version: reportConfig.version,
        retrievalMode: reportConfig.retrievalMode || 'Delta',
        charts: Object.keys(capturedCharts).length > 0 ? capturedCharts : undefined
      };

      console.log('Generating report with config:', generateRequest);

      const response = await apiService.generateReport(generateRequest);

      if (response.success && response.data) {
        const reportId = response.data.reportId;

        // Show success message
        alert(`Report "${reportConfig.name}" generated successfully! Click OK to download.`);

        // Download the generated report using the API service
        try {
          const { blob, filename } = await apiService.downloadReport(reportId);

          // Create download link using the server-generated filename
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          console.log('Report downloaded successfully', { filename });
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
          includeMultiTrend: reportConfig.includeMultiTrend ?? true,
          includeSPCCharts: reportConfig.includeSPCCharts ?? true,
          includeStatsSummary: reportConfig.includeStatsSummary ?? true,
          includeDataTable: reportConfig.includeDataTable ?? false,
          specificationLimits: reportConfig.specificationLimits || {},
          retrievalMode: reportConfig.retrievalMode || 'Delta'
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
          includeMultiTrend: loadedReport.config.includeMultiTrend ?? true,
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
      includeMultiTrend: versionInfo.config.includeMultiTrend ?? true,
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
      includeMultiTrend: importedConfig.includeMultiTrend ?? true,
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
   * Opens format selection dialog
   */
  const handleExportReport = (report: any) => {
    setExportingReport(report);
    setShowExportDialog(true);
  };

  /**
   * Handle the actual export after format selection
   */
  const handleConfirmExport = async (format: ExportFormat) => {
    if (!exportingReport) return;

    setShowExportDialog(false);
    setIsLoading(true);

    try {
      // Always load the full report from the API to ensure we have the complete config
      // including tags, chart analytics, and correct date formats
      const reportResponse = await apiService.loadSavedReport(exportingReport.id);

      if (!reportResponse || !reportResponse.success || !reportResponse.data) {
        throw new Error('Failed to load report configuration from server');
      }

      const fullConfig = reportResponse.data.config;

      if (!fullConfig) {
        throw new Error('Report configuration is empty');
      }

      // Export the configuration
      const { blob, filename } = await apiService.exportConfiguration(fullConfig, format);

      // Trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      success('Export successful', `Report "${exportingReport.name}" has been exported`);
    } catch (err: any) {
      console.error('Export error:', err);
      // ApiError has the message from the server in .message
      const errorMessage = err.message || 'Failed to export report configuration';
      toastError('Export failed', errorMessage);
    } finally {
      setIsLoading(false);
      setExportingReport(null);
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
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-6 w-6 text-primary-600" />
              <span className="text-xl font-bold text-gray-900 truncate">Historian Reports</span>
            </div>
            {isAuthenticated && (
              <button
                onClick={() => setActiveTab('about')}
                className={cn(
                  "flex items-center px-3 py-1 text-xs font-medium rounded-full transition-all duration-200",
                  activeTab === 'about'
                    ? "bg-primary-100 text-primary-700 shadow-sm"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                )}
              >
                <Info className="h-3.5 w-3.5 mr-1" />
                About
              </button>
            )}
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <div className={`text-sm px-3 py-1 rounded-full ${healthStatus.includes('✅') ? 'bg-green-100 text-green-800' :
              healthStatus.includes('⚠️') ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
              }`}>
              {healthStatus}
            </div>
            {serverTime && (
              <div className="hidden lg:flex flex-col text-[10px] text-gray-500 leading-tight border-l border-gray-200 pl-4 py-1">
                <span className="font-semibold text-gray-700">Server Time:</span>
                <span className="truncate max-w-[150px]">{serverTime.local}</span>
                <span className="text-[9px] opacity-75">{serverTime.timezone}</span>
              </div>
            )}
            {isAuthenticated && (
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            )}
          </div>

          <div className="md:hidden flex items-center space-x-2">
            <div className={`text-[10px] px-2 py-0.5 rounded-full ${healthStatus.includes('✅') ? 'bg-green-100 text-green-800' :
              healthStatus.includes('⚠️') ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
              }`}>
              {healthStatus.split(' ')[0]}
            </div>
            {isAuthenticated && (
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && isAuthenticated && (
          <div className="md:hidden bg-white border-b border-gray-200 pb-4 px-4 space-y-2">
            {[
              { id: 'create', label: 'Create Report', icon: Plus },
              { id: 'reports', label: 'My Reports', icon: FileText },
              { id: 'dashboards', label: 'Dashboards', icon: Activity },
              { id: 'schedules', label: 'Schedules', icon: Calendar },
              { id: 'categories', label: 'Categories', icon: Tag },
              { id: 'status', label: 'Status', icon: Activity },
              { id: 'database', label: 'Database', icon: Database },
              ...(currentUser?.role === 'admin' ? [{ id: 'configuration', label: 'Configuration', icon: Settings }] : []),
              ...(currentUser?.role === 'admin' ? [{ id: 'users', label: 'Users', icon: Users }] : []),
              { id: 'about', label: 'About', icon: Info },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setIsMobileMenuOpen(false);
                  if (tab.id === 'reports') loadSavedReports();
                }}
                className={cn(
                  "flex items-center w-full px-4 py-3 rounded-md text-base font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-primary-50 text-primary-600"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <tab.icon className="h-5 w-5 mr-3" />
                {tab.label}
              </button>
            ))}
            <div className="pt-4 border-t border-gray-100">
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-3 text-base font-medium text-red-600 hover:bg-red-50 rounded-md"
              >
                <LogOut className="h-5 w-5 mr-3" />
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>

      <main className="container mx-auto px-4 py-4 md:py-8">
        {authLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : !isAuthenticated ? (
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
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <Input
                    type="password"
                    value={loginForm.password}
                    onChange={e => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    autoComplete="new-password"
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
            <div className="hidden md:flex mb-6 space-x-2 border-b border-gray-200 overflow-x-auto">
              {[
                { id: 'create', label: 'Create Report', icon: Plus },
                { id: 'reports', label: 'My Reports', icon: FileText },
                { id: 'dashboards', label: 'Dashboards', icon: Activity },
                { id: 'schedules', label: 'Schedules', icon: Calendar },
                { id: 'database', label: 'Database', icon: Database },
                ...(currentUser?.role === 'admin' ? [{ id: 'configuration', label: 'Configuration', icon: Settings }] : []),
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

            <div className="md:hidden mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 capitalize">
                {activeTab.replace('-', ' ')}
              </h2>
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
                            onChange={(e) => setReportConfig(prev => ({ ...prev, retrievalMode: e.target.value as any }))}
                          >
                            <option value="Delta">Delta - Actual stored values (Changes only - Recommended)</option>
                            <option value="Cyclic">Cyclic - Interpolated at intervals</option>
                            <option value="BestFit">Best Fit - Optimized for visual trends</option>
                            <option value="Full">Full - All stored values (High detail)</option>
                            <option value="Average">Average - Time-weighted average</option>
                            <option value="Minimum">Minimum - Minimum value in period</option>
                            <option value="Maximum">Maximum - Maximum value in period</option>
                            <option value="Interpolated">Interpolated - Linear interpolation</option>
                            <option value="ValueState">Value State - State-based retrieval</option>
                          </select>
                          <p className="text-[0.65rem] text-gray-400 mt-1 leading-tight">
                            Mode defines how Historian samples and returns data points. Delta is recommended for precise reports.
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

                    {/* Chart Options Dropdown */}
                    <div className="space-y-4">
                      <ChartOptions
                        chartTypes={reportConfig.chartTypes as ('line' | 'bar')[] || ['line']}
                        onChartTypesChange={(types) => setReportConfig(prev => ({ ...prev, chartTypes: types }))}
                        realTimeEnabled={realTimeEnabled}
                        onRealTimeEnabledChange={setRealTimeEnabled}
                        realTimeStatus={realTimeData}
                        disabled={!reportConfig.tags?.length}
                      />
                    </div>

                    {/* Advanced Analytics Options */}
                    <div className="space-y-4">
                      <AnalyticsOptions
                        includeTrendLines={reportConfig.includeTrendLines}
                        includeMultiTrend={reportConfig.includeMultiTrend}
                        includeSPCCharts={reportConfig.includeSPCCharts}
                        includeStatsSummary={reportConfig.includeStatsSummary}
                        includeDataTable={reportConfig.includeDataTable}
                        onIncludeTrendLinesChange={(value) =>
                          setReportConfig(prev => ({ ...prev, includeTrendLines: value }))
                        }
                        onIncludeMultiTrendChange={(value) =>
                          setReportConfig(prev => ({ ...prev, includeMultiTrend: value }))
                        }
                        onIncludeSPCChartsChange={(value) =>
                          setReportConfig(prev => ({ ...prev, includeSPCCharts: value }))
                        }
                        onIncludeStatsSummaryChange={(value) =>
                          setReportConfig(prev => ({ ...prev, includeStatsSummary: value }))
                        }
                        onIncludeDataTableChange={(value) =>
                          setReportConfig(prev => ({ ...prev, includeDataTable: value }))
                        }
                        disabled={!reportConfig.tags?.length}
                      />
                    </div>

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
                        ref={reportPreviewRef}
                        config={{
                          id: 'preview',
                          name: reportConfig.name,
                          description: reportConfig.description || '',
                          tags: reportConfig.tags,
                          timeRange: reportConfig.timeRange!,
                          chartTypes: reportConfig.chartTypes as any[],
                          template: reportConfig.template || 'default',
                          retrievalMode: reportConfig.retrievalMode || 'Delta',
                          includeTrendLines: reportConfig.includeTrendLines,
                          includeMultiTrend: reportConfig.includeMultiTrend,
                          includeSPCCharts: reportConfig.includeSPCCharts,
                          includeStatsSummary: reportConfig.includeStatsSummary,
                          includeDataTable: reportConfig.includeDataTable,
                          specificationLimits: reportConfig.specificationLimits
                        }}
                      />
                    </div>
                  )
                }
              </div>
            )}

            {
              activeTab === 'dashboards' && (
                <div className="space-y-6">
                  {dashboardViewMode === 'list' && (
                    <DashboardList
                      onView={(id) => {
                        setSelectedDashboardId(id);
                        setDashboardViewMode('view');
                      }}
                      onEdit={(id) => {
                        setSelectedDashboardId(id);
                        setDashboardViewMode('edit');
                      }}
                      onCreate={() => {
                        setSelectedDashboardId(null);
                        setDashboardViewMode('edit');
                      }}
                    />
                  )}
                  {dashboardViewMode === 'view' && selectedDashboardId && (
                    <DashboardView
                      dashboardId={selectedDashboardId}
                      onBack={() => setDashboardViewMode('list')}
                      onEdit={() => setDashboardViewMode('edit')}
                    />
                  )}
                  {dashboardViewMode === 'edit' && (
                    <DashboardEditor
                      dashboardId={selectedDashboardId}
                      onSave={() => setDashboardViewMode('list')}
                      onCancel={() => setDashboardViewMode('list')}
                    />
                  )}
                </div>
              )
            }

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
                        <div className="space-y-4">
                          {/* Desktop Table View */}
                          <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Report Name</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {savedReports.map((report) => (
                                  <tr key={report.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{report.name}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{report.description || 'No description'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                      v{report.version}
                                      {report.totalVersions > 1 && <div className="text-xs text-gray-500">{report.totalVersions} versions</div>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="text-sm text-gray-500">{new Date(report.createdAt).toLocaleDateString()}</div>
                                      <div className="text-xs text-gray-400">by {report.createdBy}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                      <div className="flex space-x-2">
                                        <Button variant="ghost" size="sm" onClick={() => handleLoadReport(report.id)}>Load</Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleExportReport(report)} title="Export"><Download className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleDeleteReport(report.id, report.name)} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Mobile Card List View */}
                          <div className="md:hidden space-y-4">
                            {savedReports.map((report) => (
                              <Card key={report.id} className="overflow-hidden">
                                <CardContent className="p-4">
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1 min-w-0">
                                      <h3 className="font-bold text-lg text-gray-900 truncate">{report.name}</h3>
                                      <p className="text-sm text-gray-500 line-clamp-2 mt-1">{report.description || 'No description'}</p>
                                    </div>
                                    <div className="bg-primary-50 text-primary-700 px-2 py-1 rounded text-xs font-semibold ml-2">v{report.version}</div>
                                  </div>
                                  <div className="flex items-center text-xs text-gray-400 mb-4">
                                    <Calendar className="h-3 w-3 mr-1" />
                                    <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                                    <span className="mx-2 text-gray-300">•</span>
                                    <Users className="h-3 w-3 mr-1" />
                                    <span className="truncate">by {report.createdBy}</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleLoadReport(report.id)} className="w-full">
                                      Load Report
                                    </Button>
                                    <div className="flex space-x-2">
                                      <Button variant="ghost" size="sm" onClick={() => handleExportReport(report)} className="flex-1 border border-gray-200">
                                        <Download className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="sm" onClick={() => handleDeleteReport(report.id, report.name)} className="flex-1 border border-red-100 text-red-600 hover:bg-red-50">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white rounded-lg border border-gray-200">
                          <div className="p-8 text-center text-gray-500">
                            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                            <p className="text-lg font-medium text-gray-900">No reports yet</p>
                            <p className="mt-1">Create your first report to get started</p>
                            <Button className="mt-6" onClick={() => setActiveTab('create')}>
                              <Plus className="h-4 w-4 mr-2" />
                              New Report
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            }

            {/* Categories section temporarily removed */}

            {
              activeTab === 'schedules' && (
                <SchedulesErrorBoundary>
                  <SchedulesList />
                </SchedulesErrorBoundary>
              )
            }

            {
              activeTab === 'database' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-3xl font-bold text-gray-900">Database</h2>
                      <p className="text-gray-600">
                        Manage connection settings and monitor database health.
                      </p>
                    </div>
                  </div>

                  {/* Sub-navigation for Database */}
                  <div className="flex space-x-4 border-b border-gray-100">
                    <button
                      onClick={() => setDbActiveTab('status')}
                      className={cn(
                        "pb-2 px-1 text-sm font-medium transition-colors border-b-2",
                        dbActiveTab === 'status'
                          ? "border-primary-600 text-primary-600"
                          : "border-transparent text-gray-400 hover:text-gray-600"
                      )}
                    >
                      Status
                    </button>
                    <button
                      onClick={() => setDbActiveTab('config')}
                      className={cn(
                        "pb-2 px-1 text-sm font-medium transition-colors border-b-2",
                        dbActiveTab === 'config'
                          ? "border-primary-600 text-primary-600"
                          : "border-transparent text-gray-400 hover:text-gray-600"
                      )}
                    >
                      Configuration
                    </button>
                  </div>

                  <div className="mt-6">
                    {dbActiveTab === 'status' ? (
                      <StatusDashboard />
                    ) : (
                      <div className="bg-white rounded-lg border border-gray-200">
                        <div className="p-6 text-center text-gray-500">
                          <Database className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                          <p className="text-lg font-medium">Database Configuration</p>
                          <p>Current connection: {healthStatus}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            }

            {
              activeTab === 'users' && currentUser?.role === 'admin' && (
                <UserManagement />
              )
            }

            {
              activeTab === 'configuration' && currentUser?.role === 'admin' && (
                <ConfigurationManagement />
              )
            }

            {
              activeTab === 'about' && (
                <AboutSection />
              )
            }
          </>
        )}
      </main>
      <ToastContainer toasts={toasts} onClose={id => removeToast(id)} />

      {/* Format Selection Dialog for Saved Reports */}
      <FormatSelectionDialog
        isOpen={showExportDialog}
        onClose={() => {
          setShowExportDialog(false);
          setExportingReport(null);
        }}
        onSelectFormat={handleConfirmExport}
      />
    </div>
  );
};