import React, { useState, useEffect, useCallback, useMemo, useReducer } from 'react';
import { Schedule, ScheduleConfig, ExecutionHistoryParams } from '../../types/schedule';
import { ReportConfig } from '../../types/api';
import { apiService } from '../../services/api';
import { ScheduleCard } from './ScheduleCard';
import { ScheduleCardSkeleton } from './ScheduleCardSkeleton';
import { ScheduleForm } from './ScheduleForm';
import { ExecutionHistory } from './ExecutionHistory';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ToastContainer } from '../ui/ToastContainer';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../../utils/cn';
import { useToast } from '../../hooks/useToast';
import { handleApiError } from '../../utils/apiErrorHandler';

interface SchedulesListProps {
  className?: string;
}

type FilterStatus = 'all' | 'enabled' | 'disabled';
type FilterLastStatus = 'all' | 'success' | 'failed';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

interface SchedulesState {
  schedules: Schedule[];
  reportConfigs: ReportConfig[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  filterStatus: FilterStatus;
  filterLastStatus: FilterLastStatus;
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
  selectedSchedule: Schedule | null;
  showForm: boolean;
  showHistory: boolean;
  scheduleToDelete: Schedule | null;
  togglingSchedules: Set<string>;
  runningSchedules: Set<string>;
  deletingSchedule: string | null;
}

type SchedulesAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: { schedules: Schedule[]; totalPages: number; totalCount: number } }
  | { type: 'FETCH_ERROR'; payload: string }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_FILTER_STATUS'; payload: FilterStatus }
  | { type: 'SET_FILTER_LAST_STATUS'; payload: FilterLastStatus }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_REPORT_CONFIGS'; payload: ReportConfig[] }
  | { type: 'SHOW_FORM'; payload: Schedule | null }
  | { type: 'HIDE_FORM' }
  | { type: 'SHOW_HISTORY'; payload: Schedule }
  | { type: 'HIDE_HISTORY' }
  | { type: 'SET_DELETE_TARGET'; payload: Schedule | null }
  | { type: 'TOGGLE_START'; payload: string }
  | { type: 'TOGGLE_END'; payload: string }
  | { type: 'RUN_START'; payload: string }
  | { type: 'RUN_END'; payload: string }
  | { type: 'DELETE_START'; payload: string }
  | { type: 'DELETE_END' }
  | { type: 'UPDATE_SCHEDULE_ENABLED'; payload: { id: string; enabled: boolean } };

const initialState: SchedulesState = {
  schedules: [],
  reportConfigs: [],
  loading: true,
  error: null,
  searchQuery: '',
  filterStatus: 'all',
  filterLastStatus: 'all',
  page: 1,
  limit: 10,
  totalPages: 1,
  totalCount: 0,
  selectedSchedule: null,
  showForm: false,
  showHistory: false,
  scheduleToDelete: null,
  togglingSchedules: new Set(),
  runningSchedules: new Set(),
  deletingSchedule: null,
};

function schedulesReducer(state: SchedulesState, action: SchedulesAction): SchedulesState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        loading: false,
        schedules: action.payload.schedules,
        totalPages: action.payload.totalPages,
        totalCount: action.payload.totalCount,
      };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.payload, schedules: [], totalPages: 1, totalCount: 0 };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload, page: 1 };
    case 'SET_FILTER_STATUS':
      return { ...state, filterStatus: action.payload, page: 1 };
    case 'SET_FILTER_LAST_STATUS':
      return { ...state, filterLastStatus: action.payload, page: 1 };
    case 'SET_PAGE':
      return { ...state, page: action.payload };
    case 'SET_REPORT_CONFIGS':
      return { ...state, reportConfigs: action.payload };
    case 'SHOW_FORM':
      return { ...state, showForm: true, selectedSchedule: action.payload };
    case 'HIDE_FORM':
      return { ...state, showForm: false, selectedSchedule: null };
    case 'SHOW_HISTORY':
      return { ...state, showHistory: true, selectedSchedule: action.payload };
    case 'HIDE_HISTORY':
      return { ...state, showHistory: false, selectedSchedule: null };
    case 'SET_DELETE_TARGET':
      return { ...state, scheduleToDelete: action.payload };
    case 'TOGGLE_START':
      return { ...state, togglingSchedules: new Set(state.togglingSchedules).add(action.payload) };
    case 'TOGGLE_END': {
      const next = new Set(state.togglingSchedules);
      next.delete(action.payload);
      return { ...state, togglingSchedules: next };
    }
    case 'RUN_START':
      return { ...state, runningSchedules: new Set(state.runningSchedules).add(action.payload) };
    case 'RUN_END': {
      const next = new Set(state.runningSchedules);
      next.delete(action.payload);
      return { ...state, runningSchedules: next };
    }
    case 'DELETE_START':
      return { ...state, deletingSchedule: action.payload };
    case 'DELETE_END':
      return { ...state, deletingSchedule: null, scheduleToDelete: null };
    case 'UPDATE_SCHEDULE_ENABLED':
      return {
        ...state,
        schedules: state.schedules.map(s =>
          s.id === action.payload.id ? { ...s, enabled: action.payload.enabled } : s
        ),
      };
    default:
      return state;
  }
}

export const SchedulesList: React.FC<SchedulesListProps> = ({ className }) => {
  const { toasts, success, error: showError, removeToast } = useToast();
  const [state, dispatch] = useReducer(schedulesReducer, initialState);
  const {
    schedules,
    reportConfigs,
    loading,
    error,
    searchQuery,
    filterStatus,
    filterLastStatus,
    page,
    limit,
    totalPages,
    totalCount,
    selectedSchedule,
    showForm,
    showHistory,
    scheduleToDelete,
    togglingSchedules,
    runningSchedules,
    deletingSchedule
  } = state;

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const fetchSchedules = useCallback(async () => {
    dispatch({ type: 'FETCH_START' });
    try {
      const params: Record<string, string | number | boolean> = { page, limit };
      if (filterStatus !== 'all') params.enabled = filterStatus === 'enabled';
      if (debouncedSearchQuery.trim()) params.search = debouncedSearchQuery.trim();

      const response = await apiService.getSchedules(params);
      if (response.success && response.data) {
        let schedulesData = response.data.schedules || [];
        schedulesData = schedulesData.map((s: any) => ({
          ...s,
          nextRun: s.nextRun ? new Date(s.nextRun) : undefined,
          lastRun: s.lastRun ? new Date(s.lastRun) : undefined,
          createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
          updatedAt: s.updatedAt ? new Date(s.updatedAt) : new Date(),
        }));

        if (filterLastStatus !== 'all') {
          schedulesData = schedulesData.filter((s: any) => s.lastStatus === filterLastStatus);
        }

        dispatch({
          type: 'FETCH_SUCCESS',
          payload: {
            schedules: schedulesData,
            totalPages: response.data.pagination.totalPages || 1,
            totalCount: response.data.pagination.total || 0,
          }
        });
      } else {
        dispatch({ type: 'FETCH_SUCCESS', payload: { schedules: [], totalPages: 1, totalCount: 0 } });
      }
    } catch (err) {
      const msg = handleApiError(err, 'Failed to load schedules', { logToConsole: true, showNotification: false });
      dispatch({ type: 'FETCH_ERROR', payload: msg });
    }
  }, [page, limit, filterStatus, debouncedSearchQuery, filterLastStatus]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const response = await apiService.getSavedReports();
        if (response.success && response.data) {
          const configs = response.data.map((r: any) => ({
            ...r.config, id: r.id, name: r.name, description: r.description
          }));
          dispatch({ type: 'SET_REPORT_CONFIGS', payload: configs });
        }
      } catch (err) {
        console.error('Error fetching report configs:', err);
      }
    };
    fetchConfigs();
  }, []);

  const handleCreateSchedule = () => dispatch({ type: 'SHOW_FORM', payload: null });
  const handleEditSchedule = (s: Schedule) => dispatch({ type: 'SHOW_FORM', payload: s });
  const handleViewHistory = (s: Schedule) => dispatch({ type: 'SHOW_HISTORY', payload: s });

  const handleSaveSchedule = async (config: ScheduleConfig) => {
    try {
      const response = selectedSchedule
        ? await apiService.updateSchedule(selectedSchedule.id, config)
        : await apiService.createSchedule(config);

      if (response.success) {
        success(`Schedule ${selectedSchedule ? 'updated' : 'created'} successfully`);
        dispatch({ type: 'HIDE_FORM' });
        fetchSchedules();
      }
    } catch (err) {
      const msg = handleApiError(err, 'Failed to save schedule', { logToConsole: true, showNotification: false });
      showError(msg);
    }
  };

  const confirmDelete = async () => {
    if (!scheduleToDelete) return;
    dispatch({ type: 'DELETE_START', payload: scheduleToDelete.id });
    try {
      const response = await apiService.deleteSchedule(scheduleToDelete.id);
      if (response.success) {
        success('Schedule deleted successfully');
        dispatch({ type: 'DELETE_END' });
        fetchSchedules();
      }
    } catch (err) {
      showError(handleApiError(err, 'Failed to delete schedule'));
    } finally {
      dispatch({ type: 'DELETE_END' });
    }
  };

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    dispatch({ type: 'TOGGLE_START', payload: id });
    dispatch({ type: 'UPDATE_SCHEDULE_ENABLED', payload: { id, enabled } });
    try {
      const response = enabled ? await apiService.enableSchedule(id) : await apiService.disableSchedule(id);
      if (response.success) {
        success(`Schedule ${enabled ? 'enabled' : 'disabled'} successfully`);
        fetchSchedules();
      }
    } catch (err) {
      showError(handleApiError(err, 'Failed to update schedule'));
      dispatch({ type: 'UPDATE_SCHEDULE_ENABLED', payload: { id, enabled: !enabled } });
    } finally {
      dispatch({ type: 'TOGGLE_END', payload: id });
    }
  };

  const handleRunNow = async (id: string) => {
    dispatch({ type: 'RUN_START', payload: id });
    try {
      const response = await apiService.executeSchedule(id);
      if (response.success) success('Schedule execution queued');
    } catch (err) {
      showError(handleApiError(err, 'Failed to execute schedule'));
    } finally {
      dispatch({ type: 'RUN_END', payload: id });
    }
  };

  const filteredCount = useMemo(() => schedules.length, [schedules.length]);

  if (showForm) {
    return (
      <div className={cn('p-3 sm:p-6', className)}>
        <ScheduleForm
          schedule={selectedSchedule || undefined}
          reportConfigs={reportConfigs}
          onSave={handleSaveSchedule}
          onCancel={() => dispatch({ type: 'HIDE_FORM' })}
        />
      </div>
    );
  }

  if (showHistory && selectedSchedule) {
    return (
      <div className={cn('p-3 sm:p-6', className)}>
        <ExecutionHistory
          scheduleId={selectedSchedule.id}
          scheduleName={selectedSchedule.name}
          onClose={() => dispatch({ type: 'HIDE_HISTORY' })}
          onFetchHistory={async (id, params) => {
            const res = await apiService.getExecutionHistory(id, params);
            if (res.success && res.data) {
              return {
                executions: res.data.executions,
                total: res.data.pagination.total,
                page: res.data.pagination.page,
                totalPages: res.data.pagination.totalPages,
              };
            }
            throw new Error('Failed to fetch history');
          }}
        />
      </div>
    );
  }

  return (
    <div className={cn('p-3 sm:p-6', className)} role="main">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Scheduled Reports</h1>
            <p className="text-sm text-gray-600 mt-1">Manage automated report generation and delivery</p>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <Button variant="outline" onClick={() => fetchSchedules()} disabled={loading}>
              <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
            </Button>
            <Button variant="primary" onClick={handleCreateSchedule}>
              <Plus className="w-5 h-5 sm:mr-2" />
              <span className="hidden sm:inline">New Schedule</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:gap-4">
          <Input
            placeholder="Search schedules..."
            value={searchQuery}
            onChange={(e) => dispatch({ type: 'SET_SEARCH_QUERY', payload: e.target.value })}
            className="w-full"
          />
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-700 self-center hidden sm:inline">Status:</span>
              {(['all', 'enabled', 'disabled'] as FilterStatus[]).map(s => (
                <Button
                  key={s}
                  variant={filterStatus === s ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => dispatch({ type: 'SET_FILTER_STATUS', payload: s })}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {(searchQuery || filterStatus !== 'all' || filterLastStatus !== 'all') && (
          <p className="text-sm text-gray-600 mt-3">Showing {filteredCount} of {totalCount} schedules</p>
        )}
      </div>

      <ToastContainer toasts={toasts} onClose={removeToast} />

      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: limit }).map((_, i) => <ScheduleCardSkeleton key={i} />)}
        </div>
      )}

      {error && !loading && (
        <div className="p-6 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
          <Button variant="outline" size="sm" onClick={() => fetchSchedules()} className="mt-3">Try Again</Button>
        </div>
      )}

      {!loading && !error && schedules.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Clock className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No schedules found</h3>
          <Button variant="primary" onClick={handleCreateSchedule} className="mt-4">Create Schedule</Button>
        </div>
      )}

      {!loading && !error && schedules.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6">
            {schedules.map((s) => (
              <ScheduleCard
                key={s.id}
                schedule={s}
                onEdit={handleEditSchedule}
                onDelete={() => dispatch({ type: 'SET_DELETE_TARGET', payload: s })}
                onToggleEnabled={handleToggleEnabled}
                onRunNow={handleRunNow}
                onViewHistory={handleViewHistory}
                isTogglingEnabled={togglingSchedules.has(s.id)}
                isRunning={runningSchedules.has(s.id)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => dispatch({ type: 'SET_PAGE', payload: page - 1 })} disabled={page === 1}>Previous</Button>
                <Button variant="outline" size="sm" onClick={() => dispatch({ type: 'SET_PAGE', payload: page + 1 })} disabled={page === totalPages}>Next</Button>
              </div>
            </nav>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={scheduleToDelete !== null}
        title="Delete Schedule"
        message={`Are you sure you want to delete "${scheduleToDelete?.name}"?`}
        confirmLabel="Delete"
        variant="danger"
        loading={deletingSchedule !== null}
        onConfirm={confirmDelete}
        onCancel={() => dispatch({ type: 'SET_DELETE_TARGET', payload: null })}
      />
    </div>
  );
};

const RefreshCw = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const Plus = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const Clock = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
