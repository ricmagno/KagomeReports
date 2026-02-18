/**
 * Authentication Service
 * Handles user authentication, JWT tokens, and session management
 * Requirements: 9.1, 9.5
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Database } from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { apiLogger } from '@/utils/logger';
import { env, getDatabasePath } from '@/config/environment';
import { encryptionService } from '@/services/encryptionService';

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin' | 'view-only';
  passwordHash: string;
  isActive: boolean;
  lastLogin?: Date | undefined;
  createdAt: Date;
  updatedAt: Date;
  parentUserId?: string | null;
  isViewOnly: boolean;
  autoLoginEnabled: boolean;
  requirePasswordChange: boolean;
}

export interface UserSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  isActive: boolean;
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthResult {
  success: boolean;
  user?: Omit<User, 'passwordHash'>;
  token?: string;
  expiresIn?: string;
  error?: string;
}

export interface Permission {
  resource: string;
  action: string;
  granted: boolean;
}

export class AuthService {
  public db!: Database;
  private jwtSecret: string;
  private tokenExpiry: string = '24h';
  private refreshTokenExpiry: string = '30d';
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.jwtSecret = env.JWT_SECRET;
    this.initPromise = this.initializeDatabase();
  }

  /**
   * Wait for database initialization to complete
   */
  async waitForInitialization(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Initialize SQLite database for user and session storage
   */
  private async initializeDatabase(): Promise<void> {
    const dbPath = getDatabasePath('auth.db');

    // Ensure the data directory exists
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      this.db = new Database(dbPath, (err) => {
        if (err) {
          apiLogger.error('Failed to open database', { error: err });
          reject(err);
          return;
        }

        // Configure busy retry
        this.db.configure('busyTimeout', 10000);

        // Configure WAL mode for better concurrency
        this.db.run('PRAGMA journal_mode = WAL');
        this.db.run('PRAGMA synchronous = NORMAL');

        // Create tables
        this.db.serialize(() => {
          // Users table with all required columns for UserManagementService
          this.db.run(`
            CREATE TABLE IF NOT EXISTS users (
              id TEXT PRIMARY KEY,
              username TEXT UNIQUE NOT NULL COLLATE NOCASE,
              email TEXT UNIQUE NOT NULL COLLATE NOCASE,
              first_name TEXT NOT NULL,
              last_name TEXT NOT NULL,
              role TEXT NOT NULL DEFAULT 'user',
              password_hash TEXT NOT NULL,
              is_active BOOLEAN DEFAULT 1,
              is_view_only BOOLEAN DEFAULT 0,
              parent_user_id TEXT,
              auto_login_enabled BOOLEAN DEFAULT 0,
              require_password_change BOOLEAN DEFAULT 0,
              last_login DATETIME,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);

          // User sessions table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS user_sessions (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              token TEXT UNIQUE NOT NULL,
              expires_at DATETIME NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              is_active BOOLEAN DEFAULT 1,
              user_agent TEXT,
              ip_address TEXT,
              FOREIGN KEY (user_id) REFERENCES users (id)
            )
          `);

          // Role permissions table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS role_permissions (
              id TEXT PRIMARY KEY,
              role TEXT NOT NULL,
              resource TEXT NOT NULL,
              action TEXT NOT NULL,
              granted BOOLEAN DEFAULT 1,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);

          // Audit log table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS audit_logs (
              id TEXT PRIMARY KEY,
              user_id TEXT,
              action TEXT NOT NULL,
              resource TEXT,
              details TEXT,
              ip_address TEXT,
              user_agent TEXT,
              timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users (id)
            )
          `, (err) => {
            if (err) {
              apiLogger.error('Failed to create tables', { error: err });
              reject(err);
            } else {
              // Insert default permissions
              this.createDefaultPermissions().then(() => {
                apiLogger.info('Authentication database initialized and tables created');
                resolve();
              }).catch(err => {
                apiLogger.error('Failed to create default permissions', { error: err });
                reject(err);
              });
            }
          });
        });
      });
    });
  }

  /**
   * Create default role permissions
   */
  private async createDefaultPermissions(): Promise<void> {
    const permissions = [
      // Admin permissions
      { role: 'admin' as const, resource: 'reports', action: 'read' },
      { role: 'admin' as const, resource: 'reports', action: 'write' },
      { role: 'admin' as const, resource: 'reports', action: 'delete' },
      { role: 'admin' as const, resource: 'schedules', action: 'read' },
      { role: 'admin' as const, resource: 'schedules', action: 'write' },
      { role: 'admin' as const, resource: 'schedules', action: 'delete' },
      { role: 'admin' as const, resource: 'users', action: 'read' },
      { role: 'admin' as const, resource: 'users', action: 'write' },
      { role: 'admin' as const, resource: 'users', action: 'delete' },
      { role: 'admin' as const, resource: 'system', action: 'read' },
      { role: 'admin' as const, resource: 'system', action: 'write' },
      { role: 'admin' as const, resource: 'system', action: 'delete' },

      // User permissions
      { role: 'user' as const, resource: 'reports', action: 'read' },
      { role: 'user' as const, resource: 'reports', action: 'write' },
      { role: 'user' as const, resource: 'reports', action: 'delete' },
      { role: 'user' as const, resource: 'schedules', action: 'read' },
      { role: 'user' as const, resource: 'schedules', action: 'write' },
      { role: 'user' as const, resource: 'schedules', action: 'delete' },
      { role: 'user' as const, resource: 'system', action: 'read' },

      // View-Only permissions
      { role: 'view-only' as const, resource: 'reports', action: 'read' },
      { role: 'view-only' as const, resource: 'schedules', action: 'read' },
      { role: 'view-only' as const, resource: 'system', action: 'read' }
    ];

    const promises = permissions.map(perm => {
      const permId = `perm_${perm.role}_${perm.resource}_${perm.action}`;
      return new Promise<void>((resolve, reject) => {
        this.db.run(
          `INSERT OR REPLACE INTO role_permissions (id, role, resource, action, granted)
           VALUES (?, ?, ?, ?, ?)`,
          [permId, perm.role, perm.resource, perm.action, true],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    });

    await Promise.all(promises);
  }

  /**
   * Authenticate user with username/email and password
   */
  async authenticate(usernameOrEmail: string, password: string, rememberMe: boolean = false): Promise<AuthResult> {
    try {
      // Find user by username or email
      const user = await new Promise<User | null>((resolve, reject) => {
        if (!this.db) {
          reject(new Error('Database not initialized'));
          return;
        }

        this.db.get(
          'SELECT * FROM users WHERE (username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE) AND is_active = 1',
          [usernameOrEmail, usernameOrEmail],
          (err, row: any) => {
            if (err) {
              apiLogger.error('Database query error during authentication', { error: err, usernameOrEmail });
              reject(err);
            } else {
              resolve(row ? {
                id: row.id,
                username: row.username,
                email: row.email,
                firstName: row.first_name,
                lastName: row.last_name,
                role: row.role,
                passwordHash: row.password_hash,
                isActive: Boolean(row.is_active),
                lastLogin: row.last_login ? new Date(row.last_login) : undefined,
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at),
                parentUserId: row.parent_user_id || null,
                isViewOnly: Boolean(row.is_view_only),
                autoLoginEnabled: Boolean(row.auto_login_enabled),
                requirePasswordChange: Boolean(row.require_password_change)
              } as User : null);
            }
          }
        );
      });

      if (!user) {
        await this.logAuditEvent(null, 'login_failed', 'auth', `Failed login attempt for: ${usernameOrEmail}`);
        return {
          success: false,
          error: 'Invalid username or password'
        };
      }

      // Verify password
      const passwordValid = await bcrypt.compare(password, user.passwordHash);
      if (!passwordValid) {
        await this.logAuditEvent(user.id, 'login_failed', 'auth', 'Invalid password');
        return {
          success: false,
          error: 'Invalid username or password'
        };
      }

      // Generate JWT token
      const expiresIn = rememberMe ? this.refreshTokenExpiry : this.tokenExpiry;
      const token = this.generateToken(user, expiresIn);

      // Create session
      await this.createSession(user.id, token, expiresIn);

      // Update last login
      await this.updateLastLogin(user.id);

      // Log successful login
      await this.logAuditEvent(user.id, 'login_success', 'auth', 'User logged in successfully');

      const { passwordHash, ...userWithoutPassword } = user;

      return {
        success: true,
        user: userWithoutPassword,
        token,
        expiresIn
      };
    } catch (error) {
      apiLogger.error('Authentication failed', { error, usernameOrEmail });
      return {
        success: false,
        error: 'Authentication failed'
      };
    }
  }

  /**
   * Generate JWT token
   */
  private generateToken(user: User, expiresIn: string): string {
    const payload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      jti: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}` // JWT ID for uniqueness
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn } as jwt.SignOptions);
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string): Promise<{ valid: boolean; user?: Omit<User, 'passwordHash'>; error?: string }> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;

      // Check if session is still active
      const sessionActive = await new Promise<boolean>((resolve) => {
        this.db.get(
          'SELECT id FROM user_sessions WHERE token = ? AND is_active = 1 AND expires_at > datetime("now")',
          [token],
          (err, row) => {
            resolve(!!row);
          }
        );
      });

      if (!sessionActive) {
        return {
          valid: false,
          error: 'Session expired or invalid'
        };
      }

      // Get current user data
      const user = await this.getUserById(decoded.userId);
      if (!user || !user.isActive) {
        return {
          valid: false,
          error: 'User not found or inactive'
        };
      }

      const { passwordHash, ...userWithoutPassword } = user;

      return {
        valid: true,
        user: userWithoutPassword
      };
    } catch (error) {
      return {
        valid: false,
        error: 'Invalid token'
      };
    }
  }

  /**
   * Create user session
   */
  private async createSession(userId: string, token: string, expiresIn: string): Promise<void> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date();

    // Parse expiresIn (e.g., "24h", "30d")
    const match = expiresIn.match(/^(\d+)([hdm])$/);
    if (match && match[1]) {
      const value = parseInt(match[1]);
      const unit = match[2];

      switch (unit) {
        case 'h':
          expiresAt.setHours(expiresAt.getHours() + value);
          break;
        case 'd':
          expiresAt.setDate(expiresAt.getDate() + value);
          break;
        case 'm':
          expiresAt.setMinutes(expiresAt.getMinutes() + value);
          break;
      }
    } else {
      // Default to 24 hours
      expiresAt.setHours(expiresAt.getHours() + 24);
    }

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO user_sessions (id, user_id, token, expires_at)
         VALUES (?, ?, ?, ?)`,
        [sessionId, userId, token, expiresAt.toISOString()],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Logout user and invalidate session
   */
  async logout(token: string): Promise<boolean> {
    try {
      // Get user info before logout for audit log
      const decoded = jwt.decode(token) as any;

      // Deactivate session
      await new Promise<void>((resolve, reject) => {
        this.db.run(
          'UPDATE user_sessions SET is_active = 0 WHERE token = ?',
          [token],
          (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });

      // Log logout
      if (decoded?.userId) {
        await this.logAuditEvent(decoded.userId, 'logout', 'auth', 'User logged out');
      }

      return true;
    } catch (error) {
      apiLogger.error('Logout failed', { error });
      return false;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM users WHERE id = ?',
        [userId],
        (err, row: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(row ? {
              id: row.id,
              username: row.username,
              email: row.email,
              firstName: row.first_name,
              lastName: row.last_name,
              role: row.role,
              passwordHash: row.password_hash,
              isActive: Boolean(row.is_active),
              lastLogin: row.last_login ? new Date(row.last_login) : undefined,
              createdAt: new Date(row.created_at),
              updatedAt: new Date(row.updated_at),
              parentUserId: row.parent_user_id || null,
              isViewOnly: Boolean(row.is_view_only),
              autoLoginEnabled: Boolean(row.auto_login_enabled),
              requirePasswordChange: Boolean(row.require_password_change)
            } as User : null);
          }
        }
      );
    });
  }

  /**
   * Check user permissions
   */
  async hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
    try {
      const user = await this.getUserById(userId);
      if (!user || !user.isActive) {
        return false;
      }

      return new Promise((resolve) => {
        this.db.get(
          'SELECT granted FROM role_permissions WHERE role = ? AND resource = ? AND action = ?',
          [user.role, resource, action],
          (err, row: any) => {
            resolve(row ? Boolean(row.granted) : false);
          }
        );
      });
    } catch (error) {
      apiLogger.error('Permission check failed', { error, userId, resource, action });
      return false;
    }
  }

  /**
   * Get user permissions
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    try {
      const user = await this.getUserById(userId);
      if (!user || !user.isActive) {
        return [];
      }

      return new Promise((resolve, reject) => {
        this.db.all(
          'SELECT resource, action, granted FROM role_permissions WHERE role = ?',
          [user.role],
          (err, rows: any[]) => {
            if (err) {
              reject(err);
            } else {
              const permissions = rows.map(row => ({
                resource: row.resource,
                action: row.action,
                granted: Boolean(row.granted)
              }));
              resolve(permissions);
            }
          }
        );
      });
    } catch (error) {
      apiLogger.error('Failed to get user permissions', { error, userId });
      return [];
    }
  }

  /**
   * Update last login timestamp
   */
  private async updateLastLogin(userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE users SET last_login = datetime("now"), updated_at = datetime("now") WHERE id = ?',
        [userId],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Log audit event
   */
  async logAuditEvent(
    userId: string | null,
    action: string,
    resource: string,
    details: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Encrypt sensitive details
    const encryptedDetails = encryptionService.encrypt(details);
    const encryptedUserAgent = userAgent ? encryptionService.encrypt(userAgent) : null;

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO audit_logs (id, user_id, action, resource, details, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          auditId,
          userId,
          action,
          resource,
          JSON.stringify(encryptedDetails),
          ipAddress || null,
          encryptedUserAgent ? JSON.stringify(encryptedUserAgent) : null
        ],
        (err) => {
          if (err) {
            apiLogger.error('Failed to log audit event', { error: err });
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(
    limit: number = 100,
    offset: number = 0,
    userId?: string,
    action?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<any[]> {
    let query = `
      SELECT al.*, u.username, u.email 
      FROM audit_logs al 
      LEFT JOIN users u ON al.user_id = u.id 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (userId) {
      query += ' AND al.user_id = ?';
      params.push(userId);
    }

    if (action) {
      query += ' AND al.action = ?';
      params.push(action);
    }

    if (startDate) {
      query += ' AND al.timestamp >= ?';
      params.push(startDate.toISOString());
    }

    if (endDate) {
      query += ' AND al.timestamp <= ?';
      params.push(endDate.toISOString());
    }

    query += ' ORDER BY al.timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const decryptedLogs = rows.map(row => {
            try {
              // Decrypt sensitive fields
              let decryptedDetails = row.details;
              let decryptedUserAgent = row.user_agent;

              if (row.details && row.details.startsWith('{')) {
                try {
                  const encryptedDetails = JSON.parse(row.details);
                  decryptedDetails = encryptionService.decrypt(encryptedDetails);
                } catch {
                  // If decryption fails, use original value (for backward compatibility)
                  decryptedDetails = row.details;
                }
              }

              if (row.user_agent && row.user_agent.startsWith('{')) {
                try {
                  const encryptedUserAgent = JSON.parse(row.user_agent);
                  decryptedUserAgent = encryptionService.decrypt(encryptedUserAgent);
                } catch {
                  // If decryption fails, use original value (for backward compatibility)
                  decryptedUserAgent = row.user_agent;
                }
              }

              return {
                id: row.id,
                userId: row.user_id,
                username: row.username,
                email: row.email,
                action: row.action,
                resource: row.resource,
                details: decryptedDetails,
                ipAddress: row.ip_address,
                userAgent: decryptedUserAgent,
                timestamp: new Date(row.timestamp)
              };
            } catch (error) {
              apiLogger.error('Failed to decrypt audit log entry', { error, logId: row.id });
              // Return sanitized version if decryption fails
              return {
                id: row.id,
                userId: row.user_id,
                username: row.username,
                email: row.email,
                action: row.action,
                resource: row.resource,
                details: '[ENCRYPTED]',
                ipAddress: row.ip_address,
                userAgent: '[ENCRYPTED]',
                timestamp: new Date(row.timestamp)
              };
            }
          });

          resolve(decryptedLogs);
        }
      });
    });
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM user_sessions WHERE expires_at < datetime("now") OR is_active = 0',
        (err) => {
          if (err) {
            reject(err);
          } else {
            apiLogger.info('Expired sessions cleaned up');
            resolve();
          }
        }
      );
    });
  }

  /**
   * Shutdown the auth service
   */
  async shutdown(): Promise<void> {
    return new Promise((resolve) => {
      this.db.close((err) => {
        if (err) {
          apiLogger.error('Error closing auth database', { error: err });
        } else {
          apiLogger.info('Auth service shutdown');
        }
        resolve();
      });
    });
  }
}

// Export singleton instance
export const authService = new AuthService();