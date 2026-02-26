/**
 * Type definitions for OPC UA configuration management
 */

export interface OpcuaConfiguration {
    id: string;
    name: string;
    endpointUrl: string;
    securityMode: 'None' | 'Sign' | 'SignAndEncrypt';
    securityPolicy: 'None' | 'Basic128Rsa15' | 'Basic256' | 'Basic256Sha256';
    authenticationMode: 'Anonymous' | 'Username';
    username?: string | undefined;
    encryptedPassword?: string | undefined;
    isActive: boolean;
    createdBy: string;
    createdAt: Date;
    lastTested?: Date | undefined;
    status: 'connected' | 'disconnected' | 'error' | 'untested' | 'failed';
    lastError?: string | undefined;
}

export interface OpcuaConfig {
    id?: string;
    name: string;
    endpointUrl: string;
    securityMode: 'None' | 'Sign' | 'SignAndEncrypt';
    securityPolicy: 'None' | 'Basic128Rsa15' | 'Basic256' | 'Basic256Sha256';
    authenticationMode: 'Anonymous' | 'Username';
    username?: string | undefined;
    password?: string | undefined;
}

export interface OpcuaTagInfo {
    nodeId: string;
    browseName: string;
    displayName: string;
    description?: string;
    dataType: string;
    nodeClass?: string;
    value?: any;
}
