import React, { useState, useEffect } from 'react';
import { User, CreateUserData, UpdateUserData, UserRole } from '../../types/user';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';

interface UserModalProps {
  user: User | null;
  onClose: () => void;
  onSave: (data: CreateUserData | UpdateUserData) => Promise<void>;
}

export const UserModal: React.FC<UserModalProps> = ({ user, onClose, onSave }) => {
  const isEditMode = !!user;
  
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    role: user?.role || 'user' as UserRole,
    password: '',
    confirmPassword: '',
    requirePasswordChange: false
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Username validation (only for create mode)
    if (!isEditMode) {
      if (!formData.username.trim()) {
        newErrors.username = 'Username is required';
      } else if (formData.username.length < 3) {
        newErrors.username = 'Username must be at least 3 characters';
      } else if (formData.username.length > 50) {
        newErrors.username = 'Username must be less than 50 characters';
      }
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    // First name validation
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    // Last name validation
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    // Password validation (only for create mode)
    if (!isEditMode) {
      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else if (formData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
      } else if (!/[a-zA-Z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
        newErrors.password = 'Password must contain letters and numbers';
      }

      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      if (isEditMode) {
        const updateData: UpdateUserData = {
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role
        };
        await onSave(updateData);
      } else {
        const createData: CreateUserData = {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role,
          requirePasswordChange: formData.requirePasswordChange
        };
        await onSave(createData);
      }
      onClose();
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to save user' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const getPasswordStrength = (password: string): { strength: string; color: string } => {
    if (!password) return { strength: '', color: '' };
    
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 2) return { strength: 'Weak', color: 'bg-red-500' };
    if (score <= 3) return { strength: 'Medium', color: 'bg-yellow-500' };
    return { strength: 'Strong', color: 'bg-green-500' };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 my-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {isEditMode ? 'Edit User' : 'Create User'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEditMode && (
            <Input
              label="Username"
              type="text"
              value={formData.username}
              onChange={(e) => handleChange('username', e.target.value)}
              error={errors.username}
              required
              autoComplete="off"
            />
          )}

          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            error={errors.email}
            required
            autoComplete="email"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              type="text"
              value={formData.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              error={errors.firstName}
              required
              autoComplete="given-name"
            />

            <Input
              label="Last Name"
              type="text"
              value={formData.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              error={errors.lastName}
              required
              autoComplete="family-name"
            />
          </div>

          <Select
            label="Role"
            value={formData.role}
            onChange={(e) => handleChange('role', e.target.value as UserRole)}
            options={[
              { value: 'admin', label: 'Administrator - Full access to all features' },
              { value: 'user', label: 'User - Can create and manage reports' },
              { value: 'view-only', label: 'View Only - Can only view reports' }
            ]}
            required
          />

          {!isEditMode && (
            <>
              <Input
                label="Password"
                type="password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                error={errors.password}
                required
                autoComplete="new-password"
                helperText="Minimum 8 characters with letters and numbers"
              />

              {formData.password && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${passwordStrength.color} transition-all`}
                        style={{ width: passwordStrength.strength === 'Weak' ? '33%' : passwordStrength.strength === 'Medium' ? '66%' : '100%' }}
                      />
                    </div>
                    <span className="text-xs text-gray-600">{passwordStrength.strength}</span>
                  </div>
                </div>
              )}

              <Input
                label="Confirm Password"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                error={errors.confirmPassword}
                required
                autoComplete="new-password"
              />

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="requirePasswordChange"
                  checked={formData.requirePasswordChange}
                  onChange={(e) => handleChange('requirePasswordChange', e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="requirePasswordChange" className="ml-2 block text-sm text-gray-700">
                  Require password change on first login
                </label>
              </div>
            </>
          )}

          {formData.role === 'user' && !isEditMode && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> A View-Only account will be automatically created with username "{formData.username}.view"
              </p>
            </div>
          )}

          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{errors.submit}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
            >
              {isEditMode ? 'Update User' : 'Create User'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
