import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-brand-500 text-white shadow-card hover:bg-brand-400 active:bg-brand-600 focus-visible:ring-2 focus-visible:ring-brand-300",
  ghost:
    "bg-slate-900/60 text-slate-50 hover:bg-slate-800 active:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-500",
  outline:
    "border border-slate-700 text-slate-50 hover:bg-slate-900 active:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-500"
};

const sizeStyles: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-base",
  lg: "h-12 px-5 text-lg"
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-semibold transition duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
