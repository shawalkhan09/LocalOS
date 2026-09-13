"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import styles from "./Toast.module.css";

type ToastVariant = "success" | "error";
type ToastItem = { id: number; message: string; variant: ToastVariant };

type ToastContextValue = {
  showToast: (message: string, variant: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

let nextToastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant) => {
      const id = nextToastId++;
      setToasts((prev) => [...prev, { id, message, variant }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), 6000),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const timersMap = timers.current;
    return () => {
      timersMap.forEach(clearTimeout);
    };
  }, []);

  // Escape dismisses the most recent toast, keyboard-only, no click needed.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setToasts((prev) => {
          const last = prev[prev.length - 1];
          if (last) {
            dismiss(last.id);
          }
          return prev;
        });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={styles.region} aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`${styles.toast} ${styles[t.variant]}`} role="alert">
            <span className={styles.message}>{t.message}</span>
            <button
              type="button"
              className={styles.dismiss}
              aria-label="Dismiss notification"
              onClick={() => dismiss(t.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
