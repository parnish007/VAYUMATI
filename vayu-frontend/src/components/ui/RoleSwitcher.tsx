"use client";

import { useEffect, useState } from "react";
import { useDemo, type UserRole } from "@/lib/demoContext";

const ROLE_META: Record<UserRole, { icon: string; label: string; color: string; bg: string }> = {
  individual: { icon: "👤", label: "Resident",  color: "#7dc99a", bg: "rgba(79,168,112,0.10)" },
  farmer:     { icon: "🌾", label: "Farmer",    color: "#f0bb2a", bg: "rgba(240,187,42,0.10)" },
  executive:  { icon: "🏛️", label: "Executive", color: "#7cc4e0", bg: "rgba(124,196,224,0.10)" },
};
const ORDER: UserRole[] = ["individual", "farmer", "executive"];

function nextRole(r: UserRole): UserRole {
  return ORDER[(ORDER.indexOf(r) + 1) % ORDER.length];
}

interface Props {
  variant?: "pill" | "full";
  className?: string;
}

export function RoleSwitcher({ variant = "pill", className = "" }: Props) {
  const { role, setRole, isDemo } = useDemo();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const meta = ROLE_META[role];
  const next = ROLE_META[nextRole(role)];
  const disabled = !isDemo;

  if (!mounted) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${className}`}
        style={{ background: "rgba(61,139,94,0.10)", border: "1px solid rgba(61,139,94,0.18)", color: "#4d7a5e" }}
      >
        <span>👤</span><span>Loading</span>
      </div>
    );
  }

  if (variant === "full") {
    return (
      <button
        onClick={() => setRole(nextRole(role))}
        disabled={disabled}
        title={disabled ? "Enable demo mode to switch roles" : `Switch to ${next.label}`}
        className={`flex items-center gap-2 rounded-xl px-3 py-2 w-full text-left transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
        style={{ background: meta.bg, border: `1px solid ${meta.color}40`, color: meta.color }}
      >
        <span className="text-base leading-none">{meta.icon}</span>
        <div className="flex flex-col flex-1 min-w-0 leading-tight">
          <span className="text-[10px] uppercase tracking-[0.6px] opacity-70">Viewing as</span>
          <span className="text-[11px] font-bold truncate">{meta.label}</span>
        </div>
        <span className="text-[10px] opacity-60 shrink-0">↻ {next.icon}</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => setRole(nextRole(role))}
      disabled={disabled}
      title={disabled ? "Enable demo mode to switch roles" : `Switch to ${next.label}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold transition-all hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      style={{ background: meta.bg, border: `1px solid ${meta.color}40`, color: meta.color }}
    >
      <span className="text-[12px] leading-none">{meta.icon}</span>
      <span className="uppercase tracking-[0.4px]">{meta.label}</span>
      <span className="opacity-50 ml-0.5">↻</span>
    </button>
  );
}
