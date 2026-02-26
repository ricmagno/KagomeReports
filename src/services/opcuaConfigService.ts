import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import {
    OpcuaConfiguration,
    OpcuaConfig,
} from '@/types/opcuaConfig';
import { encryptionService } from '@/services/encryptionService';
import { apiLogger, logger } from '@/utils/logger';
import { env, getDatabasePath } from '@/config/environment';
import { createError } from '@/middleware/errorHandler';

export class OpcuaConfigService {
    private configurations: Map<string, OpcuaConfiguration> = new Map();
    private activeConfigId: string | null = null;
    private readonly configFileName = 'opcua-configs.json';
    private isInitialized = false;

    constructor() {
        this.loadConfigurations();
    }

    async saveConfiguration(config: OpcuaConfig, userId: string): Promise<string> {
        try {
            const configId = config.id || uuidv4();
            const existingConfig = this.configurations.get(configId);
            const isUpdate = !!existingConfig;

            let encryptedPassword: string | undefined = existingConfig?.encryptedPassword;
            if (config.password) {
                encryptedPassword = JSON.stringify(encryptionService.encrypt(config.password));
            }

            const opcuaConfig: OpcuaConfiguration = {
                id: configId,
                name: config.name,
                endpointUrl: config.endpointUrl,
                securityMode: config.securityMode,
                securityPolicy: config.securityPolicy,
                authenticationMode: config.authenticationMode,
                username: config.username || '',
                encryptedPassword,
                isActive: existingConfig?.isActive || false,
                createdBy: userId,
                createdAt: existingConfig ? existingConfig.createdAt : new Date(),
                status: existingConfig ? existingConfig.status : 'untested',
                lastTested: existingConfig?.lastTested,
                lastError: existingConfig?.lastError
            };

            this.configurations.set(configId, opcuaConfig);
            await this.persistConfigurations();

            apiLogger.info('OPC UA configuration saved', { configId, name: config.name });
            return configId;
        } catch (error) {
            apiLogger.error('Failed to save OPC UA configuration', error);
            throw error;
        }
    }

    async loadConfiguration(configId: string): Promise<OpcuaConfig> {
        const config = this.configurations.get(configId);
        if (!config) throw createError('Configuration not found', 404);

        let password: string | undefined;
        if (config.encryptedPassword) {
            password = encryptionService.decrypt(JSON.parse(config.encryptedPassword));
        }

        return {
            id: config.id,
            name: config.name,
            endpointUrl: config.endpointUrl,
            securityMode: config.securityMode,
            securityPolicy: config.securityPolicy,
            authenticationMode: config.authenticationMode,
            username: config.username || '',
            password
        };
    }

    async listConfigurations(): Promise<OpcuaConfiguration[]> {
        return Array.from(this.configurations.values());
    }

    async deleteConfiguration(configId: string): Promise<void> {
        if (this.activeConfigId === configId) {
            throw createError('Cannot delete active configuration', 400);
        }
        this.configurations.delete(configId);
        await this.persistConfigurations();
    }

    async activateConfiguration(configId: string): Promise<void> {
        const config = this.configurations.get(configId);
        if (!config) throw createError('Configuration not found', 404);

        if (this.activeConfigId) {
            const current = this.configurations.get(this.activeConfigId);
            if (current) current.isActive = false;
        }

        config.isActive = true;
        this.activeConfigId = configId;
        await this.persistConfigurations();
    }

    getActiveConfiguration(): OpcuaConfiguration | null {
        if (!this.activeConfigId) return null;
        return this.configurations.get(this.activeConfigId) || null;
    }

    private async loadConfigurations(): Promise<void> {
        const configFile = getDatabasePath(this.configFileName);
        try {
            const data = await fs.readFile(configFile, 'utf-8');
            const parsed = JSON.parse(data);

            this.configurations.clear();
            for (const config of parsed.configurations || []) {
                config.createdAt = new Date(config.createdAt);
                if (config.lastTested) config.lastTested = new Date(config.lastTested);
                this.configurations.set(config.id, config);
            }
            this.activeConfigId = parsed.activeConfigId || null;
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                apiLogger.error('Failed to load OPC UA configurations', error);
            }
        }
    }

    private async persistConfigurations(): Promise<void> {
        const configFile = getDatabasePath(this.configFileName);
        try {
            // Ensure data directory exists
            if (!this.isInitialized) {
                const dataDir = path.dirname(configFile);
                try {
                    const { fs: fsSync } = require('fs');
                    if (!fsSync.existsSync(dataDir)) {
                        apiLogger.info(`Creating missing directory for OPC UA configs: ${dataDir}`);
                        fsSync.mkdirSync(dataDir, { recursive: true });
                    }
                } catch (e) {
                    apiLogger.warn('Sync directory check failed in ConfigService', e);
                }
            }

            const data = {
                configurations: Array.from(this.configurations.values()),
                activeConfigId: this.activeConfigId,
                lastUpdated: new Date().toISOString()
            };

            await fs.writeFile(configFile, JSON.stringify(data, null, 2));
            apiLogger.debug(`OPC UA configurations persisted to ${configFile}`);
        } catch (error: any) {
            apiLogger.error('Failed to persist OPC UA configurations', {
                error: error.message,
                code: error.code,
                errno: error.errno,
                path: configFile
            });
            throw createError('Failed to save configurations to disk', 500);
        }
    }

    async initializeActiveConnection(): Promise<void> {
        if (this.isInitialized) return;

        try {
            await this.loadConfigurations();
            if (this.activeConfigId) {
                const config = await this.loadConfiguration(this.activeConfigId);
                const { opcuaService } = await import('./opcuaService');
                await opcuaService.connect(config);
                apiLogger.info('OPC UA active configuration connected on startup');
            }
            this.isInitialized = true;
        } catch (error) {
            apiLogger.error('Failed to initialize active OPC UA connection', error);
            // Don't throw, we want the server to start even if OPC UA fails
        }
    }
}

export const opcuaConfigService = new OpcuaConfigService();

export function setupOpcuaConfigIntegration(): void {
    // Attempt initialization on startup
    opcuaConfigService.initializeActiveConnection().catch(error => {
        apiLogger.error('Critical error in OPC UA setup:', error);
    });
}
