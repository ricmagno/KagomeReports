# Notification System

This document describes the toast notification and confirmation dialog system implemented for the application.

## Components

### Toast
A notification component that displays temporary messages to users.

**Features:**
- 4 types: success, error, warning, info
- Auto-dismiss after configurable duration (default 5 seconds)
- Manual dismiss with close button
- Slide-in animation from right
- Accessible with ARIA attributes

### ToastContainer
Container component that manages and displays multiple toasts.

**Features:**
- Fixed position at top-right of screen
- Stacks multiple toasts vertically
- Handles toast lifecycle

### ConfirmDialog
Modal dialog for confirming destructive or important actions.

**Features:**
- 3 variants: danger (red), warning (yellow), info (blue)
- Loading state support
- Backdrop click to cancel
- Keyboard accessible
- Scale-in animation

## Usage

### Using Toasts

```typescript
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../ui/ToastContainer';

function MyComponent() {
  const { toasts, success, error, warning, info, removeToast } = useToast();

  const handleSuccess = () => {
    success('Operation completed successfully');
  };

  const handleError = () => {
    error('Operation failed', 'Please try again later');
  };

  const handleWarning = () => {
    warning('This action may have consequences', undefined, 10000); // 10 second duration
  };

  return (
    <div>
      <button onClick={handleSuccess}>Show Success</button>
      <button onClick={handleError}>Show Error</button>
      <button onClick={handleWarning}>Show Warning</button>
      
      {/* Add ToastContainer to render toasts */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
```

### Using Confirmation Dialog

```typescript
import { useState } from 'react';
import { ConfirmDialog } from '../ui/ConfirmDialog';

function MyComponent() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteItem();
      setShowConfirm(false);
    } catch (error) {
      // Handle error
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      <button onClick={() => setShowConfirm(true)}>Delete Item</button>
      
      <ConfirmDialog
        isOpen={showConfirm}
        title="Delete Item"
        message="Are you sure you want to delete this item? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
```

## Toast Hook API

### `useToast()`

Returns an object with the following properties:

- `toasts`: Array of current toast objects
- `addToast(options)`: Add a custom toast
- `removeToast(id)`: Remove a specific toast
- `success(message, description?, duration?)`: Show success toast
- `error(message, description?, duration?)`: Show error toast
- `warning(message, description?, duration?)`: Show warning toast
- `info(message, description?, duration?)`: Show info toast
- `clearAll()`: Remove all toasts

## Toast Options

```typescript
interface ToastOptions {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  description?: string;
  duration?: number; // milliseconds, 0 = no auto-dismiss
}
```

## ConfirmDialog Props

```typescript
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;      // default: 'Confirm'
  cancelLabel?: string;        // default: 'Cancel'
  variant?: 'danger' | 'warning' | 'info'; // default: 'danger'
  loading?: boolean;           // default: false
  onConfirm: () => void;
  onCancel: () => void;
}
```

## Styling

The notification system uses Tailwind CSS classes and follows the application's design system:

- **Colors**: Uses semantic colors (green for success, red for error, yellow for warning, blue for info)
- **Animations**: Defined in `client/src/styles/globals.css`
- **Positioning**: Fixed at top-right with z-index 50
- **Responsive**: Works on all screen sizes

## Accessibility

- All components include proper ARIA attributes
- Keyboard navigation supported
- Screen reader friendly
- Focus management in dialogs
- Color contrast compliant

## Examples in Codebase

See `client/src/components/schedules/SchedulesList.tsx` for a complete implementation example showing:
- Toast notifications for CRUD operations
- Confirmation dialog for delete action
- Error handling with notifications
- Success feedback for user actions
