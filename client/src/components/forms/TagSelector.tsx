import React, { useState, useEffect, useMemo } from 'react';
import { Search, Tag, X, Plus } from 'lucide-react';
import { TagInfo } from '../../types/api';
import { apiService } from '../../services/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { cn } from '../../utils/cn';

interface TagSelectorProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  className?: string;
  maxTags?: number;
}

export const TagSelector: React.FC<TagSelectorProps> = ({
  selectedTags,
  onChange,
  className,
  maxTags = 10,
}) => {
  const [availableTags, setAvailableTags] = useState<TagInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Load available tags
  useEffect(() => {
    const loadTags = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiService.getTags();
        if (response.success) {
          setAvailableTags(response.data);
        } else {
          setError('Failed to load tags');
        }
      } catch (err) {
        console.warn('Failed to load tags from API, using fallback:', err);
        // Fallback to mock data if API fails
        const mockTags: TagInfo[] = [
          { name: 'Temperature_01', description: 'Temperature sensor 1', units: '°C', dataType: 'analog', lastUpdate: new Date() },
          { name: 'Pressure_01', description: 'Pressure sensor 1', units: 'PSI', dataType: 'analog', lastUpdate: new Date() },
          { name: 'Flow_01', description: 'Flow meter 1', units: 'GPM', dataType: 'analog', lastUpdate: new Date() },
          { name: 'Level_01', description: 'Level sensor 1', units: '%', dataType: 'analog', lastUpdate: new Date() },
          { name: 'Status_01', description: 'Status indicator 1', units: '', dataType: 'discrete', lastUpdate: new Date() },
        ];
        setAvailableTags(mockTags);
        setError('Using fallback data - API connection failed');
      } finally {
        setLoading(false);
      }
    };

    loadTags();
  }, []);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.tag-selector-dropdown')) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter tags based on search term
  const filteredTags = useMemo(() => {
    if (!searchTerm) return availableTags;
    
    const term = searchTerm.toLowerCase();
    return availableTags.filter(tag =>
      tag.name.toLowerCase().includes(term) ||
      tag.description.toLowerCase().includes(term)
    );
  }, [availableTags, searchTerm]);

  // Available tags that aren't already selected
  const unselectedTags = useMemo(() => {
    return filteredTags.filter(tag => !selectedTags.includes(tag.name));
  }, [filteredTags, selectedTags]);

  const handleAddTag = (tagName: string) => {
    if (selectedTags.length >= maxTags) {
      setError(`Maximum ${maxTags} tags allowed`);
      return;
    }

    if (!selectedTags.includes(tagName)) {
      onChange([...selectedTags, tagName]);
      setSearchTerm('');
      setShowDropdown(false);
      setError(null);
    }
  };

  const handleRemoveTag = (tagName: string) => {
    onChange(selectedTags.filter(tag => tag !== tagName));
    setError(null);
  };

  const getTagInfo = (tagName: string): TagInfo | undefined => {
    return availableTags.find(tag => tag.name === tagName);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Tag className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-medium">Tag Selection</h3>
          </div>
          <span className="text-sm text-gray-500">
            {selectedTags.length}/{maxTags} selected
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search input */}
        <div className="relative tag-selector-dropdown">
          <Input
            type="text"
            placeholder="Search tags..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            className="pr-10"
          />
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          
          {/* Dropdown */}
          {showDropdown && unselectedTags.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
              {loading ? (
                <div className="p-3 text-center text-gray-500">Loading tags...</div>
              ) : (
                unselectedTags.slice(0, 20).map((tag) => (
                  <button
                    key={tag.name}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                    onClick={() => handleAddTag(tag.name)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{tag.name}</div>
                        <div className="text-sm text-gray-500 truncate">
                          {tag.description}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 ml-2">
                        {tag.units}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Selected tags */}
        {selectedTags.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Selected Tags:</h4>
            <div className="flex flex-wrap gap-2">
              {selectedTags.map((tagName) => {
                const tagInfo = getTagInfo(tagName);
                return (
                  <div
                    key={tagName}
                    className={cn(
                      'inline-flex items-center px-3 py-1 rounded-full text-sm',
                      'bg-primary-100 text-primary-800 border border-primary-200'
                    )}
                  >
                    <span className="mr-2">{tagName}</span>
                    {tagInfo && (
                      <span className="text-xs text-primary-600 mr-2">
                        ({tagInfo.units})
                      </span>
                    )}
                    <button
                      onClick={() => handleRemoveTag(tagName)}
                      className="ml-1 hover:text-primary-900 focus:outline-none"
                      aria-label={`Remove ${tagName}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="text-sm text-error bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}

        {/* Empty state */}
        {selectedTags.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Tag className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No tags selected</p>
            <p className="text-sm">Search and select tags to include in your report</p>
          </div>
        )}

        {/* Quick add popular tags */}
        {selectedTags.length === 0 && availableTags.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Popular Tags:</h4>
            <div className="flex flex-wrap gap-2">
              {availableTags.slice(0, 5).map((tag) => (
                <Button
                  key={tag.name}
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddTag(tag.name)}
                  className="text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {tag.name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};