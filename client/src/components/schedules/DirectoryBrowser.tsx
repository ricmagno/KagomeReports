import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { cn } from '../../utils/cn';
import { apiService } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { DirectoryBrowserData, DirectoryEntry } from '../../types/filesystem';

interface DirectoryBrowserProps {
  value: string;
  onChange: (path: string) => void;
  onClose: () => void;
  className?: string;
  baseType?: 'home' | 'reports'; // Specify the base directory type
}

/**
 * DirectoryBrowser Component
 * 
 * Modal directory browser for selecting report destination paths.
 * Communicates with backend API to browse server filesystem.
 */
export const DirectoryBrowser: React.FC<DirectoryBrowserProps> = ({
  value,
  onChange,
  onClose,
  className,
  baseType = 'home' // Default to home directory
}) => {
  const [currentPath, setCurrentPath] = useState<string>(value || '');
  const [browserData, setBrowserData] = useState<DirectoryBrowserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

  const { success: showSuccess, error: showError } = useToast();

  const fetchDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.browseDirectory(path, baseType);

      if (response.success && response.data) {
        setBrowserData(response.data);
        // Ensure currentPath is updated to what the server says
        if (response.data.currentPath !== undefined && path !== response.data.currentPath) {
          setCurrentPath(response.data.currentPath);
        }
      } else {
        throw new Error(response.message || 'Failed to browse directory');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory');
      showError('Directory Error', err instanceof Error ? err.message : 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  }, [baseType, showError]);

  useEffect(() => {
    fetchDirectory(currentPath);
  }, [currentPath, fetchDirectory]);

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    setShowNewFolderInput(false);
    setNewFolderName('');
  };

  const handleGoUp = () => {
    if (browserData?.parentPath !== undefined) {
      setCurrentPath(browserData.parentPath || '');
      setShowNewFolderInput(false);
      setNewFolderName('');
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    setCreatingFolder(true);
    setError(null);

    try {
      const folderName = newFolderName.trim();
      const newPath = currentPath
        ? `${currentPath}/${folderName}`
        : folderName;

      const response = await apiService.createDirectory(newPath, baseType);

      if (response.success) {
        showSuccess('Folder Created', `Directory "${folderName}" created successfully.`);
        // Refresh the current directory
        await fetchDirectory(currentPath);
        setShowNewFolderInput(false);
        setNewFolderName('');
      } else {
        throw new Error(response.message || 'Failed to create directory');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create folder';
      setError(msg);
      showError('Folder Creation Failed', msg);
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleSelect = () => {
    if (!browserData) return;

    // Construct the absolute path
    // If currentPath is empty, it's the baseDirectory itself
    let fullPath = browserData.baseDirectory;
    if (currentPath) {
      // Normalize currentPath to remove redundant slashes
      const normalizedCurrent = currentPath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
      if (normalizedCurrent) {
        const separator = fullPath.endsWith('/') || fullPath.endsWith('\\') ? '' : '/';
        fullPath = `${fullPath}${separator}${normalizedCurrent}`;
      }
    }

    // Normalize path separators to forward slashes for the database
    const sanitizedPath = fullPath.replace(/\\/g, '/');

    onChange(sanitizedPath);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={cn('bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col', className)}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Select Destination Folder</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close directory browser"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Current Path Display */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="text-gray-700 font-mono truncate max-w-[60%]">
              {browserData?.baseDirectory || (baseType === 'reports' ? 'Reports Root' : 'Home')}/{currentPath || ''}
            </span>
            {browserData && browserData.isWritable === false && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 rounded-full border border-red-200 uppercase tracking-wider">
                Read-only
              </span>
            )}
          </div>
        </div>

        {/* Directory List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {!loading && !error && browserData && (
            <div className="space-y-1">
              {/* Parent Directory Link */}
              {!browserData.isRoot && (
                <button
                  onClick={handleGoUp}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors text-left"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">..</span>
                  <span className="text-xs text-gray-500">(parent directory)</span>
                </button>
              )}

              {/* Directory Entries */}
              {browserData.directories.length === 0 && (
                <div className="py-8 text-center text-gray-500 text-sm">
                  No subdirectories found
                </div>
              )}

              {browserData.directories.map((dir) => (
                <button
                  key={dir.path}
                  onClick={() => handleNavigate(dir.path)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-blue-50 transition-colors text-left group"
                >
                  <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-900 group-hover:text-blue-700">{dir.name}</span>
                  {!dir.isWritable && (
                    <span className="ml-auto text-xs text-red-600 bg-red-50 px-2 py-1 rounded">Read-only</span>
                  )}
                </button>
              ))}

              {/* New Folder Input */}
              {showNewFolderInput && (
                <div className="mt-4 p-3 bg-gray-50 rounded-md border border-gray-200">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="New folder name"
                      className="flex-1"
                      disabled={creatingFolder}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateFolder();
                        } else if (e.key === 'Escape') {
                          setShowNewFolderInput(false);
                          setNewFolderName('');
                        }
                      }}
                      autoFocus
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleCreateFolder}
                      disabled={!newFolderName.trim() || creatingFolder}
                      loading={creatingFolder}
                    >
                      Create
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowNewFolderInput(false);
                        setNewFolderName('');
                      }}
                      disabled={creatingFolder}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewFolderInput(true)}
              disabled={showNewFolderInput || loading}
              className="w-full sm:w-auto flex justify-center"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Folder
            </Button>

            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSelect}
                disabled={loading || (browserData !== null && browserData.isWritable === false)}
                title={browserData?.isWritable === false ? 'This directory is not writable' : ''}
                className="w-full sm:w-auto"
              >
                Select Current Folder
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
