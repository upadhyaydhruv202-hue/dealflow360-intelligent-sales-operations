import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { cn } from '../cn';
import { Alert } from '../primitives/Alert';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

export interface ToastItem extends ToastInput {
  id: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: ToastItem[];
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const item: ToastItem = {
        id,
        title: input.title,
        description: input.description,
        variant: input.variant ?? 'info',
        durationMs: input.durationMs,
      };
      setToasts((current) => [...current, item]);

      const duration = input.durationMs ?? DEFAULT_DURATION_MS;
      if (duration > 0) {
        const timer = window.setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }

      return id;
    },
    [dismiss],
  );

  const clear = useCallback(() => {
    for (const timer of timers.current.values()) {
      window.clearTimeout(timer);
    }
    timers.current.clear();
    setToasts([]);
  }, []);

  useEffect(
    () => () => {
      for (const timer of timers.current.values()) {
        window.clearTimeout(timer);
      }
      timers.current.clear();
    },
    [],
  );

  const value = useMemo(() => ({ toasts, toast, dismiss, clear }), [toasts, toast, dismiss, clear]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[80] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-96"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {toasts.map((item) => (
          <div key={item.id} className="pointer-events-auto">
            <Alert
              variant={item.variant}
              title={item.title}
              onDismiss={() => dismiss(item.id)}
              className={cn('shadow-panel')}
            >
              {item.description}
            </Alert>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return value;
}
