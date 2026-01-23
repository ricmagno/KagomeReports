/**
 * Schema Version Migrator
 * 
 * Handles migration of report configuration schemas between versions.
 * Provides backward compatibility by transforming older schema versions
 * to the current version format.
 * 
 * Requirements: 1.7, 3.4
 */

import { CURRENT_SCHEMA_VERSION, SUPPORTED_SCHEMA_VERSIONS } from '@/types/reportExportImport';
import { logger } from '@/utils/logger';

const migrationLogger = logger.child({ service: 'SchemaVersionMigrator' });

/**
 * Migration function type
 * Takes data in one schema version and returns data in the next version
 */
type MigrationFunction = (data: any) => any;

/**
 * Migration definition
 */
interface Migration {
  from: string;
  to: string;
  migrate: MigrationFunction;
}

/**
 * Schema Version Migrator
 * 
 * Manages schema version migrations for report configurations.
 * Supports incremental migrations from any supported version to the current version.
 */
export class SchemaVersionMigrator {
  private migrations: Migration[] = [];

  constructor() {
    this.registerMigrations();
  }

  /**
   * Register all available migrations
   * 
   * Migrations are defined in order from oldest to newest.
   * Each migration transforms data from one version to the next.
   * 
   * @private
   */
  private registerMigrations(): void {
    // Example migration from 1.0 to 1.1 (when we add new features)
    // this.migrations.push({
    //   from: '1.0',
    //   to: '1.1',
    //   migrate: this.migrate_1_0_to_1_1.bind(this),
    // });

    // Currently, we only have version 1.0, so no migrations are needed yet
    // Future migrations will be added here as the schema evolves
    
    migrationLogger.debug('Registered migrations', { 
      count: this.migrations.length 
    });
  }

  /**
   * Migrate configuration from old schema to current version
   * 
   * Determines the migration path and applies all necessary migrations
   * in sequence to bring the data up to the current schema version.
   * 
   * @param data - Configuration data in old schema format
   * @param fromVersion - Source schema version
   * @returns Migrated data in current schema format
   */
  migrate(data: any, fromVersion: string): any {
    // If already at current version, no migration needed
    if (fromVersion === CURRENT_SCHEMA_VERSION) {
      migrationLogger.debug('No migration needed', { 
        version: fromVersion 
      });
      return data;
    }

    // Check if version is supported
    if (!SUPPORTED_SCHEMA_VERSIONS.includes(fromVersion)) {
      migrationLogger.warn('Unsupported schema version, attempting migration anyway', {
        fromVersion,
        supportedVersions: SUPPORTED_SCHEMA_VERSIONS,
      });
    }

    // Get migration path
    const migrationPath = this.getMigrationPath(fromVersion, CURRENT_SCHEMA_VERSION);

    if (migrationPath.length === 0) {
      migrationLogger.warn('No migration path found', {
        fromVersion,
        toVersion: CURRENT_SCHEMA_VERSION,
      });
      return data;
    }

    // Apply migrations in sequence
    let migratedData = data;
    for (const migration of migrationPath) {
      migrationLogger.info('Applying migration', {
        from: migration.from,
        to: migration.to,
      });

      try {
        migratedData = migration.migrate(migratedData);
        
        // Update schema version in the data
        if (migratedData && typeof migratedData === 'object') {
          migratedData.schemaVersion = migration.to;
        }
      } catch (error) {
        migrationLogger.error('Migration failed', {
          from: migration.from,
          to: migration.to,
          error: error instanceof Error ? error.message : String(error),
        });
        throw new Error(
          `Failed to migrate from version ${migration.from} to ${migration.to}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    migrationLogger.info('Migration completed successfully', {
      fromVersion,
      toVersion: CURRENT_SCHEMA_VERSION,
      migrationsApplied: migrationPath.length,
    });

    return migratedData;
  }

  /**
   * Get ordered list of migrations needed to go from one version to another
   * 
   * Builds a migration path by finding all migrations that need to be applied
   * in sequence to transform data from the source version to the target version.
   * 
   * @param fromVersion - Source schema version
   * @param toVersion - Target schema version
   * @returns Ordered array of migrations to apply
   * @private
   */
  private getMigrationPath(fromVersion: string, toVersion: string): Migration[] {
    const path: Migration[] = [];
    let currentVersion = fromVersion;

    // Keep finding the next migration until we reach the target version
    while (currentVersion !== toVersion) {
      const nextMigration = this.migrations.find(m => m.from === currentVersion);

      if (!nextMigration) {
        // No migration found from current version
        migrationLogger.warn('Migration path incomplete', {
          fromVersion,
          toVersion,
          stoppedAt: currentVersion,
        });
        break;
      }

      path.push(nextMigration);
      currentVersion = nextMigration.to;

      // Safety check to prevent infinite loops
      if (path.length > 100) {
        migrationLogger.error('Migration path too long, possible circular dependency', {
          fromVersion,
          toVersion,
          pathLength: path.length,
        });
        throw new Error('Migration path too long, possible circular dependency');
      }
    }

    return path;
  }

  /**
   * Check if a migration path exists from one version to another
   * 
   * @param fromVersion - Source schema version
   * @param toVersion - Target schema version
   * @returns True if migration is possible
   */
  canMigrate(fromVersion: string, toVersion: string): boolean {
    if (fromVersion === toVersion) {
      return true;
    }

    const path = this.getMigrationPath(fromVersion, toVersion);
    const lastMigration = path[path.length - 1];
    return path.length > 0 && lastMigration !== undefined && lastMigration.to === toVersion;
  }

  /**
   * Get list of all supported source versions that can be migrated
   * 
   * @returns Array of schema versions that have migration paths
   */
  getSupportedSourceVersions(): string[] {
    const versions = new Set<string>();
    
    // Add current version (no migration needed)
    versions.add(CURRENT_SCHEMA_VERSION);
    
    // Add all versions that have migrations defined
    for (const migration of this.migrations) {
      versions.add(migration.from);
    }

    return Array.from(versions).sort();
  }

  // ============================================================================
  // Migration Functions
  // ============================================================================
  // Each migration function transforms data from one version to the next.
  // These are defined as private methods and registered in registerMigrations().
  // ============================================================================

  /**
   * Example migration from 1.0 to 1.1
   * 
   * This is a template for future migrations. When the schema evolves,
   * new migration functions will be added here.
   * 
   * @param data - Data in version 1.0 format
   * @returns Data in version 1.1 format
   * @private
   */
  private migrate_1_0_to_1_1(data: any): any {
    // Example: Add new optional field with default value
    return {
      ...data,
      schemaVersion: '1.1',
      reportConfig: {
        ...data.reportConfig,
        // Add new field with default
        customSettings: data.reportConfig.customSettings || {},
      },
    };
  }

  /**
   * Example migration from 1.1 to 1.2
   * 
   * @param data - Data in version 1.1 format
   * @returns Data in version 1.2 format
   * @private
   */
  private migrate_1_1_to_1_2(data: any): any {
    // Example: Rename a field
    const { reportConfig } = data;
    const { oldFieldName, ...rest } = reportConfig;

    return {
      ...data,
      schemaVersion: '1.2',
      reportConfig: {
        ...rest,
        newFieldName: oldFieldName, // Rename field
      },
    };
  }
}

// Export singleton instance
export const schemaVersionMigrator = new SchemaVersionMigrator();
