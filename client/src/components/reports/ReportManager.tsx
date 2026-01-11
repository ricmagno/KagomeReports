/**
 * Report Manager Component
 * Handles save, load, delete operations for report configurations
 * Requirements: 5.4, 5.5, 6.4, 6.5
 */

import React, { useState, useEffect } from 'react';
import { 
  Save, 
  FolderOpen, 
  Trash2, 
  Plus, 
  Search,
  Download,
  Upload,
  Tag,
  Calendar
} from 'lucide-react';
import { ReportConfig } from '../../types/api';

interface ReportManagerProps {
  currentConfig?: ReportConfig;
  onSave?: (config: ReportConfig) => Promise<void>;
  onLoad?: (config: ReportConfig) => void;
  onDelete?: (configId: string) => Promise<void>;
  onNew?: () => void;
  onExport?: (configs: ReportConfig[]) => void;
  onImport?: (file: File) => Promise<ReportConfig[]>;
  className?: string;
}

interface SavedReport extends ReportConfig {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ReportManager: React.FC<ReportManagerProps> = ({
  currentConfig,
  onSave,
  onLoad,
  onDelete,
  onNew,
  onExport,
  onImport,
  className = ''
}) => {
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveForm, setSaveForm] = useState({
    name: '',
    description: '',
    tags: [] as string[]
  });

  // Load saved reports on component mount
  useEffect(() => {
    loadSavedReports();
  }, []);

  const loadSavedReports = async () => {
    setIsLoading(true);
    try {
      // In a real implementation, this would fetch from the API
      const mockReports: SavedReport[] = [
        {
          id: '1',
          name: 'Daily Production Report',
          description: 'Daily production metrics and trends',
          tags: ['production', 'daily', 'metrics'],
          timeRange: {
            startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
            endTime: new Date()
          },
          chartTypes: ['line'],
          template: 'default',
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        },
        {
          id: '2',
          name: 'Weekly Quality Analysis',
          description: 'Quality metrics and anomaly detection',
          tags: ['quality', 'weekly', 'analysis'],
          timeRange: {
            startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            endTime: new Date()
          },
          chartTypes: ['bar'],
          template: 'default',
          createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
        },
        {
          id: '3',
          name: 'Monthly Trend Report',
          description: 'Long-term trend analysis and forecasting',
          tags: ['trends', 'monthly', 'forecast'],
          timeRange: {
            startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            endTime: new Date()
          },
          chartTypes: ['trend'],
          template: 'default',
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
        }
      ];
      setSavedReports(mockReports);
    } catch (error) {
      console.error('Failed to load saved reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentConfig || !onSave) return;

    const configToSave: ReportConfig = {
      ...currentConfig,
      name: saveForm.name || currentConfig.name,
      description: saveForm.description || currentConfig.description,
      tags: saveForm.tags.length > 0 ? saveForm.tags : currentConfig.tags
    };

    try {
      await onSave(configToSave);
      setShowSaveDialog(false);
      setSaveForm({ name: '', description: '', tags: [] });
      await loadSavedReports();
    } catch (error) {
      console.error('Failed to save report:', error);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!onDelete) return;
    
    if (window.confirm('Are you sure you want to delete this report configuration?')) {
      try {
        await onDelete(reportId);
        await loadSavedReports();
      } catch (error) {
        console.error('Failed to delete report:', error);
      }
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onImport) return;

    try {
      const importedConfigs = await onImport(file);
      await loadSavedReports();
      alert(`Successfully imported ${importedConfigs.length} report configurations.`);
    } catch (error) {
      console.error('Failed to import reports:', error);
      alert('Failed to import report configurations.');
    }
  };

  const handleExport = () => {
    if (!onExport) return;
    
    const selectedReports = filteredReports;
    onExport(selectedReports);
  };

  // Get unique tags for filtering
  const allTags = Array.from(new Set(savedReports.flatMap(r => r.tags || [])));

  // Filter reports based on search and filters
  const filteredReports = savedReports.filter(report => {
    const matchesSearch = !searchTerm || 
      report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTags = selectedTags.length === 0 || 
      selectedTags.some(tag => report.tags?.includes(tag));

    return matchesSearch && matchesTags;
  });

  const formatDate = (date: Date) => {
    return date.toLocaleDateString();
  };

  return (
    <div className={`bg-white rounded-lg shadow-md border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Report Manager</h2>
          <div className="flex space-x-2">
            {onNew && (
              <button
                onClick={onNew}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Report
              </button>
            )}
            {currentConfig && onSave && (
              <button
                onClick={() => setShowSaveDialog(true)}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Current
              </button>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Category Filter */}
          <div className="flex space-x-2">
            <label className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer">
              <Upload className="w-4 h-4 mr-2" />
              Import
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
            <button
              onClick={handleExport}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Tag Filter */}
        {allTags.length > 0 && (
          <div className="mt-4">
            <div className="flex flex-wrap gap-2">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => {
                    setSelectedTags(prev => 
                      prev.includes(tag) 
                        ? prev.filter(t => t !== tag)
                        : [...prev, tag]
                    );
                  }}
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    selectedTags.includes(tag)
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  <Tag className="w-3 h-3 mr-1" />
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reports List */}
      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading reports...</span>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center py-8">
            <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No reports found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {selectedTags.length > 0
                ? 'Try adjusting your search or filters.'
                : 'Get started by creating a new report configuration.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReports.map(report => (
              <div
                key={report.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900 mb-1">
                      {report.name}
                    </h3>
                    {report.description && (
                      <p className="text-sm text-gray-600 mb-2">
                        {report.description}
                      </p>
                    )}
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {formatDate(report.updatedAt)}
                      </span>
                      <span className="capitalize">
                        {report.chartTypes.join(', ')} • {report.template}
                      </span>
                    </div>

                    {report.tags && report.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {report.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => onLoad?.(report)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                      title="Load Report"
                    >
                      <FolderOpen className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(report.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                      title="Delete Report"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Save Report Configuration
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={saveForm.name}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={currentConfig?.name || 'Enter report name'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={saveForm.description}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={saveForm.tags.join(', ')}
                  onChange={(e) => setSaveForm(prev => ({ 
                    ...prev, 
                    tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                  }))}
                  placeholder="e.g., daily, metrics, production"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};