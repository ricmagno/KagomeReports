/**
 * Unit Tests for ConfigurationCard Component
 * Tests configuration display, reveal/mask toggle, and sensitive value handling
 * 
 * Requirements: 1.2, 3.1, 3.3, 3.4
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConfigurationCard } from '../ConfigurationCard';
import { Configuration } from '../../../types/configuration';

// Mock the useAuth hook
jest.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user123', role: 'admin' },
    isAuthenticated: true
  })
}));

describe('ConfigurationCard Component', () => {
  const mockNonSensitiveConfig: Configuration = {
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
  };

  const mockSensitiveConfig: Configuration = {
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
  };

  describe('Non-Sensitive Configuration Display', () => {
    it('should display configuration name', () => {
      render(<ConfigurationCard configuration={mockNonSensitiveConfig} />);
      
      expect(screen.getByText('DB_HOST')).toBeInTheDocument();
    });

    it('should display configuration value', () => {
      render(<ConfigurationCard configuration={mockNonSensitiveConfig} />);
      
      expect(screen.getByText('localhost')).toBeInTheDocument();
    });

    it('should display configuration description', () => {
      render(<ConfigurationCard configuration={mockNonSensitiveConfig} />);
      
      expect(screen.getByText('Database host')).toBeInTheDocument();
    });

    it('should display data type', () => {
      render(<ConfigurationCard configuration={mockNonSensitiveConfig} />);
      
      expect(screen.getByText('string')).toBeInTheDocument();
    });

    it('should display environment variable name', () => {
      render(<ConfigurationCard configuration={mockNonSensitiveConfig} />);
      
      expect(screen.getByText('DB_HOST')).toBeInTheDocument();
    });

    it('should display restart requirement indicator', () => {
      render(<ConfigurationCard configuration={mockNonSensitiveConfig} />);
      
      expect(screen.getByText(/restart/i)).toBeInTheDocument();
    });

    it('should not display reveal button for non-sensitive configuration', () => {
      render(<ConfigurationCard configuration={mockNonSensitiveConfig} />);
      
      const revealButton = screen.queryByRole('button', { name: /reveal/i });
      expect(revealButton).not.toBeInTheDocument();
    });
  });

  describe('Sensitive Configuration Display', () => {
    it('should display masked value for sensitive configuration', () => {
      render(<ConfigurationCard configuration={mockSensitiveConfig} />);
      
      expect(screen.getByText('••••••••')).toBeInTheDocument();
    });

    it('should display reveal button for sensitive configuration', () => {
      render(<ConfigurationCard configuration={mockSensitiveConfig} />);
      
      const revealButton = screen.getByRole('button', { name: /reveal/i });
      expect(revealButton).toBeInTheDocument();
    });

    it('should display sensitive indicator', () => {
      render(<ConfigurationCard configuration={mockSensitiveConfig} />);
      
      expect(screen.getByText(/sensitive/i)).toBeInTheDocument();
    });
  });

  describe('Reveal/Mask Toggle', () => {
    it('should reveal sensitive value when reveal button is clicked', async () => {
      const { rerender } = render(<ConfigurationCard configuration={mockSensitiveConfig} />);
      
      const revealButton = screen.getByRole('button', { name: /reveal/i });
      fireEvent.click(revealButton);

      // After reveal, the actual value should be displayed
      await waitFor(() => {
        expect(screen.queryByText('••••••••')).not.toBeInTheDocument();
      });
    });

    it('should display hide button after revealing', async () => {
      render(<ConfigurationCard configuration={mockSensitiveConfig} />);
      
      const revealButton = screen.getByRole('button', { name: /reveal/i });
      fireEvent.click(revealButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /hide/i })).toBeInTheDocument();
      });
    });

    it('should mask value again when hide button is clicked', async () => {
      render(<ConfigurationCard configuration={mockSensitiveConfig} />);
      
      const revealButton = screen.getByRole('button', { name: /reveal/i });
      fireEvent.click(revealButton);

      await waitFor(() => {
        const hideButton = screen.getByRole('button', { name: /hide/i });
        fireEvent.click(hideButton);
      });

      await waitFor(() => {
        expect(screen.getByText('••••••••')).toBeInTheDocument();
      });
    });
  });

  describe('Edit Button', () => {
    it('should display edit button for editable configuration', () => {
      render(<ConfigurationCard configuration={mockNonSensitiveConfig} />);
      
      const editButton = screen.getByRole('button', { name: /edit/i });
      expect(editButton).toBeInTheDocument();
    });

    it('should not display edit button for non-editable configuration', () => {
      const nonEditableConfig = { ...mockNonSensitiveConfig, isEditable: false };
      render(<ConfigurationCard configuration={nonEditableConfig} />);
      
      const editButton = screen.queryByRole('button', { name: /edit/i });
      expect(editButton).not.toBeInTheDocument();
    });

    it('should enter edit mode when edit button is clicked', async () => {
      render(<ConfigurationCard configuration={mockNonSensitiveConfig} />);
      
      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });
    });
  });

  describe('Default Value Indicator', () => {
    it('should display default indicator for default values', () => {
      const defaultConfig = { ...mockNonSensitiveConfig, isDefault: true };
      render(<ConfigurationCard configuration={defaultConfig} />);
      
      expect(screen.getByText(/default/i)).toBeInTheDocument();
    });

    it('should not display default indicator for customized values', () => {
      render(<ConfigurationCard configuration={mockNonSensitiveConfig} />);
      
      const defaultIndicator = screen.queryByText(/default/i);
      expect(defaultIndicator).not.toBeInTheDocument();
    });
  });

  describe('Constraints Display', () => {
    it('should display constraints when provided', () => {
      const configWithConstraints = {
        ...mockNonSensitiveConfig,
        constraints: 'Valid hostname or IP address'
      };
      render(<ConfigurationCard configuration={configWithConstraints} />);
      
      expect(screen.getByText('Valid hostname or IP address')).toBeInTheDocument();
    });

    it('should not display constraints when not provided', () => {
      render(<ConfigurationCard configuration={mockNonSensitiveConfig} />);
      
      const constraintsElement = screen.queryByText(/constraints/i);
      expect(constraintsElement).not.toBeInTheDocument();
    });
  });

  describe('Copy Functionality', () => {
    it('should display copy button for non-sensitive configuration', () => {
      render(<ConfigurationCard configuration={mockNonSensitiveConfig} />);
      
      const copyButton = screen.getByRole('button', { name: /copy/i });
      expect(copyButton).toBeInTheDocument();
    });

    it('should copy value to clipboard when copy button is clicked', async () => {
      const mockClipboard = {
        writeText: jest.fn().mockResolvedValue(undefined)
      };
      Object.assign(navigator, { clipboard: mockClipboard });

      render(<ConfigurationCard configuration={mockNonSensitiveConfig} />);
      
      const copyButton = screen.getByRole('button', { name: /copy/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledWith('localhost');
      });
    });

    it('should display success message after copying', async () => {
      const mockClipboard = {
        writeText: jest.fn().mockResolvedValue(undefined)
      };
      Object.assign(navigator, { clipboard: mockClipboard });

      render(<ConfigurationCard configuration={mockNonSensitiveConfig} />);
      
      const copyButton = screen.getByRole('button', { name: /copy/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(screen.getByText(/copied/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<ConfigurationCard configuration={mockNonSensitiveConfig} />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button.getAttribute('aria-label') || button.textContent).toBeTruthy();
      });
    });

    it('should have proper heading hierarchy', () => {
      render(<ConfigurationCard configuration={mockNonSensitiveConfig} />);
      
      const heading = screen.getByRole('heading');
      expect(heading).toBeInTheDocument();
    });

    it('should have proper semantic HTML', () => {
      render(<ConfigurationCard configuration={mockNonSensitiveConfig} />);
      
      expect(screen.getByText('DB_HOST')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should render properly on mobile', () => {
      render(<ConfigurationCard configuration={mockNonSensitiveConfig} />);
      
      expect(screen.getByText('DB_HOST')).toBeInTheDocument();
      expect(screen.getByText('localhost')).toBeInTheDocument();
    });

    it('should render properly on desktop', () => {
      render(<ConfigurationCard configuration={mockNonSensitiveConfig} />);
      
      expect(screen.getByText('DB_HOST')).toBeInTheDocument();
      expect(screen.getByText('localhost')).toBeInTheDocument();
    });
  });

  describe('Different Data Types', () => {
    it('should display string configuration', () => {
      render(<ConfigurationCard configuration={mockNonSensitiveConfig} />);
      
      expect(screen.getByText('string')).toBeInTheDocument();
    });

    it('should display number configuration', () => {
      const numberConfig: Configuration = {
        ...mockNonSensitiveConfig,
        name: 'DB_PORT',
        value: '1433',
        dataType: 'number'
      };
      render(<ConfigurationCard configuration={numberConfig} />);
      
      expect(screen.getByText('number')).toBeInTheDocument();
    });

    it('should display boolean configuration', () => {
      const booleanConfig: Configuration = {
        ...mockNonSensitiveConfig,
        name: 'CACHE_ENABLED',
        value: 'true',
        dataType: 'boolean'
      };
      render(<ConfigurationCard configuration={booleanConfig} />);
      
      expect(screen.getByText('boolean')).toBeInTheDocument();
    });
  });

  describe('Category Display', () => {
    it('should display configuration category', () => {
      render(<ConfigurationCard configuration={mockNonSensitiveConfig} />);
      
      expect(screen.getByText('Database')).toBeInTheDocument();
    });
  });
});
