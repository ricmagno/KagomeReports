/**
 * User Management Service
 * Handles user CRUD operations, View-Only account management, and password management
 * Requirements: User Management System Phase 2
 */

import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import { apiLogger } from '@/utils/logger';
import { env } from '@/config/environment';
import { authService } from '@/services/authService';

export interface UserManagementUser {
  id: string;
  username: string;
  email: string;
  mobile?: string;
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
  mobile?: string | undefined;
  firstName: string;
  lastName: string;
  password: string;
  role: 'admin' | 'user' | 'view-only';
  requirePasswordChange?: boolean;
}

export interface UpdateUserRequest {
  email?: string | undefined;
  mobile?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
  role?: 'admin' | 'user' | 'view-only' | undefined;
  isActive?: boolean | undefined;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  mobile?: string;
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
  private get db(): Database.Database {
    return authService.db;
  }

  constructor() { }

  async createUser(userData: CreateUserRequest): Promise<UserResponse> {
    try {
      const existingUser = await this.getUserByUsername(userData.username);
      if (existingUser) throw new Error(`Username '${userData.username}' already exists`);

      const existingEmail = await this.getUserByEmail(userData.email);
      if (existingEmail) throw new Error(`Email '${userData.email}' already exists`);

      const passwordHash = await bcrypt.hash(userData.password, env.BCRYPT_ROUNDS);
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.db.prepare(`
        INSERT INTO users (
          id, username, email, mobile, first_name, last_name, role, password_hash,
          is_active, is_view_only, parent_user_id, auto_login_enabled, require_password_change
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId, userData.username, userData.email, userData.mobile || null,
        userData.firstName, userData.lastName, userData.role, passwordHash,
        1, 0, null, 0, userData.requirePasswordChange ? 1 : 0
      );

      apiLogger.info('User created', { userId, username: userData.username, role: userData.role });

      if (userData.role === 'user') {
        const viewOnlyUser = await this.createViewOnlyAccount(userId, userData);
        apiLogger.info('View-Only account auto-created', {
          parentUserId: userId, viewOnlyUserId: viewOnlyUser.id, viewOnlyUsername: viewOnlyUser.username
        });
      }

      const createdUser = await this.getUser(userId);
      if (!createdUser) throw new Error('Failed to retrieve created user');
      return createdUser;
    } catch (error) {
      apiLogger.error('Failed to create user', { error, userData: { ...userData, password: '[REDACTED]' } });
      throw error;
    }
  }

  async createViewOnlyAccount(parentUserId: string, parentData?: CreateUserRequest): Promise<UserResponse> {
    try {
      let parentUser: UserResponse | null = null;
      if (!parentData) {
        parentUser = await this.getUser(parentUserId);
        if (!parentUser) throw new Error(`Parent user not found: ${parentUserId}`);
      }

      const username = parentData ? parentData.username : parentUser!.username;
      const viewOnlyUsername = `${username}.view`;

      const existing = await this.getUserByUsername(viewOnlyUsername);
      if (existing) throw new Error(`View-Only account already exists: ${viewOnlyUsername}`);

      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const passwordHash = parentData
        ? await bcrypt.hash(parentData.password, env.BCRYPT_ROUNDS)
        : (await this.getUserById(parentUserId))!.passwordHash;

      const email = parentData ? parentData.email : parentUser!.email;
      const firstName = parentData ? parentData.firstName : parentUser!.firstName;
      const lastName = parentData ? parentData.lastName : parentUser!.lastName;

      this.db.prepare(`
        INSERT INTO users (
          id, username, email, first_name, last_name, role, password_hash,
          is_active, is_view_only, parent_user_id, auto_login_enabled, require_password_change
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId, viewOnlyUsername,
        `${viewOnlyUsername}@${email.split('@')[1]}`,
        firstName, lastName, 'view-only', passwordHash,
        1, 1, parentUserId, 0, 0
      );

      apiLogger.info('View-Only account created', { userId, username: viewOnlyUsername, parentUserId });

      const createdUser = await this.getUser(userId);
      if (!createdUser) throw new Error('Failed to retrieve created View-Only user');
      return createdUser;
    } catch (error) {
      apiLogger.error('Failed to create View-Only account', { error, parentUserId });
      throw error;
    }
  }

  async getViewOnlyAccount(parentUserId: string): Promise<UserResponse | null> {
    const row = this.db.prepare(
      'SELECT * FROM users WHERE parent_user_id = ? AND is_view_only = 1'
    ).get(parentUserId) as any;
    return row ? this.mapRowToUserResponse(row) : null;
  }

  async updateUser(userId: string, userData: UpdateUserRequest): Promise<UserResponse> {
    try {
      const user = await this.getUser(userId);
      if (!user) throw new Error(`User not found: ${userId}`);

      const updates: string[] = [];
      const params: any[] = [];

      if (userData.email !== undefined) { updates.push('email = ?'); params.push(userData.email); }
      if (userData.mobile !== undefined) { updates.push('mobile = ?'); params.push(userData.mobile || null); }
      if (userData.firstName !== undefined) { updates.push('first_name = ?'); params.push(userData.firstName); }
      if (userData.lastName !== undefined) { updates.push('last_name = ?'); params.push(userData.lastName); }
      if (userData.role !== undefined) { updates.push('role = ?'); params.push(userData.role); }
      if (userData.isActive !== undefined) { updates.push('is_active = ?'); params.push(userData.isActive ? 1 : 0); }

      if (updates.length === 0) return user;

      updates.push(`updated_at = datetime('now')`);
      params.push(userId);

      this.db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

      apiLogger.info('User updated', { userId, updates: Object.keys(userData) });

      const updatedUser = await this.getUser(userId);
      if (!updatedUser) throw new Error('Failed to retrieve updated user');
      return updatedUser;
    } catch (error) {
      apiLogger.error('Failed to update user', { error, userId, userData });
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      const user = await this.getUser(userId);
      if (!user) throw new Error(`User not found: ${userId}`);

      if (user.role === 'user') {
        const viewOnlyAccount = await this.getViewOnlyAccount(userId);
        if (viewOnlyAccount) {
          this.db.prepare('DELETE FROM users WHERE id = ?').run(viewOnlyAccount.id);
          apiLogger.info('View-Only account deleted (cascade)', {
            viewOnlyUserId: viewOnlyAccount.id, parentUserId: userId
          });
        }
      }

      this.db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      apiLogger.info('User deleted', { userId, username: user.username });
    } catch (error) {
      apiLogger.error('Failed to delete user', { error, userId });
      throw error;
    }
  }

  async getUser(userId: string): Promise<UserResponse | null> {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    return row ? this.mapRowToUserResponse(row) : null;
  }

  private getUserByUsername(username: string): UserResponse | null {
    const row = this.db.prepare(
      'SELECT * FROM users WHERE username = ? COLLATE NOCASE'
    ).get(username) as any;
    return row ? this.mapRowToUserResponse(row) : null;
  }

  private getUserByEmail(email: string): UserResponse | null {
    const row = this.db.prepare(
      'SELECT * FROM users WHERE email = ? COLLATE NOCASE'
    ).get(email) as any;
    return row ? this.mapRowToUserResponse(row) : null;
  }

  private getUserById(userId: string): UserManagementUser | null {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    return row ? this.mapRowToUser(row) : null;
  }

  async listUsers(filters?: UserFilters, page: number = 1, pageSize: number = 50): Promise<UserListResponse> {
    try {
      let query = 'SELECT * FROM users WHERE 1=1';
      const params: any[] = [];

      if (filters?.role) { query += ' AND role = ?'; params.push(filters.role); }
      if (filters?.isActive !== undefined) { query += ' AND is_active = ?'; params.push(filters.isActive ? 1 : 0); }
      if (filters?.search) {
        query += ' AND (username LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)';
        const s = `%${filters.search}%`;
        params.push(s, s, s, s);
      }

      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
      const countRow = this.db.prepare(countQuery).get(...params) as any;
      const total = countRow.count;

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      const rows = this.db.prepare(query).all(...params, pageSize, (page - 1) * pageSize) as any[];

      return { users: rows.map(row => this.mapRowToUserResponse(row)), total, page, pageSize };
    } catch (error) {
      apiLogger.error('Failed to list users', { error, filters });
      throw error;
    }
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    try {
      const user = this.getUserById(userId);
      if (!user) throw new Error(`User not found: ${userId}`);

      const passwordValid = await bcrypt.compare(oldPassword, user.passwordHash);
      if (!passwordValid) throw new Error('Current password is incorrect');

      const newPasswordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
      this.db.prepare(
        `UPDATE users SET password_hash = ?, require_password_change = 0, updated_at = datetime('now') WHERE id = ?`
      ).run(newPasswordHash, userId);

      apiLogger.info('Password changed', { userId });
    } catch (error) {
      apiLogger.error('Failed to change password', { error, userId });
      throw error;
    }
  }

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    try {
      const user = await this.getUser(userId);
      if (!user) throw new Error(`User not found: ${userId}`);

      const newPasswordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
      this.db.prepare(
        `UPDATE users SET password_hash = ?, require_password_change = 1, updated_at = datetime('now') WHERE id = ?`
      ).run(newPasswordHash, userId);

      apiLogger.info('Password reset', { userId });
    } catch (error) {
      apiLogger.error('Failed to reset password', { error, userId });
      throw error;
    }
  }

  async activateUser(userId: string): Promise<void> {
    try {
      this.db.prepare(
        `UPDATE users SET is_active = 1, updated_at = datetime('now') WHERE id = ?`
      ).run(userId);
      apiLogger.info('User activated', { userId });
    } catch (error) {
      apiLogger.error('Failed to activate user', { error, userId });
      throw error;
    }
  }

  async deactivateUser(userId: string): Promise<void> {
    try {
      this.db.prepare(
        `UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id = ?`
      ).run(userId);
      apiLogger.info('User deactivated', { userId });
    } catch (error) {
      apiLogger.error('Failed to deactivate user', { error, userId });
      throw error;
    }
  }

  async seedInitialUsers(): Promise<void> {
    try {
      const users = [
        { username: 'admin', password: 'admin123', email: 'admin@historian.local', firstName: 'Administrator', lastName: 'User', role: 'admin' as const },
        { username: 'scada.sa', password: '1z))(+8mmBe5L8QV', email: 'scada.sa@historian.local', firstName: 'System', lastName: 'Administrator', role: 'admin' as const },
        { username: 'Operator', password: 'operator', email: 'operator@historian.local', firstName: 'Operator', lastName: 'User', role: 'user' as const },
        { username: 'Quality', password: 'quality', email: 'quality@historian.local', firstName: 'Quality', lastName: 'User', role: 'user' as const },
        { username: 'Supervisor', password: 'supervisor', email: 'supervisor@historian.local', firstName: 'Supervisor', lastName: 'User', role: 'user' as const },
        { username: 'Maintenance', password: 'maintenance', email: 'maintenance@historian.local', firstName: 'Maintenance', lastName: 'User', role: 'user' as const }
      ];

      for (const userData of users) {
        const usernameExists = this.getUserByUsername(userData.username);
        const emailExists = this.getUserByEmail(userData.email);
        if (!usernameExists && !emailExists) {
          await this.createUser(userData);
          apiLogger.info('Initial user seeded', { username: userData.username, role: userData.role });
        } else {
          apiLogger.info('Initial user already exists or email in use', {
            username: userData.username, usernameExists: !!usernameExists, emailExists: !!emailExists
          });
        }
      }

      apiLogger.info('Initial users seeding completed');
    } catch (error) {
      apiLogger.error('Failed to seed initial users', { error });
      throw error;
    }
  }

  private mapRowToUserResponse(row: any): UserResponse {
    const response: UserResponse = {
      id: row.id, username: row.username, email: row.email,
      mobile: row.mobile || undefined, firstName: row.first_name, lastName: row.last_name,
      role: row.role, isActive: Boolean(row.is_active), isViewOnly: Boolean(row.is_view_only),
      parentUserId: row.parent_user_id, autoLoginEnabled: Boolean(row.auto_login_enabled),
      createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at)
    };
    if (row.last_login) response.lastLogin = new Date(row.last_login);
    return response;
  }

  private mapRowToUser(row: any): UserManagementUser {
    const user: UserManagementUser = {
      id: row.id, username: row.username, email: row.email,
      mobile: row.mobile || undefined, firstName: row.first_name, lastName: row.last_name,
      role: row.role, passwordHash: row.password_hash,
      isActive: Boolean(row.is_active), isViewOnly: Boolean(row.is_view_only),
      parentUserId: row.parent_user_id, autoLoginEnabled: Boolean(row.auto_login_enabled),
      requirePasswordChange: Boolean(row.require_password_change),
      createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at)
    };
    if (row.last_login) user.lastLogin = new Date(row.last_login);
    return user;
  }

  shutdown(): void {
    apiLogger.info('User management service shutdown');
  }
}

export const userManagementService = new UserManagementService();
