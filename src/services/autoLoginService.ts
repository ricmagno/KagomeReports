/**
 * Auto-Login Service
 * Handles machine-based auto-login functionality
 * Requirements: User Management System Phase 2 - Task 4
 */

import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import { apiLogger } from '@/utils/logger';
import { env, getDatabasePath } from '@/config/environment';
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
  private db!: Database.Database;
  private jwtSecret: string;
  private autoLoginTokenExpiry: string = '30d';

  constructor() {
    this.jwtSecret = env.JWT_SECRET;
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    const dbPath = getDatabasePath('auth.db');
    this.db = new Database(dbPath);
    apiLogger.info('Auto-login service initialized');
  }

  async generateFingerprint(data: FingerprintData): Promise<string> {
    try {
      const hash = fingerprintService.generateHash(data);
      await fingerprintService.storeFingerprint(hash, data);
      return hash;
    } catch (error) {
      apiLogger.error('Failed to generate fingerprint', { error });
      throw error;
    }
  }

  async validateFingerprint(fingerprint: string, storedHash: string): Promise<boolean> {
    return fingerprint === storedHash;
  }

  async enableAutoLogin(userId: string, machineFingerprint: string, machineName?: string): Promise<void> {
    try {
      const existing = this.getMachineByFingerprint(userId, machineFingerprint);

      if (existing) {
        this.db.prepare(
          `UPDATE auto_login_machines SET enabled = 1, machine_name = ?, updated_at = datetime('now') WHERE id = ?`
        ).run(machineName || existing.machineName, existing.id);
        apiLogger.info('Auto-login updated', { userId, machineId: existing.id });
      } else {
        const id = `autologin_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        this.db.prepare(
          `INSERT INTO auto_login_machines (id, user_id, machine_fingerprint, machine_name, enabled) VALUES (?, ?, ?, ?, ?)`
        ).run(id, userId, machineFingerprint, machineName, 1);
        apiLogger.info('Auto-login enabled', { userId, machineId: id, machineName });
      }

      this.db.prepare(`UPDATE users SET auto_login_enabled = 1, updated_at = datetime('now') WHERE id = ?`).run(userId);
    } catch (error) {
      apiLogger.error('Failed to enable auto-login', { error, userId });
      throw error;
    }
  }

  async disableAutoLogin(userId: string, machineFingerprint: string): Promise<void> {
    try {
      this.db.prepare(
        `UPDATE auto_login_machines SET enabled = 0, updated_at = datetime('now') WHERE user_id = ? AND machine_fingerprint = ?`
      ).run(userId, machineFingerprint);

      const machines = this.getUserMachinesSync(userId);
      const hasEnabledMachines = machines.some(m => m.enabled);

      if (!hasEnabledMachines) {
        this.db.prepare(`UPDATE users SET auto_login_enabled = 0, updated_at = datetime('now') WHERE id = ?`).run(userId);
      }

      apiLogger.info('Auto-login disabled', { userId, machineFingerprint: machineFingerprint.substring(0, 12) });
    } catch (error) {
      apiLogger.error('Failed to disable auto-login', { error, userId });
      throw error;
    }
  }

  async isAutoLoginEnabled(userId: string, machineFingerprint: string): Promise<boolean> {
    const row = this.db.prepare(
      `SELECT enabled FROM auto_login_machines WHERE user_id = ? AND machine_fingerprint = ? AND enabled = 1`
    ).get(userId, machineFingerprint);
    return !!row;
  }

  async generateAutoLoginToken(userId: string, machineFingerprint: string): Promise<string> {
    try {
      const isEnabled = await this.isAutoLoginEnabled(userId, machineFingerprint);
      if (!isEnabled) throw new Error('Auto-login not enabled for this user/machine combination');

      const user = this.db.prepare(
        'SELECT id, username, email, role FROM users WHERE id = ? AND is_active = 1'
      ).get(userId) as any;
      if (!user) throw new Error('User not found or inactive');

      const payload = {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        autoLogin: true,
        machineFingerprint: machineFingerprint.substring(0, 12),
        iat: Math.floor(Date.now() / 1000),
        jti: `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      };

      const token = jwt.sign(payload, this.jwtSecret, { expiresIn: this.autoLoginTokenExpiry } as jwt.SignOptions);

      this.db.prepare(
        `UPDATE auto_login_machines SET last_used = datetime('now'), updated_at = datetime('now') WHERE user_id = ? AND machine_fingerprint = ?`
      ).run(userId, machineFingerprint);

      apiLogger.info('Auto-login token generated', { userId, username: user.username });
      return token;
    } catch (error) {
      apiLogger.error('Failed to generate auto-login token', { error, userId });
      throw error;
    }
  }

  async validateAutoLoginToken(token: string, machineFingerprint: string): Promise<AuthResult> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;

      if (!decoded.autoLogin) return { success: false, error: 'Not an auto-login token' };

      const fingerprintPrefix = machineFingerprint.substring(0, 12);
      if (decoded.machineFingerprint !== fingerprintPrefix) return { success: false, error: 'Machine fingerprint mismatch' };

      const isEnabled = await this.isAutoLoginEnabled(decoded.userId, machineFingerprint);
      if (!isEnabled) return { success: false, error: 'Auto-login no longer enabled' };

      const user = this.db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(decoded.userId) as any;
      if (!user) return { success: false, error: 'User not found or inactive' };

      this.db.prepare(
        `UPDATE auto_login_machines SET last_used = datetime('now'), updated_at = datetime('now') WHERE user_id = ? AND machine_fingerprint = ?`
      ).run(decoded.userId, machineFingerprint);

      return {
        success: true,
        user: {
          id: user.id, username: user.username, email: user.email,
          firstName: user.first_name, lastName: user.last_name, role: user.role,
          isActive: Boolean(user.is_active),
          lastLogin: user.last_login ? new Date(user.last_login) : undefined,
          createdAt: new Date(user.created_at), updatedAt: new Date(user.updated_at),
          parentUserId: user.parent_user_id || null,
          isViewOnly: Boolean(user.is_view_only),
          autoLoginEnabled: Boolean(user.auto_login_enabled),
          requirePasswordChange: Boolean(user.require_password_change)
        },
        token,
        expiresIn: this.autoLoginTokenExpiry
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) return { success: false, error: 'Invalid token' };
      apiLogger.error('Failed to validate auto-login token', { error });
      return { success: false, error: 'Token validation failed' };
    }
  }

  async getUserMachines(userId: string): Promise<MachineInfo[]> {
    return this.getUserMachinesSync(userId);
  }

  private getUserMachinesSync(userId: string): MachineInfo[] {
    const rows = this.db.prepare(
      'SELECT * FROM auto_login_machines WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId) as any[];
    return rows.map(row => ({
      id: row.id,
      machineName: row.machine_name,
      fingerprint: row.machine_fingerprint,
      enabled: Boolean(row.enabled),
      lastUsed: row.last_used ? new Date(row.last_used) : undefined,
      createdAt: new Date(row.created_at)
    }));
  }

  async removeMachine(userId: string, machineId: string): Promise<void> {
    try {
      this.db.prepare('DELETE FROM auto_login_machines WHERE id = ? AND user_id = ?').run(machineId, userId);

      const machines = this.getUserMachinesSync(userId);
      if (machines.length === 0) {
        this.db.prepare(`UPDATE users SET auto_login_enabled = 0, updated_at = datetime('now') WHERE id = ?`).run(userId);
      }

      apiLogger.info('Machine removed from auto-login', { userId, machineId });
    } catch (error) {
      apiLogger.error('Failed to remove machine', { error, userId, machineId });
      throw error;
    }
  }

  private getMachineByFingerprint(userId: string, fingerprint: string): MachineInfo | null {
    const row = this.db.prepare(
      'SELECT * FROM auto_login_machines WHERE user_id = ? AND machine_fingerprint = ?'
    ).get(userId, fingerprint) as any;
    if (!row) return null;
    return {
      id: row.id,
      machineName: row.machine_name,
      fingerprint: row.machine_fingerprint,
      enabled: Boolean(row.enabled),
      lastUsed: row.last_used ? new Date(row.last_used) : undefined,
      createdAt: new Date(row.created_at)
    };
  }

  async checkAutoLoginAvailability(machineFingerprint: string): Promise<{ available: boolean; userId?: string }> {
    const row = this.db.prepare(
      'SELECT user_id FROM auto_login_machines WHERE machine_fingerprint = ? AND enabled = 1 LIMIT 1'
    ).get(machineFingerprint) as any;
    return row ? { available: true, userId: row.user_id } : { available: false };
  }

  shutdown(): void {
    this.db.close();
    apiLogger.info('Auto-login service shutdown');
  }
}

export const autoLoginService = new AutoLoginService();
