import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "glass-panel rounded-2xl p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg",
        className
      )}
      {...props}
    />
  );
}
