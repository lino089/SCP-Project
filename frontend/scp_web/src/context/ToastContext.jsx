import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';

const ToastContext = createContext(null);

// Global standalone dispatcher for use outside React component lifecycles if needed
let globalAddToast = null;

export const toast = (message, options) => {
  if (globalAddToast) {
    return globalAddToast(message, 'info', options);
  }
  console.warn('[Toast] ToastProvider not mounted yet:', message);
};

toast.success = (message, options) => globalAddToast?.(message, 'success', options);
toast.error = (message, options) => globalAddToast?.(message, 'error', options);
toast.warning = (message, options) => globalAddToast?.(message, 'warning', options);
toast.info = (message, options) => globalAddToast?.(message, 'info', options);
toast.dismiss = (id) => {
  window.dispatchEvent(new CustomEvent('scp:dismiss-toast', { detail: { id } }));
};

export function ToastProvider({ children, maxToasts = 4 }) {
  const [toasts, setToasts] = useState([]);
  const idCounter = useRef(0);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((messageOrObj, variant = 'info', options = {}) => {
    idCounter.current += 1;
    const id = `toast-${Date.now()}-${idCounter.current}`;

    let toastItem = {};
    if (typeof messageOrObj === 'object' && messageOrObj !== null) {
      toastItem = {
        id,
        title: messageOrObj.title || null,
        message: messageOrObj.message || '',
        variant: messageOrObj.variant || variant,
        duration: messageOrObj.duration ?? (messageOrObj.variant === 'error' ? 5500 : 4000),
        action: messageOrObj.action || null,
      };
    } else {
      toastItem = {
        id,
        title: options.title || null,
        message: String(messageOrObj || ''),
        variant: options.variant || variant,
        duration: options.duration ?? (variant === 'error' ? 5500 : 4000),
        action: options.action || null,
      };
    }

    setToasts((prev) => {
      const updated = [...prev, toastItem];
      if (updated.length > maxToasts) {
        return updated.slice(updated.length - maxToasts);
      }
      return updated;
    });

    return id;
  }, [maxToasts]);

  // Connect global dispatcher
  useEffect(() => {
    globalAddToast = addToast;
    const handleDismiss = (e) => {
      if (e.detail?.id) removeToast(e.detail.id);
    };
    window.addEventListener('scp:dismiss-toast', handleDismiss);
    return () => {
      if (globalAddToast === addToast) globalAddToast = null;
      window.removeEventListener('scp:dismiss-toast', handleDismiss);
    };
  }, [addToast, removeToast]);

  const toastHelpers = useMemo(() => {
    const helper = (message, options) => addToast(message, 'info', options);
    helper.success = (message, options) => addToast(message, 'success', options);
    helper.error = (message, options) => addToast(message, 'error', options);
    helper.warning = (message, options) => addToast(message, 'warning', options);
    helper.info = (message, options) => addToast(message, 'info', options);
    helper.dismiss = removeToast;
    return helper;
  }, [addToast, removeToast]);

  const value = useMemo(
    () => ({
      toasts,
      toast: toastHelpers,
      addToast,
      removeToast,
    }),
    [toasts, toastHelpers, addToast, removeToast]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
