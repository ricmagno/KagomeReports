import React, { useState, useEffect } from 'react';
import { User, UserFilters, CreateUserData, UpdateUserData } from '../../types/user';
import { getUsers, createUser, updateUser, deleteUser } from '../../services/users-api';
import { UserTable } from './UserTable';
import { UserFilters as UserFiltersComponent } from './UserFilters';
import { UserModal } from './UserModal';
import { UserDeleteDialog } from './UserDeleteDialog';
import { Button } from '../ui/Button';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [filters, setFilters] = useState<UserFilters>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
    total: 0
  });

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Load users on mount and when filters/pagination change
  useEffect(() => {
    loadUsers();
  }, [filters, pagination.offset]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getUsers(filters, pagination.limit, pagination.offset);
      setUsers(response.data);
      setPagination(response.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingUser(null);
    setShowModal(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setShowModal(true);
  };

  const handleSave = async (data: CreateUserData | UpdateUserData) => {
    if (editingUser) {
      // Update existing user
      await updateUser(editingUser.id, data as UpdateUserData);
    } else {
      // Create new user
      await createUser(data as CreateUserData);
    }
    await loadUsers();
  };

  const handleDeleteClick = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setDeletingUser(user);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;

    setDeleteLoading(true);
    try {
      await deleteUser(deletingUser.id);
      setDeletingUser(null);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeletingUser(null);
  };

  const handleFilterChange = (newFilters: UserFilters) => {
    setFilters(newFilters);
    // Reset to first page when filters change
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  const handleNextPage = () => {
    if (pagination.offset + pagination.limit < pagination.total) {
      setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }));
    }
  };

  const handlePrevPage = () => {
    if (pagination.offset > 0) {
      setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }));
    }
  };

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-600 mt-1">Manage user accounts and permissions</p>
          </div>
          <Button onClick={handleCreate}>
            Create User
          </Button>
        </div>

        {/* Filters */}
        <UserFiltersComponent filters={filters} onChange={handleFilterChange} />

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* User Table */}
        <UserTable
          users={users}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
          loading={loading}
        />

        {/* Pagination */}
        {!loading && users.length > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total} users
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={pagination.offset === 0}
              >
                Previous
              </Button>
              <div className="flex items-center px-4 text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={pagination.offset + pagination.limit >= pagination.total}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <UserModal
          user={editingUser}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingUser && (
        <UserDeleteDialog
          user={deletingUser}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          loading={deleteLoading}
        />
      )}
    </div>
  );
};
