# Export/Import Buttons - UI Location Guide

## Visual Layout

The Export and Import buttons are located in the **Report Configuration** card header, positioned between the title and the version indicator.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Historian Reports                                    [Backend Status]│
└──────────────────────────────────────────────────────────────────────┘

┌─ Create Report ─┬─ My Reports ─┬─ Schedules ─┬─ Categories ─┬─ ... ─┐
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Report Configuration                                           │  │
│  │                                                                │  │
│  │                          ┌──────────┐ ┌──────────┐ ┌───────┐  │  │
│  │                          │ ⬇ Export │ │ ⬆ Import │ │  New  │  │  │
│  │                          └──────────┘ └──────────┘ └───────┘  │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │                                                                │  │
│  │  Report Name: [_____________________________________]          │  │
│  │                                                                │  │
│  │  Description: [_____________________________________]          │  │
│  │                                                                │  │
│  │  Time Range:  [Start Date/Time] to [End Date/Time]           │  │
│  │                                                                │  │
│  │  ...                                                           │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## Button Specifications

### Export Button
- **Icon**: Download icon (⬇)
- **Text**: "Export"
- **Style**: Outlined button (border, no fill)
- **Size**: Small (sm)
- **Color**: Gray border with gray text
- **Hover**: Darker gray background

### Import Button
- **Icon**: Upload icon (⬆)
- **Text**: "Import"
- **Style**: Outlined button (border, no fill)
- **Size**: Small (sm)
- **Color**: Gray border with gray text
- **Hover**: Darker gray background

### Version Indicator
- **Text**: "New" (for unsaved) or "Version X" (for saved)
- **Style**: Rounded pill badge
- **Color**: 
  - Green background for "New"
  - Blue background for "Version X"

## Code Location

### Dashboard Component
**File**: `client/src/components/layout/Dashboard.tsx`

**Line**: ~632

```tsx
<CardHeader>
  <div className="flex items-center justify-between">
    <h3 className="text-lg font-medium">Report Configuration</h3>
    <div className="flex items-center gap-3">
      {/* Export/Import Controls */}
      <ExportImportControls
        currentConfig={reportConfig as ReportConfig}
        onImportComplete={handleImportComplete}
        disabled={false}
      />
      {/* Version Indicator */}
      <div className={cn(
        "px-3 py-1 rounded-full text-sm font-medium",
        reportConfig.version
          ? "bg-blue-100 text-blue-800 border border-blue-200"
          : "bg-green-100 text-green-800 border border-green-200"
      )}>
        {reportConfig.version ? `Version ${reportConfig.version}` : 'New'}
      </div>
    </div>
  </div>
</CardHeader>
```

## Responsive Behavior

### Desktop (> 1024px)
- All three elements (Export, Import, Version) visible side-by-side
- Buttons show both icon and text

### Tablet (768px - 1024px)
- All three elements visible but with reduced spacing
- Buttons show both icon and text

### Mobile (< 768px)
- Elements may wrap to a second line if needed
- Buttons remain visible with icon and text

## Interaction States

### Export Button States
1. **Default**: Gray outlined button
2. **Hover**: Light gray background
3. **Loading**: Spinner icon replaces download icon, button disabled
4. **Disabled**: Grayed out, cursor not-allowed

### Import Button States
1. **Default**: Gray outlined button
2. **Hover**: Light gray background
3. **Loading**: Spinner icon replaces upload icon, button disabled
4. **Disabled**: Grayed out, cursor not-allowed

## Dialog Flows

### Export Flow
```
Click Export → Format Selection Dialog → Choose Format → Download File
                                      ↓
                                   Cancel → Close Dialog
```

### Import Flow
```
Click Import → File Browser → Select File → Validation
                                          ↓
                                    Valid → Populate Form
                                          ↓
                                  Invalid → Error Dialog → Try Again
                                                         ↓
                                                      Cancel
```

## Accessibility

### Keyboard Navigation
- Tab to focus Export button
- Tab to focus Import button
- Enter/Space to activate button
- Escape to close dialogs

### Screen Reader Support
- Export button: "Export configuration" label
- Import button: "Import configuration" label
- Loading state: "Exporting..." or "Importing..." announced
- Error messages: Announced when validation fails

### ARIA Attributes
```tsx
<Button
  aria-label="Export configuration"
  title="Export report configuration to file"
  disabled={isExporting}
  loading={isExporting}
>
  <Download aria-hidden="true" />
  <span>Export</span>
</Button>
```

## Testing Checklist

- [ ] Buttons are visible in the Report Configuration header
- [ ] Export button opens format selection dialog
- [ ] Import button opens file browser
- [ ] Loading states show spinner icons
- [ ] Disabled state prevents interaction
- [ ] Hover states work correctly
- [ ] Keyboard navigation works
- [ ] Screen reader announces button labels
- [ ] Dialogs can be closed with Escape key
- [ ] Success/error messages appear correctly

---

**Component**: ExportImportControls
**Location**: Report Configuration Card Header
**Status**: Integrated and ready for testing
