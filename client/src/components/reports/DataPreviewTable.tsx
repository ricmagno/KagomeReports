import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, Download, Loader2 } from 'lucide-react';
import { TimeSeriesData } from '../../types/api';
import { QualityIndicator } from './QualityIndicator';
import { PaginationControls } from './PaginationControls';
import {
  formatTimestamp,
  formatValue,
  sortData,
  generateCSV,
  downloadCSV,
  generateCSVFilename,
  SortColumn,
  SortDirection,
} from '../../utils/tableUtils';

interface DataPreviewTableProps {
  data: TimeSeriesData[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  reportName?: string;
}

export const DataPreviewTable: React.FC<DataPreviewTableProps> = ({
  data,
  loading = false,
  error = null,
  onRetry,
  reportName,
}) => {
  // State management
  const [sortColumn, setSortColumn] = useState<SortColumn>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [isExporting, setIsExporting] = useState(false);

  // Sort data
  const sortedData = useMemo(() => {
    return sortData(data, sortColumn, sortDirection);
  }, [data, sortColumn, sortDirection]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, currentPage, pageSize]);

  // Calculate total pages
  const totalPages = Math.ceil(sortedData.length / pageSize);

  // Handle sort
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    // Validate page bounds
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  };

  // Handle page size change
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page
  };

  // Handle CSV export
  const handleExport = async () => {
    try {
      setIsExporting(true);
      const csvContent = generateCSV(sortedData);
      const filename = generateCSVFilename(reportName);
      downloadCSV(csvContent, filename);
    } catch (err) {
      console.error('Error exporting CSV:', err);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Render sort indicator
  const renderSortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return null;
    
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-4 h-4" aria-label="Sorted ascending" />
    ) : (
      <ArrowDown className="w-4 h-4" aria-label="Sorted descending" />
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading data...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-6">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              Error Loading Data
            </h3>
            <p className="text-red-600 mb-4">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <p className="text-gray-500 text-lg">No data available</p>
        <p className="text-gray-400 text-sm mt-2">
          Try adjusting your filters or time range
        </p>
      </div>
    );
  }

  // Show pagination only if data exceeds threshold
  const showPagination = sortedData.length > 100;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Table header with export button */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Data Preview</h3>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Export data to CSV"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">Export CSV</span>
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('tagName')}
                aria-sort={sortColumn === 'tagName' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <div className="flex items-center gap-2">
                  Tag Name
                  {renderSortIndicator('tagName')}
                </div>
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('timestamp')}
                aria-sort={sortColumn === 'timestamp' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <div className="flex items-center gap-2">
                  Timestamp
                  {renderSortIndicator('timestamp')}
                </div>
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('value')}
                aria-sort={sortColumn === 'value' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <div className="flex items-center gap-2">
                  Value
                  {renderSortIndicator('value')}
                </div>
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('quality')}
                aria-sort={sortColumn === 'quality' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <div className="flex items-center gap-2">
                  Quality
                  {renderSortIndicator('quality')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((row, index) => {
              // Generate a safe key - handle both Date objects and strings
              const timestamp = row.timestamp instanceof Date 
                ? row.timestamp.getTime() 
                : new Date(row.timestamp).getTime();
              
              return (
                <tr
                  key={`${row.tagName}-${timestamp}-${index}`}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                    {row.tagName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatTimestamp(row.timestamp)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                    {formatValue(row.value)}
                  </td>
                  <td className="px-4 py-3">
                    <QualityIndicator qualityCode={row.quality} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {showPagination && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={sortedData.length}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  );
};
