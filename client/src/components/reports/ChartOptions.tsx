import React, { useState, useRef, useEffect } from 'react';
import { BarChart3, LineChart, ChevronDown, Settings, X, Zap, ZapOff, Activity } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ChartOptionsProps {
    chartTypes: ('line' | 'bar')[];
    onChartTypesChange: (types: ('line' | 'bar')[]) => void;
    realTimeEnabled: boolean;
    onRealTimeEnabledChange: (enabled: boolean) => void;
    realTimeStatus: {
        connected: boolean;
        loading: boolean;
        lastUpdate: Date | null;
        error: string | null;
    };
    disabled?: boolean;
    className?: string;
}

export const ChartOptions: React.FC<ChartOptionsProps> = ({
    chartTypes = ['line'],
    onChartTypesChange,
    realTimeEnabled = false,
    onRealTimeEnabledChange,
    realTimeStatus,
    disabled = false,
    className
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const toggleChartType = (type: 'line' | 'bar') => {
        if (chartTypes.includes(type)) {
            if (chartTypes.length > 1) {
                onChartTypesChange(chartTypes.filter(t => t !== type));
            }
        } else {
            onChartTypesChange([...chartTypes, type]);
        }
    };

    return (
        <div className={cn("relative w-full", className)} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={cn(
                    "flex items-center justify-between w-full px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg border shadow-sm",
                    disabled
                        ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
                        : "bg-white text-gray-700 border-gray-300 hover:border-primary-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2",
                    isOpen && "ring-2 ring-primary-500 border-primary-500 shadow-md bg-white"
                )}
            >
                <div className="flex items-center">
                    <div className={cn(
                        "p-1.5 rounded-md mr-3 transition-colors",
                        isOpen ? "bg-primary-100 text-primary-600" : "bg-gray-100 text-gray-500"
                    )}>
                        <Activity className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col items-start">
                        <span className="font-semibold">Chart Options</span>
                        <span className="text-[0.7rem] text-gray-500 font-normal">
                            {chartTypes.length} type{chartTypes.length !== 1 ? 's' : ''} • {realTimeEnabled ? 'Real-time on' : 'Real-time off'}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {realTimeEnabled && !isOpen && (
                        <span className="flex items-center justify-center w-5 h-5 bg-green-100 text-green-600 rounded-full">
                            <Zap className="w-3 h-3 fill-current" />
                        </span>
                    )}
                    <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform duration-200", isOpen && "transform rotate-180 text-primary-500")} />
                </div>
            </button>

            {isOpen && (
                <div className="absolute right-0 z-50 w-full mt-2 origin-top-right bg-white border border-gray-200 rounded-xl shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <span className="px-1 text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest">Configuration</span>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="p-1 hover:bg-gray-200 rounded-md transition-colors"
                        >
                            <X className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                    </div>

                    <div className="p-3 space-y-4">
                        {/* Chart Types Section */}
                        <div className="space-y-2">
                            <label className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider ml-1">Chart Types</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => toggleChartType('line')}
                                    className={cn(
                                        "flex flex-col items-center justify-center p-3 rounded-lg border transition-all",
                                        chartTypes.includes('line')
                                            ? "bg-primary-50 border-primary-200 text-primary-700"
                                            : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                                    )}
                                >
                                    <LineChart className="w-5 h-5 mb-1" />
                                    <span className="text-xs font-semibold">Line</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => toggleChartType('bar')}
                                    className={cn(
                                        "flex flex-col items-center justify-center p-3 rounded-lg border transition-all",
                                        chartTypes.includes('bar')
                                            ? "bg-primary-50 border-primary-200 text-primary-700"
                                            : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                                    )}
                                >
                                    <BarChart3 className="w-5 h-5 mb-1" />
                                    <span className="text-xs font-semibold">Bar</span>
                                </button>
                            </div>
                        </div>

                        {/* Real-time Toggle */}
                        <div className="pt-2 border-t border-gray-100">
                            <label className={cn(
                                "flex items-start p-3 rounded-lg cursor-pointer transition-all border group",
                                realTimeEnabled ? "bg-green-50 border-green-200" : "hover:bg-gray-50 border-transparent"
                            )}>
                                <div className="flex items-center h-5">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                                        checked={realTimeEnabled}
                                        onChange={(e) => onRealTimeEnabledChange(e.target.checked)}
                                    />
                                </div>
                                <div className="ml-3 flex-1">
                                    <div className="flex items-center">
                                        {realTimeEnabled ? (
                                            <Zap className="w-3.5 h-3.5 mr-2 text-green-600 fill-current" />
                                        ) : (
                                            <ZapOff className="w-3.5 h-3.5 mr-2 text-gray-400" />
                                        )}
                                        <span className={cn("text-xs font-bold", realTimeEnabled ? "text-green-900" : "text-gray-700")}>Real-time Updates</span>
                                    </div>
                                    <p className="mt-1 text-[0.65rem] text-gray-500 leading-relaxed">Automatically refresh data points from the historian server</p>
                                </div>
                            </label>

                            {realTimeEnabled && (
                                <div className="mt-2 ml-3 pl-3 border-l-2 border-green-200 space-y-1.5 py-1">
                                    <div className="flex items-center justify-between text-[0.65rem]">
                                        <span className="text-gray-500">Status:</span>
                                        <span className={cn(
                                            "font-bold px-1.5 py-0.5 rounded-full",
                                            realTimeStatus.connected ? "bg-green-100 text-green-700" :
                                                realTimeStatus.loading ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                                        )}>
                                            {realTimeStatus.loading ? 'Connecting' :
                                                realTimeStatus.connected ? 'Connected' : 'Disconnected'}
                                        </span>
                                    </div>
                                    {realTimeStatus.lastUpdate && (
                                        <div className="flex items-center justify-between text-[0.65rem]">
                                            <span className="text-gray-500">Last Update:</span>
                                            <span className="text-gray-700 font-medium">{realTimeStatus.lastUpdate.toLocaleTimeString()}</span>
                                        </div>
                                    )}
                                    {realTimeStatus.error && (
                                        <div className="text-red-600 text-[0.6rem] font-medium italic">
                                            Error: {realTimeStatus.error}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="pt-1">
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="w-full py-2 text-[0.7rem] font-bold text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors border border-primary-100"
                            >
                                Apply Configuration
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
