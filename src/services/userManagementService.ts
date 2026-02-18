/**
 * User Management Service
 * Handles user CRUD operations, View-Only account management, and password management
 * Requirements: User Management System Phase 2
 */

import { Database } from 'sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import { apiLogger } from '@/utils/logger';
import { env } from '@/config/environment';
import { authService } from '@/services/authService';

// Extended User interface with new fields
export interface UserManagementUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user' | 'view-only';
  passwordHash: string;
  isActive: boolean;
  isViewOnly: boolean;
  parentUserId?: string;
  autoLoginEnabled: boolean;
  requirePasswordChange: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: 'admin' | 'user' | 'view-only';
  requirePasswordChange?: boolean;
}

export interface UpdateUserRequest {
  email?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
  role?: 'admin' | 'user' | 'view-only' | undefined;
  isActive?: boolean | undefined;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user' | 'view-only';
  isActive: boolean;
  isViewOnly: boolean;
  parentUserId?: string;
  autoLoginEnabled: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserFilters {
  role?: 'admin' | 'user' | 'view-only';
  isActive?: boolean;
  search?: string;
}

export interface UserListResponse {
  users: UserResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export class UserManagementService {
  private get db(): Database {
    return authService.db;
  }

  constructor() { }

  /**
   * Create a new user
   * Automatically creates View-Only account if role is 'user'
   */
  async createUser(userData: CreateUserRequest): Promise<UserResponse> {
    try {
      // Validate username uniqueness
      const existingUser = await this.getUserByUsername(userData.username);
      if (existingUser) {
        throw new Error(`Username '${userData.username}' already exists`);
      }

      // Validate email uniqueness
      const existingEmail = await this.getUserByEmail(userData.email);
      if (existingEmail) {
        throw new Error(`Email '${userData.email}' already exists`);
      }

      // Hash password
      const passwordHash = await bcrypt.hash(userData.password, env.BCRYPT_ROUNDS);

      // Generate user ID
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Insert user
      await new Promise<void>((resolve, reject) => {
        this.db.run(
          `INSERT INTO users (
            id, username, email, first_name, last_name, role, password_hash,
            is_active, is_view_only, parent_user_id, auto_login_enabled, require_password_change
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            userData.username,
            userData.email,
            userData.firstName,
            userData.lastName,
            userData.role,
            passwordHash,
            1, // is_active
            0, // is_view_only
            null, // parent_user_id
            0, // auto_login_enabled
            userData.requirePasswordChange ? 1 : 0
          ],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      apiLogger.info('User created', { userId, username: userData.username, role: userData.role });

      // If role is 'user', automatically create View-Only account
      let viewOnlyUser: UserResponse | null = null;
      if (userData.role === 'user') {
        viewOnlyUser = await this.createViewOnlyAccount(userId, userData);
        apiLogger.info('View-Only account auto-created', {
          parentUserId: userId,
          viewOnlyUserId: viewOnlyUser.id,
          viewOnlyUsername: viewOnlyUser.username
        });
      }

      // Get and return the created user
      const createdUser = await this.getUser(userId);
      if (!createdUser) {
        throw new Error('Failed to retrieve created user');
      }

      return createdUser;
    } catch (error) {
      apiLogger.error('Failed to create user', { error, userData: { ...userData, password: '[REDACTED]' } });
      throw error;
    }
  }

  /**
   * Create View-Only account for a parent user
   */
  async createViewOnlyAccount(parentUserId: string, parentData?: CreateUserRequest): Promise<UserResponse> {
    try {
      // Get parent user if not provided
      let parentUser: UserResponse | null = null;
      if (!parentData) {
        parentUser = await this.getUser(parentUserId);
        if (!parentUser) {
          throw new Error(`Parent user not found: ${parentUserId}`);
        }
      }

      const username = parentData ? parentData.username : parentUser!.username;
      const viewOnlyUsername = `${username}.view`;

      // Check if View-Only account already exists
      const existing = await this.getUserByUsername(viewOnlyUsername);
      if (existing) {
        throw new Error(`View-Only account already exists: ${viewOnlyUsername}`);
      }

      // Generate user ID
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Use same password hash as parent or generate new one
      const passwordHash = parentData
        ? await bcrypt.hash(parentData.password, env.BCRYPT_ROUNDS)
        : (await this.getUserById(parentUserId))!.passwordHash;

      const email = parentData ? parentData.email : parentUser!.email;
      const firstName = parentData ? parentData.firstName : parentUser!.firstName;
      const lastName = parentData ? parentData.lastName : parentUser!.lastName;

      // Insert View-Only user
      await new Promise<void>((resolve, reject) => {
        this.db.run(
          `INSERT INTO users (
            id, username, email, first_name, last_name, role, password_hash,
            is_active, is_view_only, parent_user_id, auto_login_enabled, require_password_change
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            viewOnlyUsername,
            `${viewOnlyUsername}@${email.split('@')[1]}`, // Generate unique email
            firstName,
            lastName,
            'view-only',
            passwordHash,
            1, // is_active
            1, // is_view_only
            parentUserId, // parent_user_id
            0, // auto_login_enabled
            0 // require_password_change
          ],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      apiLogger.info('View-Only account created', { userId, username: viewOnlyUsername, parentUserId });

      const createdUser = await this.getUser(userId);
      if (!createdUser) {
        throw new Error('Failed to retrieve created View-Only user');
      }

      return createdUser;
    } catch (error) {
      apiLogger.error('Failed to create View-Only account', { error, parentUserId });
      throw error;
    }
  }

  /**
   * Get View-Only account for a parent user
   */
  async getViewOnlyAccount(parentUserId: string): Promise<UserResponse | null> {
    try {
      return new Promise((resolve, reject) => {
        this.db.get(
          `SELECT * FROM users WHERE parent_user_id = ? AND is_view_only = 1`,
          [parentUserId],
          (err, row: any) => {
            if (err) {
              reject(err);
            } else {
              resolve(row ? this.mapRowToUserResponse(row) : null);
            }
          }
        );
      });
    } catch (error) {
      apiLogger.error('Failed to get View-Only account', { error, parentUserId });
      throw error;
    }
  }

  /**
   * Update user
   */
  async updateUser(userId: string, userData: UpdateUserRequest): Promise<UserResponse> {
    try {
      const user = await this.getUser(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Build update query dynamically
      const updates: string[] = [];
      const params: any[] = [];

      if (userData.email !== undefined) {
        updates.push('email = ?');
        params.push(userData.email);
      }
      if (userData.firstName !== undefined) {
        updates.push('first_name = ?');
        params.push(userData.firstName);
      }
      if (userData.lastName !== undefined) {
        updates.push('last_name = ?');
        params.push(userData.lastName);
      }
      if (userData.role !== undefined) {
        updates.push('role = ?');
        params.push(userData.role);
      }
      if (userData.isActive !== undefined) {
        updates.push('is_active = ?');
        params.push(userData.isActive ? 1 : 0);
      }

      if (updates.length === 0) {
        return user; // No updates
      }

      updates.push('updated_at = datetime("now")');
      params.push(userId);

      await new Promise<void>((resolve, reject) => {
        this.db.run(
          `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
          params,
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      apiLogger.info('User updated', { userId, updates: Object.keys(userData) });

      const updatedUser = await this.getUser(userId);
      if (!updatedUser) {
        throw new Error('Failed to retrieve updated user');
      }

      return updatedUser;
    } catch (error) {
      apiLogger.error('Failed to update user', { error, userId, userData });
      throw error;
    }
  }

  /**
   * Delete user
   * Automatically deletes View-Only account if user role is 'user'
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      const user = await this.getUser(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Check if user has View-Only account
      if (user.role === 'user') {
        const viewOnlyAccount = await this.getViewOnlyAccount(userId);
        if (viewOnlyAccount) {
          // Delete View-Only account first
          await new Promise<void>((resolve, reject) => {
            this.db.run('DELETE FROM users WHERE id = ?', [viewOnlyAccount.id], (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
          apiLogger.info('View-Only account deleted (cascade)', {
            viewOnlyUserId: viewOnlyAccount.id,
            parentUserId: userId
          });
        }
      }

      // Delete user
      await new Promise<void>((resolve, reject) => {
        this.db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      apiLogger.info('User deleted', { userId, username: user.username });
    } catch (error) {
      apiLogger.error('Failed to delete user', { error, userId });
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<UserResponse | null> {
    try {
      return new Promise((resolve, reject) => {
        this.db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(row ? this.mapRowToUserResponse(row) : null);
          }
        });
      });
    } catch (error) {
      apiLogger.error('Failed to get user', { error, userId });
      throw error;
    }
  }

  /**
   * Get user by username
   */
  private async getUserByUsername(username: string): Promise<UserResponse | null> {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE username = ? COLLATE NOCASE', [username], (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? this.mapRowToUserResponse(row) : null);
        }
      });
    });
  }

  /**
   * Get user by email
   */
  private async getUserByEmail(email: string): Promise<UserResponse | null> {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE email = ? COLLATE NOCASE', [email], (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? this.mapRowToUserResponse(row) : null);
        }
      });
    });
  }

  /**
   * Get user by ID (internal, includes password hash)
   */
  private async getUserById(userId: string): Promise<UserManagementUser | null> {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? this.mapRowToUser(row) : null);
        }
      });
    });
  }

  /**
   * List users with filtering and pagination
   */
  async listUsers(filters?: UserFilters, page: number = 1, pageSize: number = 50): Promise<UserListResponse> {
    try {
      let query = 'SELECT * FROM users WHERE 1=1';
      const params: any[] = [];

      if (filters?.role) {
        query += ' AND role = ?';
        params.push(filters.role);
      }

      if (filters?.isActive !== undefined) {
        query += ' AND is_active = ?';
        params.push(filters.isActive ? 1 : 0);
      }

      if (filters?.search) {
        query += ' AND (username LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)';
        const searchPattern = `%${filters.search}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      // Get total count
      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
      const total = await new Promise<number>((resolve, reject) => {
        this.db.get(countQuery, params, (err, row: any) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });

      // Get paginated results
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(pageSize, (page - 1) * pageSize);

      const users = await new Promise<UserResponse[]>((resolve, reject) => {
        this.db.all(query, params, (err, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows.map(row => this.mapRowToUserResponse(row)));
          }
        });
      });

      return {
        users,
        total,
        page,
        pageSize
      };
    } catch (error) {
      apiLogger.error('Failed to list users', { error, filters });
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Verify old password
      const passwordValid = await bcrypt.compare(oldPassword, user.passwordHash);
      if (!passwordValid) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);

      // Update password
      await new Promise<void>((resolve, reject) => {
        this.db.run(
          `UPDATE users SET password_hash = ?, require_password_change = 0, updated_at = datetime("now") WHERE id = ?`,
          [newPasswordHash, userId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      apiLogger.info('Password changed', { userId });
    } catch (error) {
      apiLogger.error('Failed to change password', { error, userId });
      throw error;
    }
  }

  /**
   * Reset user password (admin only)
   */
  async resetPassword(userId: string, newPassword: string): Promise<void> {
    try {
      const user = await this.getUser(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);

      // Update password and require change on next login
      await new Promise<void>((resolve, reject) => {
        this.db.run(
          `UPDATE users SET password_hash = ?, require_password_change = 1, updated_at = datetime("now") WHERE id = ?`,
          [newPasswordHash, userId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      apiLogger.info('Password reset', { userId });
    } catch (error) {
      apiLogger.error('Failed to reset password', { error, userId });
      throw error;
    }
  }

  /**
   * Activate user
   */
  async activateUser(userId: string): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.db.run(
          `UPDATE users SET is_active = 1, updated_at = datetime("now") WHERE id = ?`,
          [userId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      apiLogger.info('User activated', { userId });
    } catch (error) {
      apiLogger.error('Failed to activate user', { error, userId });
      throw error;
    }
  }

  /**
   * Deactivate user
   */
  async deactivateUser(userId: string): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.db.run(
          `UPDATE users SET is_active = 0, updated_at = datetime("now") WHERE id = ?`,
          [userId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      apiLogger.info('User deactivated', { userId });
    } catch (error) {
      apiLogger.error('Failed to deactivate user', { error, userId });
      throw error;
    }
  }

  /**
   * Seed initial users
   */
  async seedInitialUsers(): Promise<void> {
    try {
      const users = [
        {
          username: 'admin',
          password: 'admin123',
          email: 'admin@historian.local',
          firstName: 'Administrator',
          lastName: 'User',
          role: 'admin' as const
        },
        {
          username: 'scada.sa',
          password: '1z))(+8mmBe5L8QV',
          email: 'scada.sa@historian.local',
          firstName: 'System',
          lastName: 'Administrator',
          role: 'admin' as const
        },
        {
          username: 'Operator',
          password: 'operator',
          email: 'operator@historian.local',
          firstName: 'Operator',
          lastName: 'User',
          role: 'user' as const
        },
        {
          username: 'Quality',
          password: 'quality',
          email: 'quality@historian.local',
          firstName: 'Quality',
          lastName: 'User',
          role: 'user' as const
        },
        {
          username: 'Supervisor',
          password: 'supervisor',
          email: 'supervisor@historian.local',
          firstName: 'Supervisor',
          lastName: 'User',
          role: 'user' as const
        },
        {
          username: 'Maintenance',
          password: 'maintenance',
          email: 'maintenance@historian.local',
          firstName: 'Maintenance',
          lastName: 'User',
          role: 'user' as const
        }
      ];

      for (const userData of users) {
        const [usernameExists, emailExists] = await Promise.all([
          this.getUserByUsername(userData.username),
          this.getUserByEmail(userData.email)
        ]);

        if (!usernameExists && !emailExists) {
          await this.createUser(userData);
          apiLogger.info('Initial user seeded', { username: userData.username, role: userData.role });
        } else {
          apiLogger.info('Initial user already exists or email in use', {
            username: userData.username,
            usernameExists: !!usernameExists,
            emailExists: !!emailExists
          });
        }
      }

      apiLogger.info('Initial users seeding completed');
    } catch (error) {
      apiLogger.error('Failed to seed initial users', { error });
      throw error;
    }
  }

  /**
   * Map database row to UserResponse
   */
  private mapRowToUserResponse(row: any): UserResponse {
    const response: UserResponse = {
      id: row.id,
      username: row.username,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      isActive: Boolean(row.is_active),
      isViewOnly: Boolean(row.is_view_only),
      parentUserId: row.parent_user_id,
      autoLoginEnabled: Boolean(row.auto_login_enabled),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };

    if (row.last_login) {
      response.lastLogin = new Date(row.last_login);
    }

    return response;
  }

  /**
   * Map database row to UserManagementUser (includes password hash)
   */
  private mapRowToUser(row: any): UserManagementUser {
    const user: UserManagementUser = {
      id: row.id,
      username: row.username,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      passwordHash: row.password_hash,
      isActive: Boolean(row.is_active),
      isViewOnly: Boolean(row.is_view_only),
      parentUserId: row.parent_user_id,
      autoLoginEnabled: Boolean(row.auto_login_enabled),
      requirePasswordChange: Boolean(row.require_password_change),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };

    if (row.last_login) {
      user.lastLogin = new Date(row.last_login);
    }

    return user;
  }

  /**
   * Shutdown the service
   */
  shutdown(): void {
    // Shared database is closed by AuthService
    apiLogger.info('User management service shutdown');
  }
}

// Export singleton instance
export const userManagementService = new UserManagementService();
