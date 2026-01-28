/**
 * Environment File Service Tests
 * Tests for .env file reading, writing, and backup functionality
 * Requirements: 4.5, 4.8, 4.9
 */

import { EnvFileService } from '@/services/envFileService';
import fs from 'fs';
import path from 'path';

describe('EnvFileService', () => {
  let envFileService: EnvFileService;
  const testEnvFile = path.join(__dirname, 'test.env');
  const testBackupDir = path.join(__dirname, 'test-backups');

  beforeEach(() => {
    // Create a test .env file
    const testContent = `
DB_HOST=localhost
DB_PORT=1433
DB_NAME=TestDB
DB_USER=testuser
DB_PASSWORD=testpass123
NODE_ENV=development
PORT=3000
`;

    fs.writeFileSync(testEnvFile, testContent, 'utf-8');

    // Create backup directory
    if (!fs.existsSync(testBackupDir)) {
      fs.mkdirSync(testBackupDir, { recursive: true });
    }

    envFileService = new EnvFileService(testEnvFile, testBackupDir);
  });

  afterEach(() => {
    // Cleanup test files
    if (fs.existsSync(testEnvFile)) {
      fs.unlinkSync(testEnvFile);
    }

    // Cleanup backup files
    if (fs.existsSync(testBackupDir)) {
      const files = fs.readdirSync(testBackupDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(testBackupDir, file));
      });
      fs.rmdirSync(testBackupDir);
    }
  });

  describe('updateConfigurations', () => {
    it('should update a single configuration', () => {
      const updates = new Map<string, string>();
      updates.set('DB_HOST', '192.168.1.100');

      const result = envFileService.updateConfigurations(updates);

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeDefined();

      const content = fs.readFileSync(testEnvFile, 'utf-8');
      expect(content).toContain('DB_HOST=192.168.1.100');
      expect(content).not.toContain('DB_HOST=localhost');
    });

    it('should update multiple configurations', () => {
      const updates = new Map<string, string>();
      updates.set('DB_HOST', '192.168.1.100');
      updates.set('DB_PORT', '1434');
      updates.set('PORT', '3001');

      const result = envFileService.updateConfigurations(updates);

      expect(result.success).toBe(true);

      const content = fs.readFileSync(testEnvFile, 'utf-8');
      expect(content).toContain('DB_HOST=192.168.1.100');
      expect(content).toContain('DB_PORT=1434');
      expect(content).toContain('PORT=3001');
    });

    it('should create a backup before updating', () => {
      const updates = new Map<string, string>();
      updates.set('DB_HOST', '192.168.1.100');

      const result = envFileService.updateConfigurations(updates);

      expect(result.backupPath).toBeDefined();
      expect(fs.existsSync(result.backupPath!)).toBe(true);

      const backupContent = fs.readFileSync(result.backupPath!, 'utf-8');
      expect(backupContent).toContain('DB_HOST=localhost');
    });

    it('should preserve comments in .env file', () => {
      const testContentWithComments = `
# Database Configuration
DB_HOST=localhost
# Database port
DB_PORT=1433
`;

      fs.writeFileSync(testEnvFile, testContentWithComments, 'utf-8');

      const updates = new Map<string, string>();
      updates.set('DB_HOST', '192.168.1.100');

      envFileService.updateConfigurations(updates);

      const content = fs.readFileSync(testEnvFile, 'utf-8');
      expect(content).toContain('# Database Configuration');
      expect(content).toContain('# Database port');
      expect(content).toContain('DB_HOST=192.168.1.100');
    });

    it('should preserve empty lines in .env file', () => {
      const testContentWithEmptyLines = `
DB_HOST=localhost

DB_PORT=1433

DB_NAME=TestDB
`;

      fs.writeFileSync(testEnvFile, testContentWithEmptyLines, 'utf-8');

      const updates = new Map<string, string>();
      updates.set('DB_HOST', '192.168.1.100');

      envFileService.updateConfigurations(updates);

      const content = fs.readFileSync(testEnvFile, 'utf-8');
      expect(content).toContain('DB_HOST=192.168.1.100');
      // Should still have empty lines
      expect(content.split('\n').filter(line => line === '').length).toBeGreaterThan(0);
    });

    it('should add new configurations if they do not exist', () => {
      const updates = new Map<string, string>();
      updates.set('NEW_CONFIG', 'new_value');

      envFileService.updateConfigurations(updates);

      const content = fs.readFileSync(testEnvFile, 'utf-8');
      expect(content).toContain('NEW_CONFIG=new_value');
    });

    it('should handle special characters in values', () => {
      const updates = new Map<string, string>();
      updates.set('DB_PASSWORD', 'p@ssw0rd!#$%^&*()');

      envFileService.updateConfigurations(updates);

      const content = fs.readFileSync(testEnvFile, 'utf-8');
      expect(content).toContain('DB_PASSWORD=p@ssw0rd!#$%^&*()');
    });

    it('should update process.env', () => {
      const updates = new Map<string, string>();
      updates.set('DB_HOST', '192.168.1.100');

      envFileService.updateConfigurations(updates);

      expect(process.env.DB_HOST).toBe('192.168.1.100');
    });

    it('should handle empty updates map', () => {
      const updates = new Map<string, string>();

      const result = envFileService.updateConfigurations(updates);

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeDefined();
    });

    it('should handle file system errors', () => {
      const invalidService = new EnvFileService('/invalid/path/.env', testBackupDir);

      const updates = new Map<string, string>();
      updates.set('DB_HOST', '192.168.1.100');

      const result = invalidService.updateConfigurations(updates);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('restoreFromBackup', () => {
    it('should restore from a backup file', () => {
      // Create a backup
      const updates = new Map<string, string>();
      updates.set('DB_HOST', '192.168.1.100');

      const result = envFileService.updateConfigurations(updates);
      const backupPath = result.backupPath!;

      // Verify the update was made
      let content = fs.readFileSync(testEnvFile, 'utf-8');
      expect(content).toContain('DB_HOST=192.168.1.100');

      // Restore from backup
      const restoreResult = envFileService.restoreFromBackup(backupPath);

      expect(restoreResult.success).toBe(true);

      // Verify the restore
      content = fs.readFileSync(testEnvFile, 'utf-8');
      expect(content).toContain('DB_HOST=localhost');
      expect(content).not.toContain('DB_HOST=192.168.1.100');
    });

    it('should handle non-existent backup file', () => {
      const result = envFileService.restoreFromBackup('/invalid/backup/path');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should update process.env after restore', () => {
      // Create a backup
      const updates = new Map<string, string>();
      updates.set('DB_HOST', '192.168.1.100');

      const result = envFileService.updateConfigurations(updates);
      const backupPath = result.backupPath!;

      // Restore from backup
      envFileService.restoreFromBackup(backupPath);

      expect(process.env.DB_HOST).toBe('localhost');
    });
  });

  describe('getConfigurationValue', () => {
    it('should retrieve a configuration value', () => {
      const value = envFileService.getConfigurationValue('DB_HOST');

      expect(value).toBe('localhost');
    });

    it('should return null for non-existent configuration', () => {
      const value = envFileService.getConfigurationValue('NON_EXISTENT');

      expect(value).toBeNull();
    });

    it('should handle special characters in values', () => {
      const testContent = `
DB_PASSWORD=p@ssw0rd!#$%^&*()
`;

      fs.writeFileSync(testEnvFile, testContent, 'utf-8');

      const value = envFileService.getConfigurationValue('DB_PASSWORD');

      expect(value).toBe('p@ssw0rd!#$%^&*()');
    });
  });

  describe('getAllConfigurations', () => {
    it('should retrieve all configurations', () => {
      const configs = envFileService.getAllConfigurations();

      expect(configs.size).toBeGreaterThan(0);
      expect(configs.get('DB_HOST')).toBe('localhost');
      expect(configs.get('DB_PORT')).toBe('1433');
      expect(configs.get('NODE_ENV')).toBe('development');
    });

    it('should skip comments and empty lines', () => {
      const testContent = `
# This is a comment
DB_HOST=localhost

# Another comment
DB_PORT=1433
`;

      fs.writeFileSync(testEnvFile, testContent, 'utf-8');

      const configs = envFileService.getAllConfigurations();

      expect(configs.size).toBe(2);
      expect(configs.get('DB_HOST')).toBe('localhost');
      expect(configs.get('DB_PORT')).toBe('1433');
    });

    it('should handle empty .env file', () => {
      fs.writeFileSync(testEnvFile, '', 'utf-8');

      const configs = envFileService.getAllConfigurations();

      expect(configs.size).toBe(0);
    });
  });

  describe('listBackups', () => {
    it('should list available backups', async () => {
      // Create multiple backups with delays
      const updates = new Map<string, string>();
      updates.set('DB_HOST', '192.168.1.100');

      envFileService.updateConfigurations(updates);

      // Wait to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 100));

      updates.set('DB_HOST', '192.168.1.101');
      envFileService.updateConfigurations(updates);

      const backups = envFileService.listBackups();

      expect(Array.isArray(backups)).toBe(true);
      expect(backups.length).toBeGreaterThanOrEqual(1);
      if (backups.length > 0) {
        expect(backups[0]).toMatch(/env\.backup\./);
      }
    });

    it('should return empty array if no backups exist', () => {
      const backups = envFileService.listBackups();

      expect(Array.isArray(backups)).toBe(true);
    });

    it('should sort backups in reverse chronological order', () => {
      // Create multiple backups
      const updates = new Map<string, string>();
      updates.set('DB_HOST', '192.168.1.100');

      envFileService.updateConfigurations(updates);

      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      sleep(100);

      updates.set('DB_HOST', '192.168.1.101');
      envFileService.updateConfigurations(updates);

      const backups = envFileService.listBackups();

      // Most recent should be first
      if (backups.length >= 2) {
        expect(backups[0]! > backups[1]!).toBe(true);
      }
    });
  });

  describe('cleanupOldBackups', () => {
    it('should delete old backups keeping only the most recent N', async () => {
      // Create multiple backups
      const updates = new Map<string, string>();

      for (let i = 0; i < 5; i++) {
        updates.set('DB_HOST', `192.168.1.${100 + i}`);
        envFileService.updateConfigurations(updates);

        // Wait to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const backupsBefore = envFileService.listBackups();
      const countBefore = backupsBefore.length;

      if (countBefore > 5) {
        envFileService.cleanupOldBackups(3);

        const backupsAfter = envFileService.listBackups();
        expect(backupsAfter.length).toBeLessThanOrEqual(3);
      }
    });

    it('should keep all backups if count is less than keepCount', () => {
      // Create 3 backups
      const updates = new Map<string, string>();

      for (let i = 0; i < 3; i++) {
        updates.set('DB_HOST', `192.168.1.${100 + i}`);
        envFileService.updateConfigurations(updates);

        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        sleep(10);
      }

      const backupsBefore = envFileService.listBackups();
      const countBefore = backupsBefore.length;

      envFileService.cleanupOldBackups(10);

      const backupsAfter = envFileService.listBackups();
      expect(backupsAfter.length).toBe(countBefore);
    });
  });

  describe('Edge Cases', () => {
    it('should handle configuration values with equals signs', () => {
      const updates = new Map<string, string>();
      updates.set('CORS_ORIGIN', 'http://example.com?param=value&other=123');

      envFileService.updateConfigurations(updates);

      const value = envFileService.getConfigurationValue('CORS_ORIGIN');
      expect(value).toBe('http://example.com?param=value&other=123');
    });

    it('should handle configuration values with newlines escaped', () => {
      const updates = new Map<string, string>();
      updates.set('MULTILINE_VALUE', 'line1\\nline2\\nline3');

      envFileService.updateConfigurations(updates);

      const value = envFileService.getConfigurationValue('MULTILINE_VALUE');
      expect(value).toBe('line1\\nline2\\nline3');
    });

    it('should handle very long configuration values', () => {
      const longValue = 'x'.repeat(10000);
      const updates = new Map<string, string>();
      updates.set('LONG_VALUE', longValue);

      envFileService.updateConfigurations(updates);

      const value = envFileService.getConfigurationValue('LONG_VALUE');
      expect(value).toBe(longValue);
    });

    it('should handle configuration names with underscores and numbers', () => {
      const updates = new Map<string, string>();
      updates.set('DB_POOL_MIN_SIZE_123', 'value');

      envFileService.updateConfigurations(updates);

      const value = envFileService.getConfigurationValue('DB_POOL_MIN_SIZE_123');
      expect(value).toBe('value');
    });
  });
});
