import React, { useState, useEffect } from 'react';
import { WidgetConfig } from '../../types/dashboard';
import { cn } from '../../utils/cn';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Spinner } from '../ui/Spinner';
import { AlertCircle, Maximize2, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { apiService } from '../../services/api';
import { formatYValue } from '../charts/chartUtils';
import { InteractiveChart } from '../charts/InteractiveChart';
import { TimeSeriesData } from '../../types/api';
import { useMemo } from 'react';

interface WidgetProps {
    widget: WidgetConfig;
    refreshToggle?: boolean;
}

export const Widget: React.FC<WidgetProps> = ({ widget, refreshToggle }) => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorStatus, setErrorStatus] = useState<string | null>(null);
    const [isMaximized, setIsMaximized] = useState(false);

    const fetchData = async () => {
        if (widget.tags.length === 0) return;

        try {
            setLoading(true);
            setErrorStatus(null);

            // Calculate time range based on widget config or default
            const endTime = new Date();
            const startTime = new Date(endTime.getTime() - 60 * 60 * 1000); // Default: 1 hour

            const response = await apiService.getHistorianData({
                tagNames: widget.tags,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                mode: 'Cyclic',
                interval: 60 // 1 minute interval for dashboards usually
            });

            if (response.success && response.data) {
                setData(response.data);
            } else {
                setErrorStatus(response.message || 'Failed to fetch data');
            }
        } catch (err) {
            console.error('Widget data fetch error:', err);
            setErrorStatus('Connection error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [widget.tags, refreshToggle]);

    // Group and format data points for InteractiveChart
    const dataPoints = useMemo(() => {
        const grouped: Record<string, TimeSeriesData[]> = {};

        // Initialize groups for all configured tags
        widget.tags.forEach(tag => {
            grouped[tag] = [];
        });

        // Group actual data points
        data.forEach((point: any) => {
            if (grouped[point.tagName]) {
                grouped[point.tagName].push({
                    ...point,
                    timestamp: new Date(point.timestamp)
                });
            }
        });

        // Sort each group by timestamp
        Object.keys(grouped).forEach(tag => {
            grouped[tag].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        });

        return grouped;
    }, [data, widget.tags]);

    // Simple tag description mapping
    const tagDescriptions = useMemo(() => {
        const descs: Record<string, string> = {};
        widget.tags.forEach(tag => {
            descs[tag] = tag; // Use tag name as description if not available
        });
        return descs;
    }, [widget.tags]);

    const renderContent = () => {
        if (loading && data.length === 0) {
            return (
                <div className="flex items-center justify-center h-48">
                    <Spinner size="md" />
                </div>
            );
        }

        if (errorStatus) {
            return (
                <div className="flex flex-col items-center justify-center h-48 text-red-500 text-center p-4">
                    <AlertCircle className="h-8 w-8 mb-2" />
                    <p className="text-sm font-medium">{errorStatus}</p>
                    <Button variant="ghost" size="sm" onClick={fetchData} className="mt-2">
                        <RefreshCw className="h-3 w-3 mr-1" /> Retry
                    </Button>
                </div>
            );
        }

        if (!widget.tags || widget.tags.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-center p-4">
                    <p className="text-sm">No tags configured for this widget</p>
                </div>
            );
        }

        const type = widget.type === 'trend' ? 'line' :
            widget.type === 'metric' ? 'line' :
                widget.type;

        return (
            <div className="h-full w-full flex flex-col">
                <InteractiveChart
                    dataPoints={dataPoints}
                    tagDescriptions={tagDescriptions}
                    tags={widget.tags}
                    type={type as any}
                    width="100%"
                    height="100%"
                    displayMode="multi"
                    enableGuideLines={true}
                    includeTrendLines={true}
                    title={undefined}
                    className="p-2 flex-1"
                    chartClassName="bg-transparent border-0 shadow-none p-0"
                />
            </div>
        );
    };

    // Convert layout dimensions to style or class
    // For now using simple aspect ratio or fixed height based on 'h'
    const heightClass = widget.layout.h === 1 ? 'h-64' : widget.layout.h === 2 ? 'h-[512px]' : 'h-80';

    return (
        <>
            <Card className={cn(
                "h-full flex flex-col overflow-hidden transition-all duration-300",
                isMaximized ? "fixed inset-0 z-[100] m-4 md:m-8 shadow-2xl ring-2 ring-primary-500 bg-white" : "relative"
            )}>
                <CardHeader className="py-3 px-4 flex-row items-center justify-between border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-sm font-semibold text-gray-700 truncate">{widget.title}</h3>
                    <div className="flex items-center space-x-1">
                        <button onClick={fetchData} className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-400">
                            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={() => setIsMaximized(!isMaximized)}
                            className={cn("p-1 rounded transition-colors", isMaximized ? "bg-primary-100 text-primary-600" : "hover:bg-gray-200 text-gray-400")}
                        >
                            <Maximize2 className="h-3 w-3" />
                        </button>
                    </div>
                </CardHeader>
                <CardContent className={cn("p-0 flex-1 overflow-auto", !isMaximized && heightClass)}>
                    {renderContent()}
                </CardContent>
            </Card>
            {isMaximized && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90] animate-in fade-in duration-300"
                    onClick={() => setIsMaximized(false)}
                />
            )}
        </>
    );
};
