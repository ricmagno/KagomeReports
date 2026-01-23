/**
 * Seed initial users for User Management System
 * Run this after Phase 1 migration to create the initial users
 */

const { Database } = require('sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'data', 'auth.db');
const BCRYPT_ROUNDS = 10;

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function userExists(db, username) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
      if (err) reject(err);
      else resolve(!!row);
    });
  });
}

async function createUser(db, userData) {
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const passwordHash = await hashPassword(userData.password);
  
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO users (
        id, username, email, first_name, last_name, role, password_hash,
        is_active, is_view_only, parent_user_id, auto_login_enabled, require_password_change
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        userData.username,
        userData.email,
        userData.firstName,
        userData.lastName,
        userData.role,
        passwordHash,
        1, // is_active
        0, // is_view_only
        null, // parent_user_id
        0, // auto_login_enabled
        0 // require_password_change
      ],
      (err) => {
        if (err) reject(err);
        else resolve(userId);
      }
    );
  });
}

async function createViewOnlyAccount(db, parentUserId, parentUsername, parentEmail, passwordHash) {
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const viewOnlyUsername = `${parentUsername}.view`;
  const viewOnlyEmail = `${viewOnlyUsername}@${parentEmail.split('@')[1]}`;
  
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO users (
        id, username, email, first_name, last_name, role, password_hash,
        is_active, is_view_only, parent_user_id, auto_login_enabled, require_password_change
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        viewOnlyUsername,
        viewOnlyEmail,
        'View-Only',
        'User',
        'view-only',
        passwordHash,
        1, // is_active
        1, // is_view_only
        parentUserId, // parent_user_id
        0, // auto_login_enabled
        0 // require_password_change
      ],
      (err) => {
        if (err) reject(err);
        else resolve(userId);
      }
    );
  });
}

async function seedInitialUsers() {
  console.log('='.repeat(60));
  console.log('Seeding Initial Users');
  console.log('='.repeat(60));
  
  const db = new Database(DB_PATH);
  
  try {
    const users = [
      {
        username: 'Scada.sa',
        password: '1z))(+9mmBe5L8QV',
        email: 'scada.sa@historian.local',
        firstName: 'System',
        lastName: 'Administrator',
        role: 'admin'
      },
      {
        username: 'Operator',
        password: 'operator',
        email: 'operator@historian.local',
        firstName: 'Operator',
        lastName: 'User',
        role: 'user'
      },
      {
        username: 'Quality',
        password: 'quality',
        email: 'quality@historian.local',
        firstName: 'Quality',
        lastName: 'User',
        role: 'user'
      },
      {
        username: 'Supervisor',
        password: 'supervisor',
        email: 'supervisor@historian.local',
        firstName: 'Supervisor',
        lastName: 'User',
        role: 'user'
      }
    ];
    
    for (const userData of users) {
      const exists = await userExists(db, userData.username);
      
      if (exists) {
        console.log(`⊙ User '${userData.username}' already exists, skipping`);
        continue;
      }
      
      // Create user
      const passwordHash = await hashPassword(userData.password);
      const userId = await createUser(db, userData);
      console.log(`✓ Created user: ${userData.username} (${userData.role})`);
      
      // If role is 'user', create View-Only account
      if (userData.role === 'user') {
        const viewOnlyUserId = await createViewOnlyAccount(
          db,
          userId,
          userData.username,
          userData.email,
          passwordHash
        );
        console.log(`  ✓ Created View-Only account: ${userData.username}.view`);
      }
    }
    
    // List all users
    console.log('\n--- All Users ---');
    const allUsers = await new Promise((resolve, reject) => {
      db.all('SELECT username, role, is_view_only, parent_user_id FROM users ORDER BY created_at', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    allUsers.forEach(user => {
      const viewOnlyTag = user.is_view_only ? ' [View-Only]' : '';
      const parentTag = user.parent_user_id ? ` (parent: ${user.parent_user_id.substring(0, 12)}...)` : '';
      console.log(`  - ${user.username} (${user.role})${viewOnlyTag}${parentTag}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('✓ Initial users seeded successfully!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n✗ Seeding failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

seedInitialUsers().catch(console.error);
