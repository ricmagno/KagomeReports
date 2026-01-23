/**
 * Auto-Login Service
 * Handles machine-based auto-login functionality
 * Requirements: User Management System Phase 2 - Task 4
 */

import { Database } from 'sqlite3';
import jwt from 'jsonwebtoken';
import path from 'path';
import { apiLogger } from '@/utils/logger';
import { env } from '@/config/environment';
import { fingerprintService, FingerprintData } from '@/services/fingerprintService';
import { AuthResult } from '@/services/authService';

export interface MachineInfo {
  id: string;
  machineName?: string;
  fingerprint: string;
  enabled: boolean;
  lastUsed?: Date | undefined;
  createdAt: Date;
}

export class AutoLoginService {
  private db!: Database;
  private jwtSecret: string;
  private autoLoginTokenExpiry: string = '30d'; // Auto-login tokens last 30 days

  constructor() {
    this.jwtSecret = env.JWT_SECRET;
    this.initializeDatabase();
  }

  /**
   * Initialize database connection
   */
  private initializeDatabase(): void {
    const dbPath = path.join(process.cwd(), 'data', 'auth.db');
    this.db = new Database(dbPath, (err) => {
      if (err) {
        apiLogger.error('Failed to open auto-login database', { error: err });
        throw err;
      }
    });
    apiLogger.info('Auto-login service initialized');
  }

  /**
   * Generate fingerprint from browser data
   */
  async generateFingerprint(data: FingerprintData): Promise<string> {
    try {
      const hash = fingerprintService.generateHash(data);
      
      // Store fingerprint for tracking
      await fingerprintService.storeFingerprint(hash, data);
      
      return hash;
    } catch (error) {
      apiLogger.error('Failed to generate fingerprint', { error });
      throw error;
    }
  }

  /**
   * Validate fingerprint matches stored hash
   */
  async validateFingerprint(fingerprint: string, storedHash: string): Promise<boolean> {
    try {
      return fingerprint === storedHash;
    } catch (error) {
      apiLogger.error('Failed to validate fingerprint', { error });
      return false;
    }
  }

  /**
   * Enable auto-login for a user on a specific machine
   */
  async enableAutoLogin(
    userId: string,
    machineFingerprint: string,
    machineName?: string
  ): Promise<void> {
    try {
      // Check if auto-login already exists for this user/machine combination
      const existing = await this.getMachineByFingerprint(userId, machineFingerprint);
      
      if (existing) {
        // Update existing entry
        await new Promise<void>((resolve, reject) => {
          this.db.run(
            `UPDATE auto_login_machines 
             SET enabled = 1, machine_name = ?, updated_at = datetime('now')
             WHERE id = ?`,
            [machineName || existing.machineName, existing.id],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        apiLogger.info('Auto-login updated', { userId, machineId: existing.id });
      } else {
        // Create new auto-login entry
        const id = `autologin_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

        await new Promise<void>((resolve, reject) => {
          this.db.run(
            `INSERT INTO auto_login_machines (id, user_id, machine_fingerprint, machine_name, enabled)
             VALUES (?, ?, ?, ?, ?)`,
            [id, userId, machineFingerprint, machineName, 1],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        apiLogger.info('Auto-login enabled', { userId, machineId: id, machineName });
      }

      // Update user's auto_login_enabled flag
      await new Promise<void>((resolve, reject) => {
        this.db.run(
          `UPDATE users SET auto_login_enabled = 1, updated_at = datetime('now') WHERE id = ?`,
          [userId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    } catch (error) {
      apiLogger.error('Failed to enable auto-login', { error, userId });
      throw error;
    }
  }

  /**
   * Disable auto-login for a user on a specific machine
   */
  async disableAutoLogin(userId: string, machineFingerprint: string): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.db.run(
          `UPDATE auto_login_machines 
           SET enabled = 0, updated_at = datetime('now')
           WHERE user_id = ? AND machine_fingerprint = ?`,
          [userId, machineFingerprint],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Check if user has any other enabled auto-login machines
      const machines = await this.getUserMachines(userId);
      const hasEnabledMachines = machines.some(m => m.enabled);

      if (!hasEnabledMachines) {
        // Disable auto_login_enabled flag if no machines are enabled
        await new Promise<void>((resolve, reject) => {
          this.db.run(
            `UPDATE users SET auto_login_enabled = 0, updated_at = datetime('now') WHERE id = ?`,
            [userId],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      apiLogger.info('Auto-login disabled', { userId, machineFingerprint: machineFingerprint.substring(0, 12) });
    } catch (error) {
      apiLogger.error('Failed to disable auto-login', { error, userId });
      throw error;
    }
  }

  /**
   * Check if auto-login is enabled for a user on a specific machine
   */
  async isAutoLoginEnabled(userId: string, machineFingerprint: string): Promise<boolean> {
    try {
      return new Promise((resolve, reject) => {
        this.db.get(
          `SELECT enabled FROM auto_login_machines 
           WHERE user_id = ? AND machine_fingerprint = ? AND enabled = 1`,
          [userId, machineFingerprint],
          (err, row: any) => {
            if (err) {
              reject(err);
            } else {
              resolve(!!row);
            }
          }
        );
      });
    } catch (error) {
      apiLogger.error('Failed to check auto-login status', { error, userId });
      return false;
    }
  }

  /**
   * Generate auto-login token
   */
  async generateAutoLoginToken(userId: string, machineFingerprint: string): Promise<string> {
    try {
      // Verify auto-login is enabled
      const isEnabled = await this.isAutoLoginEnabled(userId, machineFingerprint);
      if (!isEnabled) {
        throw new Error('Auto-login not enabled for this user/machine combination');
      }

      // Get user info
      const user = await new Promise<any>((resolve, reject) => {
        this.db.get(
          'SELECT id, username, email, role FROM users WHERE id = ? AND is_active = 1',
          [userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!user) {
        throw new Error('User not found or inactive');
      }

      // Generate JWT token with auto-login flag
      const payload = {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        autoLogin: true,
        machineFingerprint: machineFingerprint.substring(0, 12), // Only store prefix for security
        iat: Math.floor(Date.now() / 1000),
        jti: `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      };

      const token = jwt.sign(payload, this.jwtSecret, { expiresIn: this.autoLoginTokenExpiry } as jwt.SignOptions);

      // Update last_used timestamp
      await new Promise<void>((resolve, reject) => {
        this.db.run(
          `UPDATE auto_login_machines 
           SET last_used = datetime('now'), updated_at = datetime('now')
           WHERE user_id = ? AND machine_fingerprint = ?`,
          [userId, machineFingerprint],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      apiLogger.info('Auto-login token generated', { userId, username: user.username });

      return token;
    } catch (error) {
      apiLogger.error('Failed to generate auto-login token', { error, userId });
      throw error;
    }
  }

  /**
   * Validate auto-login token
   */
  async validateAutoLoginToken(token: string, machineFingerprint: string): Promise<AuthResult> {
    try {
      // Verify JWT token
      const decoded = jwt.verify(token, this.jwtSecret) as any;

      if (!decoded.autoLogin) {
        return {
          success: false,
          error: 'Not an auto-login token'
        };
      }

      // Verify machine fingerprint matches (compare prefix)
      const fingerprintPrefix = machineFingerprint.substring(0, 12);
      if (decoded.machineFingerprint !== fingerprintPrefix) {
        return {
          success: false,
          error: 'Machine fingerprint mismatch'
        };
      }

      // Verify auto-login is still enabled
      const isEnabled = await this.isAutoLoginEnabled(decoded.userId, machineFingerprint);
      if (!isEnabled) {
        return {
          success: false,
          error: 'Auto-login no longer enabled'
        };
      }

      // Get current user data
      const user = await new Promise<any>((resolve, reject) => {
        this.db.get(
          'SELECT * FROM users WHERE id = ? AND is_active = 1',
          [decoded.userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found or inactive'
        };
      }

      // Update last_used timestamp
      await new Promise<void>((resolve, reject) => {
        this.db.run(
          `UPDATE auto_login_machines 
           SET last_used = datetime('now'), updated_at = datetime('now')
           WHERE user_id = ? AND machine_fingerprint = ?`,
          [decoded.userId, machineFingerprint],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          isActive: Boolean(user.is_active),
          lastLogin: user.last_login ? new Date(user.last_login) : undefined,
          createdAt: new Date(user.created_at),
          updatedAt: new Date(user.updated_at),
          parentUserId: user.parent_user_id || null,
          isViewOnly: Boolean(user.is_view_only),
          autoLoginEnabled: Boolean(user.auto_login_enabled),
          requirePasswordChange: Boolean(user.require_password_change)
        },
        token,
        expiresIn: this.autoLoginTokenExpiry
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return {
          success: false,
          error: 'Invalid token'
        };
      }
      apiLogger.error('Failed to validate auto-login token', { error });
      return {
        success: false,
        error: 'Token validation failed'
      };
    }
  }

  /**
   * Get all machines for a user
   */
  async getUserMachines(userId: string): Promise<MachineInfo[]> {
    try {
      return new Promise((resolve, reject) => {
        this.db.all(
          `SELECT * FROM auto_login_machines WHERE user_id = ? ORDER BY created_at DESC`,
          [userId],
          (err, rows: any[]) => {
            if (err) {
              reject(err);
            } else {
              const machines = rows.map(row => ({
                id: row.id,
                machineName: row.machine_name,
                fingerprint: row.machine_fingerprint,
                enabled: Boolean(row.enabled),
                lastUsed: row.last_used ? new Date(row.last_used) : undefined,
                createdAt: new Date(row.created_at)
              }));
              resolve(machines);
            }
          }
        );
      });
    } catch (error) {
      apiLogger.error('Failed to get user machines', { error, userId });
      throw error;
    }
  }

  /**
   * Remove a machine from auto-login
   */
  async removeMachine(userId: string, machineId: string): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.db.run(
          'DELETE FROM auto_login_machines WHERE id = ? AND user_id = ?',
          [machineId, userId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Check if user has any remaining machines
      const machines = await this.getUserMachines(userId);
      if (machines.length === 0) {
        // Disable auto_login_enabled flag
        await new Promise<void>((resolve, reject) => {
          this.db.run(
            `UPDATE users SET auto_login_enabled = 0, updated_at = datetime('now') WHERE id = ?`,
            [userId],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      apiLogger.info('Machine removed from auto-login', { userId, machineId });
    } catch (error) {
      apiLogger.error('Failed to remove machine', { error, userId, machineId });
      throw error;
    }
  }

  /**
   * Get machine by fingerprint (private helper)
   */
  private async getMachineByFingerprint(userId: string, fingerprint: string): Promise<MachineInfo | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM auto_login_machines WHERE user_id = ? AND machine_fingerprint = ?',
        [userId, fingerprint],
        (err, row: any) => {
          if (err) {
            reject(err);
          } else if (row) {
            resolve({
              id: row.id,
              machineName: row.machine_name,
              fingerprint: row.machine_fingerprint,
              enabled: Boolean(row.enabled),
              lastUsed: row.last_used ? new Date(row.last_used) : undefined,
              createdAt: new Date(row.created_at)
            });
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  /**
   * Check if a machine fingerprint has auto-login enabled for any user
   */
  async checkAutoLoginAvailability(machineFingerprint: string): Promise<{
    available: boolean;
    userId?: string;
  }> {
    try {
      return new Promise((resolve, reject) => {
        this.db.get(
          `SELECT user_id FROM auto_login_machines 
           WHERE machine_fingerprint = ? AND enabled = 1
           LIMIT 1`,
          [machineFingerprint],
          (err, row: any) => {
            if (err) {
              reject(err);
            } else if (row) {
              resolve({
                available: true,
                userId: row.user_id
              });
            } else {
              resolve({
                available: false
              });
            }
          }
        );
      });
    } catch (error) {
      apiLogger.error('Failed to check auto-login availability', { error });
      return { available: false };
    }
  }

  /**
   * Shutdown the service
   */
  shutdown(): void {
    this.db.close();
    apiLogger.info('Auto-login service shutdown');
  }
}

// Export singleton instance
export const autoLoginService = new AutoLoginService();
