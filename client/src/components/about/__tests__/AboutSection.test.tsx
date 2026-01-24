/**
 * Unit Tests for About Section Component
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AboutSection } from '../AboutSection';
import { VersionInfo, UpdateCheckResult, UpdateRecord } from '@/types/versionManagement';

// Mock fetch
global.fetch = jest.fn();

describe('AboutSection Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Test version display rendering
   */
  describe('Version Display', () => {
    it('should display current version', async () => {
      const mockVersionInfo: VersionInfo = {
        version: '1.0.0',
        buildDate: '2024-01-15T10:30:00Z',
        commitHash: 'abc123def456',
        branchName: 'main',
        buildNumber: 42
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === '/api/version') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockVersionInfo)
          });
        }
        if (url.includes('/api/updates')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { records: [] } })
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<AboutSection />);

      await waitFor(() => {
        expect(screen.getByText('v1.0.0')).toBeInTheDocument();
      });
    });

    it('should display build information', async () => {
      const mockVersionInfo: VersionInfo = {
        version: '1.0.0',
        buildDate: '2024-01-15T10:30:00Z',
        commitHash: 'abc123def456',
        branchName: 'main'
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === '/api/version') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockVersionInfo)
          });
        }
        if (url.includes('/api/updates')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { records: [] } })
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<AboutSection />);

      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
        expect(screen.getByText('abc123')).toBeInTheDocument();
      });
    });
  });

  /**
   * Test update status display
   */
  describe('Update Status Display', () => {
    it('should display up-to-date status', async () => {
      const mockVersionInfo: VersionInfo = {
        version: '1.0.0',
        buildDate: '2024-01-15T10:30:00Z',
        commitHash: 'abc123def456',
        branchName: 'main'
      };

      const mockUpdateStatus: UpdateCheckResult = {
        isUpdateAvailable: false,
        currentVersion: '1.0.0',
        lastCheckTime: new Date().toISOString()
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === '/api/version') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockVersionInfo)
          });
        }
        if (url === '/api/updates/status') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: mockUpdateStatus })
          });
        }
        if (url.includes('/api/updates/history')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { records: [] } })
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<AboutSection />);

      await waitFor(() => {
        expect(screen.getByText('Up to Date')).toBeInTheDocument();
      });
    });

    it('should display update available status', async () => {
      const mockVersionInfo: VersionInfo = {
        version: '1.0.0',
        buildDate: '2024-01-15T10:30:00Z',
        commitHash: 'abc123def456',
        branchName: 'main'
      };

      const mockUpdateStatus: UpdateCheckResult = {
        isUpdateAvailable: true,
        currentVersion: '1.0.0',
        latestVersion: '1.1.0',
        changelog: 'New features and bug fixes',
        lastCheckTime: new Date().toISOString()
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === '/api/version') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockVersionInfo)
          });
        }
        if (url === '/api/updates/status') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: mockUpdateStatus })
          });
        }
        if (url.includes('/api/updates/history')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { records: [] } })
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<AboutSection />);

      await waitFor(() => {
        expect(screen.getByText('Update Available')).toBeInTheDocument();
        expect(screen.getByText(/v1.1.0/)).toBeInTheDocument();
      });
    });
  });

  /**
   * Test button visibility based on update availability
   */
  describe('Button Visibility', () => {
    it('should show Check for Updates button', async () => {
      const mockVersionInfo: VersionInfo = {
        version: '1.0.0',
        buildDate: '2024-01-15T10:30:00Z',
        commitHash: 'abc123def456',
        branchName: 'main'
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === '/api/version') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockVersionInfo)
          });
        }
        if (url.includes('/api/updates')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { records: [] } })
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<AboutSection />);

      await waitFor(() => {
        expect(screen.getByText('Check for Updates')).toBeInTheDocument();
      });
    });

    it('should show Install Update button when update is available', async () => {
      const mockVersionInfo: VersionInfo = {
        version: '1.0.0',
        buildDate: '2024-01-15T10:30:00Z',
        commitHash: 'abc123def456',
        branchName: 'main'
      };

      const mockUpdateStatus: UpdateCheckResult = {
        isUpdateAvailable: true,
        currentVersion: '1.0.0',
        latestVersion: '1.1.0',
        changelog: 'New features',
        lastCheckTime: new Date().toISOString()
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === '/api/version') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockVersionInfo)
          });
        }
        if (url === '/api/updates/status') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: mockUpdateStatus })
          });
        }
        if (url.includes('/api/updates/history')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { records: [] } })
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<AboutSection />);

      await waitFor(() => {
        expect(screen.getByText('Install Update')).toBeInTheDocument();
      });
    });
  });

  /**
   * Test update history list rendering
   */
  describe('Update History List', () => {
    it('should display recent updates', async () => {
      const mockVersionInfo: VersionInfo = {
        version: '1.0.0',
        buildDate: '2024-01-15T10:30:00Z',
        commitHash: 'abc123def456',
        branchName: 'main'
      };

      const mockHistory: UpdateRecord[] = [
        {
          id: '1',
          timestamp: '2024-01-15T10:00:00Z',
          fromVersion: '0.9.0',
          toVersion: '1.0.0',
          status: 'success'
        }
      ];

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === '/api/version') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockVersionInfo)
          });
        }
        if (url === '/api/updates/status') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { records: [] } })
          });
        }
        if (url.includes('/api/updates/history')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { records: mockHistory } })
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<AboutSection />);

      await waitFor(() => {
        expect(screen.getByText('v0.9.0 → v1.0.0')).toBeInTheDocument();
        expect(screen.getByText('Success')).toBeInTheDocument();
      });
    });

    it('should display failed update status', async () => {
      const mockVersionInfo: VersionInfo = {
        version: '1.0.0',
        buildDate: '2024-01-15T10:30:00Z',
        commitHash: 'abc123def456',
        branchName: 'main'
      };

      const mockHistory: UpdateRecord[] = [
        {
          id: '1',
          timestamp: '2024-01-15T10:00:00Z',
          fromVersion: '0.9.0',
          toVersion: '1.0.0',
          status: 'failed',
          errorMessage: 'Installation failed'
        }
      ];

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === '/api/version') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockVersionInfo)
          });
        }
        if (url === '/api/updates/status') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { records: [] } })
          });
        }
        if (url.includes('/api/updates/history')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { records: mockHistory } })
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<AboutSection />);

      await waitFor(() => {
        expect(screen.getByText('Failed')).toBeInTheDocument();
        expect(screen.getByText('Installation failed')).toBeInTheDocument();
      });
    });
  });

  /**
   * Test error handling
   */
  describe('Error Handling', () => {
    it('should display error message on fetch failure', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          json: () => Promise.reject(new Error('Network error'))
        });
      });

      render(<AboutSection />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load version/)).toBeInTheDocument();
      });
    });
  });

  /**
   * Test callbacks
   */
  describe('Callbacks', () => {
    it('should call onUpdateInstalled callback', async () => {
      const onUpdateInstalled = jest.fn();
      const mockVersionInfo: VersionInfo = {
        version: '1.0.0',
        buildDate: '2024-01-15T10:30:00Z',
        commitHash: 'abc123def456',
        branchName: 'main'
      };

      const mockUpdateStatus: UpdateCheckResult = {
        isUpdateAvailable: true,
        currentVersion: '1.0.0',
        latestVersion: '1.1.0',
        changelog: 'New features',
        lastCheckTime: new Date().toISOString()
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === '/api/version') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockVersionInfo)
          });
        }
        if (url === '/api/updates/status') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: mockUpdateStatus })
          });
        }
        if (url === '/api/updates/install') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          });
        }
        if (url.includes('/api/updates/history')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { records: [] } })
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<AboutSection onUpdateInstalled={onUpdateInstalled} />);

      await waitFor(() => {
        expect(screen.getByText('Install Update')).toBeInTheDocument();
      });

      const installButton = screen.getByText('Install Update');
      fireEvent.click(installButton);

      await waitFor(() => {
        expect(onUpdateInstalled).toHaveBeenCalled();
      }, { timeout: 10000 });
    });
  });
});
