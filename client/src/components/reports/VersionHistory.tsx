import React, { useState, useEffect } from 'react';
import { History, ChevronDown, ChevronUp, RotateCcw, Eye, X, Trash2, Download, Upload, Edit2, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { apiService } from '../../services/api';
import { ReportVersion, ReportVersionHistory } from '../../types/api';
import { cn } from '../../utils/cn';

interface VersionHistoryProps {
  reportId: string; // This is actually the report name, not UUID
  reportName: string;
  onClose: () => void;
  onVersionLoad?: (version: ReportVersion) => void;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  reportId, // This is the report name used as the key in the database
  reportName, // This is the display name
  onClose,
  onVersionLoad
}) => {
  const [versionHistory, setVersionHistory] = useState<ReportVersionHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedVersions, setExpandedVersions] = useState<Set<number>>(new Set());
  const [selectedVersions, setSelectedVersions] = useState<number[]>([]);
  const [editingNote, setEditingNote] = useState<number | null>(null);
  const [noteText, setNoteText] = useState<string>('');
  const [deletingVersion, setDeletingVersion] = useState<number | null>(null);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    loadVersionHistory();
  }, [reportId]);

  const loadVersionHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getReportVersions(reportId);
      
      if (response.success && response.data) {
        setVersionHistory(response.data);
      } else {
        setError('Failed to load version history');
      }
    } catch (err) {
      console.error('Error loading version history:', err);
      setError(err instanceof Error ? err.message : 'Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  const toggleVersionExpansion = (version: number) => {
    const newExpanded = new Set(expandedVersions);
    if (newExpanded.has(version)) {
      newExpanded.delete(version);
    } else {
      newExpanded.add(version);
    }
    setExpandedVersions(newExpanded);
  };

  const handleVersionSelect = (version: number) => {
    if (selectedVersions.includes(version)) {
      setSelectedVersions(selectedVersions.filter(v => v !== version));
    } else {
      if (selectedVersions.length < 2) {
        setSelectedVersions([...selectedVersions, version]);
      } else {
        // Replace the oldest selection
        setSelectedVersions([selectedVersions[1], version]);
      }
    }
  };

  const handleLoadVersion = (versionInfo: ReportVersion) => {
    if (onVersionLoad) {
      onVersionLoad(versionInfo);
    }
  };

  const handleDeleteVersion = async (version: number) => {
    if (!window.confirm(`Are you sure you want to delete version ${version}? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingVersion(version);
      // Note: This endpoint needs to be implemented in the backend
      // For now, we'll show a message
      alert('Version deletion will be implemented in the backend API');
      // await apiService.deleteReportVersion(reportId, version);
      // await loadVersionHistory(); // Reload after deletion
    } catch (err) {
      console.error('Error deleting version:', err);
      alert('Failed to delete version: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setDeletingVersion(null);
    }
  };

  const handleExportVersion = (versionInfo: ReportVersion) => {
    const exportData = {
      reportName: reportName,
      version: versionInfo.version,
      config: versionInfo.config,
      createdAt: versionInfo.createdAt,
      createdBy: versionInfo.createdBy,
      changeDescription: versionInfo.changeDescription
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reportName}_v${versionInfo.version}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportVersion = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importData = JSON.parse(text);
        
        // Validate the imported data
        if (!importData.config || !importData.version) {
          throw new Error('Invalid report version file');
        }

        // Load the imported version
        if (onVersionLoad) {
          onVersionLoad({
            id: 'imported',
            reportId: reportId,
            version: importData.version,
            config: importData.config,
            createdAt: new Date(importData.createdAt),
            createdBy: importData.createdBy,
            changeDescription: importData.changeDescription,
            isActive: false
          });
        }
        
        alert('Version imported successfully! The configuration has been loaded into the editor.');
      } catch (err) {
        console.error('Error importing version:', err);
        alert('Failed to import version: ' + (err instanceof Error ? err.message : 'Invalid file format'));
      }
    };
    input.click();
  };

  const handleEditNote = (version: number, currentNote?: string) => {
    setEditingNote(version);
    setNoteText(currentNote || '');
  };

  const handleSaveNote = async (version: number) => {
    try {
      // Note: This endpoint needs to be implemented in the backend
      // For now, we'll show a message
      alert('Version note editing will be implemented in the backend API');
      // await apiService.updateVersionNote(reportId, version, noteText);
      // await loadVersionHistory(); // Reload after update
      setEditingNote(null);
      setNoteText('');
    } catch (err) {
      console.error('Error saving note:', err);
      alert('Failed to save note: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleCompareVersions = async () => {
    if (selectedVersions.length !== 2) return;

    try {
      setComparing(true);
      const [v1, v2] = selectedVersions.sort((a, b) => a - b);
      
      // Note: This endpoint needs to be implemented in the backend
      // For now, we'll show a basic comparison
      const version1 = versionHistory?.versions.find(v => v.version === v1);
      const version2 = versionHistory?.versions.find(v => v.version === v2);
      
      if (!version1 || !version2) {
        throw new Error('Selected versions not found');
      }

      // Simple comparison display
      const differences: string[] = [];
      
      if (JSON.stringify(version1.config.tags) !== JSON.stringify(version2.config.tags)) {
        differences.push(`Tags: v${v1} has ${version1.config.tags.length} tags, v${v2} has ${version2.config.tags.length} tags`);
      }
      
      if (version1.config.timeRange?.relativeRange !== version2.config.timeRange?.relativeRange) {
        differences.push(`Time Range: v${v1} uses "${version1.config.timeRange?.relativeRange}", v${v2} uses "${version2.config.timeRange?.relativeRange}"`);
      }
      
      if (JSON.stringify(version1.config.chartTypes) !== JSON.stringify(version2.config.chartTypes)) {
        differences.push(`Chart Types: v${v1} has ${version1.config.chartTypes.length} types, v${v2} has ${version2.config.chartTypes.length} types`);
      }

      if (differences.length === 0) {
        alert(`Versions ${v1} and ${v2} have identical configurations.`);
      } else {
        alert(`Differences between versions ${v1} and ${v2}:\n\n${differences.join('\n')}`);
      }
    } catch (err) {
      console.error('Error comparing versions:', err);
      alert('Failed to compare versions: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setComparing(false);
    }
  };

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatConfigSummary = (config: any) => {
    const parts: string[] = [];
    
    if (config.tags?.length) {
      parts.push(`${config.tags.length} tag${config.tags.length > 1 ? 's' : ''}`);
    }
    
    if (config.timeRange) {
      parts.push(`Time range: ${config.timeRange.relativeRange || 'custom'}`);
    }
    
    if (config.chartTypes?.length) {
      parts.push(`${config.chartTypes.length} chart type${config.chartTypes.length > 1 ? 's' : ''}`);
    }
    
    return parts.join(' • ');
  };

  const getLatestVersion = () => {
    if (!versionHistory?.versions.length) return null;
    return Math.max(...versionHistory.versions.map(v => v.version));
  };

  const latestVersion = getLatestVersion();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Version History</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-gray-600">Loading version history...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Version History</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-600">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={loadVersionHistory} className="mt-4">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!versionHistory || versionHistory.versions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Version History</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <History className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No version history available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Version History</h3>
            <p className="text-sm text-gray-600 mt-1">
              {reportName} • {versionHistory.totalVersions} version{versionHistory.totalVersions > 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleImportVersion}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {versionHistory.versions.map((versionInfo) => {
            const isLatest = versionInfo.version === latestVersion;
            return (
              <div
                key={versionInfo.version}
                className={cn(
                  "border rounded-lg transition-all",
                  isLatest ? "border-primary-300 bg-primary-50" : "border-gray-200 bg-white",
                  selectedVersions.includes(versionInfo.version) && "ring-2 ring-primary-500"
                )}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-gray-900">
                          Version {versionInfo.version}
                        </span>
                        {isLatest && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-800 rounded-full">
                            Latest
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        {formatDate(versionInfo.createdAt)} • by {versionInfo.createdBy || 'Unknown'}
                      </div>
                      {versionInfo.changeDescription && (
                        <div className="mt-2 text-sm text-gray-700">
                          {versionInfo.changeDescription}
                        </div>
                      )}
                      <div className="mt-2 text-xs text-gray-500">
                        {formatConfigSummary(versionInfo.config)}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleVersionExpansion(versionInfo.version)}
                      >
                        {expandedVersions.has(versionInfo.version) ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {expandedVersions.has(versionInfo.version) && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Configuration Details</h4>
                          <div className="bg-gray-50 rounded p-3 text-xs font-mono">
                            <div className="space-y-1">
                              <div><span className="text-gray-600">Tags:</span> {versionInfo.config.tags?.join(', ')}</div>
                              <div><span className="text-gray-600">Time Range:</span> {versionInfo.config.timeRange?.relativeRange || 'custom'}</div>
                              <div><span className="text-gray-600">Chart Types:</span> {versionInfo.config.chartTypes?.join(', ')}</div>
                              <div><span className="text-gray-600">Template:</span> {versionInfo.config.template}</div>
                            </div>
                          </div>
                        </div>

                        {/* Version Notes Section */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-gray-700">Version Notes</h4>
                            {editingNote !== versionInfo.version && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditNote(versionInfo.version, versionInfo.changeDescription)}
                              >
                                <Edit2 className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                            )}
                          </div>
                          {editingNote === versionInfo.version ? (
                            <div className="space-y-2">
                              <Input
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder="Add version notes..."
                                className="text-sm"
                              />
                              <div className="flex space-x-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveNote(versionInfo.version)}
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  Save
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingNote(null);
                                    setNoteText('');
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-600 bg-gray-50 rounded p-2">
                              {versionInfo.changeDescription || 'No notes added'}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleLoadVersion(versionInfo)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Load This Version
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExportVersion(versionInfo)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Export
                          </Button>
                          {!isLatest && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleVersionSelect(versionInfo.version)}
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                {selectedVersions.includes(versionInfo.version) ? 'Selected' : 'Select for Compare'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteVersion(versionInfo.version)}
                                disabled={deletingVersion === versionInfo.version}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {deletingVersion === versionInfo.version ? 'Deleting...' : 'Delete'}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {selectedVersions.length === 2 && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="text-sm text-blue-900">
                <span className="font-medium">Compare versions {selectedVersions[0]} and {selectedVersions[1]}</span>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedVersions([])}
                >
                  Clear Selection
                </Button>
                <Button
                  size="sm"
                  onClick={handleCompareVersions}
                  disabled={comparing}
                >
                  {comparing ? 'Comparing...' : 'Compare'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
