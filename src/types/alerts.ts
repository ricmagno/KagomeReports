/**
 * Type definitions for the Alert system
 */

export interface DistributionListMember {
    name: string;
    email?: string;
    phone?: string;
}

export interface DistributionList {
    id: string;
    name: string;
    description?: string;
    members: DistributionListMember[];
    createdAt: Date;
    updatedAt: Date;
}

export interface AlertConfig {
    id: string;
    name: string;
    tagName: string; // prefixed with opcua: for now
    hhLimit?: number;
    hLimit?: number;
    lLimit?: number;
    llLimit?: number;
    deadband?: number;
    delay?: number; // seconds to wait before triggering
    distributionListId: string;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export type AlertStatus = 'NORMAL' | 'HH' | 'H' | 'L' | 'LL';

export interface AlertEvent {
    id: string;
    alertId: string;
    timestamp: Date;
    type: AlertStatus;
    value: number;
    limit: number;
    status: 'ACTIVE' | 'CLEARED';
}
