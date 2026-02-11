/**
 * Dashboard Import Service
 * Handles importing and validating dashboard configurations from JSON
 */

import { DashboardConfig, DashboardValidationResult } from '../types/dashboard';
import { logger } from '../utils/logger';

export class DashboardImportService {
    constructor() { }

    /**
     * Import a dashboard configuration from JSON string
     */
    async importDashboard(jsonString: string): Promise<DashboardConfig> {
        try {
            const data = JSON.parse(jsonString);

            const validation = this.validateSchema(data);
            if (!validation.isValid) {
                throw new Error(`Invalid dashboard file: ${validation.errors.join(', ')}`);
            }

            return data.dashboardConfig;
        } catch (error) {
            logger.error('Error importing dashboard:', error);
            throw error;
        }
    }

    private validateSchema(data: any): DashboardValidationResult {
        const errors: string[] = [];

        if (!data || typeof data !== 'object') {
            errors.push('Invalid JSON format');
            return { isValid: false, errors, warnings: [] };
        }

        if (!data.schemaVersion) {
            errors.push('Missing schemaVersion');
        }

        if (!data.dashboardConfig) {
            errors.push('Missing dashboardConfig');
        } else {
            const config = data.dashboardConfig;
            if (!config.name) errors.push('Dashboard name is required');
            if (!config.widgets || !Array.isArray(config.widgets)) errors.push('Dashboard widgets must be an array');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings: []
        };
    }
}
