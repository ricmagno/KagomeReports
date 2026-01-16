import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { ScheduleExecution, ExecutionHistoryParams } from '../../types/schedule';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusIndicator } from './StatusIndicator';
import { cn } from '../../utils/cn';

/**
 * Props for the ExecutionHistory component
 */
interface ExecutionHistoryProps {
  /** ID of the schedule to show history for */
  scheduleId: string;
  /** Name of the schedule for display */
  scheduleName: string;
  /** Callback when close button is clicked */
  onClose: () => void;
  /** Callback to fetch execution history data */
  onFetchHistory: (
    scheduleId: string,
    params: ExecutionHistoryParams
  ) => Promise<{
    executions: ScheduleExecution[];
    total: number;
    page: number;
    totalPages: number;
  }>;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ExecutionHistory Component
 * 
 * Displays execution history for a specific schedule with filtering,
 * pagination, and detailed execution information.
 * 
 * Features:
 * - Execution list with status icons
 * - Start time, end time, and duration display
 * - Status indicators (success/failed/running)
 * - Error messages for failed executions
 * - Report file paths for successful executions
 * - Pagination controls
 * - Status filter (all/success/failed/running)
 * - Execution statistics summary
 * - Loading and error states
 * 
 * Statistics Displayed:
 * - Total executions count
 * - Successful executions count
 * - Failed executions count
 * - Success rate percentage
 * 
 * Performance:
 * - Memoized callbacks to prevent unnecessary re-renders
 * - Efficient data fetching with pagination
 * - Optimized statistics calculation
 * 
 * @example
 * ```tsx
 * <ExecutionHistory
 *   scheduleId={schedule.id}
 *   scheduleName={schedule.name}
 *   onClose={handleClose}
 *   onFetchHistory={fetchHistory}
 * />
 * ```
 */

const ExecutionHistoryComponent: React.FC<ExecutionHistoryProps> = ({
  scheduleId,
  scheduleName,
  onClose,
  onFetchHistory,
  className,
}) => {
  const [executions, setExecutions] = useState<ScheduleExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'running'>('all');
  const [statistics, setStatistics] = useState({
    total: 0,
    successful: 0,
    failed: 0,
    successRate: 0,
    avgDuration: 0,
  });

  const limit = 10;

  // Memoize fetchExecutions to prevent unnecessary recreations
  const fetchExecutions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params: ExecutionHistoryParams = {
        page,
        limit,
        status: statusFilter === 'all' ? undefined : statusFilter,
      };

      const result = await onFetchHistory(scheduleId, params);
      
      // Convert date strings to Date objects
      const executionsWithDates = result.executions.map(execution => ({
        ...execution,
        startTime: execution.startTime instanceof Date ? execution.startTime : new Date(execution.startTime),
        endTime: execution.endTime ? (execution.endTime instanceof Date ? execution.endTime : new Date(execution.endTime)) : undefined,
      }));
      
      setExecutions(executionsWithDates);
      setTotalPages(result.totalPages);

      // Calculate statistics
      calculateStatistics(executionsWithDates);
    } catch (err) {
      setError('Failed to load execution history');
      console.error('Error fetching execution history:', err);
    } finally {
      setLoading(false);
    }
  }, [scheduleId, page, limit, statusFilter, onFetchHistory]);

  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  const calculateStatistics = useCallback((execs: ScheduleExecution[]) => {
    const total = execs.length;
    const successful = execs.filter((e) => e.status === 'success').length;
    const failed = execs.filter((e) => e.status === 'failed').length;
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    const completedExecutions = execs.filter((e) => e.duration);
    const avgDuration =
      completedExecutions.length > 0
        ? completedExecutions.reduce((sum, e) => sum + (e.duration || 0), 0) /
          completedExecutions.length
        : 0;

    setStatistics({
      total,
      successful,
      failed,
      successRate,
      avgDuration,
    });
  }, []);

  // Memoize formatting functions
  const formatDate = useCallback((date: Date | string) => {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, []);

  const formatDuration = useCallback((ms?: number) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  }, [totalPages]);

  return (
    <Card className={cn('max-w-5xl mx-auto', className)}>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900" id="history-title">Execution History</h2>
          <p className="text-sm text-gray-600 mt-1 break-words">{scheduleName}</p>
        </div>
        <Button 
          variant="ghost" 
          onClick={onClose} 
          aria-label="Close execution history" 
          className="self-end sm:self-auto"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </Button>
      </CardHeader>

      <CardContent>
        {/* Statistics Summary */}
        <div 
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 p-3 sm:p-4 bg-gray-50 rounded-lg"
          role="region"
          aria-label="Execution statistics"
        >
          <div>
            <p className="text-xs sm:text-sm text-gray-600">Total Executions</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900" aria-label={`${statistics.total} total executions`}>
              {statistics.total}
            </p>
          </div>
          <div>
            <p className="text-xs sm:text-sm text-gray-600">Successful</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600" aria-label={`${statistics.successful} successful executions`}>
              {statistics.successful}
            </p>
          </div>
          <div>
            <p className="text-xs sm:text-sm text-gray-600">Failed</p>
            <p className="text-xl sm:text-2xl font-bold text-red-600" aria-label={`${statistics.failed} failed executions`}>
              {statistics.failed}
            </p>
          </div>
          <div>
            <p className="text-xs sm:text-sm text-gray-600">Success Rate</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900" aria-label={`${statistics.successRate.toFixed(1)}% success rate`}>
              {statistics.successRate.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filter executions by status">
          <Button
            variant={statusFilter === 'all' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
            aria-label="Show all executions"
            aria-pressed={statusFilter === 'all'}
          >
            All
          </Button>
          <Button
            variant={statusFilter === 'success' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('success')}
            aria-label="Show only successful executions"
            aria-pressed={statusFilter === 'success'}
          >
            Success
          </Button>
          <Button
            variant={statusFilter === 'failed' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('failed')}
            aria-label="Show only failed executions"
            aria-pressed={statusFilter === 'failed'}
          >
            Failed
          </Button>
          <Button
            variant={statusFilter === 'running' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('running')}
            aria-label="Show only running executions"
            aria-pressed={statusFilter === 'running'}
          >
            Running
          </Button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8" role="status" aria-live="polite">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" aria-hidden="true"></div>
            <p className="mt-2 text-sm text-gray-600">Loading executions...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md" role="alert">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Executions List */}
        {!loading && !error && (
          <>
            {executions.length === 0 ? (
              <div className="text-center py-8" role="status">
                <p className="text-gray-600">No executions found</p>
              </div>
            ) : (
              <div className="space-y-3" role="list" aria-label="Execution history">
                {executions.map((execution) => (
                  <div
                    key={execution.id}
                    className="p-3 sm:p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    role="listitem"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-0 mb-2">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <StatusIndicator status={execution.status} size="md" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 break-words">
                            <time dateTime={execution.startTime instanceof Date ? execution.startTime.toISOString() : execution.startTime}>
                              {formatDate(execution.startTime)}
                            </time>
                          </p>
                          {execution.endTime && (
                            <p className="text-xs text-gray-500 break-words">
                              Ended: <time dateTime={execution.endTime instanceof Date ? execution.endTime.toISOString() : execution.endTime}>
                                {formatDate(execution.endTime)}
                              </time>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-sm font-medium text-gray-700">
                          Duration: {formatDuration(execution.duration)}
                        </p>
                      </div>
                    </div>

                    {/* Report Path */}
                    {execution.reportPath && execution.status === 'success' && (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded" role="status">
                        <p className="text-xs text-green-800 break-all">
                          <span className="font-medium">Report:</span>{' '}
                          {execution.reportPath}
                        </p>
                      </div>
                    )}

                    {/* Error Message */}
                    {execution.error && execution.status === 'failed' && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded" role="alert">
                        <p className="text-xs text-red-800 break-words">
                          <span className="font-medium">Error:</span> {execution.error}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <nav 
                className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 pt-4 border-t border-gray-200"
                role="navigation"
                aria-label="Execution history pagination"
              >
                <p className="text-sm text-gray-600" aria-live="polite">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2" role="group" aria-label="Pagination controls">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    aria-label="Go to previous page"
                  >
                    <span className="hidden sm:inline">Previous</span>
                    <span className="sm:hidden">Prev</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === totalPages}
                    aria-label="Go to next page"
                  >
                    Next
                  </Button>
                </div>
              </nav>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const ExecutionHistory = memo(ExecutionHistoryComponent, (prevProps, nextProps) => {
  return (
    prevProps.scheduleId === nextProps.scheduleId &&
    prevProps.scheduleName === nextProps.scheduleName
  );
});

ExecutionHistory.displayName = 'ExecutionHistory';
