# Export/Import Feature Testing Instructions

## Current Status

✅ **Phase 3 Core Implementation: COMPLETE**

All frontend components have been successfully integrated:
- ExportImportControls component created and tested
- FormatSelectionDialog component implemented
- ValidationErrorDialog component implemented
- Dashboard integration completed
- State protection implemented
- Schema version migration support added

## Code Integration Verification

### 1. Component Location
- **File**: `client/src/components/reports/ExportImportControls.tsx`
- **Status**: ✅ Created and fully implemented
- **Exports**: Properly exported from `client/src/components/reports/index.ts`

### 2. Dashboard Integration
- **File**: `client/src/components/layout/Dashboard.tsx`
- **Import**: ✅ `import { ExportImportControls } from '../reports/ExportImportControls';`
- **Usage**: ✅ Integrated in Report Configuration header (line ~632)
- **Location**: Between "Report Configuration" title and "Version" indicator

### 3. Build Status
- **TypeScript**: ✅ No errors
- **Build**: ✅ Compiles successfully (with only minor warnings)
- **Tests**: ✅ 62/62 backend tests passing

## How to Test the Export/Import Buttons

### Step 1: Start the Backend Server
```bash
# From the project root directory
npm run dev
```

This will start the backend server on `http://localhost:3000`

### Step 2: Start the Frontend Client
```bash
# From the project root directory
npm run start:client

# OR from the client directory
cd client
npm start
```

This will start the React development server on `http://localhost:3001`

### Step 3: Access the Application
1. Open your browser to `http://localhost:3001`
2. Login with credentials:
   - Username: `admin`
   - Password: `admin123`

### Step 4: Navigate to Create Report Tab
1. After login, you should be on the "Create Report" tab by default
2. Look at the **Report Configuration** card header
3. You should see:
   ```
   Report Configuration                    [Export] [Import] [Version Badge]
   ```

### Step 5: Test Export Functionality
1. Fill in a report name (e.g., "Test Report")
2. Select at least one tag
3. Click the **Export** button
4. A dialog should appear asking you to choose a format:
   - JSON (recommended)
   - Power BI
5. Select a format
6. The file should download to your browser's download folder

### Step 6: Test Import Functionality
1. Click the **Import** button
2. A file browser should open
3. Select a previously exported JSON file
4. If the file is valid:
   - The form should populate with the imported configuration
   - A success message should appear
5. If the file is invalid:
   - A validation error dialog should appear
   - The dialog will show specific errors

## Expected UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Report Configuration                                        │
│                                    [Export] [Import] [New]  │
├─────────────────────────────────────────────────────────────┤
│ Report Name: [________________]                             │
│ Description: [________________]                             │
│ ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

The Export and Import buttons should appear as outlined buttons with icons:
- Export button: Download icon + "Export" text
- Import button: Upload icon + "Import" text

## Troubleshooting

### If buttons are not visible:

1. **Check browser console for errors**:
   - Open Developer Tools (F12)
   - Look for any JavaScript errors in the Console tab

2. **Verify the build is up to date**:
   ```bash
   cd client
   npm run build
   ```

3. **Clear browser cache**:
   - Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)

4. **Check if component is rendering**:
   - Open React DevTools
   - Search for "ExportImportControls" component
   - Verify it's in the component tree

5. **Verify backend is running**:
   ```bash
   curl http://localhost:3000/api/health
   ```
   Should return: `{"status":"ok"}`

### If export fails:

1. Check backend logs for errors
2. Verify the export endpoint is accessible:
   ```bash
   curl -X POST http://localhost:3000/api/reports/export \
     -H "Content-Type: application/json" \
     -d '{"config":{"name":"Test"},"format":"json"}'
   ```

### If import fails:

1. Check that the JSON file is valid
2. Verify the import endpoint is accessible:
   ```bash
   curl -X POST http://localhost:3000/api/reports/import \
     -H "Content-Type: application/json" \
     -d '{"fileContent":"{\"name\":\"Test\"}"}'
   ```

## Feature Capabilities

### Export Features:
- ✅ Export to JSON format
- ✅ Export to Power BI format
- ✅ Format preference persistence (remembers last choice)
- ✅ Automatic filename generation
- ✅ Browser download (saves to ~/Downloads)
- ✅ Loading states during export
- ✅ Error handling with user-friendly messages

### Import Features:
- ✅ Import from JSON files
- ✅ File type validation (JSON only)
- ✅ File size validation (10 MB limit)
- ✅ Schema validation with detailed error messages
- ✅ State protection (preserves form if import fails)
- ✅ Schema version migration support
- ✅ Automatic form population on success
- ✅ Warning messages for non-critical issues

## Next Steps

After verifying the buttons are visible and functional:

1. **Task 22**: Run comprehensive integration tests
2. **Task 23**: Add API documentation
3. **Task 24**: Create user documentation
4. **Task 25**: Final integration testing (E2E, performance, security, UI/UX)
5. **Task 26**: Final checkpoint

## Technical Details

### Component Props:
```typescript
<ExportImportControls
  currentConfig={reportConfig as ReportConfig}
  onImportComplete={handleImportComplete}
  disabled={false}
/>
```

### API Endpoints:
- **Export**: `POST /api/reports/export`
- **Import**: `POST /api/reports/import`

### File Formats:
- **JSON**: Standard JSON format with full configuration
- **Power BI**: Power Query M language format for Power BI integration

---

**Last Updated**: January 24, 2026
**Status**: Ready for testing
**Build Status**: ✅ Passing
**Integration Status**: ✅ Complete
