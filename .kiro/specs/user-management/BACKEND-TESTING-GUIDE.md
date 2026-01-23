# User Management Backend Testing Guide

## Overview

This guide provides step-by-step instructions for testing the User Management System backend (Phases 1-3) before proceeding with frontend development.

## Prerequisites

1. **Database Migration**: Ensure the migration has been run
2. **Server Running**: Backend server should be running
3. **Initial Users**: Seed initial users for testing

## Phase 1: Database Setup & Verification

### Step 1: Run Database Migration

```bash
# Run the migration script
npm run ts-node scripts/migrate-user-management.ts
```

**Expected Output**:
- ✅ Migration completed successfully
- ✅ Database backup created
- ✅ New columns added to users table
- ✅ New tables created (auto_login_machines, machine_fingerprints)
- ✅ View-Only role permissions added

### Step 2: Verify Database Schema

```bash
# Run the verification script
npm run ts-node scripts/verify-user-management-schema.ts
```

**Expected Output**:
- ✅ All required columns exist
- ✅ All required tables exist
- ✅ All indexes are in place
- ✅ View-Only permissions configured

### Step 3: Seed Initial Users

```bash
# Run the seeding script
node scripts/seed-initial-users.js
```

**Expected Output**:
- ✅ Created 7 users:
  - admin (Administrator)
  - Scada.sa (Administrator)
  - Operator (User) + Operator.view (View-Only)
  - Quality (User) + Quality.view (View-Only)
  - Supervisor (User) + Supervisor.view (View-Only)

## Phase 2: Backend Services Testing

### Test 1: UserManagementService

Create a test script: `scripts/test-user-management-service.ts`

```typescript
import { userManagementService } from '../src/services/userManagementService';

async function testUserManagementService() {
  console.log('Testing UserManagementService...\n');

  // Test 1: List all users
  console.log('1. Listing all users:');
  const users = await userManagementService.listUsers({}, 50, 0);
  console.log(`   Found ${users.length} users`);
  users.forEach(u => console.log(`   - ${u.username} (${u.role})`));

  // Test 2: Get specific user
  console.log('\n2. Getting user by ID:');
  const user = await userManagementService.getUser(users[0].id);
  console.log(`   User: ${user.username} - ${user.email}`);

  // Test 3: Create new user (should auto-create View-Only)
  console.log('\n3. Creating new user:');
  const newUser = await userManagementService.createUser(
    'testuser',
    'test@example.com',
    'password123',
    'Test',
    'User',
    'user',
    false
  );
  console.log(`   Created: ${newUser.user.username}`);
  if (newUser.viewOnlyUser) {
    console.log(`   Auto-created View-Only: ${newUser.viewOnlyUser.username}`);
  }

  // Test 4: Get View-Only account
  console.log('\n4. Getting View-Only account:');
  const viewOnly = await userManagementService.getViewOnlyAccount(newUser.user.id);
  if (viewOnly) {
    console.log(`   View-Only account: ${viewOnly.username}`);
  }

  // Test 5: Update user
  console.log('\n5. Updating user:');
  const updated = await userManagementService.updateUser(newUser.user.id, {
    firstName: 'Updated',
    lastName: 'Name'
  });
  console.log(`   Updated: ${updated.firstName} ${updated.lastName}`);

  // Test 6: Delete user (should cascade delete View-Only)
  console.log('\n6. Deleting user (cascade delete):');
  await userManagementService.deleteUser(newUser.user.id);
  console.log('   User deleted successfully');

  // Verify View-Only was deleted
  const deletedViewOnly = await userManagementService.getViewOnlyAccount(newUser.user.id);
  console.log(`   View-Only account deleted: ${!deletedViewOnly}`);

  console.log('\n✅ All UserManagementService tests passed!');
}

testUserManagementService().catch(console.error);
```

Run: `npm run ts-node scripts/test-user-management-service.ts`

### Test 2: FingerprintService

Create a test script: `scripts/test-fingerprint-service.ts`

```typescript
import { fingerprintService } from '../src/services/fingerprintService';

async function testFingerprintService() {
  console.log('Testing FingerprintService...\n');

  const testData = {
    userAgent: 'Mozilla/5.0...',
    screen: { width: 1920, height: 1080 },
    timezone: 'America/New_York'
  };

  // Test 1: Generate hash
  console.log('1. Generating fingerprint hash:');
  const hash = await fingerprintService.generateHash(testData);
  console.log(`   Hash: ${hash.substring(0, 20)}...`);

  // Test 2: Store fingerprint
  console.log('\n2. Storing fingerprint:');
  const fingerprintId = await fingerprintService.storeFingerprint(
    hash,
    testData,
    '192.168.1.1',
    'Test Machine'
  );
  console.log(`   Stored with ID: ${fingerprintId}`);

  // Test 3: Validate fingerprint
  console.log('\n3. Validating fingerprint:');
  const isValid = await fingerprintService.validateFingerprint(hash);
  console.log(`   Valid: ${isValid}`);

  // Test 4: Get fingerprint info
  console.log('\n4. Getting fingerprint info:');
  const info = await fingerprintService.getFingerprintInfo(hash);
  console.log(`   Machine: ${info?.machineName}`);
  console.log(`   IP: ${info?.ipAddress}`);

  // Test 5: Get statistics
  console.log('\n5. Getting statistics:');
  const stats = await fingerprintService.getStatistics();
  console.log(`   Total fingerprints: ${stats.totalFingerprints}`);
  console.log(`   Unique machines: ${stats.uniqueMachines}`);

  console.log('\n✅ All FingerprintService tests passed!');
}

testFingerprintService().catch(console.error);
```

Run: `npm run ts-node scripts/test-fingerprint-service.ts`

### Test 3: AutoLoginService

Create a test script: `scripts/test-auto-login-service.ts`

```typescript
import { autoLoginService } from '../src/services/autoLoginService';
import { userManagementService } from '../src/services/userManagementService';

async function testAutoLoginService() {
  console.log('Testing AutoLoginService...\n');

  // Get a test user
  const users = await userManagementService.listUsers({ role: 'user' }, 1, 0);
  const testUser = users[0];

  const testFingerprint = {
    userAgent: 'Mozilla/5.0...',
    screen: { width: 1920, height: 1080 }
  };

  // Test 1: Generate fingerprint
  console.log('1. Generating fingerprint:');
  const hash = await autoLoginService.generateFingerprint(testFingerprint);
  console.log(`   Hash: ${hash.substring(0, 20)}...`);

  // Test 2: Enable auto-login
  console.log('\n2. Enabling auto-login:');
  const machineId = await autoLoginService.enableAutoLogin(
    testUser.id,
    hash,
    'Test Machine',
    '192.168.1.1',
    'Mozilla/5.0...'
  );
  console.log(`   Machine ID: ${machineId}`);

  // Test 3: Check if enabled
  console.log('\n3. Checking if auto-login enabled:');
  const isEnabled = await autoLoginService.isAutoLoginEnabled(testUser.id);
  console.log(`   Enabled: ${isEnabled}`);

  // Test 4: Get user machines
  console.log('\n4. Getting user machines:');
  const machines = await autoLoginService.getUserMachines(testUser.id);
  console.log(`   Machines: ${machines.length}`);
  machines.forEach(m => console.log(`   - ${m.machineName}`));

  // Test 5: Generate auto-login token
  console.log('\n5. Generating auto-login token:');
  const token = await autoLoginService.generateAutoLoginToken(testUser.id, hash);
  console.log(`   Token: ${token.substring(0, 30)}...`);

  // Test 6: Validate auto-login token
  console.log('\n6. Validating auto-login token:');
  const validation = await autoLoginService.validateAutoLoginToken(
    hash,
    '192.168.1.1',
    'Mozilla/5.0...'
  );
  console.log(`   Valid: ${validation.valid}`);
  console.log(`   User: ${validation.user?.username}`);

  // Test 7: Disable auto-login
  console.log('\n7. Disabling auto-login:');
  await autoLoginService.disableAutoLogin(testUser.id);
  const stillEnabled = await autoLoginService.isAutoLoginEnabled(testUser.id);
  console.log(`   Disabled: ${!stillEnabled}`);

  console.log('\n✅ All AutoLoginService tests passed!');
}

testAutoLoginService().catch(console.error);
```

Run: `npm run ts-node scripts/test-auto-login-service.ts`

## Phase 3: API Routes Testing

### Using cURL

#### Test 1: Login

```bash
# Login as admin
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user_...",
      "username": "admin",
      "role": "admin",
      ...
    }
  }
}
```

**Save the token** for subsequent requests!

#### Test 2: List Users

```bash
# Replace YOUR_TOKEN with the token from login
curl -X GET http://localhost:3001/api/users \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "user_...",
      "username": "admin",
      "role": "admin",
      ...
    },
    ...
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 7
  }
}
```

#### Test 3: Create User

```bash
curl -X POST http://localhost:3001/api/users \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "email": "newuser@example.com",
    "password": "password123",
    "firstName": "New",
    "lastName": "User",
    "role": "user"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "user": { ... },
    "viewOnlyUser": { ... }
  }
}
```

#### Test 4: Get User Details

```bash
curl -X GET http://localhost:3001/api/users/USER_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Test 5: Update User

```bash
curl -X PUT http://localhost:3001/api/users/USER_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Updated",
    "lastName": "Name"
  }'
```

#### Test 6: Delete User

```bash
curl -X DELETE http://localhost:3001/api/users/USER_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Test 7: Change Password

```bash
curl -X POST http://localhost:3001/api/users/me/change-password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "admin123",
    "newPassword": "newpassword123",
    "confirmPassword": "newpassword123"
  }'
```

#### Test 8: Auto-Login - Check Availability

```bash
curl -X POST http://localhost:3001/api/auth/auto-login/check \
  -H "Content-Type: application/json" \
  -d '{
    "fingerprint": "test_fingerprint_hash"
  }'
```

#### Test 9: Auto-Login - Enable

```bash
curl -X POST http://localhost:3001/api/auth/auto-login/enable \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fingerprint": "test_fingerprint_hash",
    "machineName": "My Computer"
  }'
```

#### Test 10: Auto-Login - Authenticate

```bash
curl -X POST http://localhost:3001/api/auth/auto-login/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "fingerprint": "test_fingerprint_hash"
  }'
```

### Using Postman

1. **Import Collection**: Create a Postman collection with all endpoints
2. **Set Environment Variable**: Create `{{token}}` variable
3. **Test Each Endpoint**: Verify responses match expected format

### Postman Collection Structure

```
User Management API
├── Auth
│   ├── POST Login
│   ├── POST Logout
│   └── GET Me
├── Users
│   ├── GET List Users
│   ├── GET User Details
│   ├── POST Create User
│   ├── PUT Update User
│   ├── DELETE Delete User
│   ├── POST Change Password
│   ├── POST Reset Password
│   ├── GET User Machines
│   └── DELETE Remove Machine
└── Auto-Login
    ├── POST Check Availability
    ├── POST Enable
    ├── POST Disable
    ├── POST Authenticate
    └── GET Status
```

## Testing Checklist

### Phase 1: Database ✅
- [ ] Migration runs successfully
- [ ] Schema verification passes
- [ ] Initial users seeded correctly
- [ ] View-Only accounts auto-created
- [ ] Database backup created

### Phase 2: Services ✅
- [ ] UserManagementService creates users
- [ ] View-Only accounts auto-created
- [ ] Cascade deletion works
- [ ] FingerprintService generates hashes
- [ ] Fingerprints stored and validated
- [ ] AutoLoginService enables auto-login
- [ ] Auto-login tokens generated
- [ ] Auto-login validation works

### Phase 3: API Routes ✅
- [ ] Login endpoint works
- [ ] Token authentication works
- [ ] List users endpoint works
- [ ] Create user endpoint works
- [ ] Update user endpoint works
- [ ] Delete user endpoint works
- [ ] Password change works
- [ ] Password reset works
- [ ] Auto-login check works
- [ ] Auto-login enable works
- [ ] Auto-login authenticate works
- [ ] Rate limiting works (10 requests/15min)

## Common Issues & Solutions

### Issue 1: Migration Fails
**Solution**: Check if database file exists and has write permissions

### Issue 2: Token Invalid
**Solution**: Ensure JWT_SECRET is set in .env file

### Issue 3: Auto-Login Not Working
**Solution**: Verify fingerprint hash is consistent

### Issue 4: View-Only Account Not Created
**Solution**: Check role is 'user' (not 'admin' or 'view-only')

### Issue 5: Rate Limiting Too Strict
**Solution**: Wait 15 minutes or restart server to reset

## Next Steps

Once all tests pass:

1. ✅ **Backend is Ready**: Phases 1-3 are complete and tested
2. 🔄 **Continue to Phase 4**: Implement frontend components
3. 📝 **Document Issues**: Note any bugs or improvements needed
4. 🎨 **Design Review**: Review UI/UX requirements before building frontend

## Success Criteria

The backend is ready for frontend development when:

- ✅ All database tables exist and are populated
- ✅ All services work correctly
- ✅ All API endpoints return expected responses
- ✅ Authentication and authorization work
- ✅ Auto-login functionality works
- ✅ Cascade deletion works
- ✅ Rate limiting works
- ✅ No critical errors in logs

---

**Testing Date**: _____________
**Tested By**: _____________
**Status**: ⬜ Pass ⬜ Fail ⬜ Partial
**Notes**: _____________________________________________
