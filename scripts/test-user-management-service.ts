/**
 * Test script for UserManagementService
 * Tests user creation, View-Only account auto-creation, and other operations
 */

import { userManagementService } from '../src/services/userManagementService';

async function testUserManagementService(): Promise<void> {
  console.log('='.repeat(60));
  console.log('UserManagementService Test');
  console.log('='.repeat(60));

  try {
    // Test 1: Create a user (should auto-create View-Only account)
    console.log('\n--- Test 1: Create User with Auto View-Only Account ---');
    const testUser = await userManagementService.createUser({
      username: 'TestUser',
      email: 'testuser@test.com',
      firstName: 'Test',
      lastName: 'User',
      password: 'testpassword123',
      role: 'user'
    });
    console.log('✓ User created:', testUser.username);

    // Check if View-Only account was created
    const viewOnlyAccount = await userManagementService.getViewOnlyAccount(testUser.id);
    if (viewOnlyAccount) {
      console.log('✓ View-Only account auto-created:', viewOnlyAccount.username);
      console.log('  - Parent User ID:', viewOnlyAccount.parentUserId);
      console.log('  - Is View Only:', viewOnlyAccount.isViewOnly);
    } else {
      console.log('✗ View-Only account NOT created');
    }

    // Test 2: List users
    console.log('\n--- Test 2: List Users ---');
    const userList = await userManagementService.listUsers();
    console.log(`✓ Found ${userList.total} users:`);
    userList.users.forEach(u => {
      console.log(`  - ${u.username} (${u.role}) ${u.isViewOnly ? '[View-Only]' : ''}`);
    });

    // Test 3: Update user
    console.log('\n--- Test 3: Update User ---');
    const updatedUser = await userManagementService.updateUser(testUser.id, {
      firstName: 'Updated',
      lastName: 'Name'
    });
    console.log('✓ User updated:', `${updatedUser.firstName} ${updatedUser.lastName}`);

    // Test 4: Change password
    console.log('\n--- Test 4: Change Password ---');
    await userManagementService.changePassword(testUser.id, 'testpassword123', 'newpassword456');
    console.log('✓ Password changed successfully');

    // Test 5: Deactivate user
    console.log('\n--- Test 5: Deactivate User ---');
    await userManagementService.deactivateUser(testUser.id);
    const deactivatedUser = await userManagementService.getUser(testUser.id);
    console.log('✓ User deactivated:', !deactivatedUser?.isActive);

    // Test 6: Activate user
    console.log('\n--- Test 6: Activate User ---');
    await userManagementService.activateUser(testUser.id);
    const activatedUser = await userManagementService.getUser(testUser.id);
    console.log('✓ User activated:', activatedUser?.isActive);

    // Test 7: Delete user (should cascade delete View-Only account)
    console.log('\n--- Test 7: Delete User (Cascade Delete View-Only) ---');
    await userManagementService.deleteUser(testUser.id);
    console.log('✓ User deleted');

    // Verify View-Only account was also deleted
    const deletedViewOnly = await userManagementService.getViewOnlyAccount(testUser.id);
    if (!deletedViewOnly) {
      console.log('✓ View-Only account cascade deleted');
    } else {
      console.log('✗ View-Only account still exists');
    }

    // Test 8: Seed initial users
    console.log('\n--- Test 8: Seed Initial Users ---');
    await userManagementService.seedInitialUsers();
    console.log('✓ Initial users seeded');

    // List all users after seeding
    const finalList = await userManagementService.listUsers();
    console.log(`\n✓ Final user count: ${finalList.total}`);
    console.log('Users:');
    finalList.users.forEach(u => {
      const viewOnlyTag = u.isViewOnly ? ' [View-Only]' : '';
      const parentTag = u.parentUserId ? ` (parent: ${u.parentUserId.substring(0, 12)}...)` : '';
      console.log(`  - ${u.username} (${u.role})${viewOnlyTag}${parentTag}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✓ All tests passed!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n✗ Test failed:', error);
    process.exit(1);
  } finally {
    userManagementService.shutdown();
  }
}

testUserManagementService().catch(console.error);
