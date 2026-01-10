import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  History, 
  GitBranch, 
  RotateCcw, 
  Eye, 
  GitCompare,
  Clock,
  User,
  FileText,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { ReportVersionHistory, ReportVersion, ReportConfig } from '../../types/api';
import { apiService } from '../../services/api';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { cn } from '../../utils/cn';

interface ReportVersionHistoryProps {
  reportId: string;
  currentConfig: ReportConfig;
  onVersionSelect?: (version: ReportVersion) => void;
  onRollback?: (version: number) => void;
  className?: string;
}

export const ReportVersionHistoryComponent: React.FC<ReportVersionHistoryProps> = ({
  reportId,
  currentConfig,
  onVersionSelect,
  onRollback,
  className,
}) => {
  const [versionHistory, setVersionHistory] = useState<ReportVersionHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersions, setSelectedVersions] = useState<number[]>([]);
  const [comparing, setComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<any>(null);

  // Load version history
  useEffect(() => {
    const loadVersionHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiService.getReportVersions(reportId);
        if (response.success) {
          setVersionHistory(response.data);
        } else {
          setError('Failed to load version history');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load version history');
      } finally {
        setLoading(false);
      }
    };

    if (reportId) {
      loadVersionHistory();
    }
  }, [reportId]);

  const handleVersionSelect = (version: ReportVersion) => {
    if (onVersionSelect) {
      onVersionSelect(version);
    }
  };

  const handleRollback = async (version: number) => {
    if (!onRollback) return;

    try {
      setLoading(true);
      await onRollback(version);
      // Reload version history after rollback
      const response = await apiService.getReportVersions(reportId);
      if (response.success) {
        setVersionHistory(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rollback to version');
    } finally {
      setLoading(false);
    }
  };

  const handleVersionToggle = (version: number) => {
    setSelectedVersions(prev => {
      if (prev.includes(version)) {
        return prev.filter(v => v !== version);
      } else if (prev.length < 2) {
        return [...prev, version];
      } else {
        // Replace the first selected version
        return [prev[1], version];
      }
    });
  };

  const handleCompareVersions = async () => {
    if (selectedVersions.length !== 2) return;

    setComparing(true);
    try {
      const response = await apiService.compareVersions(
        reportId,
        selectedVersions[0],
        selectedVersions[1]
      );
      if (response.success) {
        setComparisonResult(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare versions');
    } finally {
      setComparing(false);
    }
  };

  const getVersionStatusIcon = (version: ReportVersion) => {
    if (version.isActive) {
      return <CheckCircle className="h-4 w-4 text-success" />;
    }
    return <Clock className="h-4 w-4 text-gray-400" />;
  };

  const getChangesSummary = (version: ReportVersion) => {
    const config = version.config;
    const changes = [];
    
    if (config.tags?.length) {
      changes.push(`${config.tags.length} tags`);
    }
    if (config.chartTypes?.length) {
      changes.push(`${config.chartTypes.length} chart types`);
    }
    if (config.timeRange) {
      changes.push('time range updated');
    }
    
    return changes.join(', ') || 'Configuration updated';
  };

  if (loading && !versionHistory) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading version history...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-12 w-12 text-error mx-auto mb-4" />
          <p className="text-error">{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!versionHistory || versionHistory.versions.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <History className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-medium">Version History</h3>
          </div>
        </CardHeader>
        <CardContent className="text-center py-8">
          <GitBranch className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No version history available</p>
          <p className="text-sm text-gray-400">Save changes to create version history</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <History className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-medium">Version History</h3>
            <span className="text-sm text-gray-500">
              ({versionHistory.totalVersions} versions)
            </span>
          </div>
          {selectedVersions.length === 2 && (
            <Button
              size="sm"
              onClick={handleCompareVersions}
              disabled={comparing}
              loading={comparing}
            >
              <GitCompare className="h-4 w-4 mr-2" />
              Compare
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Version selection hint */}
        {selectedVersions.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-800">
              {selectedVersions.length === 1 
                ? 'Select another version to compare'
                : `Comparing versions ${selectedVersions[0]} and ${selectedVersions[1]}`
              }
            </p>
          </div>
        )}

        {/* Version list */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {versionHistory.versions.map((version) => (
            <div
              key={version.id}
              className={cn(
                'border rounded-lg p-4 transition-colors',
                version.isActive 
                  ? 'border-success bg-green-50' 
                  : 'border-gray-200 hover:border-gray-300',
                selectedVersions.includes(version.version) && 'ring-2 ring-primary-500'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    {getVersionStatusIcon(version)}
                    <span className="font-medium text-gray-900">
                      Version {version.version}
                      {version.isActive && (
                        <span className="ml-2 text-xs bg-success text-white px-2 py-1 rounded-full">
                          Current
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => handleVersionToggle(version.version)}
                      className={cn(
                        'text-xs px-2 py-1 rounded border transition-colors',
                        selectedVersions.includes(version.version)
                          ? 'bg-primary-100 border-primary-300 text-primary-800'
                          : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      {selectedVersions.includes(version.version) ? 'Selected' : 'Select'}
                    </button>
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-2">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{format(new Date(version.createdAt), 'MMM dd, yyyy HH:mm')}</span>
                      </div>
                      {version.createdBy && (
                        <div className="flex items-center space-x-1">
                          <User className="h-3 w-3" />
                          <span>{version.createdBy}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {version.changeDescription && (
                    <p className="text-sm text-gray-700 mb-2">
                      {version.changeDescription}
                    </p>
                  )}

                  <div className="text-xs text-gray-500">
                    <FileText className="h-3 w-3 inline mr-1" />
                    {getChangesSummary(version)}
                  </div>
                </div>

                <div className="flex space-x-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleVersionSelect(version)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                  {!version.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRollback(version.version)}
                      disabled={loading}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Rollback
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Comparison result */}
        {comparisonResult && (
          <div className="mt-6 border-t pt-4">
            <h4 className="font-medium text-gray-900 mb-3">Version Comparison</h4>
            <div className="bg-gray-50 rounded-md p-4">
              <p className="text-sm text-gray-600">
                Comparing Version {selectedVersions[0]} with Version {selectedVersions[1]}
              </p>
              {/* Add detailed comparison UI here */}
              <div className="mt-2 text-xs text-gray-500">
                Detailed comparison view would be implemented here
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};