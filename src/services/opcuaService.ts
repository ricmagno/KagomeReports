import {
    OPCUAClient,
    MessageSecurityMode,
    SecurityPolicy,
    AttributeIds,
    makeBrowsePath,
    ClientSession,
    NodeId,
    BrowseDirection,
    ReferenceDescription,
    UserTokenType,
    OPCUACertificateManager,
} from 'node-opcua';
import { OpcuaConfig, OpcuaTagInfo } from '@/types/opcuaConfig';
import { logger } from '@/utils/logger';
import { createError } from '@/middleware/errorHandler';
import { RetryHandler } from '@/utils/retryHandler';
import { getDatabasePath } from '@/config/environment';

export class OpcuaService {
    private client: OPCUAClient | null = null;
    private session: ClientSession | null = null;
    private config: OpcuaConfig | null = null;

    constructor() { }

    async connect(config: OpcuaConfig): Promise<void> {
        try {
            this.config = config;

            // Set up client with a robust connection strategy and certificate management
            this.client = OPCUAClient.create({
                endpointMustExist: false,
                securityMode: MessageSecurityMode[config.securityMode as keyof typeof MessageSecurityMode] || MessageSecurityMode.None,
                securityPolicy: SecurityPolicy[config.securityPolicy as keyof typeof SecurityPolicy] || SecurityPolicy.None,
                connectionStrategy: {
                    maxRetry: 5, // More retries for stability
                    initialDelay: 2000,
                    maxDelay: 10000,
                },
                // Add explicit connection timeout (ms)
                requestedSessionTimeout: 60000, // More generous session timeout
                keepSessionAlive: true,
                // Certificate management
                clientCertificateManager: new OPCUACertificateManager({
                    rootFolder: getDatabasePath('pki'),
                    automaticallyAcceptUnknownCertificate: true,
                } as any),
            });

            logger.info(`Attempting to connect to OPC UA server: ${config.endpointUrl}`, {
                securityMode: config.securityMode,
                securityPolicy: config.securityPolicy,
                authenticationMode: config.authenticationMode
            });

            // Use RetryHandler for the connection and session creation
            await RetryHandler.executeWithRetry(
                async () => {
                    if (!this.client) {
                        throw new Error('OPC UA client is not initialized');
                    }

                    // Advanced Discovery before connecting
                    try {
                        logger.info(`Discovering server endpoints: ${config.endpointUrl}`);
                        const endpoints = await this.client.getEndpoints({ endpointUrl: config.endpointUrl });

                        logger.info(`Server discovered with ${endpoints.length} endpoints`);
                        endpoints.forEach((ep, i) => {
                            const policies = ep.userIdentityTokens?.map(p => `${p.policyId} (${UserTokenType[p.tokenType as any]})`).join(', ');
                            logger.info(`Endpoint ${i + 1}:`, {
                                endpointUrl: ep.endpointUrl,
                                securityMode: MessageSecurityMode[ep.securityMode],
                                securityPolicy: ep.securityPolicyUri,
                                userPolicies: policies
                            });
                        });
                    } catch (discoveryError: any) {
                        logger.warn(`Endpoint discovery failed: ${discoveryError.message}. Proceeding with direct connection...`);
                    }

                    // Attempt connection
                    await this.client.connect(config.endpointUrl);
                    logger.info(`Connected to OPC UA server: ${config.endpointUrl}`);

                    // Attempt session creation
                    const isUsernameAuth = config.authenticationMode === 'Username';

                    logger.info(`Creating OPC UA session with mode: ${config.authenticationMode}`, {
                        hasUsername: !!config.username,
                        hasPassword: !!config.password,
                        securityMode: config.securityMode,
                        securityPolicy: config.securityPolicy
                    });

                    const userIdentity: any = isUsernameAuth
                        ? {
                            type: UserTokenType.UserName,
                            userName: config.username || '',
                            password: config.password || ''
                        }
                        : { type: UserTokenType.Anonymous };

                    this.session = await this.client.createSession(userIdentity);
                    logger.info('OPC UA session created');
                },
                {
                    maxAttempts: 3,
                    baseDelay: 2000,
                    retryCondition: (error: Error) => {
                        const message = error.message.toLowerCase();
                        // Do NOT retry on Access Denied as it's likely a config/auth issue
                        if (message.includes('accessdenied') || message.includes('denied')) {
                            return false;
                        }
                        return message.includes('premature disconnection') ||
                            message.includes('timeout') ||
                            message.includes('connection') ||
                            message.includes('socket') ||
                            message.includes('disconnected');
                    }
                },
                'OPC UA Connection'
            );
        } catch (error: any) {
            const errorDetails = {
                message: error.message,
                code: error.code,
                endpointUrl: config.endpointUrl,
                stack: error.stack
            };
            logger.error('Failed to connect to OPC UA server after retries:', errorDetails);

            // Provide helpful hint for BadUserAccessDenied
            if (error.message.includes('BadUserAccessDenied')) {
                logger.error('CRITICAL: ACCESS DENIED. Possible reasons:');
                logger.error('1. Wrong username/password (double check case sensitivity)');
                logger.error('2. Account locked or disabled on OPC UA server');
                logger.error('3. Server requires encryption for username/password login, but current mode is None');
                logger.error('4. Client certificate is NOT trusted on the server (check server trust list)');
            }

            // Cleanup on failure
            if (this.client) {
                try {
                    await this.client.disconnect();
                } catch (e) {
                    logger.warn('Error during emergency OPC UA disconnect:', e);
                }
                this.client = null;
            }
            this.session = null;

            throw createError(`Failed to connect to OPC UA server: ${error.message || 'Unknown error'}`, 500);
        }
    }

    async disconnect(): Promise<void> {
        try {
            if (this.session) {
                await this.session.close();
                this.session = null;
            }
            if (this.client) {
                await this.client.disconnect();
                this.client = null;
            }
            logger.info('Disconnected from OPC UA server');
        } catch (error) {
            logger.error('Error during OPC UA disconnection:', error);
        }
    }

    async browse(nodeId: string = 'RootFolder'): Promise<OpcuaTagInfo[]> {
        if (!this.session) {
            throw createError('No active OPC UA session', 500);
        }

        try {
            const browseResult = await this.session.browse(nodeId);
            const tags: OpcuaTagInfo[] = [];

            if (browseResult.references) {
                for (const ref of browseResult.references) {
                    // We only care about objects and variables
                    if (ref.nodeClass === 1 || ref.nodeClass === 2) {
                        tags.push({
                            nodeId: ref.nodeId.toString(),
                            browseName: ref.browseName.toString(),
                            displayName: ref.displayName.text?.toString() || '',
                            nodeClass: ref.nodeClass === 2 ? 'Variable' : 'Object',
                            dataType: 'unknown', // Will be updated if read
                        });
                    }
                }
            }
            return tags;
        } catch (error) {
            logger.error(`Error browsing OPC UA node ${nodeId}:`, error);
            throw createError('Failed to browse OPC UA server', 500);
        }
    }

    async readVariable(nodeId: string): Promise<{ value: any; quality: string; description?: string; displayName?: string }> {
        if (!this.session) {
            throw createError('No active OPC UA session', 500);
        }

        try {
            const dataValues = await this.session.read([
                {
                    nodeId,
                    attributeId: AttributeIds.Value,
                },
                {
                    nodeId,
                    attributeId: AttributeIds.Description,
                },
                {
                    nodeId,
                    attributeId: AttributeIds.DisplayName,
                }
            ]);

            const valueData = dataValues[0];
            const descriptionData = dataValues[1];
            const displayNameData = dataValues[2];

            return {
                value: valueData?.value?.value,
                quality: valueData?.statusCode?.name === 'Good' ? 'Good' : 'Bad',
                description: descriptionData?.value?.value?.text?.toString() || '',
                displayName: displayNameData?.value?.value?.text?.toString() || ''
            };
        } catch (error) {
            logger.error(`Error reading OPC UA variable ${nodeId}:`, error);
            throw createError('Failed to read OPC UA variable', 500);
        }
    }

    async readValues(nodeIds: string[]): Promise<any[]> {
        if (!this.session) {
            throw createError('No active OPC UA session', 500);
        }

        if (!nodeIds || nodeIds.length === 0) {
            return [];
        }

        try {
            const nodesToRead = nodeIds.map(nodeId => ({
                nodeId,
                attributeId: AttributeIds.Value,
            }));

            const dataValues = await this.session.read(nodesToRead);

            return dataValues.map(dv => {
                if (dv.statusCode?.name !== 'Good' && dv.statusCode?.name !== 'Uncertain') {
                    return null;
                }
                return dv.value?.value;
            });
        } catch (error) {
            logger.error(`Error reading OPC UA variables batch:`, error);
            throw createError('Failed to read OPC UA variables', 500);
        }
    }
}

export const opcuaService = new OpcuaService();
