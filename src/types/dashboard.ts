/**
 * Type definitions for Dashboard management and configuration
 */

import { TimeRange, RetrievalMode } from './historian';

export type WidgetType = 'line' | 'bar' | 'trend' | 'scatter' | 'metric' | 'table';

export interface WidgetConfig {
    id: string;
    type: WidgetType;
    title: string;
    tags: string[];
    timeRange?: TimeRange; // Optional override for the dashboard-wide time range
    retrievalMode?: RetrievalMode;
    refreshRate?: number; // Refresh rate for this specific widget in seconds
    layout: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    options?: Record<string, any>; // Chart-specific options
}

export interface DashboardConfig {
    id?: string | undefined;
    name: string;
    description?: string | undefined;
    widgets: WidgetConfig[];
    timeRange: {
        startTime?: Date | undefined;
        endTime?: Date | undefined;
        relativeRange?: 'last1h' | 'last2h' | 'last6h' | 'last12h' | 'last24h' | 'last7d' | 'last30d' | undefined;
    };
    refreshRate: number; // Global refresh rate in seconds (default 30s)
    createdBy?: string | undefined;
    createdAt?: Date | undefined;
    updatedAt?: Date | undefined;
    version?: number | undefined;
}

export interface SavedDashboard {
    id: string;
    name: string;
    description: string;
    config: DashboardConfig;
    version: number;
    createdBy: string;
    createdByUserId: string;
    createdAt: Date;
    updatedAt: Date;
    isLatestVersion: boolean;
}

export interface DashboardVersion {
    id: string;
    dashboardId: string;
    version: number;
    config: DashboardConfig;
    createdAt: Date;
    createdBy: string;
    changeDescription?: string;
    isActive: boolean;
}

export interface DashboardVersionHistory {
    dashboardId: string;
    dashboardName: string;
    versions: DashboardVersion[];
    totalVersions: number;
}

export interface DashboardListItem {
    id: string;
    name: string;
    description: string;
    config: DashboardConfig;
    version: number;
    createdBy: string;
    createdByUserId: string;
    createdAt: Date;
    updatedAt: Date;
    isLatestVersion: boolean;
    totalVersions: number;
}

export interface SaveDashboardRequest {
    name: string;
    description?: string | undefined;
    config: Omit<DashboardConfig, 'id' | 'name' | 'description' | 'createdBy' | 'createdAt' | 'updatedAt' | 'version'>;
    changeDescription?: string | undefined;
}

export interface SaveDashboardResponse {
    success: boolean;
    dashboardId: string;
    version: number;
    message: string;
}

export interface DashboardValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

export interface VersionChange {
    field: string;
    oldValue: any;
    newValue: any;
    changeType: 'added' | 'removed' | 'modified';
}

export interface VersionComparison {
    dashboardName: string;
    oldVersion: DashboardVersion;
    newVersion: DashboardVersion;
    changes: VersionChange[];
}

export interface VersionCleanupPolicy {
    maxVersionsToKeep: number;
    maxAgeInDays: number;
    keepMajorVersions: boolean;
}
