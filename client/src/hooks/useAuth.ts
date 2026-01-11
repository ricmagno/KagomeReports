/**
 * Authentication Hook
 * Provides user authentication state and role checking
 */

import { useState, useEffect, createContext, useContext } from 'react';
import { apiService } from '../services/api';

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin';
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (resource: string, action: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useAuthState = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';

  // Check if user has specific permission based on role
  const hasPermission = (resource: string, action: string): boolean => {
    if (!user || !user.isActive) return false;
    
    // Admin has all permissions
    if (user.role === 'admin') return true;
    
    // Define user permissions
    const userPermissions = [
      'reports:read',
      'reports:write',
      'schedules:read',
      'schedules:write',
      'system:read'
    ];
    
    const permission = `${resource}:${action}`;
    return userPermissions.includes(permission);
  };

  const login = async (username: string, password: string, rememberMe: boolean = false): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await apiService.login({ username, password });
      
      if (response.success && response.data?.user) {
        setUser(response.data.user);
        // Store token in localStorage or sessionStorage
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem('authToken', response.data.token || '');
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error) {
      setUser(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('authToken');
      sessionStorage.removeItem('authToken');
    }
  };

  const refreshUser = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
      
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      // Set token for API requests
      const { setAuthToken } = await import('../services/api');
      setAuthToken(token);

      // Verify token and get current user data
      try {
        const response = await apiService.getCurrentUser();
        if (response.success && response.data) {
          setUser(response.data);
        } else {
          setUser(null);
          localStorage.removeItem('authToken');
          sessionStorage.removeItem('authToken');
        }
      } catch (error) {
        // If getCurrentUser fails, just clear the token and continue without auth
        console.warn('Failed to get current user, continuing without authentication:', error);
        setUser(null);
        localStorage.removeItem('authToken');
        sessionStorage.removeItem('authToken');
        const { setAuthToken } = await import('../services/api');
        setAuthToken(null);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      setUser(null);
      localStorage.removeItem('authToken');
      sessionStorage.removeItem('authToken');
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize auth state on mount
  useEffect(() => {
    // Authentication disabled for now - using mock state
    // refreshUser();
    setIsLoading(false); // Set loading to false immediately
  }, []);

  return {
    user,
    isAuthenticated,
    isAdmin,
    isLoading,
    login,
    logout,
    refreshUser,
    hasPermission
  };
};

export { AuthContext };