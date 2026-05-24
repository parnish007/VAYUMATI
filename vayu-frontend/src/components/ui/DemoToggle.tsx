"use client";
import { useState, useEffect } from "react";
import { useDemo } from "@/lib/demoContext";

const ROLE_LABEL: Record<string, string> = { individual: "👤", farmer: "🌾", executive: "🏛️" };

export function DemoToggle({ compact = false }: { compact?: boolean }) {
  const { isDemo, toggleDemo, role } = useDemo();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    // Render placeholder with same dimensions during SSR/hydration
    return (
      <div className={compact
        ? "flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] font-bold"
        : "flex items-center gap-2 rounded-xl px-3 py-2 w-full"
      } style={{ background: "rgba(79,168,112,0.18)", border: "1px solid rgba(79,168,112,0.45)" }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#7dc99a" }} />
        {compact ? <span style={{ color: "#7dc99a" }}>DEMO</span> : <span className="text-[11px] font-semibold flex-1" style={{ color: "#7dc99a" }}>DEMO MODE</span>}
      </div>
    );
  }

  if (compact) {
    return (
      <button
        onClick={toggleDemo}
        className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] font-bold tracking-wide transition-all"
        style={isDemo
          ? { background: "rgba(79,168,112,0.18)", border: "1px solid rgba(79,168,112,0.45)", color: "#7dc99a" }
          : { background: "rgba(240,187,42,0.15)", border: "1px solid rgba(240,187,42,0.40)", color: "#f0bb2a" }
        }
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: isDemo ? "#7dc99a" : "#f0bb2a", animation: isDemo ? "pulse-dot 1.6s infinite" : "none" }} />
        {isDemo ? "DEMO" : "LIVE"}
      </button>
    );
  }

  return (
    <button
      onClick={toggleDemo}
      className="flex items-center gap-2 rounded-xl px-3 py-2 w-full text-left transition-all"
      style={isDemo
        ? { background: "rgba(79,168,112,0.12)", border: "1px solid rgba(79,168,112,0.30)", color: "#7dc99a" }
        : { background: "rgba(240,187,42,0.10)", border: "1px solid rgba(240,187,42,0.28)", color: "#f0bb2a" }
      }
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: isDemo ? "#7dc99a" : "#f0bb2a", animation: isDemo ? "pulse-dot 1.6s infinite" : "none" }} />
      <span className="text-[11px] font-semibold flex-1">{isDemo ? "DEMO MODE" : "LIVE DATA"}</span>
      <span className="text-[13px]">{ROLE_LABEL[role] ?? "👤"}</span>
    </button>
  );
}
