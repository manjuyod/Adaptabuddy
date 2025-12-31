import { cn } from "@/lib/utils";
import { X } from "lucide-react";

type ToastProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
};

export function Toast({
  title,
  description,
  actionLabel,
  onAction,
  onClose
}: ToastProps) {
  return (
    <div className="glass-panel flex min-w-[260px] max-w-sm items-start gap-3 rounded-2xl border border-slate-800/70 p-4 shadow-card">
      <div className="flex-1 space-y-1">
        <p className="text-sm font-semibold text-white">{title}</p>
        {description ? (
          <p className="text-xs text-slate-300">{description}</p>
        ) : null}
        {actionLabel ? (
          <button
            className="mt-1 text-xs font-semibold text-brand-200 hover:text-brand-100"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
      <button
        aria-label="Close toast"
        className={cn(
          "rounded-full p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
        )}
        onClick={onClose}
      >
        <X size={16} />
      </button>
    </div>
  );
}
