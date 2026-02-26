import { apiService as api } from './api';

export interface AlertListMember {
    name: string;
    email?: string;
    phone?: string;
}

export interface AlertList {
    id: string;
    name: string;
    description?: string;
    members: AlertListMember[];
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface AlertConfig {
    id: string;
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
    createdBy: string;
    createdAt: string;
    updatedAt: string;
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
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface SaveAlertListRequest {
    name: string;
    description?: string;
    members: AlertListMember[];
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
    isActive?: boolean;
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

export const alertsApi = {
    // --- Alert Lists ---
    getAlertLists: async () => {
        const response = await api.get<{ success: boolean; data: AlertList[] }>('/alerts/lists');
        return response.data;
    },

    getAlertListById: async (id: string) => {
        const response = await api.get<{ success: boolean; data: AlertList }>(`/alerts/lists/${id}`);
        return response.data;
    },

    createAlertList: async (data: SaveAlertListRequest) => {
        const response = await api.post<{ success: boolean; data: AlertList }>('/alerts/lists', data);
        return response.data;
    },

    updateAlertList: async (id: string, data: SaveAlertListRequest) => {
        const response = await api.put<{ success: boolean; data: AlertList }>(`/alerts/lists/${id}`, data);
        return response.data;
    },

    deleteAlertList: async (id: string) => {
        const response = await api.delete<{ success: boolean; message: string }>(`/alerts/lists/${id}`);
        return response.message;
    },

    // --- Alert Configs ---
    getAlertConfigs: async () => {
        const response = await api.get<{ success: boolean; data: AlertConfig[] }>('/alerts/configs');
        return response.data;
    },

    getActiveAlertConfigs: async () => {
        const response = await api.get<{ success: boolean; data: AlertConfig[] }>('/alerts/configs/active');
        return response.data;
    },

    getAlertConfigById: async (id: string) => {
        const response = await api.get<{ success: boolean; data: AlertConfig }>(`/alerts/configs/${id}`);
        return response.data;
    },

    createAlertConfig: async (data: SaveAlertConfigRequest) => {
        const response = await api.post<{ success: boolean; data: AlertConfig }>('/alerts/configs', data);
        return response.data;
    },

    updateAlertConfig: async (id: string, data: SaveAlertConfigRequest) => {
        const response = await api.put<{ success: boolean; data: AlertConfig }>(`/alerts/configs/${id}`, data);
        return response.data;
    },

    deleteAlertConfig: async (id: string) => {
        const response = await api.delete<{ success: boolean; message: string }>(`/alerts/configs/${id}`);
        return response.message;
    },

    // --- Alert Patterns ---
    getAlertPatterns: async () => {
        const response = await api.get<{ success: boolean; data: AlertPattern[] }>('/alerts/patterns');
        return response.data;
    },

    getAlertPatternById: async (id: string) => {
        const response = await api.get<{ success: boolean; data: AlertPattern }>(`/alerts/patterns/${id}`);
        return response.data;
    },

    createAlertPattern: async (data: SaveAlertPatternRequest) => {
        const response = await api.post<{ success: boolean; data: AlertPattern }>('/alerts/patterns', data);
        return response.data;
    },

    updateAlertPattern: async (id: string, data: SaveAlertPatternRequest) => {
        const response = await api.put<{ success: boolean; data: AlertPattern }>(`/alerts/patterns/${id}`, data);
        return response.data;
    },

    deleteAlertPattern: async (id: string) => {
        const response = await api.delete<{ success: boolean; message: string }>(`/alerts/patterns/${id}`);
        return response.message;
    }
};
