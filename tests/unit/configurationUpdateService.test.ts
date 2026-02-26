/**
 * Configuration Update Service Tests
 * Tests for configuration update functionality with validation and persistence
 * Requirements: 4.5, 4.8, 4.9, 5.1, 5.2, 9.1, 9.2, 9.3
 */

import { ConfigurationUpdateService } from '@/services/configurationUpdateService';
import { ConfigurationChange } from '@/types/configuration';
import fs from 'fs';
import path from 'path';

describe('ConfigurationUpdateService', () => {
  let updateService: ConfigurationUpdateService;
  const testEnvFile = path.join(__dirname, 'test.env');
  const testBackupDir = path.join(__dirname, 'test-backups');

  beforeEach(() => {
    const testContent = `DB_HOST=localhost
DB_PORT=1433
DB_NAME=TestDB
DB_USER=testuser
DB_PASSWORD=testpass123
NODE_ENV=development
PORT=3000
JWT_SECRET=test-secret-key-with-32-characters-minimum
BCRYPT_ROUNDS=12
SMTP_HOST=smtp.test.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=test@test.com
SMTP_PASSWORD=testpass
REPORTS_DIR=./reports
TEMP_DIR=./temp
MAX_REPORT_SIZE_MB=50
CHART_WIDTH=800
CHART_HEIGHT=400
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_TIMEOUT_MS=30000
CACHE_TTL_SECONDS=300
MAX_CONCURRENT_REPORTS=5
CORS_ORIGIN=http://localhost:3001
SESSION_TIMEOUT_HOURS=24
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=info
LOG_FILE=./logs/app.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5`;

    fs.writeFileSync(testEnvFile, testContent, 'utf-8');

    if (!fs.existsSync(testBackupDir)) {
      fs.mkdirSync(testBackupDir, { recursive: true });
    }

    updateService = new ConfigurationUpdateService(testEnvFile);
  });

  afterEach(() => {
    if (fs.existsSync(testEnvFile)) {
      fs.unlinkSync(testEnvFile);
    }

    if (fs.existsSync(testBackupDir)) {
      const files = fs.readdirSync(testBackupDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(testBackupDir, file));
      });
      fs.rmdirSync(testBackupDir);
    }
  });

  it('should successfully update a single configuration', async () => {
    const changes: ConfigurationChange[] = [
      { name: 'DB_HOST', oldValue: 'localhost', newValue: '192.168.1.100' }
    ];

    const result = await updateService.updateConfigurations(changes, 'user123', '127.0.0.1', 'Mozilla/5.0');

    expect(result.success).toBe(true);
    expect(result.message).toContain('successfully');
    expect(result.updatedConfigurations).toHaveLength(1);
  });

  it('should reject invalid numeric values', async () => {
    const changes: ConfigurationChange[] = [
      { name: 'DB_PORT', oldValue: '1433', newValue: 'not-a-number' }
    ];

    const result = await updateService.updateConfigurations(changes, 'user123', '127.0.0.1', 'Mozilla/5.0');

    expect(result.success).toBe(false);
    expect(result.validationErrors).toHaveLength(1);
  });

  it('should persist changes to .env file', async () => {
    const changes: ConfigurationChange[] = [
      { name: 'DB_HOST', oldValue: 'localhost', newValue: '192.168.1.100' }
    ];

    await updateService.updateConfigurations(changes, 'user123', '127.0.0.1', 'Mozilla/5.0');

    const envContent = fs.readFileSync(testEnvFile, 'utf-8');
    expect(envContent).toContain('DB_HOST=192.168.1.100');
  });

  it('should create backup before updating', async () => {
    const changes: ConfigurationChange[] = [
      { name: 'DB_HOST', oldValue: 'localhost', newValue: '192.168.1.100' }
    ];

    const result = await updateService.updateConfigurations(changes, 'user123', '127.0.0.1', 'Mozilla/5.0');

    expect(result.backupPath).toBeDefined();
    expect(fs.existsSync(result.backupPath!)).toBe(true);
  });

  it('should implement atomic behavior', async () => {
    const changes: ConfigurationChange[] = [
      { name: 'DB_HOST', oldValue: 'localhost', newValue: '192.168.1.100' },
      { name: 'DB_PORT', oldValue: '1433', newValue: 'invalid-port' }
    ];

    const result = await updateService.updateConfigurations(changes, 'user123', '127.0.0.1', 'Mozilla/5.0');

    expect(result.success).toBe(false);

    const envContent = fs.readFileSync(testEnvFile, 'utf-8');
    expect(envContent).toContain('DB_HOST=localhost');
  });

  it('should log configuration changes', async () => {
    const changes: ConfigurationChange[] = [
      { name: 'DB_HOST', oldValue: 'localhost', newValue: '192.168.1.100' }
    ];

    await updateService.updateConfigurations(changes, 'user123', '127.0.0.1', 'Mozilla/5.0');

    const auditLogger = updateService.getAuditLogger();
    const logs = auditLogger.getLogsByAction('change');

    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0]?.userId).toBe('user123');
  });

  it('should mask sensitive values in audit logs', async () => {
    const changes: ConfigurationChange[] = [
      { name: 'DB_PASSWORD', oldValue: 'oldpass123', newValue: 'newpass456' }
    ];

    await updateService.updateConfigurations(changes, 'user123', '127.0.0.1', 'Mozilla/5.0');

    const auditLogger = updateService.getAuditLogger();
    const logs = auditLogger.getLogsByAction('change');

    expect(logs[0]?.oldValue).toBe('••••••••');
    expect(logs[0]?.newValue).toBe('••••••••');
  });
});
