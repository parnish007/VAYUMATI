"use client";

import { useState } from "react";
import { useAir } from "@/hooks/useAir";
import { aqiColor } from "@/lib/aqi";
import { DEFAULT_WARD_ID } from "@/lib/constants";
import { DemoToggle } from "@/components/ui/DemoToggle";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuth } from "@/lib/authContext";

interface TopBarProps {
  wardId?: string;
}

export function TopBar({ wardId = DEFAULT_WARD_ID }: TopBarProps) {
  const { air } = useAir(wardId);
  const { name, isDemo } = useCurrentUser();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="md:hidden flex items-center justify-between px-4 py-3 relative"
      style={{
        background: "rgba(10,26,15,0.95)",
        borderBottom: "1px solid rgba(61,139,94,0.14)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <span className="font-display text-[17px] font-bold tracking-tight text-parchment leading-none">
        Vāyu<em className="not-italic" style={{ color: "#f0bb2a" }}>Mitti</em>
      </span>

      <div className="flex items-center gap-2">
        {/* Show demo toggle only in demo mode */}
        {isDemo && <DemoToggle compact />}

        {/* AQI pill */}
        {air ? (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-medium"
            style={{
              background: `${aqiColor(air.aqi)}18`,
              border: `1px solid ${aqiColor(air.aqi)}35`,
              color: aqiColor(air.aqi),
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: aqiColor(air.aqi), animation: "pulse-dot 1.6s infinite" }}
            />
            AQI {air.aqi}
          </div>
        ) : (
          <div className="h-7 w-20 rounded-full animate-pulse" style={{ background: "rgba(61,139,94,0.08)" }} />
        )}

        {/* Live mode: user avatar + dropdown with logout */}
        {!isDemo && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-opacity hover:opacity-80"
              style={{ background: "rgba(45,122,154,0.25)", border: "1px solid rgba(45,122,154,0.4)", color: "#7cc4e0" }}
            >
              {name ? name.slice(0, 1).toUpperCase() : "U"}
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-10 z-50 rounded-xl py-1 min-w-[140px] shadow-xl"
                  style={{ background: "#0d1f12", border: "1px solid rgba(61,139,94,0.2)" }}>
                  <div className="px-3 py-2 border-b" style={{ borderColor: "rgba(61,139,94,0.1)" }}>
                    <p className="text-[11px] font-semibold text-parchment truncate">{name}</p>
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); logout(); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-[11px] font-medium transition-opacity hover:opacity-70"
                    style={{ color: "#c44b2b" }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
                    </svg>
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
