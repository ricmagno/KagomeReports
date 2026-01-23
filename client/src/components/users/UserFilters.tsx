import React from 'react';
import { UserFilters as UserFiltersType, UserRole } from '../../types/user';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface UserFiltersProps {
  filters: UserFiltersType;
  onChange: (filters: UserFiltersType) => void;
}

export const UserFilters: React.FC<UserFiltersProps> = ({ filters, onChange }) => {
  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onChange({
      ...filters,
      role: value === '' ? undefined : value as UserRole
    });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onChange({
      ...filters,
      isActive: value === '' ? undefined : value === 'true'
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...filters,
      search: e.target.value || undefined
    });
  };

  const handleClearFilters = () => {
    onChange({});
  };

  const hasActiveFilters = filters.role || filters.isActive !== undefined || filters.search;

  return (
    <div className="bg-gray-50 p-4 rounded-lg mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Select
          label="Role"
          value={filters.role || ''}
          onChange={handleRoleChange}
          options={[
            { value: '', label: 'All Roles' },
            { value: 'admin', label: 'Administrator' },
            { value: 'user', label: 'User' },
            { value: 'view-only', label: 'View Only' }
          ]}
        />

        <Select
          label="Status"
          value={filters.isActive === undefined ? '' : String(filters.isActive)}
          onChange={handleStatusChange}
          options={[
            { value: '', label: 'All Status' },
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' }
          ]}
        />

        <Input
          label="Search"
          type="text"
          placeholder="Username or email..."
          value={filters.search || ''}
          onChange={handleSearchChange}
        />

        <div className="flex items-end">
          <Button
            variant="outline"
            onClick={handleClearFilters}
            disabled={!hasActiveFilters}
            className="w-full"
          >
            Clear Filters
          </Button>
        </div>
      </div>
    </div>
  );
};
