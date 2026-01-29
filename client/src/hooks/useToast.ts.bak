import { useState, useCallback } from 'react';
import { ToastProps, ToastType } from '../components/ui/Toast';

interface ToastOptions {
  type: ToastType;
  message: string;
  description?: string;
  duration?: number;
}

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const addToast = useCallback((options: ToastOptions) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const toast: ToastProps = {
      id,
      type: options.type,
      message: options.message,
      description: options.description,
      duration: options.duration ?? 5000,
      onClose: removeToast,
    };

    setToasts((prev) => [...prev, toast]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const success = useCallback(
    (message: string, description?: string, duration?: number) => {
      return addToast({ type: 'success', message, description, duration });
    },
    [addToast]
  );

  const error = useCallback(
    (message: string, description?: string, duration?: number) => {
      return addToast({ type: 'error', message, description, duration });
    },
    [addToast]
  );

  const warning = useCallback(
    (message: string, description?: string, duration?: number) => {
      return addToast({ type: 'warning', message, description, duration });
    },
    [addToast]
  );

  const info = useCallback(
    (message: string, description?: string, duration?: number) => {
      return addToast({ type: 'info', message, description, duration });
    },
    [addToast]
  );

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
    clearAll,
  };
};
