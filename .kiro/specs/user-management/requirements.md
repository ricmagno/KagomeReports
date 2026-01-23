# User Management System - Requirements

## Overview

A comprehensive user management system with role-based access control (RBAC) for the Historian Reports application. The system supports three user levels with different permissions and includes auto-login functionality per machine.

## User Stories

### 1. User Roles and Permissions

**1.1 Administrator Role**
- As an administrator, I can access all application features
- As an administrator, I can create, edit, and delete user accounts
- As an administrator, I can assign user roles (Administrator, User, View-Only)
- As an administrator, I can configure auto-login settings per machine
- As an administrator, I can view audit logs of user activities

**1.2 User Role**
- As a user, I can access all report functions (create, edit, run, schedule)
- As a user, I cannot access user management functions
- As a user, I have an associated view-only account automatically created
- As a user, I can change my own password

**1.3 View-Only Role**
- As a view-only user, I can run existing reports
- As a view-only user, I cannot create or modify reports
- As a view-only user, I cannot access user management
- As a view-only user, I cannot access scheduled reports
- As a view-only user, I can view report history

### 2. User Management Interface

**2.1 User List**
- As an administrator, I can view a list of all users
- As an administrator, I can filter users by role
- As an administrator, I can search users by username
- As an administrator, I can see user status (active/inactive)
- As an administrator, I can see last login time

**2.2 User Creation**
- As an administrator, I can create new user accounts
- As an administrator, when I create a User-level account, a View-Only account is automatically created
- As an administrator, I can set initial passwords
- As an administrator, I can require password change on first login

**2.3 User Editing**
- As an administrator, I can edit user details
- As an administrator, I can change user roles
- As an administrator, I can reset user passwords
- As an administrator, I can activate/deactivate users

**2.4 User Deletion**
- As an administrator, I can delete user accounts
- As an administrator, when I delete a User-level account, the associated View-Only account is also deleted
- As an administrator, I receive confirmation before deletion

### 3. Auto-Login Functionality

**3.1 Machine-Based Auto-Login**
- As an administrator, I can enable auto-login for specific users on specific machines
- As an administrator, I can configure which machine(s) a user can auto-login from
- As a user with auto-login enabled, I am automatically logged in when accessing from an authorized machine
- As a user, I can see if auto-login is enabled for my account

**3.2 Machine Identification**
- The system identifies machines using browser fingerprinting
- The system stores machine identifiers securely
- The system validates machine identity on each login attempt

### 4. Security Requirements

**4.1 Password Security**
- Passwords must be hashed using bcrypt
- Passwords must meet minimum complexity requirements
- Passwords must be at least 8 characters long
- Failed login attempts are logged

**4.2 Session Management**
- JWT tokens are used for authentication
- Tokens expire after configurable period (default 8 hours)
- Refresh tokens are supported for extended sessions
- Sessions are invalidated on logout

**4.3 Audit Logging**
- All user management actions are logged
- Login attempts (successful and failed) are logged
- Password changes are logged
- Role changes are logged

## Initial Users

The system must be seeded with the following users:

### Administrator
- Username: `Scada.sa`
- Password: `1z))(+9mmBe5L8QV`
- Role: Administrator

### User-Level Users (with auto-created View-Only accounts)

1. **Operator**
   - Username: `Operator`
   - Password: `operator`
   - Role: User
   - View-Only Account: `Operator.view` (auto-created)

2. **Quality**
   - Username: `Quality`
   - Password: `quality`
   - Role: User
   - View-Only Account: `Quality.view` (auto-created)

3. **Supervisor**
   - Username: `Supervisor`
   - Password: `supervisor`
   - Role: User
   - View-Only Account: `Supervisor.view` (auto-created)

## Acceptance Criteria

### AC 1: Role-Based Access Control
- Given I am logged in as an administrator, when I access any feature, then I have full access
- Given I am logged in as a user, when I try to access user management, then I am denied access
- Given I am logged in as view-only, when I try to create a report, then I am denied access

### AC 2: User Creation with View-Only Account
- Given I am an administrator creating a User-level account, when I save the user, then a View-Only account is automatically created with username `{username}.view`
- Given a User-level account is created, when I check the user list, then I see both the User and View-Only accounts

### AC 3: User Management Interface
- Given I am an administrator, when I access the user management page, then I see a list of all users with their roles and status
- Given I am an administrator, when I create a new user, then the user is added to the database with hashed password
- Given I am an administrator, when I delete a User-level account, then the associated View-Only account is also deleted

### AC 4: Auto-Login Configuration
- Given I am an administrator, when I enable auto-login for a user on a specific machine, then the configuration is saved
- Given a user has auto-login enabled, when they access from the authorized machine, then they are automatically logged in
- Given a user has auto-login enabled, when they access from a different machine, then they must login manually

### AC 5: Password Security
- Given I am creating a user, when I set a password, then it is hashed using bcrypt before storage
- Given I am a user, when I login with correct credentials, then I receive a JWT token
- Given I am a user, when I login with incorrect credentials, then the attempt is logged and I receive an error

### AC 6: Navigation and UI
- Given I am an administrator, when I view the navigation menu, then I see a "User Management" option
- Given I am a user or view-only, when I view the navigation menu, then I do not see "User Management"
- Given I am on the user management page, when I click "Add User", then I see a user creation form

## Non-Functional Requirements

### Performance
- User list should load within 1 second for up to 1000 users
- Login authentication should complete within 500ms
- Password hashing should use appropriate work factor (10-12 rounds)

### Security
- All passwords must be hashed with bcrypt
- JWT tokens must be signed with secure secret
- Auto-login tokens must be cryptographically secure
- Session tokens must be stored securely (httpOnly cookies)

### Usability
- User management interface must be intuitive and accessible
- Error messages must be clear and actionable
- Forms must have proper validation with helpful feedback

### Compatibility
- Must work in all modern browsers (Chrome, Firefox, Safari, Edge)
- Must be responsive for different screen sizes
- Must support keyboard navigation

## Dependencies

- Existing authentication system (JWT-based)
- SQLite database for user storage
- bcrypt for password hashing
- React frontend with TypeScript
- Express backend with TypeScript

## Out of Scope

- LDAP/Active Directory integration
- Two-factor authentication (future enhancement)
- Password recovery via email (future enhancement)
- User groups/teams (future enhancement)
- Detailed permission granularity beyond three roles
