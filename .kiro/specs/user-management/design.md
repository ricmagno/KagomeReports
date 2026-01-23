# User Management System - Design Document

## Overview

This design document describes the implementation of a comprehensive user management system with role-based access control (RBAC) for the Historian Reports application. The system extends the existing JWT-based authentication to support three user roles (Administrator, User, View-Only) with automatic View-Only account creation, machine-based auto-login functionality, and a complete user management interface.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ User Mgmt UI │  │ Login Page   │  │ Navigation   │      │
│  │              │  │              │  │ (Role-based) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ REST API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Express)                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Auth Routes  │  │ User Routes  │  │ Auth         │      │
│  │              │  │              │  │ Middleware   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Auth Service │  │ User Mgmt    │  │ Auto-Login   │      │
│  │ (existing)   │  │ Service      │  │ Service      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ Fingerprint  │  │ Audit        │                        │
│  │ Service      │  │ Service      │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                SQLite Database (auth.db)                     │
├─────────────────────────────────────────────────────────────┤
│  • users                                                     │
│  • user_sessions                                             │
│  • role_permissions (extended)                               │
│  • audit_logs                                                │
│  • auto_login_machines (new)                                 │
│  • machine_fingerprints (new)                                │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Login Flow**:
   - User accesses application → Frontend checks for auto-login token
   - If auto-login enabled: Validate machine fingerprint → Auto-authenticate
   - If manual login: Submit credentials → Backend validates → Generate JWT → Return token
   - Frontend stores token → Include in subsequent API requests

2. **User Management Flow**:
   - Admin accesses User Management UI → Fetch user list
   - Admin creates/edits user → Backend validates permissions → Update database
   - If creating User role → Automatically create View-Only account
   - If deleting User role → Cascade delete View-Only account

3. **Authorization Flow**:
   - API request with JWT → Auth middleware validates token
   - Extract user role → Check permissions for requested resource/action
   - Allow/deny based on role permissions

## Components and Interfaces

### 1. Database Schema Extensions

#### Extended Users Table
```sql
-- Extend existing users table with new columns
ALTER TABLE users ADD COLUMN parent_user_id TEXT;
ALTER TABLE users ADD COLUMN is_view_only BOOLEAN DEFAULT 0;
ALTER TABLE users ADD COLUMN auto_login_enabled BOOLEAN DEFAULT 0;

-- Add foreign key constraint
-- parent_user_id references users(id) for View-Only accounts
```

#### Auto-Login Machines Table
```sql
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
);

CREATE INDEX idx_auto_login_fingerprint ON auto_login_machines(machine_fingerprint);
CREATE INDEX idx_auto_login_user ON auto_login_machines(user_id);
```

#### Machine Fingerprints Table
```sql
CREATE TABLE machine_fingerprints (
  id TEXT PRIMARY KEY,
  fingerprint_hash TEXT UNIQUE NOT NULL,
  fingerprint_data TEXT NOT NULL, -- Encrypted JSON
  first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  seen_count INTEGER DEFAULT 1
);

CREATE INDEX idx_fingerprint_hash ON machine_fingerprints(fingerprint_hash);
```

#### Extended Role Permissions
```sql
-- Add View-Only role permissions
INSERT INTO role_permissions (id, role, resource, action, granted) VALUES
  ('perm_view-only_reports_read', 'view-only', 'reports', 'read', 1),
  ('perm_view-only_reports_run', 'view-only', 'reports', 'run', 1);
```

### 2. Backend Services

#### UserManagementService

```typescript
interface UserManagementService {
  // User CRUD operations
  createUser(userData: CreateUserRequest): Promise<UserResponse>;
  updateUser(userId: string, userData: UpdateUserRequest): Promise<UserResponse>;
  deleteUser(userId: string): Promise<void>;
  getUser(userId: string): Promise<UserResponse>;
  listUsers(filters?: UserFilters): Promise<UserListResponse>;
  
  // View-Only account management
  createViewOnlyAccount(parentUserId: string): Promise<UserResponse>;
  getViewOnlyAccount(parentUserId: string): Promise<UserResponse | null>;
  
  // Password management
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>;
  resetPassword(userId: string, newPassword: string): Promise<void>;
  
  // User activation
  activateUser(userId: string): Promise<void>;
  deactivateUser(userId: string): Promise<void>;
  
  // Seed initial users
  seedInitialUsers(): Promise<void>;
}

interface CreateUserRequest {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: 'admin' | 'user' | 'view-only';
  requirePasswordChange?: boolean;
}

interface UpdateUserRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: 'admin' | 'user' | 'view-only';
  isActive?: boolean;
}

interface UserResponse {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user' | 'view-only';
  isActive: boolean;
  isViewOnly: boolean;
  parentUserId?: string;
  autoLoginEnabled: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface UserFilters {
  role?: 'admin' | 'user' | 'view-only';
  isActive?: boolean;
  search?: string; // Search by username or email
}

interface UserListResponse {
  users: UserResponse[];
  total: number;
  page: number;
  pageSize: number;
}
```

#### AutoLoginService

```typescript
interface AutoLoginService {
  // Machine fingerprint management
  generateFingerprint(request: FingerprintData): Promise<string>;
  validateFingerprint(fingerprint: string, storedHash: string): Promise<boolean>;
  
  // Auto-login configuration
  enableAutoLogin(userId: string, machineFingerprint: string, machineName?: string): Promise<void>;
  disableAutoLogin(userId: string, machineFingerprint: string): Promise<void>;
  isAutoLoginEnabled(userId: string, machineFingerprint: string): Promise<boolean>;
  
  // Auto-login token management
  generateAutoLoginToken(userId: string, machineFingerprint: string): Promise<string>;
  validateAutoLoginToken(token: string, machineFingerprint: string): Promise<AuthResult>;
  
  // Machine management
  getUserMachines(userId: string): Promise<MachineInfo[]>;
  removeMachine(userId: string, machineId: string): Promise<void>;
}

interface FingerprintData {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  hardwareConcurrency: number;
  deviceMemory?: number;
  colorDepth: number;
  pixelRatio: number;
  plugins: string[];
  canvas?: string; // Canvas fingerprint
  webgl?: string; // WebGL fingerprint
}

interface MachineInfo {
  id: string;
  machineName?: string;
  fingerprint: string;
  enabled: boolean;
  lastUsed?: Date;
  createdAt: Date;
}
```

#### FingerprintService

```typescript
interface FingerprintService {
  // Generate fingerprint hash from browser data
  generateHash(data: FingerprintData): string;
  
  // Store fingerprint
  storeFingerprint(fingerprintHash: string, data: FingerprintData): Promise<void>;
  
  // Validate fingerprint
  validateFingerprint(fingerprintHash: string): Promise<boolean>;
  
  // Get fingerprint info
  getFingerprintInfo(fingerprintHash: string): Promise<FingerprintInfo | null>;
}

interface FingerprintInfo {
  id: string;
  hash: string;
  firstSeen: Date;
  lastSeen: Date;
  seenCount: number;
}
```

### 3. API Routes

#### User Management Routes (`/api/users`)

```typescript
// List users (Admin only)
GET /api/users
Query params: role, isActive, search, page, pageSize
Response: UserListResponse

// Get user by ID (Admin only)
GET /api/users/:userId
Response: UserResponse

// Create user (Admin only)
POST /api/users
Body: CreateUserRequest
Response: UserResponse

// Update user (Admin only)
PUT /api/users/:userId
Body: UpdateUserRequest
Response: UserResponse

// Delete user (Admin only)
DELETE /api/users/:userId
Response: { success: boolean }

// Change own password (Any authenticated user)
POST /api/users/me/change-password
Body: { oldPassword: string, newPassword: string }
Response: { success: boolean }

// Reset user password (Admin only)
POST /api/users/:userId/reset-password
Body: { newPassword: string }
Response: { success: boolean }

// Get user's machines (Admin or own user)
GET /api/users/:userId/machines
Response: MachineInfo[]

// Remove machine (Admin or own user)
DELETE /api/users/:userId/machines/:machineId
Response: { success: boolean }
```

#### Auto-Login Routes (`/api/auth/auto-login`)

```typescript
// Check auto-login availability
POST /api/auth/auto-login/check
Body: { fingerprint: string }
Response: { available: boolean, userId?: string }

// Enable auto-login (Admin only)
POST /api/auth/auto-login/enable
Body: { userId: string, fingerprint: string, machineName?: string }
Response: { success: boolean }

// Disable auto-login (Admin or own user)
POST /api/auth/auto-login/disable
Body: { userId: string, fingerprint: string }
Response: { success: boolean }

// Auto-login authentication
POST /api/auth/auto-login/authenticate
Body: { fingerprint: string }
Response: AuthResult
```

### 4. Frontend Components

#### User Management Page (`UserManagement.tsx`)

```typescript
interface UserManagementProps {}

const UserManagement: React.FC<UserManagementProps> = () => {
  // State management
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [filters, setFilters] = useState<UserFilters>({});
  const [selectedUser, setSelectedUser] = useState<UserResponse | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Handlers
  const handleCreateUser = async (userData: CreateUserRequest) => { /* ... */ };
  const handleUpdateUser = async (userId: string, userData: UpdateUserRequest) => { /* ... */ };
  const handleDeleteUser = async (userId: string) => { /* ... */ };
  const handleFilterChange = (newFilters: UserFilters) => { /* ... */ };
  
  return (
    <div className="user-management">
      <UserManagementHeader onCreateClick={() => setShowCreateModal(true)} />
      <UserFilters filters={filters} onChange={handleFilterChange} />
      <UserTable 
        users={users}
        onEdit={setSelectedUser}
        onDelete={handleDeleteUser}
      />
      {showCreateModal && <CreateUserModal onClose={() => setShowCreateModal(false)} onCreate={handleCreateUser} />}
      {showEditModal && selectedUser && <EditUserModal user={selectedUser} onClose={() => setShowEditModal(false)} onUpdate={handleUpdateUser} />}
    </div>
  );
};
```

#### User Table Component (`UserTable.tsx`)

```typescript
interface UserTableProps {
  users: UserResponse[];
  onEdit: (user: UserResponse) => void;
  onDelete: (userId: string) => void;
}

const UserTable: React.FC<UserTableProps> = ({ users, onEdit, onDelete }) => {
  return (
    <table className="user-table">
      <thead>
        <tr>
          <th>Username</th>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Status</th>
          <th>Last Login</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map(user => (
          <UserTableRow 
            key={user.id}
            user={user}
            onEdit={() => onEdit(user)}
            onDelete={() => onDelete(user.id)}
          />
        ))}
      </tbody>
    </table>
  );
};
```

#### Create/Edit User Modal (`UserModal.tsx`)

```typescript
interface UserModalProps {
  user?: UserResponse; // undefined for create, defined for edit
  onClose: () => void;
  onSave: (userData: CreateUserRequest | UpdateUserRequest) => Promise<void>;
}

const UserModal: React.FC<UserModalProps> = ({ user, onClose, onSave }) => {
  const [formData, setFormData] = useState<CreateUserRequest | UpdateUserRequest>(
    user || { username: '', email: '', firstName: '', lastName: '', password: '', role: 'user' }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate form
    const validationErrors = validateUserForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    await onSave(formData);
    onClose();
  };
  
  return (
    <Modal isOpen onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Input label="Username" value={formData.username} onChange={/* ... */} error={errors.username} disabled={!!user} />
        <Input label="Email" value={formData.email} onChange={/* ... */} error={errors.email} />
        <Input label="First Name" value={formData.firstName} onChange={/* ... */} error={errors.firstName} />
        <Input label="Last Name" value={formData.lastName} onChange={/* ... */} error={errors.lastName} />
        {!user && <Input label="Password" type="password" value={formData.password} onChange={/* ... */} error={errors.password} />}
        <Select label="Role" value={formData.role} onChange={/* ... */} options={roleOptions} />
        <Button type="submit">Save</Button>
        <Button type="button" onClick={onClose}>Cancel</Button>
      </form>
    </Modal>
  );
};
```

#### Auto-Login Settings Component (`AutoLoginSettings.tsx`)

```typescript
interface AutoLoginSettingsProps {
  userId: string;
}

const AutoLoginSettings: React.FC<AutoLoginSettingsProps> = ({ userId }) => {
  const [machines, setMachines] = useState<MachineInfo[]>([]);
  const [currentFingerprint, setCurrentFingerprint] = useState<string>('');
  
  useEffect(() => {
    // Generate current machine fingerprint
    generateFingerprint().then(setCurrentFingerprint);
    // Load user's machines
    loadUserMachines(userId).then(setMachines);
  }, [userId]);
  
  const handleEnableAutoLogin = async () => {
    await enableAutoLogin(userId, currentFingerprint);
    // Reload machines
    loadUserMachines(userId).then(setMachines);
  };
  
  const handleDisableAutoLogin = async (machineId: string) => {
    await disableAutoLogin(userId, machineId);
    // Reload machines
    loadUserMachines(userId).then(setMachines);
  };
  
  return (
    <div className="auto-login-settings">
      <h3>Auto-Login Machines</h3>
      <Button onClick={handleEnableAutoLogin}>Enable Auto-Login on This Machine</Button>
      <MachineList machines={machines} onRemove={handleDisableAutoLogin} />
    </div>
  );
};
```

#### Login Page Enhancement (`Login.tsx`)

```typescript
const Login: React.FC = () => {
  const [autoLoginChecked, setAutoLoginChecked] = useState(false);
  const [fingerprint, setFingerprint] = useState<string>('');
  
  useEffect(() => {
    // Generate fingerprint on mount
    generateFingerprint().then(async (fp) => {
      setFingerprint(fp);
      
      // Check if auto-login is available
      const result = await checkAutoLogin(fp);
      if (result.available && result.userId) {
        // Attempt auto-login
        const authResult = await autoLoginAuthenticate(fp);
        if (authResult.success) {
          // Redirect to dashboard
          navigate('/dashboard');
        }
      }
      
      setAutoLoginChecked(true);
    });
  }, []);
  
  if (!autoLoginChecked) {
    return <LoadingSpinner message="Checking auto-login..." />;
  }
  
  // Regular login form
  return (
    <div className="login-page">
      <LoginForm onSubmit={handleLogin} />
    </div>
  );
};
```

## Data Models

### User Model (Extended)

```typescript
interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user' | 'view-only';
  passwordHash: string;
  isActive: boolean;
  isViewOnly: boolean;
  parentUserId?: string; // For View-Only accounts
  autoLoginEnabled: boolean;
  requirePasswordChange: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Auto-Login Machine Model

```typescript
interface AutoLoginMachine {
  id: string;
  userId: string;
  machineFingerprint: string;
  machineName?: string;
  enabled: boolean;
  lastUsed?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Machine Fingerprint Model

```typescript
interface MachineFingerprint {
  id: string;
  fingerprintHash: string;
  fingerprintData: FingerprintData; // Encrypted
  firstSeen: Date;
  lastSeen: Date;
  seenCount: number;
}
```

### Role Permission Model (Extended)

```typescript
interface RolePermission {
  id: string;
  role: 'admin' | 'user' | 'view-only';
  resource: string; // 'reports', 'schedules', 'users', 'system'
  action: string; // 'read', 'write', 'delete', 'run'
  granted: boolean;
  createdAt: Date;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Administrator Full Access
*For any* resource and action in the system, when an administrator attempts to access it, the system should grant access.
**Validates: Requirements AC 1.1**

### Property 2: View-Only Account Auto-Creation
*For any* User-level account creation, the system should automatically create a corresponding View-Only account with username `{username}.view` and link it to the parent user.
**Validates: Requirements AC 2.1, AC 2.2**

### Property 3: User List Completeness
*For any* set of created users, when an administrator fetches the user list, all users should be present with their correct roles, status, and metadata.
**Validates: Requirements AC 3.1**

### Property 4: Password Hashing
*For any* user creation or password change, the stored password should be a valid bcrypt hash and not the plaintext password.
**Validates: Requirements AC 3.2, AC 5.1**

### Property 5: Cascade Delete View-Only Accounts
*For any* User-level account deletion, the associated View-Only account (if it exists) should also be deleted from the database.
**Validates: Requirements AC 3.3**

### Property 6: Auto-Login Configuration Persistence
*For any* user and machine fingerprint combination, when auto-login is enabled, the configuration should be stored and retrievable from the database.
**Validates: Requirements AC 4.1**

### Property 7: Auto-Login Authentication Success
*For any* user with auto-login enabled on a specific machine, when accessing from that machine's fingerprint, authentication should succeed without requiring credentials.
**Validates: Requirements AC 4.2**

### Property 8: Auto-Login Machine Restriction
*For any* user with auto-login enabled on specific machines, when accessing from a different machine fingerprint, auto-login should fail and require manual authentication.
**Validates: Requirements AC 4.3**

### Property 9: JWT Token Generation
*For any* valid user credentials, when authentication succeeds, the system should return a valid JWT token that can be verified and contains the correct user information.
**Validates: Requirements AC 5.2**

### Property 10: Failed Login Audit
*For any* failed login attempt, the system should log the attempt in the audit log with relevant details (username, timestamp, reason).
**Validates: Requirements AC 5.3**

### Property 11: Role-Based Navigation
*For any* user role, the navigation menu should only display options that the role has permission to access (e.g., User Management only for administrators).
**Validates: Requirements AC 6.1, AC 6.2**

## Error Handling

### Validation Errors

1. **User Creation Validation**:
   - Username must be unique and 3-50 characters
   - Email must be valid format and unique
   - Password must meet complexity requirements (min 8 chars, mix of letters/numbers)
   - Role must be one of: admin, user, view-only
   - Error response: `{ error: 'Validation failed', details: { field: 'message' } }`

2. **User Update Validation**:
   - Cannot change username (immutable)
   - Email must be valid format if provided
   - Role changes must not orphan View-Only accounts
   - Error response: `{ error: 'Validation failed', details: { field: 'message' } }`

3. **Password Validation**:
   - Minimum 8 characters
   - Must contain at least one letter and one number
   - Cannot be same as username
   - Error response: `{ error: 'Password does not meet requirements' }`

### Authorization Errors

1. **Insufficient Permissions**:
   - HTTP 403 Forbidden
   - Response: `{ error: 'Insufficient permissions', required: 'admin' }`

2. **Invalid Token**:
   - HTTP 401 Unauthorized
   - Response: `{ error: 'Invalid or expired token' }`

3. **User Not Found**:
   - HTTP 404 Not Found
   - Response: `{ error: 'User not found', userId: 'xxx' }`

### Business Logic Errors

1. **Cannot Delete Own Account**:
   - HTTP 400 Bad Request
   - Response: `{ error: 'Cannot delete your own account' }`

2. **Cannot Delete Last Administrator**:
   - HTTP 400 Bad Request
   - Response: `{ error: 'Cannot delete the last administrator account' }`

3. **View-Only Account Conflict**:
   - HTTP 409 Conflict
   - Response: `{ error: 'View-Only account already exists', username: 'xxx.view' }`

4. **Auto-Login Already Enabled**:
   - HTTP 409 Conflict
   - Response: `{ error: 'Auto-login already enabled for this machine' }`

### Database Errors

1. **Connection Failure**:
   - HTTP 503 Service Unavailable
   - Response: `{ error: 'Database connection failed', retry: true }`

2. **Constraint Violation**:
   - HTTP 409 Conflict
   - Response: `{ error: 'Database constraint violation', details: 'xxx' }`

### Error Logging

All errors should be logged with appropriate context:
```typescript
apiLogger.error('User creation failed', {
  error: err.message,
  username: userData.username,
  role: userData.role,
  timestamp: new Date().toISOString()
});
```

## Testing Strategy

### Dual Testing Approach

The User Management System will be validated using both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests**: Focus on specific examples, edge cases, and error conditions
- Specific user creation scenarios
- Password validation edge cases
- Role permission checks for known resources
- UI component rendering with specific props
- Error handling for known failure modes

**Property-Based Tests**: Verify universal properties across all inputs
- User creation with random valid data
- Password hashing for any password input
- Role-based access control for any resource/action combination
- Auto-login functionality with random fingerprints
- Cascade deletion with random user hierarchies

### Property-Based Testing Configuration

**Testing Library**: fast-check (JavaScript/TypeScript property-based testing library)

**Test Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with feature name and property number
- Tag format: `Feature: user-management, Property {N}: {property description}`

**Example Property Test Structure**:
```typescript
import fc from 'fast-check';

describe('Feature: user-management, Property 2: View-Only Account Auto-Creation', () => {
  it('should create View-Only account for any User-level account', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          username: fc.string({ minLength: 3, maxLength: 50 }),
          email: fc.emailAddress(),
          firstName: fc.string({ minLength: 1, maxLength: 50 }),
          lastName: fc.string({ minLength: 1, maxLength: 50 }),
          password: fc.string({ minLength: 8, maxLength: 100 })
        }),
        async (userData) => {
          // Create User-level account
          const user = await userManagementService.createUser({
            ...userData,
            role: 'user'
          });
          
          // Verify View-Only account exists
          const viewOnlyAccount = await userManagementService.getViewOnlyAccount(user.id);
          
          expect(viewOnlyAccount).toBeDefined();
          expect(viewOnlyAccount?.username).toBe(`${userData.username}.view`);
          expect(viewOnlyAccount?.role).toBe('view-only');
          expect(viewOnlyAccount?.parentUserId).toBe(user.id);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Unit Test Coverage

**Backend Services**:
- UserManagementService: CRUD operations, validation, View-Only account management
- AutoLoginService: Fingerprint generation, validation, token management
- FingerprintService: Hash generation, storage, validation
- AuthService extensions: Role-based permissions, audit logging

**API Routes**:
- User management endpoints: Authorization, request validation, response format
- Auto-login endpoints: Fingerprint validation, token generation
- Error handling middleware: Proper error responses

**Frontend Components**:
- UserManagement page: User list rendering, filtering, pagination
- UserTable: Sorting, row actions, status display
- UserModal: Form validation, submission, error display
- AutoLoginSettings: Machine list, enable/disable actions
- Login page: Auto-login check, manual login fallback

### Integration Tests

**End-to-End Flows**:
1. Complete user creation flow (Admin creates User → View-Only auto-created)
2. User deletion flow (Delete User → View-Only cascade deleted)
3. Auto-login flow (Enable → Authenticate → Validate)
4. Role-based access flow (Different roles → Different permissions)
5. Password change flow (Old password validation → New password hashing)

### Manual Testing Checklist

**User Management**:
- [ ] Create administrator account
- [ ] Create user account (verify View-Only auto-created)
- [ ] Create view-only account directly
- [ ] Edit user details
- [ ] Change user role
- [ ] Delete user (verify View-Only cascade deleted)
- [ ] Filter users by role
- [ ] Search users by username/email

**Auto-Login**:
- [ ] Enable auto-login on current machine
- [ ] Verify auto-login works on refresh
- [ ] Verify auto-login fails on different browser
- [ ] Disable auto-login
- [ ] Verify manual login required after disable

**Role-Based Access**:
- [ ] Login as admin → Access all features
- [ ] Login as user → Cannot access user management
- [ ] Login as view-only → Cannot create/edit reports
- [ ] Verify navigation menu shows correct options per role

**Security**:
- [ ] Verify passwords are hashed in database
- [ ] Verify JWT tokens expire correctly
- [ ] Verify audit logs capture all actions
- [ ] Verify failed login attempts are logged

## Implementation Notes

### Database Migration

The existing `auth.db` database will need to be migrated to add new columns and tables:

```typescript
// Migration script
async function migrateDatabase() {
  // Add new columns to users table
  await db.run('ALTER TABLE users ADD COLUMN parent_user_id TEXT');
  await db.run('ALTER TABLE users ADD COLUMN is_view_only BOOLEAN DEFAULT 0');
  await db.run('ALTER TABLE users ADD COLUMN auto_login_enabled BOOLEAN DEFAULT 0');
  await db.run('ALTER TABLE users ADD COLUMN require_password_change BOOLEAN DEFAULT 0');
  
  // Create new tables
  await db.run(/* auto_login_machines table */);
  await db.run(/* machine_fingerprints table */);
  
  // Add View-Only role permissions
  await db.run(/* INSERT role_permissions */);
  
  // Update existing role column to support 'view-only'
  // (SQLite doesn't support ALTER COLUMN, so this is already flexible)
}
```

### Initial User Seeding

The system should seed initial users on first run:

```typescript
async function seedInitialUsers() {
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
    const exists = await checkUserExists(userData.username);
    if (!exists) {
      await userManagementService.createUser(userData);
      // View-Only accounts will be auto-created for User-level accounts
    }
  }
}
```

### Browser Fingerprinting

The fingerprinting implementation should use multiple data points for uniqueness:

```typescript
async function generateFingerprint(): Promise<string> {
  const data: FingerprintData = {
    userAgent: navigator.userAgent,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as any).deviceMemory,
    colorDepth: screen.colorDepth,
    pixelRatio: window.devicePixelRatio,
    plugins: Array.from(navigator.plugins).map(p => p.name),
    canvas: await generateCanvasFingerprint(),
    webgl: await generateWebGLFingerprint()
  };
  
  // Send to backend for hashing
  const response = await fetch('/api/auth/fingerprint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  const { fingerprint } = await response.json();
  return fingerprint;
}
```

### Security Considerations

1. **Fingerprint Storage**: Machine fingerprints should be hashed before storage
2. **Auto-Login Tokens**: Should be separate from regular JWT tokens with shorter expiry
3. **Audit Logging**: All user management actions must be logged
4. **Password Complexity**: Enforce minimum requirements (8 chars, letters + numbers)
5. **Rate Limiting**: Implement rate limiting on login endpoints to prevent brute force
6. **Session Management**: Auto-login sessions should have shorter expiry than manual login

### Performance Considerations

1. **User List Pagination**: Implement server-side pagination for large user lists
2. **Fingerprint Caching**: Cache fingerprint generation results in browser
3. **Database Indexing**: Add indexes on frequently queried columns (username, email, fingerprint_hash)
4. **Lazy Loading**: Load user details on-demand rather than fetching all data upfront

## Dependencies

### Existing Systems
- JWT authentication (src/services/authService.ts)
- SQLite database (data/auth.db)
- bcrypt password hashing
- Express middleware (src/middleware/auth.ts)
- React frontend with TypeScript

### New Dependencies
- **fast-check**: Property-based testing library
- **fingerprintjs2** or **@fingerprintjs/fingerprintjs**: Browser fingerprinting library
- **crypto**: Node.js crypto module for fingerprint hashing

### Frontend Dependencies
- React Router for navigation
- State management (React Context or existing solution)
- UI components (existing design system)
- Form validation library (e.g., react-hook-form, formik)

## Future Enhancements

The following features are out of scope for this implementation but may be added in future iterations:

1. **Two-Factor Authentication (2FA)**: Add TOTP-based 2FA for enhanced security
2. **LDAP/Active Directory Integration**: Support enterprise authentication systems
3. **Password Recovery**: Email-based password reset functionality
4. **User Groups/Teams**: Organize users into groups with shared permissions
5. **Granular Permissions**: More fine-grained permission control beyond three roles
6. **Session Management UI**: Allow users to view and revoke active sessions
7. **User Activity Dashboard**: Visualize user activity and login patterns
8. **Bulk User Operations**: Import/export users, bulk role changes
9. **Custom Role Creation**: Allow administrators to define custom roles
10. **Multi-Factor Machine Verification**: Additional verification for auto-login beyond fingerprinting
