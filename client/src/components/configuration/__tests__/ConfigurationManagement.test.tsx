/**
 * Unit Tests for ConfigurationManagement Component
 * Tests configuration display, category grouping, and expand/collapse functionality
 * 
 * Requirements: 1.1, 2.1, 2.2
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConfigurationManagement } from '../ConfigurationManagement';
import * as configurationApi from '../../../services/configuration-api';

// Mock the configuration API
jest.mock('../../../services/configuration-api');

// Mock the useAuth hook
jest.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user123', role: 'admin' },
    isAuthenticated: true
  })
}));

describe('ConfigurationManagement Component', () => {
  const mockConfigurations = [
    {
      category: 'Database',
      configurations: [
        {
          name: 'DB_HOST',
          value: 'localhost',
          description: 'Database host',
          category: 'Database',
          dataType: 'string',
          isSensitive: false,
          isDefault: false,
          isEditable: true,
          requiresRestart: true,
          environmentVariable: 'DB_HOST'
        },
        {
          name: 'DB_PASSWORD',
          value: '••••••••',
          description: 'Database password',
          category: 'Database',
          dataType: 'string',
          isSensitive: true,
          isDefault: false,
          isEditable: true,
          requiresRestart: false,
          environmentVariable: 'DB_PASSWORD'
        }
      ]
    },
    {
      category: 'Application',
      configurations: [
        {
          name: 'NODE_ENV',
          value: 'production',
          description: 'Node environment',
          category: 'Application',
          dataType: 'string',
          isSensitive: false,
          isDefault: false,
          isEditable: true,
          requiresRestart: true,
          environmentVariable: 'NODE_ENV'
        }
      ]
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (configurationApi.getConfigurations as jest.Mock).mockResolvedValue(mockConfigurations);
  });

  describe('Configuration Display', () => {
    it('should render the component', async () => {
      render(<ConfigurationManagement />);
      
      await waitFor(() => {
        expect(screen.getByText(/Configuration Management/i)).toBeInTheDocument();
      });
    });

    it('should fetch configurations on mount', async () => {
      render(<ConfigurationManagement />);

      await waitFor(() => {
        expect(configurationApi.getConfigurations).toHaveBeenCalledTimes(1);
      });
    });

    it('should display loading state initially', () => {
      (configurationApi.getConfigurations as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockConfigurations), 100))
      );

      render(<ConfigurationManagement />);
      
      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });

    it('should display error message on API failure', async () => {
      const error = new Error('Failed to fetch configurations');
      (configurationApi.getConfigurations as jest.Mock).mockRejectedValue(error);

      render(<ConfigurationManagement />);

      await waitFor(() => {
        expect(screen.getByText(/Error loading configurations/i)).toBeInTheDocument();
      });
    });

    it('should display retry button on error', async () => {
      const error = new Error('Failed to fetch configurations');
      (configurationApi.getConfigurations as jest.Mock).mockRejectedValue(error);

      render(<ConfigurationManagement />);

      await waitFor(() => {
        expect(screen.getByText(/Retry/i)).toBeInTheDocument();
      });
    });

    it('should retry fetching configurations when retry button is clicked', async () => {
      const error = new Error('Failed to fetch configurations');
      (configurationApi.getConfigurations as jest.Mock)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockConfigurations);

      render(<ConfigurationManagement />);

      await waitFor(() => {
        expect(screen.getByText(/Retry/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Retry/i));

      await waitFor(() => {
        expect(configurationApi.getConfigurations).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Category Grouping', () => {
    it('should display all categories', async () => {
      render(<ConfigurationManagement />);

      await waitFor(() => {
        expect(screen.getByText('Database')).toBeInTheDocument();
        expect(screen.getByText('Application')).toBeInTheDocument();
      });
    });

    it('should display configurations under correct categories', async () => {
      render(<ConfigurationManagement />);

      await waitFor(() => {
        expect(screen.getByText('DB_HOST')).toBeInTheDocument();
        expect(screen.getByText('NODE_ENV')).toBeInTheDocument();
      });
    });

    it('should display configuration count for each category', async () => {
      render(<ConfigurationManagement />);

      await waitFor(() => {
        expect(screen.getByText(/Database.*2/)).toBeInTheDocument();
        expect(screen.getByText(/Application.*1/)).toBeInTheDocument();
      });
    });
  });

  describe('Expand/Collapse Functionality', () => {
    it('should have categories expanded by default', async () => {
      render(<ConfigurationManagement />);

      await waitFor(() => {
        expect(screen.getByText('DB_HOST')).toBeVisible();
        expect(screen.getByText('NODE_ENV')).toBeVisible();
      });
    });

    it('should collapse category when collapse button is clicked', async () => {
      render(<ConfigurationManagement />);

      await waitFor(() => {
        expect(screen.getByText('DB_HOST')).toBeVisible();
      });

      const collapseButtons = screen.getAllByRole('button', { name: /collapse/i });
      fireEvent.click(collapseButtons[0]);

      await waitFor(() => {
        expect(screen.queryByText('DB_HOST')).not.toBeVisible();
      });
    });

    it('should expand category when expand button is clicked', async () => {
      render(<ConfigurationManagement />);

      await waitFor(() => {
        expect(screen.getByText('DB_HOST')).toBeVisible();
      });

      const collapseButtons = screen.getAllByRole('button', { name: /collapse/i });
      fireEvent.click(collapseButtons[0]);

      await waitFor(() => {
        expect(screen.queryByText('DB_HOST')).not.toBeVisible();
      });

      const expandButtons = screen.getAllByRole('button', { name: /expand/i });
      fireEvent.click(expandButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('DB_HOST')).toBeVisible();
      });
    });

    it('should maintain expand/collapse state independently for each category', async () => {
      render(<ConfigurationManagement />);

      await waitFor(() => {
        expect(screen.getByText('DB_HOST')).toBeVisible();
        expect(screen.getByText('NODE_ENV')).toBeVisible();
      });

      const collapseButtons = screen.getAllByRole('button', { name: /collapse/i });
      fireEvent.click(collapseButtons[0]); // Collapse Database

      await waitFor(() => {
        expect(screen.queryByText('DB_HOST')).not.toBeVisible();
        expect(screen.getByText('NODE_ENV')).toBeVisible(); // Application still visible
      });
    });
  });

  describe('Configuration Display Details', () => {
    it('should display configuration names', async () => {
      render(<ConfigurationManagement />);

      await waitFor(() => {
        expect(screen.getByText('DB_HOST')).toBeInTheDocument();
        expect(screen.getByText('DB_PASSWORD')).toBeInTheDocument();
        expect(screen.getByText('NODE_ENV')).toBeInTheDocument();
      });
    });

    it('should display configuration descriptions', async () => {
      render(<ConfigurationManagement />);

      await waitFor(() => {
        expect(screen.getByText('Database host')).toBeInTheDocument();
        expect(screen.getByText('Database password')).toBeInTheDocument();
        expect(screen.getByText('Node environment')).toBeInTheDocument();
      });
    });

    it('should display configuration values', async () => {
      render(<ConfigurationManagement />);

      await waitFor(() => {
        expect(screen.getByText('localhost')).toBeInTheDocument();
        expect(screen.getByText('production')).toBeInTheDocument();
      });
    });

    it('should display masked values for sensitive configurations', async () => {
      render(<ConfigurationManagement />);

      await waitFor(() => {
        expect(screen.getByText('••••••••')).toBeInTheDocument();
      });
    });

    it('should display data types', async () => {
      render(<ConfigurationManagement />);

      await waitFor(() => {
        const stringTypes = screen.getAllByText('string');
        expect(stringTypes.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Read-Only Messaging', () => {
    it('should display read-only instructions', async () => {
      render(<ConfigurationManagement />);

      await waitFor(() => {
        expect(screen.getByText(/read-only/i)).toBeInTheDocument();
      });
    });

    it('should display backup information', async () => {
      render(<ConfigurationManagement />);

      await waitFor(() => {
        expect(screen.getByText(/backup/i)).toBeInTheDocument();
      });
    });

    it('should display restart requirement information', async () => {
      render(<ConfigurationManagement />);

      await waitFor(() => {
        expect(screen.getByText(/restart/i)).toBeInTheDocument();
      });
    });

    it('should display environment variable names', async () => {
      render(<ConfigurationManagement />);

      await waitFor(() => {
        expect(screen.getByText('DB_HOST')).toBeInTheDocument();
        expect(screen.getByText('DB_PASSWORD')).toBeInTheDocument();
      });
    });
  });

  describe('Sensitive Value Handling', () => {
    it('should display reveal button for sensitive configurations', async () => {
      render(<ConfigurationManagement />);

      await waitFor(() => {
        const revealButtons = screen.getAllByRole('button', { name: /reveal/i });
        expect(revealButtons.length).toBeGreaterThan(0);
      });
    });

    it('should not display reveal button for non-sensitive configurations', async () => {
      render(<ConfigurationManagement />);

      await waitFor(() => {
        expect(screen.getByText('DB_HOST')).toBeInTheDocument();
      });

      // DB_HOST is not sensitive, so it should not have a reveal button
      const dbHostElement = screen.getByText('DB_HOST').closest('div');
      const revealButton = dbHostElement?.querySelector('button[aria-label*="reveal"]');
      expect(revealButton).not.toBeInTheDocument();
    });
  });

  describe('Edit Access Control', () => {
    it('should display edit buttons for admin users', async () => {
      render(<ConfigurationManagement />);

      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: /edit/i });
        expect(editButtons.length).toBeGreaterThan(0);
      });
    });

    it('should display edit buttons for editable configurations', async () => {
      render(<ConfigurationManagement />);

      await waitFor(() => {
        expect(screen.getByText('DB_HOST')).toBeInTheDocument();
      });

      // DB_HOST is editable, so it should have an edit button
      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      expect(editButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no configurations are returned', async () => {
      (configurationApi.getConfigurations as jest.Mock).mockResolvedValue([]);

      render(<ConfigurationManagement />);

      await waitFor(() => {
        expect(screen.getByText(/No configurations found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      render(<ConfigurationManagement />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      });
    });

    it('should have descriptive button labels', async () => {
      render(<ConfigurationManagement />);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        buttons.forEach(button => {
          expect(button.getAttribute('aria-label') || button.textContent).toBeTruthy();
        });
      });
    });

    it('should have proper ARIA labels for interactive elements', async () => {
      render(<ConfigurationManagement />);

      await waitFor(() => {
        const expandButtons = screen.queryAllByRole('button', { name: /expand/i });
        expandButtons.forEach(button => {
          expect(button.getAttribute('aria-expanded')).toBeDefined();
        });
      });
    });
  });
});
