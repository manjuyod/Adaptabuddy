"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode
} from "react";
import { Toast } from "./toast";

type ToastOptions = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
};

type ToastEntry = ToastOptions & { id: string };

type ToastContextValue = {
  toast: (options: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const entry: ToastEntry = { id, ...options };
      setToasts((items) => [...items, entry]);

      const duration = options.duration ?? 3600;
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-24 z-50 flex flex-col items-end gap-3 sm:items-end">
        {toasts.map((item) => (
          <div key={item.id} className="pointer-events-auto">
            <Toast
              title={item.title}
              description={item.description}
              actionLabel={item.actionLabel}
              onAction={() => {
                item.onAction?.();
                dismiss(item.id);
              }}
              onClose={() => dismiss(item.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error("useToast must be used inside <ToastProvider />");
  }

  return value;
}
