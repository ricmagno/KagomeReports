import React from 'react';
import { User } from '../../types/user';
import { Button } from '../ui/Button';

interface UserDeleteDialogProps {
  user: User;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export const UserDeleteDialog: React.FC<UserDeleteDialogProps> = ({
  user,
  onConfirm,
  onCancel,
  loading
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Delete User
        </h2>
        
        <div className="mb-6">
          <p className="text-gray-700 mb-2">
            Are you sure you want to delete the user <strong>{user.username}</strong>?
          </p>
          
          {user.role === 'user' && !user.isViewOnly && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                <strong>Warning:</strong> This will also delete the associated View-Only account ({user.username}.view).
              </p>
            </div>
          )}
          
          <p className="text-sm text-gray-600 mt-4">
            This action cannot be undone.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            loading={loading}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Delete User
          </Button>
        </div>
      </div>
    </div>
  );
};
