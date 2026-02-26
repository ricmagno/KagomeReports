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
} from 'node-opcua';
import { OpcuaConfig, OpcuaTagInfo } from '@/types/opcuaConfig';
import { logger } from '@/utils/logger';
import { createError } from '@/middleware/errorHandler';

export class OpcuaService {
    private client: OPCUAClient | null = null;
    private session: ClientSession | null = null;
    private config: OpcuaConfig | null = null;

    constructor() { }

    async connect(config: OpcuaConfig): Promise<void> {
        try {
            this.config = config;

            // Set up client with a reasonable connection strategy
            this.client = OPCUAClient.create({
                endpointMustExist: false,
                securityMode: MessageSecurityMode[config.securityMode as keyof typeof MessageSecurityMode] || MessageSecurityMode.None,
                securityPolicy: SecurityPolicy[config.securityPolicy as keyof typeof SecurityPolicy] || SecurityPolicy.None,
                connectionStrategy: {
                    maxRetry: 1, // Only try twice for connection test
                    initialDelay: 1000,
                    maxDelay: 2000,
                },
                // Add explicit connection timeout (ms)
                requestedSessionTimeout: 10000,
            });

            logger.info(`Attempting to connect to OPC UA server: ${config.endpointUrl}`, {
                securityMode: config.securityMode,
                securityPolicy: config.securityPolicy,
                authenticationMode: config.authenticationMode
            });

            // Use a promise with timeout for the connection
            let timeoutId: NodeJS.Timeout;
            const timeoutPromise = new Promise((_, reject) =>
                timeoutId = setTimeout(() => reject(new Error('Connection timed out (10s)')), 10000)
            );

            try {
                const connectPromise = this.client.connect(config.endpointUrl);
                await Promise.race([connectPromise, timeoutPromise]);
                logger.info(`Connected to OPC UA server: ${config.endpointUrl}`);

                // Similar timeout for session creation
                const sessionPromise = this.client.createSession(
                    config.authenticationMode === 'Username'
                        ? { type: 1, userName: config.username, password: config.password } as any
                        : undefined
                );

                this.session = (await Promise.race([sessionPromise, timeoutPromise])) as ClientSession;
                logger.info('OPC UA session created');
            } finally {
                if (timeoutId!) clearTimeout(timeoutId);
            }
        } catch (error: any) {
            const errorDetails = {
                message: error.message,
                code: error.code,
                endpointUrl: config.endpointUrl,
                stack: error.stack
            };
            logger.error('Failed to connect to OPC UA server:', errorDetails);

            // Cleanup on failure
            if (this.client) {
                await this.client.disconnect();
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
