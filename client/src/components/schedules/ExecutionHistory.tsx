import React, { useState, useEffect, useCallback, useMemo, memo, useReducer } from 'react';
import { Download, FileText } from 'lucide-react';
import { ScheduleExecution, ExecutionHistoryParams } from '../../types/schedule';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusIndicator } from './StatusIndicator';
import { cn } from '../../utils/cn';
import { apiService } from '../../services/api';

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

interface HistoryState {
  executions: ScheduleExecution[];
  loading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  statusFilter: 'all' | 'success' | 'failed' | 'running';
  statistics: {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
    avgDuration: number;
  };
  downloadingId: string | null;
}

type HistoryAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: { executions: ScheduleExecution[]; totalPages: number } }
  | { type: 'FETCH_ERROR'; payload: string }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_FILTER'; payload: HistoryState['statusFilter'] }
  | { type: 'SET_STATISTICS'; payload: HistoryState['statistics'] }
  | { type: 'SET_DOWNLOADING'; payload: string | null };

const initialState: HistoryState = {
  executions: [],
  loading: true,
  error: null,
  page: 1,
  totalPages: 1,
  statusFilter: 'all',
  statistics: {
    total: 0,
    successful: 0,
    failed: 0,
    successRate: 0,
    avgDuration: 0,
  },
  downloadingId: null,
};

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        loading: false,
        executions: action.payload.executions,
        totalPages: action.payload.totalPages,
      };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'SET_PAGE':
      return { ...state, page: action.payload };
    case 'SET_FILTER':
      return { ...state, statusFilter: action.payload, page: 1 };
    case 'SET_STATISTICS':
      return { ...state, statistics: action.payload };
    case 'SET_DOWNLOADING':
      return { ...state, downloadingId: action.payload };
    default:
      return state;
  }
}

const ExecutionHistoryComponent: React.FC<ExecutionHistoryProps> = ({
  scheduleId,
  scheduleName,
  onClose,
  onFetchHistory,
  className,
}) => {
  const [state, dispatch] = useReducer(historyReducer, initialState);
  const {
    executions,
    loading,
    error,
    page,
    totalPages,
    statusFilter,
    statistics,
    downloadingId,
  } = state;

  const limit = 10;

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

    dispatch({
      type: 'SET_STATISTICS',
      payload: {
        total,
        successful,
        failed,
        successRate,
        avgDuration,
      },
    });
  }, []);

  const fetchExecutions = useCallback(async () => {
    dispatch({ type: 'FETCH_START' });

    try {
      const params: ExecutionHistoryParams = {
        page,
        limit,
        status: statusFilter === 'all' ? undefined : statusFilter,
      };

      const result = await onFetchHistory(scheduleId, params);

      const executionsWithDates = result.executions.map(execution => ({
        ...execution,
        startTime: execution.startTime instanceof Date ? execution.startTime : new Date(execution.startTime),
        endTime: execution.endTime ? (execution.endTime instanceof Date ? execution.endTime : new Date(execution.endTime)) : undefined,
      }));

      dispatch({
        type: 'FETCH_SUCCESS',
        payload: {
          executions: executionsWithDates,
          totalPages: result.totalPages,
        },
      });

      calculateStatistics(executionsWithDates);
    } catch (err) {
      dispatch({ type: 'FETCH_ERROR', payload: 'Failed to load execution history' });
      console.error('Error fetching execution history:', err);
    }
  }, [scheduleId, page, limit, statusFilter, onFetchHistory, calculateStatistics]);

  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  const handleDownload = async (execution: ScheduleExecution) => {
    try {
      dispatch({ type: 'SET_DOWNLOADING', payload: execution.id });
      const blob = await apiService.downloadExecutionReport(execution.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = execution.reportPath ? execution.reportPath.split(/[/\\]/).pop() : `report_${execution.id}.pdf`;
      link.download = fileName || 'report.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download report:', err);
      alert('Failed to download report.');
    } finally {
      dispatch({ type: 'SET_DOWNLOADING', payload: null });
    }
  };

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
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${seconds}s`;
  }, []);

  return (
    <Card className={cn('max-w-5xl mx-auto', className)}>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Execution History</h2>
          <p className="text-sm text-gray-600 mt-1">{scheduleName}</p>
        </div>
        <Button variant="ghost" onClick={onClose}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-xs sm:text-sm text-gray-600">Total Executions</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{statistics.total}</p>
          </div>
          <div>
            <p className="text-xs sm:text-sm text-gray-600">Successful</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600">{statistics.successful}</p>
          </div>
          <div>
            <p className="text-xs sm:text-sm text-gray-600">Failed</p>
            <p className="text-xl sm:text-2xl font-bold text-red-600">{statistics.failed}</p>
          </div>
          <div>
            <p className="text-xs sm:text-sm text-gray-600">Success Rate</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{statistics.successRate.toFixed(1)}%</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {(['all', 'success', 'failed', 'running'] as const).map(s => (
            <Button
              key={s}
              variant={statusFilter === s ? 'primary' : 'outline'}
              size="sm"
              onClick={() => dispatch({ type: 'SET_FILTER', payload: s })}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>

        {loading && <div className="text-center py-8">Loading...</div>}
        {error && <div className="p-4 bg-red-50 text-red-800 rounded-md">{error}</div>}

        {!loading && !error && (
          <>
            {executions.length === 0 ? (
              <div className="text-center py-8 text-gray-600">No executions found</div>
            ) : (
              <div className="space-y-3">
                {executions.map((execution) => (
                  <div key={execution.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <StatusIndicator status={execution.status} size="md" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{formatDate(execution.startTime)}</p>
                          {execution.endTime && <p className="text-xs text-gray-500">Ended: {formatDate(execution.endTime)}</p>}
                        </div>
                      </div>
                      <p className="text-sm font-medium text-gray-700">Duration: {formatDuration(execution.duration)}</p>
                    </div>

                    {execution.reportPath && execution.status === 'success' && (
                      <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start">
                          <FileText className="h-4 w-4 text-green-600 mt-0.5 mr-2" />
                          <p className="text-xs text-green-800 break-all">{execution.reportPath}</p>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleDownload(execution)}
                          loading={downloadingId === execution.id}
                        >
                          <Download className="h-4 w-4 mr-2" /> Download
                        </Button>
                      </div>
                    )}
                    {execution.error && execution.status === 'failed' && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">{execution.error}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <nav className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">Page {page} of {totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => dispatch({ type: 'SET_PAGE', payload: page - 1 })} disabled={page === 1}>Previous</Button>
                  <Button variant="outline" size="sm" onClick={() => dispatch({ type: 'SET_PAGE', payload: page + 1 })} disabled={page === totalPages}>Next</Button>
                </div>
              </nav>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export const ExecutionHistory = memo(ExecutionHistoryComponent, (prevProps, nextProps) => {
  return prevProps.scheduleId === nextProps.scheduleId && prevProps.scheduleName === nextProps.scheduleName;
});

ExecutionHistory.displayName = 'ExecutionHistory';
