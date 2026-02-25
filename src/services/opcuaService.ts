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
            this.client = OPCUAClient.create({
                endpointMustExist: false,
                securityMode: MessageSecurityMode[config.securityMode as keyof typeof MessageSecurityMode] || MessageSecurityMode.None,
                securityPolicy: SecurityPolicy[config.securityPolicy as keyof typeof SecurityPolicy] || SecurityPolicy.None,
            });

            await this.client.connect(config.endpointUrl);
            logger.info(`Connected to OPC UA server: ${config.endpointUrl}`);

            this.session = (await this.client.createSession(
                config.authenticationMode === 'Username'
                    ? { type: 1, userName: config.username, password: config.password } as any
                    : undefined
            )) as ClientSession;
            logger.info('OPC UA session created');
        } catch (error) {
            logger.error('Failed to connect to OPC UA server:', error);
            this.client = null;
            this.session = null;
            throw createError('Failed to connect to OPC UA server', 500);
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

    async readVariable(nodeId: string): Promise<{ value: any; quality: string }> {
        if (!this.session) {
            throw createError('No active OPC UA session', 500);
        }

        try {
            const dataValue = await this.session.read({
                nodeId,
                attributeId: AttributeIds.Value,
            });
            return {
                value: dataValue.value.value,
                quality: dataValue.statusCode.toString() === 'Good' ? 'Good' : 'Bad'
            };
        } catch (error) {
            logger.error(`Error reading OPC UA variable ${nodeId}:`, error);
            throw createError('Failed to read OPC UA variable', 500);
        }
    }
}

export const opcuaService = new OpcuaService();
