import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    ArrowLeft,
    Settings,
    RefreshCw,
    Clock,
    Calendar,
    ChevronDown,
    Play,
    Pause
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Widget } from './Widget';
import { DashboardConfig } from '../../types/dashboard';
import { apiService } from '../../services/api';
import { useToast } from '../../hooks/useToast';

interface DashboardViewProps {
    dashboardId: string;
    onBack: () => void;
    onEdit: () => void;
}

interface DashboardState {
    dashboard: DashboardConfig | null;
    loading: boolean;
    refreshEnabled: boolean;
    secondsUntilRefresh: number;
    refreshCounter: number;
    lastRefreshTime: Date;
}

type DashboardAction =
    | { type: 'FETCH_START' }
    | { type: 'FETCH_SUCCESS'; payload: DashboardConfig }
    | { type: 'FETCH_ERROR' }
    | { type: 'TOGGLE_REFRESH' }
    | { type: 'TICK' }
    | { type: 'FORCE_REFRESH' };

const dashboardReducer = (state: DashboardState, action: DashboardAction): DashboardState => {
    switch (action.type) {
        case 'FETCH_START':
            return { ...state, loading: true };
        case 'FETCH_SUCCESS':
            return {
                ...state,
                loading: false,
                dashboard: action.payload,
                secondsUntilRefresh: action.payload.refreshRate || 30
            };
        case 'FETCH_ERROR':
            return { ...state, loading: false };
        case 'TOGGLE_REFRESH':
            return { ...state, refreshEnabled: !state.refreshEnabled };
        case 'TICK':
            if (state.secondsUntilRefresh <= 1) {
                return {
                    ...state,
                    secondsUntilRefresh: state.dashboard?.refreshRate || 30,
                    refreshCounter: state.refreshCounter + 1,
                    lastRefreshTime: new Date()
                };
            }
            return { ...state, secondsUntilRefresh: state.secondsUntilRefresh - 1 };
        case 'FORCE_REFRESH':
            return {
                ...state,
                refreshCounter: state.refreshCounter + 1,
                lastRefreshTime: new Date(),
                secondsUntilRefresh: state.dashboard?.refreshRate || 30
            };
        default:
            return state;
    }
};

export const DashboardView: React.FC<DashboardViewProps> = ({
    dashboardId,
    onBack,
    onEdit
}) => {
    const [state, dispatch] = React.useReducer(dashboardReducer, {
        dashboard: null,
        loading: true,
        refreshEnabled: true,
        secondsUntilRefresh: 30,
        refreshCounter: 0,
        lastRefreshTime: new Date()
    });

    const { dashboard, loading, refreshEnabled, secondsUntilRefresh, refreshCounter, lastRefreshTime } = state;
    const { error } = useToast();

    const fetchDashboard = useCallback(async () => {
        try {
            dispatch({ type: 'FETCH_START' });
            const response = await apiService.loadDashboard(dashboardId);
            if (response.success) {
                dispatch({ type: 'FETCH_SUCCESS', payload: response.data.config });
            } else {
                error('Failed to load dashboard');
                dispatch({ type: 'FETCH_ERROR' });
            }
        } catch (err) {
            console.error('Error loading dashboard:', err);
            error('Failed to load dashboard');
            dispatch({ type: 'FETCH_ERROR' });
        }
    }, [dashboardId, error]);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    // Independent timer effect
    useEffect(() => {
        if (!dashboard || !refreshEnabled) {
            return;
        }

        const intervalId = setInterval(() => {
            dispatch({ type: 'TICK' });
        }, 1000);

        return () => {
            clearInterval(intervalId);
        };
    }, [dashboard, refreshEnabled]);

    const toggleRefresh = useCallback(() => {
        dispatch({ type: 'TOGGLE_REFRESH' });
    }, []);

    const forceRefresh = useCallback(() => {
        dispatch({ type: 'FORCE_REFRESH' });
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
                <p className="text-gray-500">Loading your dashboard...</p>
            </div>
        );
    }

    if (!dashboard) {
        return (
            <div className="text-center py-20">
                <p className="text-red-500 mb-4">Dashboard not found</p>
                <Button onClick={onBack}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to List
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        title="Back to Dashboards"
                    >
                        <ArrowLeft className="h-5 w-5 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{dashboard.name}</h1>
                        <div className="flex items-center text-xs text-gray-500 mt-0.5">
                            <Clock className="h-3 w-3 mr-1" />
                            <span>Refresh: {dashboard.refreshRate}s</span>
                            <span className="mx-2">•</span>
                            <Calendar className="h-3 w-3 mr-1" />
                            <span>{dashboard.timeRange.relativeRange || 'Manual'}</span>
                            <span className="mx-2">•</span>
                            <span className="text-primary-600 font-medium tracking-tight">
                                Updated: {lastRefreshTime.toLocaleTimeString()}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={forceRefresh}
                        className="flex items-center bg-gray-50 border border-gray-200 rounded-md px-3 py-1.5 mr-2 hover:bg-gray-100 hover:border-gray-300 transition-colors group"
                        title="Refresh Now"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 mr-2 text-primary-600 ${refreshEnabled ? 'animate-spin-slow' : ''} group-hover:rotate-180 transition-transform duration-500`} />
                        <span className="text-xs font-medium text-gray-700 w-10 text-left">
                            {refreshEnabled ? `${secondsUntilRefresh}s` : 'Paused'}
                        </span>
                    </button>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleRefresh}
                        className={refreshEnabled ? 'text-amber-600 hover:text-amber-700 bg-amber-50' : 'text-green-600 hover:text-green-700 bg-green-50'}
                    >
                        {refreshEnabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>



                    <Button variant="outline" size="sm" onClick={onEdit}>
                        <Settings className="h-4 w-4 mr-2" />
                        Edit
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-max">
                {dashboard.widgets.map((widget) => (
                    <div
                        key={widget.id}
                        className={
                            (widget.type === 'value-block' || widget.type === 'radial-gauge') ? 'col-span-1' :
                                widget.layout.w === 4 ? 'col-span-1 md:col-span-2 lg:col-span-4' :
                                    widget.layout.w === 3 ? 'col-span-1 md:col-span-2 lg:col-span-3' :
                                        widget.layout.w === 2 ? 'col-span-1 md:col-span-2' :
                                            'col-span-1 md:col-span-2' // Default for charts is 2 if somehow it was set to 1
                        }
                    >
                        <Widget
                            widget={widget}
                            refreshToggle={refreshCounter}
                            globalTimeRange={dashboard.timeRange}
                        />
                    </div>
                ))}
            </div>

            {dashboard.widgets.length === 0 && (
                <div className="py-20 text-center text-gray-500 bg-white rounded-lg border border-gray-200">
                    <p>This dashboard has no widgets.</p>
                    <Button className="mt-4" onClick={onEdit}>
                        Add Your First Widget
                    </Button>
                </div>
            )}
        </div>
    );
};
