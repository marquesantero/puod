import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type ToastVariant = "success" | "error" | "info" | "destructive" | "default";

type ToastState = {
  id: number;
  title?: string;
  message: string;
  variant: ToastVariant;
};

type ToastOptions = {
  title?: string;
  variant?: ToastVariant;
};

type ToastContextValue = {
  showToast: (message: string, options?: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantStyles: Record<ToastVariant, string> = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-700",
  destructive: "border-destructive/40 bg-destructive/10 text-destructive",
  default: "border-gray-500/30 bg-gray-500/10 text-gray-700",
};

const iconForVariant: Record<ToastVariant, React.ReactNode> = {
  success: (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
      <path
        d="M5 12l4 4 10-10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  error: (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
      <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  info: (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
      <path d="M12 8h.01M11 12h2v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  destructive: (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
      <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  default: (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
      <path d="M12 8h.01M11 12h2v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, options?: ToastOptions) => {
    setToast({
      id: Date.now(),
      message,
      title: options?.title,
      variant: options?.variant ?? "info",
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Listen for session expiration events from API client
  useEffect(() => {
    const handleSessionExpired = (event: Event) => {
      const customEvent = event as CustomEvent;
      showToast(customEvent.detail?.message || "Your session has expired", {
        title: "Session Expired",
        variant: "destructive",
      });
    };

    window.addEventListener('session-expired', handleSessionExpired);
    return () => window.removeEventListener('session-expired', handleSessionExpired);
  }, [showToast]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <div
          key={toast.id}
          className={`fixed right-6 top-24 z-50 max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${variantStyles[toast.variant]}`}
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-current dark:bg-slate-900/60">
              {iconForVariant[toast.variant]}
            </span>
            <div className="flex-1">
              {toast.title ? <p className="font-semibold">{toast.title}</p> : null}
              <p className="text-xs opacity-80">{toast.message}</p>
            </div>
            <button
              type="button"
              className="opacity-60 hover:opacity-100"
              onClick={() => setToast(null)}
            >
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
