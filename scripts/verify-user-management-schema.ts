/**
 * Verification Script for User Management Database Schema
 * Checks that all tables and columns are properly created
 */

import { Database } from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'auth.db');

async function verifySchema(): Promise<void> {
  console.log('='.repeat(60));
  console.log('User Management Schema Verification');
  console.log('='.repeat(60));
  
  const db = new Database(DB_PATH);
  
  try {
    // Check users table structure
    console.log('\n--- Users Table Structure ---');
    const userColumns = await new Promise<any[]>((resolve, reject) => {
      db.all('PRAGMA table_info(users)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('Columns:');
    userColumns.forEach((col: any) => {
      console.log(`  - ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
    });
    
    // Check auto_login_machines table
    console.log('\n--- Auto Login Machines Table Structure ---');
    const autoLoginColumns = await new Promise<any[]>((resolve, reject) => {
      db.all('PRAGMA table_info(auto_login_machines)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('Columns:');
    autoLoginColumns.forEach((col: any) => {
      console.log(`  - ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
    });
    
    // Check machine_fingerprints table
    console.log('\n--- Machine Fingerprints Table Structure ---');
    const fingerprintColumns = await new Promise<any[]>((resolve, reject) => {
      db.all('PRAGMA table_info(machine_fingerprints)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('Columns:');
    fingerprintColumns.forEach((col: any) => {
      console.log(`  - ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
    });
    
    // Check indexes
    console.log('\n--- Indexes ---');
    const indexes = await new Promise<any[]>((resolve, reject) => {
      db.all(`SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    indexes.forEach((idx: any) => {
      console.log(`  - ${idx.name} on ${idx.tbl_name}`);
    });
    
    // Check role permissions
    console.log('\n--- Role Permissions ---');
    const permissions = await new Promise<any[]>((resolve, reject) => {
      db.all('SELECT role, resource, action, granted FROM role_permissions ORDER BY role, resource, action', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    const groupedPerms: Record<string, any[]> = {};
    permissions.forEach((perm: any) => {
      if (!groupedPerms[perm.role]) {
        groupedPerms[perm.role] = [];
      }
      groupedPerms[perm.role]!.push(perm);
    });
    
    Object.keys(groupedPerms).sort().forEach(role => {
      console.log(`\n${role.toUpperCase()}:`);
      groupedPerms[role]!.forEach(perm => {
        console.log(`  - ${perm.action} ${perm.resource} ${perm.granted ? '✓' : '✗'}`);
      });
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('✓ Schema verification complete');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('✗ Verification failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

verifySchema().catch(console.error);
