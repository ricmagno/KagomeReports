import React from 'react';
import { cn } from '../../utils/cn';

interface ValueBlockProps {
    tagName: string;
    value: string | number;
    unit?: string;
    description?: string;
    status?: 'good' | 'bad' | 'uncertain';
    className?: string;
    isMaximized?: boolean;
}

export const ValueBlock: React.FC<ValueBlockProps> = ({
    tagName,
    value,
    unit = '',
    description = '',
    status = 'good',
    className = '',
    isMaximized = false
}) => {
    const statusColors = {
        good: 'text-gray-900 border-gray-100 bg-white',
        bad: 'text-red-900 border-red-100 bg-red-50/30',
        uncertain: 'text-amber-900 border-amber-100 bg-amber-50/30'
    };

    const statusIcons = {
        good: 'bg-green-500',
        bad: 'bg-red-500',
        uncertain: 'bg-amber-500'
    };

    const formattedValue = typeof value === 'number' ? value.toFixed(1) : value;

    return (
        <div className={cn(
            "flex flex-col rounded-lg border shadow-sm transition-all hover:shadow-md h-full relative overflow-hidden bg-white p-6",
            statusColors[status],
            className
        )}>
            {/* Status indicator */}
            <div className={cn(
                "absolute top-3 right-3 rounded-full border-2 border-white shadow-sm z-10",
                isMaximized ? "w-6 h-6 border-4" : "w-3 h-3",
                statusIcons[status]
            )} />

            {/* Main Information - Vertically Stacked and Centered */}
            <div className={cn(
                "flex-1 flex flex-col items-center justify-center",
                !isMaximized && "-mt-2"
            )}>
                <div className={cn(
                    "flex items-baseline justify-center space-x-1 transition-transform duration-300 hover:scale-110",
                    isMaximized ? "mb-4" : "mb-1"
                )}>
                    <span className={cn(
                        "font-black tracking-tighter text-gray-900 leading-none",
                        isMaximized ? "text-9xl" : "text-5xl"
                    )}>
                        {formattedValue}
                    </span>
                    {unit && (
                        <span className={cn(
                            "font-bold text-gray-400",
                            isMaximized ? "text-4xl" : "text-lg"
                        )}>
                            {unit}
                        </span>
                    )}
                </div>

                <span className={cn(
                    "font-black text-gray-400 uppercase tracking-widest truncate max-w-full px-2",
                    isMaximized ? "text-2xl" : "text-[11px]"
                )} title={tagName}>
                    {tagName}
                </span>
            </div>

            {/* Description - Absolutely pinned to bottom */}
            {description && (
                <div className={cn(
                    "absolute left-0 right-0 text-center px-4",
                    isMaximized ? "bottom-8" : "bottom-4"
                )}>
                    <span className={cn(
                        "text-gray-400 font-medium truncate block opacity-70 italic",
                        isMaximized ? "text-lg" : "text-[10px]"
                    )}>
                        {description}
                    </span>
                </div>
            )}
        </div>
    );
};
