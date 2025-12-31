import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "warning";

const variants: Record<Variant, string> = {
  default: "bg-slate-800 text-slate-100",
  success: "bg-emerald-500/20 text-emerald-200 border border-emerald-500/40",
  warning: "bg-amber-500/20 text-amber-200 border border-amber-500/40"
};

type ChipProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
};

export function Chip({ className, variant = "default", ...props }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
