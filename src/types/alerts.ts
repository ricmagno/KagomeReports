/**
 * Type definitions for the Alert system
 */

export interface AlertListMember {
    name: string;
    email?: string;
    phone?: string;
}

export interface AlertPattern {
    id: string;
    name: string;
    description?: string;
    pvSuffix: string;
    hhLimitSuffix: string;
    hLimitSuffix: string;
    lLimitSuffix: string;
    llLimitSuffix: string;
    hhEventSuffix: string;
    hEventSuffix: string;
    lEventSuffix: string;
    llEventSuffix: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
}

export interface AlertList {
    id: string;
    name: string;
    description?: string;
    members: AlertListMember[];
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
}

export interface AlertConfig {
    id: string;
    name: string;
    description?: string;
    tagBase: string; // The base tag name, e.g. NV11_FT001
    monitorHH: boolean;
    monitorH: boolean;
    monitorL: boolean;
    monitorLL: boolean;
    alertListId: string;
    patternId: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
}

export interface SaveAlertListRequest {
    name: string;
    description?: string;
    members: Omit<AlertListMember, 'id'>[];
}

export interface SaveAlertPatternRequest {
    name: string;
    description?: string;
    pvSuffix: string;
    hhLimitSuffix: string;
    hLimitSuffix: string;
    lLimitSuffix: string;
    llLimitSuffix: string;
    hhEventSuffix: string;
    hEventSuffix: string;
    lEventSuffix: string;
    llEventSuffix: string;
}

export interface SaveAlertConfigRequest {
    name: string;
    description?: string;
    tagBase: string;
    monitorHH: boolean;
    monitorH: boolean;
    monitorL: boolean;
    monitorLL: boolean;
    alertListId: string;
    patternId: string;
    isActive: boolean;
}

