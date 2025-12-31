import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ToggleProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange"
> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  (
    { className, checked = false, onCheckedChange, disabled, ...props },
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
