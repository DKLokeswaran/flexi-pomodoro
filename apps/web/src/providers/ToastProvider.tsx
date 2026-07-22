import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import styles from "./ToastProvider.module.css";

export type ToastKind = "success" | "error";

export type ToastInput = {
  kind: ToastKind;
  message: string;
};

type ToastContextValue = {
  pushToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_MS = 3_500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastInput | null>(null);

  const pushToast = useCallback((next: ToastInput) => {
    setToast(next);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div className={styles.stack} aria-live="polite" aria-relevant="additions">
        {toast ? (
          <div
            className={`${styles.toast} ${
              toast.kind === "success" ? styles.toastSuccess : styles.toastError
            }`}
            role="status"
          >
            <span className={styles.message}>{toast.message}</span>
            <button
              type="button"
              className={styles.close}
              aria-label="Dismiss"
              onClick={() => setToast(null)}
            >
              ×
            </button>
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
