/**
 * Environment File Service
 * Handles reading and writing to .env files with atomic operations
 * Requirements: 4.5, 4.8, 4.9
 */

import fs from 'fs';
import path from 'path';
import { dbLogger } from '@/utils/logger';

/**
 * Environment file service for atomic .env updates
 */
export class EnvFileService {
  private envFilePath: string;
  private backupDir: string;

  constructor(envFilePath: string = '.env', backupDir: string = '.env.backups') {
    this.envFilePath = envFilePath;
    this.backupDir = backupDir;

    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Read the current .env file
   */
  private readEnvFile(): string {
    try {
      if (!fs.existsSync(this.envFilePath)) {
        dbLogger.warn(`Environment file not found: ${this.envFilePath}`);
        return '';
      }

      const content = fs.readFileSync(this.envFilePath, 'utf-8');
      return content;
    } catch (error) {
      dbLogger.error(`Error reading environment file: ${this.envFilePath}`, error);
      throw new Error(`Failed to read environment file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Write content to the .env file
   */
  private writeEnvFile(content: string): void {
    try {
      fs.writeFileSync(this.envFilePath, content, 'utf-8');
      dbLogger.info('Environment file updated successfully');
    } catch (error) {
      dbLogger.error(`Error writing environment file: ${this.envFilePath}`, error);
      throw new Error(`Failed to write environment file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a backup of the current .env file
   */
  private createBackup(): string {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `env.backup.${timestamp}`;
      const backupPath = path.join(this.backupDir, backupFileName);

      const content = this.readEnvFile();
      fs.writeFileSync(backupPath, content, 'utf-8');

      dbLogger.info(`Backup created: ${backupPath}`);
      return backupPath;
    } catch (error) {
      dbLogger.error('Error creating backup', error);
      throw new Error(`Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse .env file content into key-value pairs
   */
  private parseEnvContent(content: string): Map<string, string> {
    const envMap = new Map<string, string>();

    const lines = content.split('\n');
    for (const line of lines) {
      // Skip empty lines and comments
      if (!line.trim() || line.trim().startsWith('#')) {
        continue;
      }

      // Parse key=value
      const equalsIndex = line.indexOf('=');
      if (equalsIndex === -1) {
        continue;
      }

      const key = line.substring(0, equalsIndex).trim();
      const value = line.substring(equalsIndex + 1).trim();

      if (key) {
        envMap.set(key, value);
      }
    }

    return envMap;
  }

  /**
   * Reconstruct .env file content from key-value pairs
   * Preserves comments and formatting as much as possible
   */
  private reconstructEnvContent(
    originalContent: string,
    updates: Map<string, string>
  ): string {
    const lines = originalContent.split('\n');
    const result: string[] = [];
    const processedKeys = new Set<string>();

    for (const line of lines) {
      // Preserve empty lines and comments
      if (!line.trim() || line.trim().startsWith('#')) {
        result.push(line);
        continue;
      }

      // Parse key=value
      const equalsIndex = line.indexOf('=');
      if (equalsIndex === -1) {
        result.push(line);
        continue;
      }

      const key = line.substring(0, equalsIndex).trim();

      if (!key) {
        result.push(line);
        continue;
      }

      // Check if this key has been updated
      if (updates.has(key)) {
        const newValue = updates.get(key)!;
        result.push(`${key}=${newValue}`);
        processedKeys.add(key);
      } else {
        result.push(line);
      }
    }

    // Add any new keys that weren't in the original file
    for (const [key, value] of updates.entries()) {
      if (!processedKeys.has(key)) {
        result.push(`${key}=${value}`);
      }
    }

    return result.join('\n');
  }

  /**
   * Update configuration values in the .env file
   * Implements atomic update with backup
   * Requirements: 4.5, 4.8, 4.9
   */
  updateConfigurations(updates: Map<string, string>): { success: boolean; backupPath?: string; error?: string } {
    try {
      // Create backup before making changes
      const backupPath = this.createBackup();

      // Read current content
      const originalContent = this.readEnvFile();

      // Reconstruct with updates
      const updatedContent = this.reconstructEnvContent(originalContent, updates);

      // Write updated content
      this.writeEnvFile(updatedContent);

      // Update process.env for immediate effect
      for (const [key, value] of updates.entries()) {
        process.env[key] = value;
      }

      dbLogger.info('Configuration update completed successfully', {
        updatedKeys: Array.from(updates.keys()),
        backupPath
      });

      return {
        success: true,
        backupPath
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      dbLogger.error('Configuration update failed', error);

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Restore from a backup file
   */
  restoreFromBackup(backupPath: string): { success: boolean; error?: string } {
    try {
      if (!fs.existsSync(backupPath)) {
        return {
          success: false,
          error: `Backup file not found: ${backupPath}`
        };
      }

      const backupContent = fs.readFileSync(backupPath, 'utf-8');
      this.writeEnvFile(backupContent);

      // Reload environment variables
      const envMap = this.parseEnvContent(backupContent);
      for (const [key, value] of envMap.entries()) {
        process.env[key] = value;
      }

      dbLogger.info(`Configuration restored from backup: ${backupPath}`);

      return {
        success: true
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      dbLogger.error('Backup restore failed', error);

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get the value of a specific environment variable from the file
   */
  getConfigurationValue(key: string): string | null {
    try {
      const content = this.readEnvFile();
      const envMap = this.parseEnvContent(content);
      return envMap.get(key) || null;
    } catch (error) {
      dbLogger.error(`Error getting configuration value for ${key}`, error);
      return null;
    }
  }

  /**
   * Get all configuration values from the file
   */
  getAllConfigurations(): Map<string, string> {
    try {
      const content = this.readEnvFile();
      return this.parseEnvContent(content);
    } catch (error) {
      dbLogger.error('Error getting all configurations', error);
      return new Map();
    }
  }

  /**
   * List available backups
   */
  listBackups(): string[] {
    try {
      if (!fs.existsSync(this.backupDir)) {
        return [];
      }

      const files = fs.readdirSync(this.backupDir);
      return files
        .filter(f => f.startsWith('env.backup.'))
        .sort()
        .reverse();
    } catch (error) {
      dbLogger.error('Error listing backups', error);
      return [];
    }
  }

  /**
   * Delete old backups, keeping only the most recent N
   */
  cleanupOldBackups(keepCount: number = 10): void {
    try {
      const backups = this.listBackups();

      if (backups.length > keepCount) {
        const toDelete = backups.slice(keepCount);

        for (const backup of toDelete) {
          const backupPath = path.join(this.backupDir, backup);
          fs.unlinkSync(backupPath);
          dbLogger.info(`Deleted old backup: ${backup}`);
        }
      }
    } catch (error) {
      dbLogger.error('Error cleaning up old backups', error);
      // Don't throw - cleanup failures should not break the application
    }
  }
}
