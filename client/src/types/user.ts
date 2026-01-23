/**
 * User Management Types
 * Type definitions for user management system
 */

export type UserRole = 'admin' | 'user' | 'view-only';

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
  parentUserId?: string | null;
  isViewOnly: boolean;
  autoLoginEnabled: boolean;
  requirePasswordChange: boolean;
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  requirePasswordChange?: boolean;
}

export interface UpdateUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface UserFilters {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
}

export interface UserListResponse {
  success: boolean;
  data: User[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface Machine {
  id: string;
  userId: string;
  machineName: string;
  fingerprintHash: string;
  lastUsed: string;
  createdAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ResetPasswordData {
  newPassword: string;
  requirePasswordChange: boolean;
}
