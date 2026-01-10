import { useState, useEffect, useCallback } from 'react';
import { ReportConfig, ReportVersion, ReportVersionHistory } from '../types/api';
import { VersionControlService, VersionControlOptions } from '../services/versionControl';

export interface UseVersionControlOptions extends VersionControlOptions {
  reportId: string;
  onVersionChange?: (version: ReportVersion) => void;
  onRollback?: (version: ReportVersion) => void;
}

export interface UseVersionControlReturn {
  // Version history
  versionHistory: ReportVersionHistory | null;
  currentVersion: ReportVersion | null;
  
  // State
  loading: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
  
  // Actions
  createVersion: (config: ReportConfig, changeDescription?: string) => Promise<ReportVersion>;
  rollbackToVersion: (version: number) => Promise<ReportVersion | null>;
  getVersion: (version: number) => ReportVersion | null;
  compareVersions: (version1: number, version2: number) => any;
  
  // Utilities
  getChangesSummary: (config: ReportConfig) => string[];
  checkUnsavedChanges: (config: ReportConfig) => boolean;
  clearHistory: () => void;
  exportHistory: () => string;
  importHistory: (jsonData: string) => boolean;
  
  // Refresh
  refresh: () => void;
}

export const useVersionControl = (options: UseVersionControlOptions): UseVersionControlReturn => {
  const [versionService] = useState(() => new VersionControlService(options.reportId, options));
  const [versionHistory, setVersionHistory] = useState<ReportVersionHistory | null>(null);
  const [currentVersion, setCurrentVersion] = useState<ReportVersion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load version history
  const loadVersionHistory = useCallback(() => {
    try {
      setLoading(true);
      setError(null);
      
      const history = versionService.getVersionHistory();
      const current = versionService.getCurrentVersion();
      
      setVersionHistory(history);
      setCurrentVersion(current);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load version history');
    } finally {
      setLoading(false);
    }
  }, [versionService]);

  // Initialize
  useEffect(() => {
    loadVersionHistory();
  }, [loadVersionHistory]);

  // Create a new version
  const createVersion = useCallback(async (
    config: ReportConfig, 
    changeDescription?: string
  ): Promise<ReportVersion> => {
    try {
      setLoading(true);
      setError(null);
      
      const newVersion = versionService.createVersion(
        config,
        changeDescription,
        config.createdBy
      );
      
      // Update state
      setCurrentVersion(newVersion);
      setHasUnsavedChanges(false);
      loadVersionHistory();
      
      // Notify callback
      if (options.onVersionChange) {
        options.onVersionChange(newVersion);
      }
      
      return newVersion;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create version';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [versionService, loadVersionHistory, options]);

  // Rollback to a specific version
  const rollbackToVersion = useCallback(async (version: number): Promise<ReportVersion | null> => {
    try {
      setLoading(true);
      setError(null);
      
      const rolledBackVersion = versionService.rollbackToVersion(version);
      
      if (rolledBackVersion) {
        setCurrentVersion(rolledBackVersion);
        setHasUnsavedChanges(false);
        loadVersionHistory();
        
        // Notify callback
        if (options.onRollback) {
          options.onRollback(rolledBackVersion);
        }
      }
      
      return rolledBackVersion;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to rollback version';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [versionService, loadVersionHistory, options]);

  // Get a specific version
  const getVersion = useCallback((version: number): ReportVersion | null => {
    return versionService.getVersion(version);
  }, [versionService]);

  // Compare versions
  const compareVersions = useCallback((version1: number, version2: number) => {
    return versionService.compareVersions(version1, version2);
  }, [versionService]);

  // Get changes summary
  const getChangesSummary = useCallback((config: ReportConfig): string[] => {
    return versionService.getChangesSummary(config);
  }, [versionService]);

  // Check for unsaved changes
  const checkUnsavedChanges = useCallback((config: ReportConfig): boolean => {
    const hasChanges = versionService.hasUnsavedChanges(config);
    setHasUnsavedChanges(hasChanges);
    return hasChanges;
  }, [versionService]);

  // Clear history
  const clearHistory = useCallback(() => {
    versionService.clearHistory();
    setVersionHistory(null);
    setCurrentVersion(null);
    setHasUnsavedChanges(false);
    loadVersionHistory();
  }, [versionService, loadVersionHistory]);

  // Export history
  const exportHistory = useCallback((): string => {
    return versionService.exportHistory();
  }, [versionService]);

  // Import history
  const importHistory = useCallback((jsonData: string): boolean => {
    const success = versionService.importHistory(jsonData);
    if (success) {
      loadVersionHistory();
    }
    return success;
  }, [versionService, loadVersionHistory]);

  // Refresh
  const refresh = useCallback(() => {
    loadVersionHistory();
  }, [loadVersionHistory]);

  return {
    // Version history
    versionHistory,
    currentVersion,
    
    // State
    loading,
    error,
    hasUnsavedChanges,
    
    // Actions
    createVersion,
    rollbackToVersion,
    getVersion,
    compareVersions,
    
    // Utilities
    getChangesSummary,
    checkUnsavedChanges,
    clearHistory,
    exportHistory,
    importHistory,
    
    // Refresh
    refresh,
  };
};