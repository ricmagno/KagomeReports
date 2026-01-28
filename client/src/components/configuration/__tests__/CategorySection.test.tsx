/**
 * Unit Tests for CategorySection Component
 * Tests category display, expand/collapse functionality
 * 
 * Requirements: 2.1, 2.2, 2.3
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CategorySection } from '../CategorySection';
import { Configuration, ConfigurationCategory } from '../../../types/configuration';

describe('CategorySection Component', () => {
  const mockConfigurations: Configuration[] = [
    {
      name: 'DB_HOST',
      value: 'localhost',
      description: 'Database host',
      category: ConfigurationCategory.Database,
      dataType: 'string',
      isSensitive: false,
      isDefault: false,
      isEditable: true,
      requiresRestart: true,
      environmentVariable: 'DB_HOST'
    },
    {
      name: 'DB_PORT',
      value: '1433',
      description: 'Database port',
      category: ConfigurationCategory.Database,
      dataType: 'number',
      isSensitive: false,
      isDefault: false,
      isEditable: true,
      requiresRestart: true,
      environmentVariable: 'DB_PORT'
    },
    {
      name: 'DB_PASSWORD',
      value: '••••••••',
      description: 'Database password',
      category: ConfigurationCategory.Database,
      dataType: 'string',
      isSensitive: true,
      isDefault: false,
      isEditable: true,
      requiresRestart: false,
      environmentVariable: 'DB_PASSWORD'
    }
  ];

  const mockOnToggleExpand = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Category Display', () => {
    it('should display category name', () => {
      render(
        <CategorySection
          category={ConfigurationCategory.Database}
          configurations={mockConfigurations}
          isExpanded={true}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      expect(screen.getByText('Database')).toBeInTheDocument();
    });

    it('should display configuration count', () => {
      render(
        <CategorySection
          category={ConfigurationCategory.Database}
          configurations={mockConfigurations}
          isExpanded={true}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      expect(screen.getByText(/3/)).toBeInTheDocument();
    });

    it('should display correct count for different category sizes', () => {
      const singleConfig = [mockConfigurations[0]];
      render(
        <CategorySection
          category={ConfigurationCategory.Database}
          configurations={singleConfig}
          isExpanded={true}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      expect(screen.getByText(/1/)).toBeInTheDocument();
    });
  });

  describe('Expand/Collapse Button', () => {
    it('should display expand/collapse button', () => {
      render(
        <CategorySection
          category={ConfigurationCategory.Database}
          configurations={mockConfigurations}
          isExpanded={true}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should call onToggleExpand when button is clicked', () => {
      render(
        <CategorySection
          category={ConfigurationCategory.Database}
          configurations={mockConfigurations}
          isExpanded={true}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(mockOnToggleExpand).toHaveBeenCalledWith(ConfigurationCategory.Database);
    });

    it('should display collapse icon when expanded', () => {
      render(
        <CategorySection
          category={ConfigurationCategory.Database}
          configurations={mockConfigurations}
          isExpanded={true}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('should display expand icon when collapsed', () => {
      render(
        <CategorySection
          category={ConfigurationCategory.Database}
          configurations={mockConfigurations}
          isExpanded={false}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Configuration Display', () => {
    it('should display all configurations when expanded', () => {
      render(
        <CategorySection
          category={ConfigurationCategory.Database}
          configurations={mockConfigurations}
          isExpanded={true}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      expect(screen.getByText('DB_HOST')).toBeInTheDocument();
      expect(screen.getByText('DB_PORT')).toBeInTheDocument();
      expect(screen.getByText('DB_PASSWORD')).toBeInTheDocument();
    });

    it('should not display configurations when collapsed', () => {
      render(
        <CategorySection
          category={ConfigurationCategory.Database}
          configurations={mockConfigurations}
          isExpanded={false}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      expect(screen.queryByText('DB_HOST')).not.toBeInTheDocument();
      expect(screen.queryByText('DB_PORT')).not.toBeInTheDocument();
      expect(screen.queryByText('DB_PASSWORD')).not.toBeInTheDocument();
    });

    it('should display configurations in correct order', () => {
      render(
        <CategorySection
          category={ConfigurationCategory.Database}
          configurations={mockConfigurations}
          isExpanded={true}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      const configNames = screen.getAllByText(/DB_/);
      expect(configNames[0]).toHaveTextContent('DB_HOST');
      expect(configNames[1]).toHaveTextContent('DB_PORT');
      expect(configNames[2]).toHaveTextContent('DB_PASSWORD');
    });
  });

  describe('Empty Category', () => {
    it('should handle empty configuration list', () => {
      render(
        <CategorySection
          category={ConfigurationCategory.Database}
          configurations={[]}
          isExpanded={true}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      expect(screen.getByText('Database')).toBeInTheDocument();
      expect(screen.getByText(/0/)).toBeInTheDocument();
    });
  });

  describe('Different Categories', () => {
    it('should display Application category', () => {
      const appConfigs: Configuration[] = [
        {
          name: 'NODE_ENV',
          value: 'production',
          description: 'Node environment',
          category: ConfigurationCategory.Application,
          dataType: 'string',
          isSensitive: false,
          isDefault: false,
          isEditable: true,
          requiresRestart: true,
          environmentVariable: 'NODE_ENV'
        }
      ];

      render(
        <CategorySection
          category={ConfigurationCategory.Application}
          configurations={appConfigs}
          isExpanded={true}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      expect(screen.getByText('Application')).toBeInTheDocument();
    });

    it('should display Security category', () => {
      const securityConfigs: Configuration[] = [
        {
          name: 'JWT_SECRET',
          value: '••••••••',
          description: 'JWT secret',
          category: ConfigurationCategory.Security,
          dataType: 'string',
          isSensitive: true,
          isDefault: false,
          isEditable: true,
          requiresRestart: false,
          environmentVariable: 'JWT_SECRET'
        }
      ];

      render(
        <CategorySection
          category={ConfigurationCategory.Security}
          configurations={securityConfigs}
          isExpanded={true}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      expect(screen.getByText('Security')).toBeInTheDocument();
    });

    it('should display Email category', () => {
      const emailConfigs: Configuration[] = [
        {
          name: 'SMTP_HOST',
          value: 'smtp.example.com',
          description: 'SMTP host',
          category: ConfigurationCategory.Email,
          dataType: 'string',
          isSensitive: false,
          isDefault: false,
          isEditable: true,
          requiresRestart: false,
          environmentVariable: 'SMTP_HOST'
        }
      ];

      render(
        <CategorySection
          category={ConfigurationCategory.Email}
          configurations={emailConfigs}
          isExpanded={true}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      expect(screen.getByText('Email')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <CategorySection
          category={ConfigurationCategory.Database}
          configurations={mockConfigurations}
          isExpanded={true}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      const button = screen.getByRole('button');
      expect(button.getAttribute('aria-expanded')).toBeDefined();
    });

    it('should have proper heading hierarchy', () => {
      render(
        <CategorySection
          category={ConfigurationCategory.Database}
          configurations={mockConfigurations}
          isExpanded={true}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      const heading = screen.getByRole('heading');
      expect(heading).toBeInTheDocument();
    });

    it('should have descriptive button label', () => {
      render(
        <CategorySection
          category={ConfigurationCategory.Database}
          configurations={mockConfigurations}
          isExpanded={true}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      const button = screen.getByRole('button');
      expect(button.textContent).toContain('Database');
    });
  });

  describe('Styling and Layout', () => {
    it('should apply expanded class when expanded', () => {
      const { container } = render(
        <CategorySection
          category={ConfigurationCategory.Database}
          configurations={mockConfigurations}
          isExpanded={true}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      const section = container.querySelector('[data-testid="category-section"]');
      expect(section).toHaveClass('expanded');
    });

    it('should apply collapsed class when collapsed', () => {
      const { container } = render(
        <CategorySection
          category={ConfigurationCategory.Database}
          configurations={mockConfigurations}
          isExpanded={false}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      const section = container.querySelector('[data-testid="category-section"]');
      expect(section).toHaveClass('collapsed');
    });
  });

  describe('Configuration Count Display', () => {
    it('should display singular form for single configuration', () => {
      const singleConfig = [mockConfigurations[0]];
      render(
        <CategorySection
          category={ConfigurationCategory.Database}
          configurations={singleConfig}
          isExpanded={true}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      expect(screen.getByText(/1 configuration/i)).toBeInTheDocument();
    });

    it('should display plural form for multiple configurations', () => {
      render(
        <CategorySection
          category={ConfigurationCategory.Database}
          configurations={mockConfigurations}
          isExpanded={true}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      expect(screen.getByText(/3 configurations/i)).toBeInTheDocument();
    });
  });
});
