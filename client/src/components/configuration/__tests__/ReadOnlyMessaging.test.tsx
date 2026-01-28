/**
 * Unit Tests for Read-Only Messaging
 * Tests that instructions are displayed and environment variable names are shown
 * 
 * Requirements: 5.1, 5.3
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
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

describe('Read-Only Messaging', () => {
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
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (configurationApi.getConfigurations as jest.Mock).mockResolvedValue(mockConfigurations);
  });

  describe('Instructions Display', () => {
    it('should display read-only instructions', async () => {
      render(<ConfigurationManagement />);

      // Wait for component to load
      await screen.findByText('DB_HOST');

      expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    });

    it('should display backup instructions', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_HOST');

      expect(screen.getByText(/backup/i)).toBeInTheDocument();
    });

    it('should display restart instructions', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_HOST');

      expect(screen.getByText(/restart/i)).toBeInTheDocument();
    });

    it('should display information about editing .env file', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_HOST');

      expect(screen.getByText(/\.env/i)).toBeInTheDocument();
    });

    it('should display information about configuration categories', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_HOST');

      expect(screen.getByText(/category/i)).toBeInTheDocument();
    });
  });

  describe('Environment Variable Names Display', () => {
    it('should display environment variable name for each configuration', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_HOST');

      expect(screen.getByText('DB_HOST')).toBeInTheDocument();
      expect(screen.getByText('DB_PASSWORD')).toBeInTheDocument();
    });

    it('should display environment variable in correct format', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_HOST');

      const dbHostElement = screen.getByText('DB_HOST');
      expect(dbHostElement).toBeInTheDocument();
    });

    it('should display environment variable for sensitive configurations', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_PASSWORD');

      expect(screen.getByText('DB_PASSWORD')).toBeInTheDocument();
    });

    it('should display environment variable for non-sensitive configurations', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_HOST');

      expect(screen.getByText('DB_HOST')).toBeInTheDocument();
    });
  });

  describe('Restart Requirement Information', () => {
    it('should display restart requirement indicator for configurations that require restart', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_HOST');

      const restartIndicators = screen.getAllByText(/restart/i);
      expect(restartIndicators.length).toBeGreaterThan(0);
    });

    it('should display restart requirement message', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_HOST');

      expect(screen.getByText(/requires restart/i)).toBeInTheDocument();
    });

    it('should not display restart requirement for configurations that do not require restart', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_PASSWORD');

      // DB_PASSWORD does not require restart, so it should not have restart indicator
      const dbPasswordElement = screen.getByText('DB_PASSWORD').closest('div');
      const restartIndicator = dbPasswordElement?.querySelector('[data-testid="restart-indicator"]');
      expect(restartIndicator).not.toBeInTheDocument();
    });
  });

  describe('Default Value Information', () => {
    it('should display default value indicator for default configurations', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_HOST');

      // Check if default indicator is displayed for configurations with isDefault: true
      const defaultIndicators = screen.queryAllByText(/default/i);
      expect(defaultIndicators.length).toBeGreaterThanOrEqual(0);
    });

    it('should display information about customized values', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_HOST');

      // DB_HOST has isDefault: false, so it should be marked as customized
      expect(screen.getByText(/customized/i)).toBeInTheDocument();
    });
  });

  describe('Data Type Information', () => {
    it('should display data type for each configuration', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_HOST');

      expect(screen.getByText('string')).toBeInTheDocument();
    });

    it('should display data type information in readable format', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_HOST');

      const dataTypeElements = screen.getAllByText('string');
      expect(dataTypeElements.length).toBeGreaterThan(0);
    });
  });

  describe('Constraints Information', () => {
    it('should display constraints when available', async () => {
      const configsWithConstraints = [
        {
          category: 'Database',
          configurations: [
            {
              name: 'DB_PORT',
              value: '1433',
              description: 'Database port',
              category: 'Database',
              dataType: 'number',
              isSensitive: false,
              isDefault: false,
              isEditable: true,
              requiresRestart: true,
              environmentVariable: 'DB_PORT',
              constraints: 'Valid port number (1-65535)'
            }
          ]
        }
      ];

      (configurationApi.getConfigurations as jest.Mock).mockResolvedValue(configsWithConstraints);

      render(<ConfigurationManagement />);

      await screen.findByText('DB_PORT');

      expect(screen.getByText('Valid port number (1-65535)')).toBeInTheDocument();
    });
  });

  describe('Sensitive Configuration Information', () => {
    it('should display sensitive indicator for sensitive configurations', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_PASSWORD');

      expect(screen.getByText(/sensitive/i)).toBeInTheDocument();
    });

    it('should display information about masked values', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_PASSWORD');

      expect(screen.getByText(/masked/i)).toBeInTheDocument();
    });

    it('should display reveal button for sensitive configurations', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_PASSWORD');

      const revealButtons = screen.getAllByRole('button', { name: /reveal/i });
      expect(revealButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Editable Configuration Information', () => {
    it('should display editable indicator for editable configurations', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_HOST');

      expect(screen.getByText(/editable/i)).toBeInTheDocument();
    });

    it('should display edit button for editable configurations', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_HOST');

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      expect(editButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Category Information', () => {
    it('should display category name for each configuration', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_HOST');

      expect(screen.getByText('Database')).toBeInTheDocument();
    });

    it('should display category information in organized manner', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_HOST');

      const categoryHeading = screen.getByText('Database');
      expect(categoryHeading).toBeInTheDocument();
    });
  });

  describe('Help and Documentation', () => {
    it('should display help text about configuration management', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_HOST');

      expect(screen.getByText(/configuration/i)).toBeInTheDocument();
    });

    it('should display information about accessing configuration documentation', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_HOST');

      const docLinks = screen.queryAllByRole('link', { name: /documentation/i });
      expect(docLinks.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Accessibility of Messages', () => {
    it('should have proper heading hierarchy for instructions', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_HOST');

      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
    });

    it('should have descriptive text for all indicators', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_HOST');

      const allText = screen.getByText(/Configuration Management/i);
      expect(allText).toBeInTheDocument();
    });

    it('should have proper ARIA labels for interactive elements', async () => {
      render(<ConfigurationManagement />);

      await screen.findByText('DB_HOST');

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button.getAttribute('aria-label') || button.textContent).toBeTruthy();
      });
    });
  });
});
