import React from 'react';
import { Card, CardContent } from '../ui/Card';
import { cn } from '../../utils/cn';

interface ScheduleCardSkeletonProps {
  className?: string;
}

/**
 * Skeleton loader for ScheduleCard
 * Displays a loading placeholder while schedules are being fetched
 */
export const ScheduleCardSkeleton: React.FC<ScheduleCardSkeletonProps> = ({ className }) => {
  return (
    <Card className={cn('animate-pulse', className)} data-testid="schedule-card-skeleton">
      <CardContent className="p-4 sm:p-6">
        {/* Header with title and status */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              {/* Title skeleton */}
              <div className="h-5 sm:h-6 bg-gray-200 rounded w-40 sm:w-48"></div>
              {/* Status badge skeleton */}
              <div className="h-5 w-16 bg-gray-200 rounded-full"></div>
            </div>
            {/* Description skeleton */}
            <div className="h-4 bg-gray-200 rounded w-full mb-1"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>

          {/* Toggle skeleton */}
          <div className="sm:ml-4">
            <div className="h-6 w-24 bg-gray-200 rounded-full"></div>
          </div>
        </div>

        {/* Schedule Information Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
          <div>
            <div className="h-3 bg-gray-200 rounded w-20 mb-2"></div>
            <div className="h-5 bg-gray-200 rounded w-32"></div>
          </div>
          <div>
            <div className="h-3 bg-gray-200 rounded w-20 mb-2"></div>
            <div className="h-5 bg-gray-200 rounded w-32"></div>
          </div>
          <div>
            <div className="h-3 bg-gray-200 rounded w-20 mb-2"></div>
            <div className="h-5 bg-gray-200 rounded w-32"></div>
          </div>
          <div>
            <div className="h-3 bg-gray-200 rounded w-20 mb-2"></div>
            <div className="h-5 bg-gray-200 rounded w-32"></div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
          <div className="h-8 w-12 sm:w-16 bg-gray-200 rounded"></div>
          <div className="h-8 w-16 sm:w-20 bg-gray-200 rounded"></div>
          <div className="h-8 w-16 sm:w-20 bg-gray-200 rounded"></div>
          <div className="h-8 w-16 sm:w-20 bg-gray-200 rounded"></div>
        </div>
      </CardContent>
    </Card>
  );
};
