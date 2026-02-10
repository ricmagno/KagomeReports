import React, { useState, useEffect, useRef } from 'react';
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

export const DashboardView: React.FC<DashboardViewProps> = ({
    dashboardId,
    onBack,
    onEdit
}) => {
    const [dashboard, setDashboard] = useState<DashboardConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshEnabled, setRefreshEnabled] = useState(true);
    const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(30);
    const [refreshToggle, setRefreshToggle] = useState(false);
    const { error } = useToast();

    const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const fetchDashboard = async () => {
        try {
            setLoading(true);
            const response = await apiService.loadDashboard(dashboardId);
            if (response.success) {
                setDashboard(response.data.config);
                setSecondsUntilRefresh(response.data.config.refreshRate || 30);
            } else {
                error('Failed to load dashboard');
            }
        } catch (err) {
            console.error('Error loading dashboard:', err);
            error('Failed to load dashboard');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
    }, [dashboardId]);

    // Handle auto-refresh logic
    useEffect(() => {
        if (!dashboard || !refreshEnabled) {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            return;
        }

        const refreshRate = dashboard.refreshRate || 30;

        timerIntervalRef.current = setInterval(() => {
            setSecondsUntilRefresh(prev => {
                if (prev <= 1) {
                    setRefreshToggle(t => !t); // Trigger widgets refresh
                    return refreshRate;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, [dashboard, refreshEnabled]);

    const toggleRefresh = () => {
        setRefreshEnabled(!refreshEnabled);
    };

    const forceRefresh = () => {
        setRefreshToggle(t => !t);
        if (dashboard) setSecondsUntilRefresh(dashboard.refreshRate || 30);
    };

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
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-gray-50 border border-gray-200 rounded-md px-3 py-1.5 mr-2">
                        <RefreshCw className={`h-3.5 w-3.5 mr-2 text-primary-600 ${refreshEnabled ? 'animate-spin-slow' : ''}`} />
                        <span className="text-xs font-medium text-gray-700 w-16">
                            {refreshEnabled ? `Next in ${secondsUntilRefresh}s` : 'Paused'}
                        </span>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleRefresh}
                        className={refreshEnabled ? 'text-amber-600 hover:text-amber-700 bg-amber-50' : 'text-green-600 hover:text-green-700 bg-green-50'}
                    >
                        {refreshEnabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>

                    <Button variant="outline" size="sm" onClick={forceRefresh}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh Now
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
                            widget.layout.w === 4 ? 'col-span-1 md:col-span-2 lg:col-span-4' :
                                widget.layout.w === 3 ? 'col-span-1 md:col-span-2 lg:col-span-3' :
                                    widget.layout.w === 2 ? 'col-span-1 md:col-span-2' :
                                        'col-span-1'
                        }
                    >
                        <Widget widget={widget} refreshToggle={refreshToggle} />
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
