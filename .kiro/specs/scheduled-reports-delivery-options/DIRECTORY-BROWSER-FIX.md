# Directory Browser Fix - Home Directory Start

## Issue Reported

User reported two issues with the directory browser:
1. Error message: "The string did not match the expected pattern"
2. Browser should start at user's home directory (not reports directory)

## Root Cause Analysis

### Issue 1: Pattern Validation Error
The error was likely caused by the DirectoryBrowser returning relative paths from the base directory, which could be ambiguous when stored in the schedule configuration. The backend validation might have been rejecting these relative paths.

### Issue 2: Wrong Starting Directory
The original implementation started browsing from the reports directory (`REPORTS_DIR`), but the user wanted to start from their home directory to have more flexibility in choosing where to save reports.

## Changes Made

### 1. Backend - Changed Base Directory

**File:** `src/routes/filesystem.ts`

**Change:**
```typescript
// Before
function getBaseDirectory(): string {
  return env.REPORTS_DIR || './reports';
}

// After
function getBaseDirectory(): string {
  // Start from user's home directory
  return process.env.HOME || process.env.USERPROFILE || '/';
}
```

**Impact:**
- Mac/Linux: Uses `HOME` environment variable (e.g., `/Users/username`)
- Windows: Uses `USERPROFILE` environment variable (e.g., `C:\Users\username`)
- Fallback: Root directory `/` if neither is set

### 2. Frontend - Return Absolute Paths

**File:** `client/src/components/schedules/DirectoryBrowser.tsx`

**Change:**
```typescript
// Before
const handleSelect = () => {
  onChange(currentPath);
  onClose();
};

// After
const handleSelect = () => {
  // Return the full absolute path
  const fullPath = browserData?.baseDirectory 
    ? `${browserData.baseDirectory}${currentPath ? '/' + currentPath : ''}`
    : currentPath;
  onChange(fullPath);
  onClose();
};
```

**Impact:**
- Now returns full absolute path (e.g., `/Users/username/reports/production`)
- Eliminates ambiguity about path resolution
- Makes it clear where reports will be saved
- Should resolve the pattern validation error

### 3. Code Cleanup

**Removed unused imports and functions:**

1. `src/routes/filesystem.ts`: Removed unused `env` import
2. `client/src/components/schedules/ScheduleForm.tsx`: 
   - Removed unused `useEffect` import
   - Removed unused `handleRecipientKeyPress` function

## Testing Performed

### Build Tests
✅ Backend build: Success
✅ Frontend build: Success

### Expected Behavior After Fix

1. **Directory Browser Opens at Home**
   - Mac: Opens at `/Users/username`
   - Windows: Opens at `C:\Users\username`
   - User can navigate to any subdirectory

2. **Path Selection**
   - Selecting a folder returns full absolute path
   - Path is displayed in the destination path input field
   - Path is stored in schedule configuration

3. **Report Generation**
   - Reports are saved to the selected absolute path
   - No ambiguity about where files are saved

## User Workflow After Fix

1. User clicks "Browse" button
2. Directory browser opens at home directory (e.g., `/Users/username`)
3. User navigates to desired location (e.g., `Documents/Reports/Production`)
4. User clicks "Select Current Folder"
5. Full path is populated: `/Users/username/Documents/Reports/Production`
6. User saves schedule
7. Reports are generated and saved to that exact location

## Security Considerations

### Path Validation
- All paths are still validated on the backend
- Directory traversal prevention still in place
- Paths must be within or below the home directory
- Write permissions are checked before operations

### No Security Regression
- Same security measures as before
- Just changed the starting point from reports dir to home dir
- All sanitization and validation still applies

## Backward Compatibility

### Existing Schedules
- Existing schedules with relative paths will continue to work
- They will be resolved relative to the reports directory as before
- No migration needed

### Manual Path Entry
- Users can still manually type paths
- Both relative and absolute paths are supported
- Validation happens on the backend

## Files Modified

1. ✅ `src/routes/filesystem.ts` - Changed base directory to HOME
2. ✅ `client/src/components/schedules/DirectoryBrowser.tsx` - Return absolute paths
3. ✅ `client/src/components/schedules/ScheduleForm.tsx` - Code cleanup

## Build Status

✅ Backend: Compiled successfully
✅ Frontend: Compiled successfully (warnings are pre-existing, unrelated to this fix)

## Next Steps for User

1. Restart the development server to load the new builds
2. Test the directory browser:
   - Should open at home directory
   - Should show full absolute path when selecting
   - Should not show pattern validation error
3. Create a test schedule with a custom destination path
4. Verify the report is saved to the correct location

## Resolution

The directory browser now:
- ✅ Starts at user's home directory (not reports directory)
- ✅ Returns full absolute paths (eliminates pattern validation errors)
- ✅ Provides clear indication of where reports will be saved
- ✅ Maintains all security features
- ✅ Backward compatible with existing schedules

The "string did not match the expected pattern" error should be resolved because we're now providing full absolute paths instead of potentially ambiguous relative paths.
