/**
 * CategorySection Component
 * Container for grouping configurations by category
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import React from 'react';
import {
  Configuration,
  ConfigurationCategory,
  RevealedValues
} from '../../types/configuration';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ConfigurationCard } from './ConfigurationCard';
import { getCategoryDisplayName, getCategoryIcon } from '../../utils/configurationUtils';
import './CategorySection.css';

interface CategorySectionProps {
  category: ConfigurationCategory;
  configurations: Configuration[];
  isExpanded: boolean;
  onToggleExpand: (category: ConfigurationCategory) => void;
  revealedValues: RevealedValues;
  onRevealValue: (configName: string) => void;
  isEditable: boolean;
  onEditConfiguration: (configName: string, oldValue: string, newValue: string) => void;
}

export const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  configurations,
  isExpanded,
  onToggleExpand,
  revealedValues,
  onRevealValue,
  isEditable,
  onEditConfiguration
}) => {
  const handleToggle = () => {
    onToggleExpand(category);
  };

  const categoryName = getCategoryDisplayName(category);
  const categoryIcon = getCategoryIcon(category);

  return (
    <div className="category-section">
      {/* Category Header */}
      <button
        className="category-header"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-label={`Toggle ${categoryName} configurations`}
      >
        <div className="header-left">
          {isExpanded ? (
            <ChevronDown size={20} className="chevron" />
          ) : (
            <ChevronRight size={20} className="chevron" />
          )}
          <span className="category-icon">{categoryIcon}</span>
          <h2 className="category-name">{categoryName}</h2>
        </div>
        <div className="header-right">
          <span className="config-count">{configurations.length}</span>
        </div>
      </button>

      {/* Category Content */}
      {isExpanded && (
        <div className="category-content">
          <div className="configurations-list">
            {configurations.map(config => (
              <ConfigurationCard
                key={config.environmentVariable}
                configuration={config}
                isRevealed={revealedValues[config.environmentVariable] || false}
                isEditable={isEditable}
                onReveal={onRevealValue}
                onEdit={onEditConfiguration}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CategorySection;
