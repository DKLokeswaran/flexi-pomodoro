import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

/** Holds a single status toast and auto-dismisses it after TOAST_MS. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastInput | null>(null);

  /** Replace the current toast (previous one is dropped). */
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
      <div
        className="pointer-events-none fixed right-4 bottom-4 z-40 flex max-w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toast ? (
          <div
            className={cn(
              "pointer-events-auto flex animate-rise items-center gap-3 rounded-md border bg-card py-2.5 pr-2 pl-4 text-sm text-foreground",
              toast.kind === "success"
                ? "border-primary/40"
                : "border-destructive/50 text-destructive",
            )}
            role="status"
          >
            <span className="min-w-0 flex-1">{toast.message}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Dismiss"
              onClick={() => setToast(null)}
            >
              <X aria-hidden />
            </Button>
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

/** Access pushToast; must be rendered under ToastProvider. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
