import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (type: ToastType, message: string, title?: string, duration?: number) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  removeToast: (id: string) => void;
  toast: {
    show: (type: ToastType, message: string, title?: string, duration?: number) => void;
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, message: string, title?: string, duration = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = { id, type, title, message, duration };

    setToasts(prev => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const success = useCallback((message: string, title?: string) => {
    showToast('success', message, title);
  }, [showToast]);

  const error = useCallback((message: string, title?: string) => {
    showToast('error', message, title || 'Operation Error');
  }, [showToast]);

  const warning = useCallback((message: string, title?: string) => {
    showToast('warning', message, title || 'Notice');
  }, [showToast]);

  const info = useCallback((message: string, title?: string) => {
    showToast('info', message, title);
  }, [showToast]);

  const toastObj = {
    show: showToast,
    success,
    error,
    warning,
    info
  };

  return (
    <ToastContext.Provider value={{ toasts, showToast, success, error, warning, info, removeToast, toast: toastObj }}>
      {children}
      {/* Toast Notification Container Floating Stack */}
      <div
        className="fixed top-16 right-4 sm:right-6 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
        aria-live="polite"
      >
        {toasts.map(toast => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';
          const isWarning = toast.type === 'warning';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl shadow-2xl backdrop-blur-md border transition-all duration-300 transform translate-y-0 opacity-100 animate-slideIn ${
                isSuccess
                  ? 'bg-slate-900/95 border-emerald-500/40 text-emerald-300 shadow-emerald-950/30'
                  : isError
                  ? 'bg-slate-900/95 border-rose-500/40 text-rose-300 shadow-rose-950/30'
                  : isWarning
                  ? 'bg-slate-900/95 border-amber-500/40 text-amber-300 shadow-amber-950/30'
                  : 'bg-slate-900/95 border-sky-500/40 text-sky-300 shadow-sky-950/30'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {isError && <XCircle className="w-5 h-5 text-rose-400" />}
                {isWarning && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                {!isSuccess && !isError && !isWarning && <Info className="w-5 h-5 text-sky-400" />}
              </div>

              <div className="flex-1 min-w-0">
                {toast.title && (
                  <h4 className="text-xs font-bold text-white tracking-tight leading-tight">
                    {toast.title}
                  </h4>
                )}
                <p className="text-xs text-slate-200 mt-0.5 leading-relaxed break-words font-medium">
                  {toast.message}
                </p>
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 p-1 text-slate-400 hover:text-white rounded transition"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
