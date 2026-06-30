import Database from 'better-sqlite3';
import { getDatabasePath } from '@/config/environment';
import { encryptionService } from '@/services/encryptionService';
import { apiLogger } from '@/utils/logger';

export interface EmailDeliveryConfig {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  fromName: string;
  fromEmail: string;
  updatedAt?: Date;
}

export interface EmailDeliveryConfigClient extends Omit<EmailDeliveryConfig, 'smtpPassword'> {
  hasPassword: boolean;
}

export interface SmsDeliveryConfig {
  enabled: boolean;
  apiUrl: string;
  apiToken: string;
  updatedAt?: Date;
}

export interface SmsDeliveryConfigClient extends Omit<SmsDeliveryConfig, 'apiToken'> {
  hasToken: boolean;
}

export class AlertDeliveryConfigService {
  private db: Database.Database;

  constructor() {
    this.db = new Database(getDatabasePath('alerts.db'));
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 10000');
    this.initializeTables();
  }

  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS alert_email_config (
        id TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 0,
        smtp_host TEXT NOT NULL DEFAULT '',
        smtp_port INTEGER NOT NULL DEFAULT 587,
        smtp_secure INTEGER NOT NULL DEFAULT 0,
        smtp_user TEXT NOT NULL DEFAULT '',
        smtp_password_encrypted TEXT NOT NULL DEFAULT '',
        from_name TEXT NOT NULL DEFAULT '',
        from_email TEXT NOT NULL DEFAULT '',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS alert_sms_config (
        id TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 0,
        api_token_encrypted TEXT NOT NULL DEFAULT '',
        api_url TEXT NOT NULL DEFAULT '',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migrate old api_token column → api_token_encrypted if needed
    try {
      const cols = this.db.prepare("PRAGMA table_info(alert_sms_config)").all() as any[];
      const hasOld = cols.some(c => c.name === 'api_token');
      const hasNew = cols.some(c => c.name === 'api_token_encrypted');
      if (hasOld && !hasNew) {
        this.db.exec(`ALTER TABLE alert_sms_config ADD COLUMN api_token_encrypted TEXT NOT NULL DEFAULT ''`);
      }
    } catch {
      // PRAGMA failures are non-fatal
    }
  }

  // ── Email ────────────────────────────────────────────────────────────────

  getEmailConfig(): EmailDeliveryConfig | null {
    const row = this.db.prepare('SELECT * FROM alert_email_config WHERE id = ?').get('email') as any;
    if (!row || !row.smtp_host) return null;

    let password = '';
    if (row.smtp_password_encrypted) {
      try {
        const parsed = JSON.parse(row.smtp_password_encrypted);
        password = encryptionService.decrypt(parsed);
      } catch {
        apiLogger.error('Failed to decrypt SMTP password from alert_email_config');
      }
    }

    return {
      enabled: Boolean(row.enabled),
      smtpHost: row.smtp_host,
      smtpPort: row.smtp_port,
      smtpSecure: Boolean(row.smtp_secure),
      smtpUser: row.smtp_user,
      smtpPassword: password,
      fromName: row.from_name,
      fromEmail: row.from_email,
      ...(row.updated_at ? { updatedAt: new Date(row.updated_at) } : {}),
    };
  }

  getEmailConfigForClient(): EmailDeliveryConfigClient | null {
    const config = this.getEmailConfig();
    if (!config) return null;
    const { smtpPassword, ...rest } = config;
    return { ...rest, hasPassword: smtpPassword.length > 0 };
  }

  saveEmailConfig(config: EmailDeliveryConfig): void {
    let encryptedPassword = '';
    if (config.smtpPassword) {
      encryptedPassword = JSON.stringify(encryptionService.encrypt(config.smtpPassword));
    }

    this.db.prepare(`
      INSERT INTO alert_email_config (id, enabled, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password_encrypted, from_name, from_email, updated_at)
      VALUES ('email', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        enabled = excluded.enabled,
        smtp_host = excluded.smtp_host,
        smtp_port = excluded.smtp_port,
        smtp_secure = excluded.smtp_secure,
        smtp_user = excluded.smtp_user,
        smtp_password_encrypted = CASE WHEN excluded.smtp_password_encrypted = '' THEN smtp_password_encrypted ELSE excluded.smtp_password_encrypted END,
        from_name = excluded.from_name,
        from_email = excluded.from_email,
        updated_at = excluded.updated_at
    `).run(
      config.enabled ? 1 : 0,
      config.smtpHost,
      config.smtpPort,
      config.smtpSecure ? 1 : 0,
      config.smtpUser,
      encryptedPassword,
      config.fromName,
      config.fromEmail
    );
  }

  // ── SMS ─────────────────────────────────────────────────────────────────

  getSmsConfig(): SmsDeliveryConfig | null {
    const row = this.db.prepare('SELECT * FROM alert_sms_config WHERE id = ?').get('sms') as any;
    if (!row || !row.api_url) return null;

    let token = '';
    const encrypted = row.api_token_encrypted ?? row.api_token ?? '';
    if (encrypted) {
      try {
        const parsed = JSON.parse(encrypted);
        token = encryptionService.decrypt(parsed);
      } catch {
        apiLogger.error('Failed to decrypt SMS API token from alert_sms_config');
      }
    }

    return {
      enabled: Boolean(row.enabled),
      apiUrl: row.api_url,
      apiToken: token,
      ...(row.updated_at ? { updatedAt: new Date(row.updated_at) } : {}),
    };
  }

  getSmsConfigForClient(): SmsDeliveryConfigClient | null {
    const config = this.getSmsConfig();
    if (!config) return null;
    const { apiToken, ...rest } = config;
    return { ...rest, hasToken: apiToken.length > 0 };
  }

  saveSmsConfig(config: SmsDeliveryConfig): void {
    let encryptedToken = '';
    if (config.apiToken) {
      encryptedToken = JSON.stringify(encryptionService.encrypt(config.apiToken));
    }

    this.db.prepare(`
      INSERT INTO alert_sms_config (id, enabled, api_url, api_token_encrypted, updated_at)
      VALUES ('sms', ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        enabled = excluded.enabled,
        api_url = excluded.api_url,
        api_token_encrypted = CASE WHEN excluded.api_token_encrypted = '' THEN api_token_encrypted ELSE excluded.api_token_encrypted END,
        updated_at = excluded.updated_at
    `).run(
      config.enabled ? 1 : 0,
      config.apiUrl,
      encryptedToken
    );
  }
}

export const alertDeliveryConfigService = new AlertDeliveryConfigService();
