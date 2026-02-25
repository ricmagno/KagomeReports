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
import { TimeSeriesData, TagInfo } from '../../types/api';
import { useMemo } from 'react';
import { RadialGauge } from './RadialGauge';
import { ValueBlock } from './ValueBlock';
import { RadarChart } from '../charts/RadarChart';

interface WidgetProps {
    widget: WidgetConfig;
    refreshToggle?: boolean | number;
    globalTimeRange?: {
        startTime?: string | Date;
        endTime?: string | Date;
        relativeRange?: string;
    };
}

export const Widget: React.FC<WidgetProps> = ({ widget, refreshToggle, globalTimeRange }) => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorStatus, setErrorStatus] = useState<string | null>(null);
    const [tagInfoMap, setTagInfoMap] = useState<Record<string, TagInfo>>({});
    const [isMaximized, setIsMaximized] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const getRangeSeconds = (range?: string) => {
        switch (range) {
            case 'last1h': return 3600;
            case 'last2h': return 7200;
            case 'last6h': return 21600;
            case 'last12h': return 43200;
            case 'last24h': return 86400;
            case 'last7d': return 604800;
            case 'last30d': return 2592000;
            default: return 3600;
        }
    };

    const isLiveWidget = widget.type === 'radial-gauge' || widget.type === 'value-block' || widget.type === 'radar';

    const fetchData = async (silent = false) => {
        if (widget.tags.length === 0) return;

        try {
            if (!silent) {
                setLoading(true);
            }
            setErrorStatus(null);

            // Calculate time range based on widget config or global dashboard config
            const endTime = new Date();
            let startTime = new Date(endTime.getTime() - 60 * 60 * 1000); // Default: 1 hour

            if (globalTimeRange?.relativeRange) {
                const seconds = getRangeSeconds(globalTimeRange.relativeRange);
                startTime = new Date(endTime.getTime() - seconds * 1000);
            } else if (globalTimeRange?.startTime) {
                startTime = new Date(globalTimeRange.startTime);
            }

            // Determine retrieval mode based on widget type
            const mode = isLiveWidget ? 'Live' : 'Delta';

            const response = await apiService.getHistorianData({
                tagNames: widget.tags,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                mode: mode as any,
                // For Live mode we only want the latest value (limit: 1)
                // For Delta mode we want high resolution data
                limit: isLiveWidget ? 1 : 1000000000000,
                // interval is only for Cyclic mode, which we're moving away from for these widgets
            });

            if (response.success && response.data) {
                if (isLiveWidget) {
                    // For live widgets, merge with previous state to preserve values if record expires
                    setData(prevData => {
                        const newDataMap = new Map((response.data as any[]).map(d => [d.tagName, d]));
                        const mergedData = [...prevData];

                        widget.tags.forEach(tagName => {
                            const newPoint = newDataMap.get(tagName);
                            const existingIdx = mergedData.findIndex(d => d.tagName === tagName);

                            if (newPoint && newPoint.value !== null && newPoint.value !== undefined) {
                                if (existingIdx > -1) {
                                    mergedData[existingIdx] = newPoint;
                                } else {
                                    mergedData.push(newPoint);
                                }
                            } else {
                                // Record expired or value is null, keep last value but mark quality as Bad (0)
                                if (existingIdx > -1) {
                                    mergedData[existingIdx] = {
                                        ...mergedData[existingIdx],
                                        quality: 0, // Mark as bad/expired
                                        timestamp: new Date() // Still update timestamp
                                    };
                                } else if (newPoint) {
                                    // First time seeing this tag but it's null
                                    mergedData.push({ ...newPoint, quality: 0 });
                                }
                            }
                        });
                        return mergedData;
                    });
                } else {
                    setData(response.data);
                }
                setLastUpdated(new Date());

                // Fetch tag info for metadata (min/max/units) if we don't have it
                const missingTags = widget.tags.filter(tag => !tagInfoMap[tag]);
                if (missingTags.length > 0) {
                    try {
                        const infoPromises = missingTags.map(tag => apiService.getTagInfo(tag));
                        const infoResponses = await Promise.all(infoPromises);

                        const newInfoMap = { ...tagInfoMap };
                        infoResponses.forEach((res, index) => {
                            if (res.success && res.data) {
                                newInfoMap[missingTags[index]] = res.data;
                            }
                        });
                        setTagInfoMap(newInfoMap);
                    } catch (metaErr) {
                        console.warn('Failed to fetch widget metadata, using defaults:', metaErr);
                    }
                }
            } else {
                setErrorStatus(response.message || 'Failed to fetch data');
            }
        } catch (err) {
            console.error('Widget data fetch error:', err);
            setErrorStatus('Connection error');
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        fetchData();
    }, [widget.tags, refreshToggle, globalTimeRange]);

    // Set up auto-refresh for live widgets (1 second)
    useEffect(() => {
        if (!isLiveWidget) return;

        const intervalId = setInterval(() => {
            fetchData(true); // silent refresh
        }, 1000);

        return () => clearInterval(intervalId);
    }, [isLiveWidget, widget.tags]);

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
            descs[tag] = tagInfoMap[tag]?.description || tag;
        });
        return descs;
    }, [widget.tags, tagInfoMap]);

    const renderContent = () => {
        if (loading && data.length === 0) {
            return (
                <div className="flex items-center justify-center h-full min-h-[200px]">
                    <Spinner size="md" />
                </div>
            );
        }

        if (errorStatus) {
            return (
                <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-red-500 text-center p-4">
                    <AlertCircle className="h-8 w-8 mb-2" />
                    <p className="text-sm font-medium">{errorStatus}</p>
                    <Button variant="ghost" size="sm" onClick={() => fetchData()} className="mt-2">
                        <RefreshCw className="h-3 w-3 mr-1" /> Retry
                    </Button>
                </div>
            );
        }

        if (!widget.tags || widget.tags.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-gray-400 text-center p-4">
                    <p className="text-sm">No tags configured for this widget</p>
                </div>
            );
        }

        if (widget.type === 'radial-gauge' || widget.type === 'value-block') {
            const tagName = widget.tags[0];
            const tagData = dataPoints[tagName] || [];
            const lastPoint = tagData[tagData.length - 1];
            const tagInfo = tagInfoMap[tagName];

            if (widget.type === 'radial-gauge') {
                return (
                    <RadialGauge
                        value={lastPoint?.value || 0}
                        min={tagInfo?.minValue || 0}
                        max={tagInfo?.maxValue || 100}
                        tagName={tagName}
                        unit={tagInfo?.units || ''}
                        description={lastPoint?.description || tagInfo?.description}
                        status={lastPoint?.quality === 'Good' || lastPoint?.quality === 192 ? 'good' : 'bad'}
                        isMaximized={isMaximized}
                    />
                );
            }

            return (
                <div className="h-full w-full">
                    <ValueBlock
                        tagName={tagName}
                        value={lastPoint?.value ?? 'N/A'}
                        unit={tagInfo?.units}
                        description={lastPoint?.description || tagInfo?.description}
                        status={lastPoint?.quality === 'Good' || lastPoint?.quality === 192 ? 'good' : 'bad'}
                        className="rounded-none border-0 shadow-none bg-transparent"
                        isMaximized={isMaximized}
                    />
                </div>
            );
        }

        if (widget.type === 'radar') {
            const radarData: Record<string, number> = {};
            let isAnyBad = false;

            widget.tags.forEach(tag => {
                const tagData = dataPoints[tag] || [];
                const lastPoint = tagData[tagData.length - 1];
                radarData[tag] = lastPoint?.value || 0;

                if (lastPoint && lastPoint.quality !== 'Good' && lastPoint.quality !== 192) {
                    isAnyBad = true;
                }
            });

            return (
                <div className="h-full w-full">
                    <RadarChart
                        data={radarData}
                        title={widget.title}
                        status={isAnyBad ? 'bad' : 'good'}
                    />
                </div>
            );
        }

        const type = widget.type === 'trend' ? 'line' :
            widget.type === 'metric' ? 'line' :
                widget.type;

        return (
            <div className={cn(
                "h-full w-full flex flex-col transition-opacity duration-300",
                loading && data.length > 0 ? "opacity-60" : "opacity-100"
            )}>
                <InteractiveChart
                    dataPoints={dataPoints}
                    tagDescriptions={tagDescriptions}
                    tags={widget.tags}
                    type={type as any}
                    width="100%"
                    height="100%"
                    displayMode="multi"
                    enableGuideLines={false}
                    includeTrendLines={true}
                    title={undefined}
                    className="p-2 flex-1"
                    chartClassName="bg-transparent border-0 shadow-none p-0"
                />
                {loading && data.length > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/10 pointer-events-none">
                        <div className="bg-white/80 rounded-full p-2 shadow-sm border border-gray-100">
                            <RefreshCw className="h-4 w-4 text-primary-500 animate-spin" />
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Convert layout dimensions to style or class
    // For now using simple aspect ratio or fixed height based on 'h'
    const heightClass = widget.type === 'value-block' ? 'h-40' :
        widget.layout.h === 1 ? 'h-64' :
            widget.layout.h === 2 ? 'h-[512px]' :
                'h-80';

    return (
        <>
            <Card className={cn(
                "h-full flex flex-col overflow-hidden transition-all duration-300",
                isMaximized ? "fixed inset-0 z-[100] m-4 md:m-8 shadow-2xl ring-2 ring-primary-500 bg-white" : "relative"
            )}>
                <CardHeader className="py-2 px-4 flex-row items-center justify-between border-b border-gray-100 bg-gray-50/50">
                    <div className="flex flex-col min-w-0">
                        <h3 className="text-sm font-semibold text-gray-700 truncate">{widget.title}</h3>
                        {lastUpdated && (
                            <span className="text-[10px] text-gray-400 font-medium">
                                Updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center space-x-1">
                        <button onClick={() => fetchData()} title="Refresh data" className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-400">
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
