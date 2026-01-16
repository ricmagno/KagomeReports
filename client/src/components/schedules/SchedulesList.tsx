import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

/**
 * Props for the SchedulesList component
 */
interface SchedulesListProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Filter status type
 */
type FilterStatus = 'all' | 'enabled' | 'disabled';

/**
 * Filter last status type
 */
type FilterLastStatus = 'all' | 'success' | 'failed';

/**
 * Custom hook for debouncing values
 * 
 * @param value - Value to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced value
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * SchedulesList Component
 * 
 * Main container component that displays all schedules with comprehensive
 * management capabilities including search, filtering, pagination, and CRUD operations.
 * 
 * Features:
 * - Grid/list view of all schedules
 * - Real-time search by name/description (debounced)
 * - Filter by enabled/disabled status
 * - Filter by last execution status
 * - Pagination with configurable page size
 * - Create new schedule button
 * - Refresh schedules button
 * - Loading states with skeleton loaders
 * - Error handling with retry capability
 * - Empty state with call-to-action
 * - Toast notifications for actions
 * - Confirmation dialogs for destructive actions
 * 
 * State Management:
 * - Schedules list with pagination
 * - Loading and error states
 * - Search query (debounced for performance)
 * - Filter states (status, last execution)
 * - UI state (form visibility, history visibility)
 * - Action loading states (toggling, running, deleting)
 * 
 * Performance Optimizations:
 * - Debounced search input (300ms delay)
 * - Memoized callbacks to prevent unnecessary re-renders
 * - Optimistic UI updates for toggle actions
 * - Efficient pagination
 * - Skeleton loaders for better perceived performance
 * 
 * Accessibility:
 * - WCAG 2.1 AA compliant
 * - Keyboard navigation support
 * - Screen reader compatible
 * - ARIA labels and live regions
 * - Focus management
 * 
 * @example
 * ```tsx
 * <SchedulesList className="custom-class" />
 * ```
 */

export const SchedulesList: React.FC<SchedulesListProps> = ({ className }) => {
  // Toast notifications
  const { toasts, success, error: showError, removeToast } = useToast();
  
  // State management
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [reportConfigs, setReportConfigs] = useState<ReportConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterLastStatus, setFilterLastStatus] = useState<FilterLastStatus>('all');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // UI state
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<Schedule | null>(null);

  // Loading states for individual actions
  const [togglingSchedules, setTogglingSchedules] = useState<Set<string>>(new Set());
  const [runningSchedules, setRunningSchedules] = useState<Set<string>>(new Set());
  const [deletingSchedule, setDeletingSchedule] = useState<string | null>(null);

  // Debounce search query with 300ms delay
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Fetch schedules on mount and when filters change
  useEffect(() => {
    fetchSchedules();
  }, [page, filterStatus, debouncedSearchQuery]); // Use debounced value

  // Fetch report configs on mount
  useEffect(() => {
    fetchReportConfigs();
  }, []);

  // Memoize fetchSchedules to prevent unnecessary recreations
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params: any = {
        page,
        limit,
      };

      // Add enabled filter if not 'all'
      if (filterStatus !== 'all') {
        params.enabled = filterStatus === 'enabled';
      }

      // Add search query if present (use debounced value)
      if (debouncedSearchQuery.trim()) {
        params.search = debouncedSearchQuery.trim();
      }

      const response = await apiService.getSchedules(params);

      if (response.success && response.data) {
        // Handle both possible response structures
        const schedulesData = response.data.schedules || [];
        let filteredSchedules = Array.isArray(schedulesData) ? schedulesData : [];

        // Convert date strings to Date objects
        filteredSchedules = filteredSchedules.map(schedule => ({
          ...schedule,
          nextRun: schedule.nextRun ? new Date(schedule.nextRun) : undefined,
          lastRun: schedule.lastRun ? new Date(schedule.lastRun) : undefined,
          createdAt: schedule.createdAt ? new Date(schedule.createdAt) : new Date(),
          updatedAt: schedule.updatedAt ? new Date(schedule.updatedAt) : new Date(),
        }));

        // Apply last status filter client-side
        if (filterLastStatus !== 'all') {
          filteredSchedules = filteredSchedules.filter(
            (schedule) => schedule.lastStatus === filterLastStatus
          );
        }

        setSchedules(filteredSchedules);
        
        // Safely access pagination data with defaults
        const pagination = response.data.pagination || { totalPages: 1, total: 0 };
        setTotalPages(pagination.totalPages || 1);
        setTotalCount(pagination.total || 0);
      } else {
        // Set empty array if no data
        setSchedules([]);
        setTotalPages(1);
        setTotalCount(0);
      }
    } catch (err) {
      const errorMessage = handleApiError(err, 'Failed to load schedules', {
        logToConsole: true,
        showNotification: false,
      });
      setError(errorMessage);
      // Ensure schedules is always an array
      setSchedules([]);
      setTotalPages(1);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, filterStatus, debouncedSearchQuery, filterLastStatus]);

  const fetchReportConfigs = useCallback(async () => {
    try {
      const response = await apiService.getSavedReports();
      if (response.success && response.data) {
        // Map saved reports to ReportConfig format
        const configs: ReportConfig[] = response.data.map((report: any) => ({
          id: report.id,
          name: report.name,
          description: report.description,
          tags: [],
          timeRange: { startTime: new Date(), endTime: new Date() },
          chartTypes: [],
          template: 'default',
          format: 'pdf',
        }));
        setReportConfigs(configs);
      }
    } catch (err) {
      console.error('Error fetching report configs:', err);
    }
  }, []);

  // Memoize callback functions to prevent unnecessary re-renders
  const handleCreateSchedule = useCallback(() => {
    setSelectedSchedule(null);
    setShowForm(true);
  }, []);

  const handleEditSchedule = useCallback((schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setShowForm(true);
  }, []);

  const handleSaveSchedule = useCallback(async (config: ScheduleConfig) => {
    try {
      if (selectedSchedule) {
        // Update existing schedule
        const response = await apiService.updateSchedule(selectedSchedule.id, config);
        if (response.success) {
          success('Schedule updated successfully');
          setShowForm(false);
          fetchSchedules();
        }
      } else {
        // Create new schedule
        const response = await apiService.createSchedule(config);
        if (response.success) {
          success('Schedule created successfully');
          setShowForm(false);
          fetchSchedules();
        }
      }
    } catch (err: any) {
      const errorMessage = handleApiError(
        err,
        selectedSchedule ? 'Failed to update schedule' : 'Failed to create schedule',
        {
          logToConsole: true,
          showNotification: false,
        }
      );
      showError(errorMessage);
      throw err;
    }
  }, [selectedSchedule, success, showError, fetchSchedules]);

  const handleDeleteSchedule = useCallback((schedule: Schedule) => {
    setScheduleToDelete(schedule);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!scheduleToDelete) return;

    setDeletingSchedule(scheduleToDelete.id);

    try {
      const response = await apiService.deleteSchedule(scheduleToDelete.id);
      if (response.success) {
        success('Schedule deleted successfully');
        setScheduleToDelete(null);
        fetchSchedules();
      }
    } catch (err: any) {
      const errorMessage = handleApiError(err, 'Failed to delete schedule', {
        logToConsole: true,
        showNotification: false,
      });
      showError(errorMessage);
    } finally {
      setDeletingSchedule(null);
    }
  }, [scheduleToDelete, success, showError, fetchSchedules]);

  const handleToggleEnabled = useCallback(async (scheduleId: string, enabled: boolean) => {
    // Optimistic update
    setTogglingSchedules(prev => new Set(prev).add(scheduleId));
    
    // Update UI immediately
    setSchedules(prevSchedules =>
      prevSchedules.map(schedule =>
        schedule.id === scheduleId
          ? { ...schedule, enabled }
          : schedule
      )
    );

    try {
      const response = enabled
        ? await apiService.enableSchedule(scheduleId)
        : await apiService.disableSchedule(scheduleId);

      if (response.success) {
        success(
          `Schedule ${enabled ? 'enabled' : 'disabled'} successfully`
        );
        // Fetch fresh data to get updated nextRun time
        fetchSchedules();
      }
    } catch (err: any) {
      const errorMessage = handleApiError(err, 'Failed to update schedule', {
        logToConsole: true,
        showNotification: false,
      });
      showError(errorMessage);
      // Revert optimistic update on error
      setSchedules(prevSchedules =>
        prevSchedules.map(schedule =>
          schedule.id === scheduleId
            ? { ...schedule, enabled: !enabled }
            : schedule
        )
      );
    } finally {
      setTogglingSchedules(prev => {
        const next = new Set(prev);
        next.delete(scheduleId);
        return next;
      });
    }
  }, [success, showError, fetchSchedules]);

  const handleRunNow = useCallback(async (scheduleId: string) => {
    setRunningSchedules(prev => new Set(prev).add(scheduleId));

    try {
      const response = await apiService.executeSchedule(scheduleId);
      if (response.success) {
        success('Schedule execution queued successfully');
      }
    } catch (err: any) {
      const errorMessage = handleApiError(err, 'Failed to execute schedule', {
        logToConsole: true,
        showNotification: false,
      });
      showError(errorMessage);
    } finally {
      setRunningSchedules(prev => {
        const next = new Set(prev);
        next.delete(scheduleId);
        return next;
      });
    }
  }, [success, showError]);

  const handleViewHistory = useCallback((schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setShowHistory(true);
  }, []);

  const handleFetchHistory = useCallback(async (
    scheduleId: string,
    params: ExecutionHistoryParams
  ) => {
    const response = await apiService.getExecutionHistory(scheduleId, params);
    if (response.success && response.data) {
      return {
        executions: response.data.executions,
        total: response.data.pagination.total,
        page: response.data.pagination.page,
        totalPages: response.data.pagination.totalPages,
      };
    }
    throw new Error('Failed to fetch execution history');
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  }, [totalPages]);

  const handleRefresh = useCallback(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Calculate filtered count - memoize to avoid recalculation
  const filteredCount = useMemo(() => schedules.length, [schedules.length]);

  // Show form view
  if (showForm) {
    return (
      <div className={cn('p-3 sm:p-6', className)}>
        <ScheduleForm
          schedule={selectedSchedule || undefined}
          reportConfigs={reportConfigs}
          onSave={handleSaveSchedule}
          onCancel={() => setShowForm(false)}
        />
      </div>
    );
  }

  // Show history view
  if (showHistory && selectedSchedule) {
    return (
      <div className={cn('p-3 sm:p-6', className)}>
        <ExecutionHistory
          scheduleId={selectedSchedule.id}
          scheduleName={selectedSchedule.name}
          onClose={() => {
            setShowHistory(false);
            setSelectedSchedule(null);
          }}
          onFetchHistory={handleFetchHistory}
        />
      </div>
    );
  }

  // Main list view
  return (
    <div className={cn('p-3 sm:p-6', className)} role="main" aria-label="Scheduled reports management">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Scheduled Reports</h1>
            <p className="text-sm text-gray-600 mt-1" id="page-description">
              Manage automated report generation and delivery
            </p>
          </div>
          <div className="flex gap-2 sm:gap-3" role="group" aria-label="Schedule actions">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={loading}
              aria-label="Refresh schedules list"
              className="flex-shrink-0"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </Button>
            <Button 
              variant="primary" 
              onClick={handleCreateSchedule} 
              className="flex-shrink-0"
              aria-label="Create new schedule"
            >
              <svg
                className="w-5 h-5 sm:mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="hidden sm:inline">New Schedule</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* Search */}
          <div className="w-full">
            <label htmlFor="schedule-search" className="sr-only">
              Search schedules by name or description
            </label>
            <Input
              id="schedule-search"
              type="text"
              placeholder="Search schedules..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1); // Reset to first page on search
              }}
              className="w-full"
              aria-label="Search schedules by name or description"
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            {/* Status Filter */}
            <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter by schedule status">
              <span className="text-sm font-medium text-gray-700 self-center hidden sm:inline" id="status-filter-label">Status:</span>
              <Button
                variant={filterStatus === 'all' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => {
                  setFilterStatus('all');
                  setPage(1);
                }}
                aria-label="Show all schedules"
                aria-pressed={filterStatus === 'all'}
              >
                All
              </Button>
              <Button
                variant={filterStatus === 'enabled' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => {
                  setFilterStatus('enabled');
                  setPage(1);
                }}
                aria-label="Show only enabled schedules"
                aria-pressed={filterStatus === 'enabled'}
              >
                Enabled
              </Button>
              <Button
                variant={filterStatus === 'disabled' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => {
                  setFilterStatus('disabled');
                  setPage(1);
                }}
                aria-label="Show only disabled schedules"
                aria-pressed={filterStatus === 'disabled'}
              >
                Disabled
              </Button>
            </div>

            {/* Last Status Filter */}
            <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter by last execution status">
              <span className="text-sm font-medium text-gray-700 self-center hidden sm:inline" id="last-status-filter-label">Last Run:</span>
              <Button
                variant={filterLastStatus === 'all' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => {
                  setFilterLastStatus('all');
                  setPage(1);
                }}
                aria-label="Show all execution statuses"
                aria-pressed={filterLastStatus === 'all'}
              >
                All
              </Button>
              <Button
                variant={filterLastStatus === 'success' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => {
                  setFilterLastStatus('success');
                  setPage(1);
                }}
                aria-label="Show only successful executions"
                aria-pressed={filterLastStatus === 'success'}
              >
                Success
              </Button>
              <Button
                variant={filterLastStatus === 'failed' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => {
                  setFilterLastStatus('failed');
                  setPage(1);
                }}
                aria-label="Show only failed executions"
                aria-pressed={filterLastStatus === 'failed'}
              >
                Failed
              </Button>
            </div>
          </div>
        </div>

        {/* Results Count */}
        {(searchQuery || filterStatus !== 'all' || filterLastStatus !== 'all') && (
          <p className="text-sm text-gray-600 mt-3" role="status" aria-live="polite">
            Showing {filteredCount} of {totalCount} schedules
          </p>
        )}
      </div>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Loading State with Skeleton Loaders */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" role="status" aria-live="polite" aria-label="Loading schedules">
          <span className="sr-only">Loading schedules...</span>
          {Array.from({ length: limit }).map((_, index) => (
            <ScheduleCardSkeleton key={index} />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-6 bg-red-50 border border-red-200 rounded-md" role="alert" aria-live="assertive">
          <p className="text-sm text-red-800">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="mt-3"
            aria-label="Retry loading schedules"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && schedules.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300" role="status">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            No schedules found
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            {searchQuery || filterStatus !== 'all' || filterLastStatus !== 'all'
              ? 'Try adjusting your filters or search query'
              : 'Get started by creating your first scheduled report'}
          </p>
          {!searchQuery && filterStatus === 'all' && filterLastStatus === 'all' && (
            <Button
              variant="primary"
              onClick={handleCreateSchedule}
              className="mt-4"
              aria-label="Create your first schedule"
            >
              Create Schedule
            </Button>
          )}
        </div>
      )}

      {/* Schedules Grid */}
      {!loading && !error && schedules.length > 0 && (
        <>
          <div 
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4 sm:gap-6"
            role="list"
            aria-label="Scheduled reports"
          >
            {schedules.map((schedule) => (
              <div key={schedule.id} role="listitem">
                <ScheduleCard
                  schedule={schedule}
                  onEdit={handleEditSchedule}
                  onDelete={() => handleDeleteSchedule(schedule)}
                  onToggleEnabled={handleToggleEnabled}
                  onRunNow={handleRunNow}
                  onViewHistory={handleViewHistory}
                  isTogglingEnabled={togglingSchedules.has(schedule.id)}
                  isRunning={runningSchedules.has(schedule.id)}
                />
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav 
              className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200"
              role="navigation"
              aria-label="Pagination"
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
                  <svg
                    className="w-5 h-5 sm:mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  aria-label="Go to next page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <svg
                    className="w-5 h-5 sm:ml-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Button>
              </div>
            </nav>
          )}
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={scheduleToDelete !== null}
        title="Delete Schedule"
        message={`Are you sure you want to delete "${scheduleToDelete?.name}"? This action cannot be undone and will stop all future executions.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deletingSchedule !== null}
        onConfirm={confirmDelete}
        onCancel={() => setScheduleToDelete(null)}
      />
    </div>
  );
};
