/**
 * User Management API Service
 * Handles all user management API calls
 */

import { 
  User, 
  CreateUserData, 
  UpdateUserData, 
  UserFilters, 
  UserListResponse,
  Machine,
  ChangePasswordData,
  ResetPasswordData
} from '../types/user';

const API_BASE = '/api';

/**
 * Get list of users with optional filters
 */
export async function getUsers(
  filters?: UserFilters,
  limit: number = 50,
  offset: number = 0
): Promise<UserListResponse> {
  const params = new URLSearchParams();
  
  if (filters?.role) params.append('role', filters.role);
  if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));
  if (filters?.search) params.append('search', filters.search);
  params.append('limit', String(limit));
  params.append('offset', String(offset));

  const response = await fetch(`${API_BASE}/users?${params}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }

  return response.json();
}

/**
 * Get user by ID
 */
export async function getUser(userId: string): Promise<User> {
  const response = await fetch(`${API_BASE}/users/${userId}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Create new user
 */
export async function createUser(userData: CreateUserData): Promise<{ user: User; viewOnlyUser?: User }> {
  const response = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify(userData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create user');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Update user
 */
export async function updateUser(userId: string, updates: UpdateUserData): Promise<User> {
  const response = await fetch(`${API_BASE}/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update user');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Delete user
 */
export async function deleteUser(userId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete user');
  }
}

/**
 * Change own password
 */
export async function changePassword(data: ChangePasswordData): Promise<void> {
  const response = await fetch(`${API_BASE}/users/me/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to change password');
  }
}

/**
 * Reset user password (admin only)
 */
export async function resetPassword(userId: string, data: ResetPasswordData): Promise<void> {
  const response = await fetch(`${API_BASE}/users/${userId}/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to reset password');
  }
}

/**
 * Get user's machines
 */
export async function getUserMachines(userId: string): Promise<Machine[]> {
  const response = await fetch(`${API_BASE}/users/${userId}/machines`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch machines');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Remove machine from user
 */
export async function removeMachine(userId: string, machineId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/users/${userId}/machines/${machineId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove machine');
  }
}

/**
 * Activate user
 */
export async function activateUser(userId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/users/${userId}/activate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to activate user');
  }
}

/**
 * Deactivate user
 */
export async function deactivateUser(userId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/users/${userId}/deactivate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to deactivate user');
  }
}
