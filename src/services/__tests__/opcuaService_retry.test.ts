import { OpcuaService } from '../opcuaService';
import { OPCUAClient, MessageSecurityMode, SecurityPolicy } from 'node-opcua';
import { OpcuaConfig } from '@/types/opcuaConfig';

// Mock node-opcua
jest.mock('node-opcua', () => ({
    OPCUAClient: {
        create: jest.fn().mockImplementation(() => ({
            getEndpoints: jest.fn().mockResolvedValue([]),
            connect: jest.fn(),
            createSession: jest.fn(),
            disconnect: jest.fn(),
        })),
    },
    OPCUACertificateManager: jest.fn().mockImplementation(() => ({})),
    MessageSecurityMode: {
        None: 0,
        Sign: 1,
        SignAndEncrypt: 2,
    },
    SecurityPolicy: {
        None: 'http://opcfoundation.org/UA/SecurityPolicy#None',
    },
    UserTokenType: {
        Anonymous: 0,
        UserName: 1,
        Certificate: 2,
        IssuedToken: 3,
    },
    AttributeIds: {
        Value: 13,
        Description: 24,
        DisplayName: 4
    }
}));

jest.mock('@/config/environment', () => ({
    getDatabasePath: jest.fn().mockReturnValue('/mock/path/pki'),
}));

// Mock logger
jest.mock('@/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    },
    dbLogger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    }
}));

describe('OpcuaService Retry Logic', () => {
    let opcuaService: OpcuaService;
    let mockClient: any;
    let mockSession: any;

    const testConfig: OpcuaConfig = {
        name: 'Test Server',
        endpointUrl: 'opc.tcp://localhost:4840',
        securityMode: 'None',
        securityPolicy: 'None',
        authenticationMode: 'Anonymous'
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockSession = {
            close: jest.fn().mockResolvedValue(undefined),
        };

        mockClient = {
            connect: jest.fn(),
            createSession: jest.fn(),
            disconnect: jest.fn().mockResolvedValue(undefined),
        };

        (OPCUAClient.create as jest.Mock).mockReturnValue(mockClient);
        opcuaService = new OpcuaService();
    });

    it('should retry on "premature disconnection" error and eventually succeed', async () => {
        // Fail twice with premature disconnection, succeed on 3rd attempt
        mockClient.connect
            .mockRejectedValueOnce(new Error('premature disconnection 4'))
            .mockRejectedValueOnce(new Error('premature disconnection 4'))
            .mockResolvedValueOnce(undefined);

        mockClient.createSession.mockResolvedValue(mockSession);

        await opcuaService.connect(testConfig);

        expect(mockClient.connect).toHaveBeenCalledTimes(3);
        expect(mockClient.createSession).toHaveBeenCalledTimes(1);
    });

    it('should fail after maximum retries', async () => {
        // Always fail with premature disconnection
        mockClient.connect.mockRejectedValue(new Error('premature disconnection 4'));

        await expect(opcuaService.connect(testConfig)).rejects.toThrow('Failed to connect to OPC UA server');

        // RetryHandler is configured for 3 attempts in opcuaService.ts
        expect(mockClient.connect).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
        // Fail with an error that shouldn't be retried (not in the list)
        mockClient.connect.mockRejectedValue(new Error('Invalid certificate'));

        await expect(opcuaService.connect(testConfig)).rejects.toThrow('Failed to connect to OPC UA server');

        // Should only be called once
        expect(mockClient.connect).toHaveBeenCalledTimes(1);
    });
});
