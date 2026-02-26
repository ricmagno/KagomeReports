import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ToastProps, ToastType } from '../components/ui/Toast';
import { ToastContainer } from '../components/ui/ToastContainer';

interface ToastOptions {
    type: ToastType;
    message: string;
    description?: string;
    duration?: number;
}

interface ToastContextType {
    toasts: ToastProps[];
    addToast: (options: ToastOptions) => string;
    removeToast: (id: string) => void;
    success: (message: string, description?: string, duration?: number) => string;
    error: (message: string, description?: string, duration?: number) => string;
    warning: (message: string, description?: string, duration?: number) => string;
    info: (message: string, description?: string, duration?: number) => string;
    clearAll: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastProps[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

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
    }, [removeToast]);

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

    return (
        <ToastContext.Provider
            value={{
                toasts,
                addToast,
                removeToast,
                success,
                error,
                warning,
                info,
                clearAll,
            }}
        >
            {children}
            <ToastContainer toasts={toasts} onClose={removeToast} />
        </ToastContext.Provider>
    );
};

export const useToastContext = () => {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToastContext must be used within a ToastProvider');
    }
    return context;
};
