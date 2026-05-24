import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type BadgeVariant = "green" | "amber" | "red" | "purple" | "muted";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  green:  "bg-sage/20 text-sage-3 border border-sage/30",
  amber:  "bg-amber/20 text-amber-2 border border-amber/30",
  red:    "bg-rust/20 text-rust border border-rust/30",
  purple: "bg-purple/20 text-purple border border-purple/30",
  muted:  "bg-ink-3 text-mist border border-ink-3",
};

export function Badge({ children, variant = "muted", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
