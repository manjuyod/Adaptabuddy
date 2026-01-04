import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ToggleProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange"
> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  children?: ReactNode;
};

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  (
    { className, checked = false, onCheckedChange, disabled, children, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
          "relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200",
          checked ? "bg-brand-500" : "bg-slate-800",
          disabled && "cursor-not-allowed opacity-60",
          className
        )}
        {...props}
      >
        {children ? (
          <span className="absolute left-1 flex items-center pointer-events-none text-slate-300">
            {children}
          </span>
        ) : null}
        <span
          className={cn(
            "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
            checked ? "translate-x-5" : "translate-x-1"
          )}
        />
      </button>
    );
  }
);

Toggle.displayName = "Toggle";
