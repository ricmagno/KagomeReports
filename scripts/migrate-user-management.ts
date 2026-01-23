/**
 * Database Migration Script for User Management System
 * Adds support for three user roles, View-Only accounts, and auto-login functionality
 * 
 * This script:
 * 1. Adds new columns to users table
 * 2. Creates auto_login_machines table
 * 3. Creates machine_fingerprints table
 * 4. Adds View-Only role permissions
 * 5. Creates backup before migration
 */

import { Database } from 'sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'auth.db');
const BACKUP_PATH = path.join(process.cwd(), 'data', `auth.db.backup.${Date.now()}`);

interface MigrationResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Create database backup before migration
 */
async function createBackup(): Promise<void> {
  console.log('Creating database backup...');
  
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`Database not found at ${DB_PATH}`);
  }
  
  fs.copyFileSync(DB_PATH, BACKUP_PATH);
  console.log(`✓ Backup created at ${BACKUP_PATH}`);
}

/**
 * Check if a column exists in a table
 */
async function columnExists(db: Database, tableName: string, columnName: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, (err, rows: any[]) => {
      if (err) {
        reject(err);
      } else {
        const exists = rows.some(row => row.name === columnName);
        resolve(exists);
      }
    });
  });
}

/**
 * Check if a table exists
 */
async function tableExists(db: Database, tableName: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      [tableName],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(!!row);
        }
      }
    );
  });
}

/**
 * Execute SQL statement
 */
async function executeSql(db: Database, sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Migration Step 1: Add new columns to users table
 */
async function migrateUsersTable(db: Database): Promise<MigrationResult> {
  console.log('\n--- Step 1: Migrating users table ---');
  
  try {
    const columns = [
      { name: 'parent_user_id', sql: 'ALTER TABLE users ADD COLUMN parent_user_id TEXT' },
      { name: 'is_view_only', sql: 'ALTER TABLE users ADD COLUMN is_view_only BOOLEAN DEFAULT 0' },
      { name: 'auto_login_enabled', sql: 'ALTER TABLE users ADD COLUMN auto_login_enabled BOOLEAN DEFAULT 0' },
      { name: 'require_password_change', sql: 'ALTER TABLE users ADD COLUMN require_password_change BOOLEAN DEFAULT 0' }
    ];
    
    for (const column of columns) {
      const exists = await columnExists(db, 'users', column.name);
      
      if (exists) {
        console.log(`  ⊙ Column '${column.name}' already exists, skipping`);
      } else {
        await executeSql(db, column.sql);
        console.log(`  ✓ Added column '${column.name}'`);
      }
    }
    
    return {
      success: true,
      message: 'Users table migration completed'
    };
  } catch (error) {
    return {
      success: false,
      message: 'Users table migration failed',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Migration Step 2: Create auto_login_machines table
 */
async function createAutoLoginMachinesTable(db: Database): Promise<MigrationResult> {
  console.log('\n--- Step 2: Creating auto_login_machines table ---');
  
  try {
    const exists = await tableExists(db, 'auto_login_machines');
    
    if (exists) {
      console.log('  ⊙ Table auto_login_machines already exists, skipping');
      return {
        success: true,
        message: 'auto_login_machines table already exists'
      };
    }
    
    await executeSql(db, `
      CREATE TABLE auto_login_machines (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        machine_fingerprint TEXT NOT NULL,
        machine_name TEXT,
        enabled BOOLEAN DEFAULT 1,
        last_used DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(user_id, machine_fingerprint)
      )
    `);
    console.log('  ✓ Created table auto_login_machines');
    
    // Create indexes
    await executeSql(db, 'CREATE INDEX idx_auto_login_fingerprint ON auto_login_machines(machine_fingerprint)');
    console.log('  ✓ Created index idx_auto_login_fingerprint');
    
    await executeSql(db, 'CREATE INDEX idx_auto_login_user ON auto_login_machines(user_id)');
    console.log('  ✓ Created index idx_auto_login_user');
    
    return {
      success: true,
      message: 'auto_login_machines table created successfully'
    };
  } catch (error) {
    return {
      success: false,
      message: 'auto_login_machines table creation failed',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Migration Step 3: Create machine_fingerprints table
 */
async function createMachineFingerprintsTable(db: Database): Promise<MigrationResult> {
  console.log('\n--- Step 3: Creating machine_fingerprints table ---');
  
  try {
    const exists = await tableExists(db, 'machine_fingerprints');
    
    if (exists) {
      console.log('  ⊙ Table machine_fingerprints already exists, skipping');
      return {
        success: true,
        message: 'machine_fingerprints table already exists'
      };
    }
    
    await executeSql(db, `
      CREATE TABLE machine_fingerprints (
        id TEXT PRIMARY KEY,
        fingerprint_hash TEXT UNIQUE NOT NULL,
        fingerprint_data TEXT NOT NULL,
        first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        seen_count INTEGER DEFAULT 1
      )
    `);
    console.log('  ✓ Created table machine_fingerprints');
    
    // Create index
    await executeSql(db, 'CREATE INDEX idx_fingerprint_hash ON machine_fingerprints(fingerprint_hash)');
    console.log('  ✓ Created index idx_fingerprint_hash');
    
    return {
      success: true,
      message: 'machine_fingerprints table created successfully'
    };
  } catch (error) {
    return {
      success: false,
      message: 'machine_fingerprints table creation failed',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Migration Step 4: Add View-Only role permissions
 */
async function addViewOnlyPermissions(db: Database): Promise<MigrationResult> {
  console.log('\n--- Step 4: Adding View-Only role permissions ---');
  
  try {
    const permissions = [
      { id: 'perm_view-only_reports_read', role: 'view-only', resource: 'reports', action: 'read' },
      { id: 'perm_view-only_reports_run', role: 'view-only', resource: 'reports', action: 'run' }
    ];
    
    for (const perm of permissions) {
      await executeSql(
        db,
        `INSERT OR IGNORE INTO role_permissions (id, role, resource, action, granted)
         VALUES (?, ?, ?, ?, ?)`,
        [perm.id, perm.role, perm.resource, perm.action, true]
      );
      console.log(`  ✓ Added permission: ${perm.role} can ${perm.action} ${perm.resource}`);
    }
    
    return {
      success: true,
      message: 'View-Only permissions added successfully'
    };
  } catch (error) {
    return {
      success: false,
      message: 'View-Only permissions addition failed',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Verify migration results
 */
async function verifyMigration(db: Database): Promise<MigrationResult> {
  console.log('\n--- Verification ---');
  
  try {
    // Check users table columns
    const userColumns = ['parent_user_id', 'is_view_only', 'auto_login_enabled', 'require_password_change'];
    for (const col of userColumns) {
      const exists = await columnExists(db, 'users', col);
      if (!exists) {
        throw new Error(`Column '${col}' not found in users table`);
      }
      console.log(`  ✓ Column '${col}' exists in users table`);
    }
    
    // Check tables
    const tables = ['auto_login_machines', 'machine_fingerprints'];
    for (const table of tables) {
      const exists = await tableExists(db, table);
      if (!exists) {
        throw new Error(`Table '${table}' not found`);
      }
      console.log(`  ✓ Table '${table}' exists`);
    }
    
    // Check permissions
    const permCount = await new Promise<number>((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM role_permissions WHERE role = 'view-only'`,
        (err, row: any) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });
    
    if (permCount < 2) {
      throw new Error(`Expected at least 2 view-only permissions, found ${permCount}`);
    }
    console.log(`  ✓ View-Only permissions exist (${permCount} permissions)`);
    
    return {
      success: true,
      message: 'Migration verification passed'
    };
  } catch (error) {
    return {
      success: false,
      message: 'Migration verification failed',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Main migration function
 */
async function runMigration(): Promise<void> {
  console.log('='.repeat(60));
  console.log('User Management System - Database Migration');
  console.log('='.repeat(60));
  
  let db: Database | null = null;
  
  try {
    // Create backup
    await createBackup();
    
    // Open database
    console.log('\nOpening database...');
    db = new Database(DB_PATH);
    console.log('✓ Database opened');
    
    // Run migrations in sequence
    const results: MigrationResult[] = [];
    
    results.push(await migrateUsersTable(db));
    results.push(await createAutoLoginMachinesTable(db));
    results.push(await createMachineFingerprintsTable(db));
    results.push(await addViewOnlyPermissions(db));
    
    // Verify migration
    const verificationResult = await verifyMigration(db);
    results.push(verificationResult);
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    
    const failed = results.filter(r => !r.success);
    
    if (failed.length === 0) {
      console.log('✓ All migration steps completed successfully!');
      console.log(`\nBackup location: ${BACKUP_PATH}`);
      console.log('\nYou can now proceed with Phase 2: Backend Services');
    } else {
      console.log('✗ Some migration steps failed:');
      failed.forEach(r => {
        console.log(`  - ${r.message}: ${r.error}`);
      });
      console.log(`\nBackup available at: ${BACKUP_PATH}`);
      console.log('You can restore from backup if needed.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n✗ Migration failed with error:');
    console.error(error);
    console.log(`\nBackup available at: ${BACKUP_PATH}`);
    console.log('You can restore from backup if needed.');
    process.exit(1);
  } finally {
    if (db) {
      db.close();
      console.log('\nDatabase connection closed.');
    }
  }
}

// Run migration
runMigration().catch(console.error);
