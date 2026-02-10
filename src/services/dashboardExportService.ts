/**
 * Dashboard Export Service
 * Handles exporting dashboard configurations to JSON
 */

import { DashboardConfig } from '../types/dashboard';
import { logger } from '../utils/logger';

export interface ExportResult {
    filename: string;
    contentType: string;
    data: string;
}

const CURRENT_SCHEMA_VERSION = '1.0.0';

export class DashboardExportService {
    constructor() { }

    /**
     * Export a dashboard configuration to JSON string
     */
    exportDashboard(config: DashboardConfig, includeMetadata: boolean = true): ExportResult {
        try {
            const exportedData = {
                schemaVersion: CURRENT_SCHEMA_VERSION,
                exportMetadata: includeMetadata ? this.buildMetadata() : {},
                dashboardConfig: config,
            };

            const jsonString = JSON.stringify(exportedData, null, 2);
            const filename = `${config.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_dashboard_v${config.version || 1}.json`;

            return {
                filename,
                contentType: 'application/json',
                data: jsonString,
            };
        } catch (error) {
            logger.error('Error exporting dashboard:', error);
            throw new Error(`Failed to export dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private buildMetadata() {
        return {
            exportDate: new Date().toISOString(),
            exporter: 'KagomeReports Dashboard Service',
            schemaCompatibility: ['1.0.0']
        };
    }
}
