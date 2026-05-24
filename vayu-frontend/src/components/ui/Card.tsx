import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-ink-2 border border-sage-tint p-4",
        className
      )}
    >
      {children}
    </div>
  );
}
