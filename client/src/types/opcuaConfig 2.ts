export interface OpcuaConfig {
    id?: string;
    name: string;
    endpointUrl: string;
    securityMode: 'None' | 'Sign' | 'SignAndEncrypt';
    securityPolicy: 'None' | 'Basic128Rsa15' | 'Basic256' | 'Basic256Sha256';
    authenticationMode: 'Anonymous' | 'Username';
    username?: string;
    password?: string;
}

export interface OpcuaConfiguration extends OpcuaConfig {
    id: string;
    isActive: boolean;
    createdBy: string;
    createdAt: Date;
    status: 'untested' | 'connected' | 'failed';
    lastError?: string;
}

export interface OpcuaTagInfo {
    nodeId: string;
    browseName: string;
    displayName: string;
    description?: string;
    nodeClass: string;
    typeDefinition?: string;
    dataType?: string;
}
