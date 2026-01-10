import { ReportConfig, ReportVersion, ReportVersionHistory } from '../types/api';

/**
 * Version Control Service
 * Handles local version management and change tracking for report configurations
 */

export interface VersionControlOptions {
  maxVersions?: number;
  autoSave?: boolean;
  trackChanges?: boolean;
}

export interface ConfigChange {
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
}

export class VersionControlService {
  private storageKey: string;
  private options: VersionControlOptions;

  constructor(reportId: string, options: VersionControlOptions = {}) {
    this.storageKey = `report_versions_${reportId}`;
    this.options = {
      maxVersions: 50,
      autoSave: true,
      trackChanges: true,
      ...options,
    };
  }

  /**
   * Create a new version of the report configuration
   */
  createVersion(
    config: ReportConfig,
    changeDescription?: string,
    createdBy?: string
  ): ReportVersion {
    const history = this.getVersionHistory();
    const nextVersion = history.versions.length > 0 
      ? Math.max(...history.versions.map(v => v.version)) + 1 
      : 1;

    const newVersion: ReportVersion = {
      id: this.generateVersionId(),
      reportId: config.id || '',
      version: nextVersion,
      config: { ...config, version: nextVersion },
      createdAt: new Date(),
      createdBy,
      changeDescription,
      isActive: true,
    };

    // Mark previous versions as inactive
    history.versions.forEach(v => v.isActive = false);

    // Add new version
    history.versions.unshift(newVersion);
    history.totalVersions = history.versions.length;

    // Limit versions if needed
    if (this.options.maxVersions && history.versions.length > this.options.maxVersions) {
      history.versions = history.versions.slice(0, this.options.maxVersions);
      history.totalVersions = history.versions.length;
    }

    this.saveVersionHistory(history);
    return newVersion;
  }

  /**
   * Get the complete version history
   */
  getVersionHistory(): ReportVersionHistory {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        parsed.versions.forEach((v: any) => {
          v.createdAt = new Date(v.createdAt);
          if (v.config.createdAt) v.config.createdAt = new Date(v.config.createdAt);
          if (v.config.updatedAt) v.config.updatedAt = new Date(v.config.updatedAt);
          if (v.config.timeRange) {
            v.config.timeRange.startTime = new Date(v.config.timeRange.startTime);
            v.config.timeRange.endTime = new Date(v.config.timeRange.endTime);
          }
        });
        return parsed;
      }
    } catch (error) {
      console.error('Failed to load version history:', error);
    }

    return {
      reportId: '',
      reportName: '',
      versions: [],
      totalVersions: 0,
    };
  }

  /**
   * Get a specific version
   */
  getVersion(version: number): ReportVersion | null {
    const history = this.getVersionHistory();
    return history.versions.find(v => v.version === version) || null;
  }

  /**
   * Get the current active version
   */
  getCurrentVersion(): ReportVersion | null {
    const history = this.getVersionHistory();
    return history.versions.find(v => v.isActive) || null;
  }

  /**
   * Rollback to a specific version
   */
  rollbackToVersion(version: number): ReportVersion | null {
    const history = this.getVersionHistory();
    const targetVersion = history.versions.find(v => v.version === version);
    
    if (!targetVersion) {
      return null;
    }

    // Create a new version based on the target version
    const rollbackConfig = {
      ...targetVersion.config,
      updatedAt: new Date(),
    };

    return this.createVersion(
      rollbackConfig,
      `Rolled back to version ${version}`,
      targetVersion.createdBy
    );
  }

  /**
   * Compare two versions and return differences
   */
  compareVersions(version1: number, version2: number): {
    version1: ReportVersion | null;
    version2: ReportVersion | null;
    differences: ConfigChange[];
  } {
    const v1 = this.getVersion(version1);
    const v2 = this.getVersion(version2);
    
    if (!v1 || !v2) {
      return {
        version1: v1,
        version2: v2,
        differences: [],
      };
    }

    const differences = this.detectChanges(v1.config, v2.config);
    
    return {
      version1: v1,
      version2: v2,
      differences,
    };
  }

  /**
   * Detect changes between two configurations
   */
  detectChanges(oldConfig: ReportConfig, newConfig: ReportConfig): ConfigChange[] {
    const changes: ConfigChange[] = [];
    const timestamp = new Date();

    // Compare basic fields
    const basicFields = ['name', 'description', 'template'];
    basicFields.forEach(field => {
      const oldValue = oldConfig[field as keyof ReportConfig];
      const newValue = newConfig[field as keyof ReportConfig];
      
      if (oldValue !== newValue) {
        changes.push({
          field,
          oldValue,
          newValue,
          timestamp,
        });
      }
    });

    // Compare arrays (tags, chartTypes)
    const arrayFields = ['tags', 'chartTypes'];
    arrayFields.forEach(field => {
      const oldValue = oldConfig[field as keyof ReportConfig] as any[];
      const newValue = newConfig[field as keyof ReportConfig] as any[];
      
      if (JSON.stringify(oldValue?.sort()) !== JSON.stringify(newValue?.sort())) {
        changes.push({
          field,
          oldValue: oldValue || [],
          newValue: newValue || [],
          timestamp,
        });
      }
    });

    // Compare time range
    if (oldConfig.timeRange && newConfig.timeRange) {
      const oldRange = oldConfig.timeRange;
      const newRange = newConfig.timeRange;
      
      if (
        oldRange.startTime.getTime() !== newRange.startTime.getTime() ||
        oldRange.endTime.getTime() !== newRange.endTime.getTime() ||
        oldRange.relativeRange !== newRange.relativeRange
      ) {
        changes.push({
          field: 'timeRange',
          oldValue: oldRange,
          newValue: newRange,
          timestamp,
        });
      }
    }

    return changes;
  }

  /**
   * Check if there are unsaved changes
   */
  hasUnsavedChanges(currentConfig: ReportConfig): boolean {
    const currentVersion = this.getCurrentVersion();
    if (!currentVersion) return true;

    const changes = this.detectChanges(currentVersion.config, currentConfig);
    return changes.length > 0;
  }

  /**
   * Get a summary of changes since last version
   */
  getChangesSummary(currentConfig: ReportConfig): string[] {
    const currentVersion = this.getCurrentVersion();
    if (!currentVersion) return ['New configuration'];

    const changes = this.detectChanges(currentVersion.config, currentConfig);
    return changes.map(change => {
      switch (change.field) {
        case 'name':
          return `Name changed from "${change.oldValue}" to "${change.newValue}"`;
        case 'description':
          return 'Description updated';
        case 'template':
          return `Template changed to ${change.newValue}`;
        case 'tags':
          const addedTags = change.newValue.filter((tag: string) => !change.oldValue.includes(tag));
          const removedTags = change.oldValue.filter((tag: string) => !change.newValue.includes(tag));
          const tagChanges = [];
          if (addedTags.length > 0) tagChanges.push(`added ${addedTags.length} tags`);
          if (removedTags.length > 0) tagChanges.push(`removed ${removedTags.length} tags`);
          return `Tags ${tagChanges.join(', ')}`;
        case 'chartTypes':
          return 'Chart types updated';
        case 'timeRange':
          return 'Time range updated';
        default:
          return `${change.field} updated`;
      }
    });
  }

  /**
   * Clear all version history
   */
  clearHistory(): void {
    localStorage.removeItem(this.storageKey);
  }

  /**
   * Export version history as JSON
   */
  exportHistory(): string {
    const history = this.getVersionHistory();
    return JSON.stringify(history, null, 2);
  }

  /**
   * Import version history from JSON
   */
  importHistory(jsonData: string): boolean {
    try {
      const history = JSON.parse(jsonData);
      this.saveVersionHistory(history);
      return true;
    } catch (error) {
      console.error('Failed to import version history:', error);
      return false;
    }
  }

  private saveVersionHistory(history: ReportVersionHistory): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save version history:', error);
    }
  }

  private generateVersionId(): string {
    return `version_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}