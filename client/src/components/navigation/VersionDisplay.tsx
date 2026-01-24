/**
 * Version Display Component
 * Displays application version in the main navigation
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import React, { useState, useEffect } from 'react';
import { VersionInfo } from '@/types/versionManagement';
import './VersionDisplay.css';

interface VersionDisplayProps {
  onAboutClick?: () => void;
}

/**
 * VersionDisplay component shows version in navigation
 */
export const VersionDisplay: React.FC<VersionDisplayProps> = ({ onAboutClick }) => {
  const [version, setVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load version on mount
  useEffect(() => {
    loadVersion();
  }, []);

  /**
   * Load version information
   */
  const loadVersion = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/version');
      if (!response.ok) {
        throw new Error('Failed to fetch version');
      }
      const data: VersionInfo = await response.json();
      setVersion(`v${data.version}`);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load version');
      setVersion(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="version-display loading">Loading...</div>;
  }

  if (error) {
    return <div className="version-display error" title={error}>Unknown</div>;
  }

  return (
    <button
      className="version-display"
      onClick={onAboutClick}
      title="Click to view application information"
    >
      {version || 'Unknown'}
    </button>
  );
};

export default VersionDisplay;
