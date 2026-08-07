"use client";
import { useEffect, useState } from "react";
import { toast, ToastMessage } from "@/lib/toast";

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return toast.subscribe(setToasts);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((t) => {
        const bg =
          t.type === "success"
            ? "bg-emerald-950/90 border-emerald-500/30 text-emerald-200"
            : t.type === "error"
            ? "bg-red-950/90 border-red-500/30 text-red-200"
            : "bg-surface-2/95 border-primary/30 text-primary-soft-2";

        const icon = t.type === "success" ? "✓" : t.type === "error" ? "!" : "i";

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-[16px] border backdrop-blur-xl shadow-[0_8px_28px_rgba(0,0,0,0.36)] transition-all duration-200 animate-fade-in ${bg}`}
          >
            <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
              {icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight">{t.title}</p>
              {t.message && (
                <p className="text-xs opacity-80 mt-1 leading-normal">{t.message}</p>
              )}
            </div>
            <button
              onClick={() => toast.remove(t.id)}
              className="text-xs opacity-50 hover:opacity-100 transition-opacity ml-2"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
