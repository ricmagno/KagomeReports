# User Testing Guide: Schedule Update Fix

## Quick Start

The schedule update issue has been fixed. Follow these steps to verify the fix is working:

## Step 1: Rebuild and Start the Application

```bash
# Build backend and frontend
npm run build && npm run build:client

# Start the application
npm run start:dev
```

Wait for both servers to start:
- Backend: http://localhost:3000
- Frontend: http://localhost:3001

## Step 2: Test Schedule Update

### 2.1 Navigate to Schedules
1. Open your browser to http://localhost:3001
2. Click on "Schedules" in the navigation menu

### 2.2 Edit an Existing Schedule
1. Find any schedule in the list
2. Click the "Edit" button (pencil icon)
3. The schedule form should open with the current values

### 2.3 Make Changes
1. Change the **Schedule Name** (e.g., add " - Updated" to the end)
2. Change the **Description** (e.g., add " - Modified on [date]")
3. Optionally change other fields like:
   - Cron expression
   - Recipients
   - Enabled/Disabled status

### 2.4 Save Changes
1. Click the "Update Schedule" button
2. **Expected behavior**:
   - Loading spinner appears briefly
   - Success toast notification: "Schedule updated successfully"
   - Form closes automatically
   - You're returned to the schedule list

### 2.5 Verify Changes
1. Find the schedule you just updated in the list
2. **Verify**:
   - The name shows your new value
   - The description shows your new value
   - The "Updated" timestamp is recent
   - All other changes are reflected

### 2.6 Verify Persistence
1. Refresh the browser page (F5 or Cmd+R)
2. Navigate back to Schedules
3. **Verify**: Your changes are still there (not reverted)

## Step 3: Check Browser Console (Optional)

Open the browser's Developer Tools (F12) and check the Console tab. You should see logs like:

```
[SchedulesList] Updating schedule: schedule_xxx {...}
[SchedulesList] Update response: {success: true, data: {...}}
[SchedulesList] Fetching updated schedules...
[SchedulesList] Schedules refreshed
```

## Step 4: Verify Database (Optional)

If you want to verify the database directly:

```bash
sqlite3 data/scheduler.db "SELECT id, name, description, updated_at FROM schedules;"
```

You should see your updated values and a recent `updated_at` timestamp.

## What Was Fixed

### Issue 1: Update Persistence
When updating a schedule, changes appeared to save but were not persisted to the database.

**Root Causes**:
1. **Browser caching** - GET requests were being cached
2. **TypeScript error** - Compilation issue in update method
3. **Async handling** - Missing await on data refresh
4. **React Hooks** - Violations in chart components

### Issue 2: Validation Error
When updating a schedule, the backend rejected the update with: "Array must contain at least 1 element(s) at path ["reportConfig","tags"]"

**Root Cause**:
The form tried to match the schedule's report config with saved reports, but if no match was found, it would send an empty tags array.

**Fix**:
- Form now uses the schedule's existing report config when editing
- Only changes report config if user explicitly selects a different one
- Current report config appears in dropdown even if not in saved reports list

### Fixes Applied
1. ✅ Added cache-busting headers to prevent stale data
2. ✅ Fixed TypeScript compilation errors
3. ✅ Improved async/await handling
4. ✅ Fixed React Hooks violations
5. ✅ Enhanced logging for debugging
6. ✅ Fixed report config selection logic
7. ✅ Improved validation schema

## Troubleshooting

### Issue: Changes don't appear after update

**Check**:
1. Open browser console - look for error messages
2. Check Network tab - verify PUT request returns 200 OK
3. Check if subsequent GET request returns updated data
4. Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

**Solution**:
- Clear browser cache
- Try in incognito/private window
- Check backend logs in `logs/app.log`

### Issue: Form doesn't close after update

**Check**:
1. Browser console for JavaScript errors
2. Network tab for failed API requests

**Solution**:
- Check if success toast appears
- Verify API response is successful
- Check backend logs for errors

### Issue: "Schedule not found" error

**Check**:
1. Verify schedule still exists in database
2. Check if schedule ID is correct

**Solution**:
- Refresh the schedule list
- Try editing a different schedule

## Backend Testing (Advanced)

If you want to test the backend directly:

```bash
npx tsx scripts/test-schedule-update.ts
```

**Expected output**:
```
✅ Update test PASSED - All fields updated correctly
```

## Success Criteria

The fix is working correctly if:
- ✅ You can edit a schedule
- ✅ Changes are saved when you click "Update Schedule"
- ✅ Success toast appears
- ✅ Form closes automatically
- ✅ Updated schedule appears in the list with new values
- ✅ Changes persist after page refresh
- ✅ No errors in browser console
- ✅ Database shows updated values

## Need Help?

If you encounter any issues:

1. **Check the logs**:
   - Browser console (F12)
   - Backend logs: `logs/app.log`

2. **Verify the fix is applied**:
   ```bash
   git log --oneline -5
   ```
   Should show recent commits for the fix

3. **Rebuild everything**:
   ```bash
   npm run build && npm run build:client
   ```

4. **Check documentation**:
   - `BUG-FIX-UPDATE-PERSISTENCE.md` - Detailed fix documentation
   - `TASK-15-FINAL-SUMMARY.md` - Complete summary

## Date
January 17, 2026

---

**Status**: Ready for Testing
**Priority**: High
**Estimated Testing Time**: 5-10 minutes
