"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toast: (kind: ToastKind, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const kindStyles: Record<ToastKind, { icon: IconName; ring: string; iconColor: string }> = {
  success: { icon: "check", ring: "ring-green/25", iconColor: "bg-green text-white" },
  error: { icon: "warn", ring: "ring-red/25", iconColor: "bg-red text-white" },
  info: {
    icon: "info",
    ring: "ring-gold/40",
    iconColor: "bg-gradient-to-br from-gold-light via-gold to-[#1e40af] text-white",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (kind: ToastKind, title: string, message?: string) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-3), { id, kind, title, message }]);
      setTimeout(() => dismiss(id), 4200);
    },
    [dismiss]
  );

  const value: ToastContextValue = {
    toast,
    success: (t, m) => toast("success", t, m),
    error: (t, m) => toast("error", t, m),
    info: (t, m) => toast("info", t, m),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => {
          const s = kindStyles[t.kind];
          return (
            <div
              key={t.id}
              role={t.kind === "error" ? "alert" : "status"}
              className={cn(
                "animate-toast pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-white/90 p-3.5 shadow-pop ring-1 backdrop-blur-xl",
                s.ring,
                "dark:bg-[#0f172a]/90"
              )}
            >
              <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full", s.iconColor)} aria-hidden="true">
                <Icon name={s.icon} size={13} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink dark:text-slate-100">{t.title}</p>
                {t.message && (
                  <p className="mt-0.5 text-[13px] leading-snug text-sub dark:text-slate-400">{t.message}</p>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="rounded-full p-1.5 text-faint hover:bg-black/5 dark:hover:bg-white/10"
                aria-label={`Dismiss notification: ${t.title}`}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
