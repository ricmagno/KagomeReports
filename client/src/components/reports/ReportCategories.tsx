/**
 * Report Categories Component
 * Handles categorization and tagging system for reports
 * Requirements: 6.4, 6.5
 */

import React, { useState } from 'react';
import { 
  Tag, 
  Plus, 
  X, 
  Edit2, 
  Trash2, 
  FolderPlus,
  Folder,
  Hash,
  Search
} from 'lucide-react';

export interface Category {
  id: string;
  name: string;
  description?: string;
  color: string;
  reportCount: number;
  createdAt: Date;
}

export interface TagInfo {
  name: string;
  count: number;
  category?: string;
}

interface ReportCategoriesProps {
  categories: Category[];
  tags: TagInfo[];
  onCreateCategory?: (category: Omit<Category, 'id' | 'reportCount' | 'createdAt'>) => Promise<void>;
  onUpdateCategory?: (id: string, category: Partial<Category>) => Promise<void>;
  onDeleteCategory?: (id: string) => Promise<void>;
  onCreateTag?: (tag: string, category?: string) => Promise<void>;
  onDeleteTag?: (tag: string) => Promise<void>;
  className?: string;
}

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6B7280'  // Gray
];

export const ReportCategories: React.FC<ReportCategoriesProps> = ({
  categories,
  tags,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onCreateTag,
  onDeleteTag,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'categories' | 'tags'>('categories');
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    color: PRESET_COLORS[0]
  });

  const [tagForm, setTagForm] = useState({
    name: '',
    category: ''
  });

  const resetCategoryForm = () => {
    setCategoryForm({
      name: '',
      description: '',
      color: PRESET_COLORS[0]
    });
  };

  const resetTagForm = () => {
    setTagForm({
      name: '',
      category: ''
    });
  };

  const handleCreateCategory = async () => {
    if (!categoryForm.name.trim() || !onCreateCategory) return;

    try {
      await onCreateCategory({
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim() || undefined,
        color: categoryForm.color
      });
      
      setShowCreateCategory(false);
      resetCategoryForm();
    } catch (error) {
      console.error('Failed to create category:', error);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !categoryForm.name.trim() || !onUpdateCategory) return;

    try {
      await onUpdateCategory(editingCategory.id, {
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim() || undefined,
        color: categoryForm.color
      });
      
      setEditingCategory(null);
      resetCategoryForm();
    } catch (error) {
      console.error('Failed to update category:', error);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!onDeleteCategory) return;
    
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;

    if (category.reportCount > 0) {
      if (!window.confirm(`This category contains ${category.reportCount} reports. Are you sure you want to delete it?`)) {
        return;
      }
    }

    try {
      await onDeleteCategory(categoryId);
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const handleCreateTag = async () => {
    if (!tagForm.name.trim() || !onCreateTag) return;

    try {
      await onCreateTag(
        tagForm.name.trim(),
        tagForm.category.trim() || undefined
      );
      
      setShowCreateTag(false);
      resetTagForm();
    } catch (error) {
      console.error('Failed to create tag:', error);
    }
  };

  const handleDeleteTag = async (tagName: string) => {
    if (!onDeleteTag) return;
    
    const tag = tags.find(t => t.name === tagName);
    if (!tag) return;

    if (tag.count > 0) {
      if (!window.confirm(`This tag is used by ${tag.count} reports. Are you sure you want to delete it?`)) {
        return;
      }
    }

    try {
      await onDeleteTag(tagName);
    } catch (error) {
      console.error('Failed to delete tag:', error);
    }
  };

  const startEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
      color: category.color
    });
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    resetCategoryForm();
  };

  // Filter categories and tags based on search
  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    category.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tag.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`bg-white rounded-lg shadow-md border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Report Organization
        </h2>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-4">
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'categories'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Folder className="w-4 h-4 mr-2" />
            Categories ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            className={`flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'tags'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Hash className="w-4 h-4 mr-2" />
            Tags ({tags.length})
          </button>
        </div>

        {/* Search and Actions */}
        <div className="flex items-center justify-between">
          <div className="flex-1 relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            onClick={() => {
              if (activeTab === 'categories') {
                setShowCreateCategory(true);
              } else {
                setShowCreateTag(true);
              }
            }}
            className="ml-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add {activeTab === 'categories' ? 'Category' : 'Tag'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'categories' ? (
          <div className="space-y-4">
            {filteredCategories.length === 0 ? (
              <div className="text-center py-8">
                <FolderPlus className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  {searchTerm ? 'No categories found' : 'No categories yet'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchTerm 
                    ? 'Try adjusting your search term.'
                    : 'Get started by creating your first category.'
                  }
                </p>
              </div>
            ) : (
              filteredCategories.map(category => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">
                        {category.name}
                      </h3>
                      {category.description && (
                        <p className="text-sm text-gray-500">
                          {category.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        {category.reportCount} reports
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => startEditCategory(category)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                      title="Edit Category"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                      title="Delete Category"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTags.length === 0 ? (
              <div className="text-center py-8">
                <Tag className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  {searchTerm ? 'No tags found' : 'No tags yet'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchTerm 
                    ? 'Try adjusting your search term.'
                    : 'Tags will appear here as you create reports.'
                  }
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTags.map(tag => (
                  <div
                    key={tag.name}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      <Tag className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {tag.name}
                        </p>
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <span>{tag.count} reports</span>
                          {tag.category && (
                            <>
                              <span>•</span>
                              <span>{tag.category}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteTag(tag.name)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md flex-shrink-0"
                      title="Delete Tag"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Category Dialog */}
      {showCreateCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Create Category
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Production Reports"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setCategoryForm(prev => ({ ...prev, color }))}
                      className={`w-8 h-8 rounded-full border-2 ${
                        categoryForm.color === color ? 'border-gray-900' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateCategory(false);
                  resetCategoryForm();
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCategory}
                disabled={!categoryForm.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Category Dialog */}
      {editingCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Edit Category
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setCategoryForm(prev => ({ ...prev, color }))}
                      className={`w-8 h-8 rounded-full border-2 ${
                        categoryForm.color === color ? 'border-gray-900' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={cancelEdit}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateCategory}
                disabled={!categoryForm.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Tag Dialog */}
      {showCreateTag && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Create Tag
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tag Name *
                </label>
                <input
                  type="text"
                  value={tagForm.name}
                  onChange={(e) => setTagForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., daily, production, quality"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category (Optional)
                </label>
                <select
                  value={tagForm.category}
                  onChange={(e) => setTagForm(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">No category</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateTag(false);
                  resetTagForm();
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTag}
                disabled={!tagForm.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};