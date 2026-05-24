"use client";

import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const HOME_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);
const EXPOSURE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
  </svg>
);
const REWARDS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
  </svg>
);
const COMMUNITY_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
  </svg>
);
const ALERTS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
);
const PULSE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="2"/><path d="M6.34 6.34a8 8 0 000 11.32M17.66 6.34a8 8 0 010 11.32"/><path d="M3.52 3.52a13 13 0 000 16.97M20.49 3.52a13 13 0 010 16.97"/>
  </svg>
);
const SENSORS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
  </svg>
);
const FARM_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a10 10 0 100 20A10 10 0 0012 2z"/><path d="M12 6v6l4 2"/>
  </svg>
);
const CHAT_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
);

type Tab = { href: string; label: string; icon: React.ReactNode };

const INDIVIDUAL_TABS: Tab[] = [
  { href: "/dashboard", label: "Home",      icon: HOME_ICON },
  { href: "/exposure",  label: "Exposure",  icon: EXPOSURE_ICON },
  { href: "/pulse",     label: "Pulse",     icon: PULSE_ICON },
  { href: "/chat",      label: "MATI",      icon: CHAT_ICON },
  { href: "/community", label: "Community", icon: COMMUNITY_ICON },
];

const FARMER_TABS: Tab[] = [
  { href: "/dashboard", label: "Home",      icon: HOME_ICON },
  { href: "/ward",      label: "Soil/Air",  icon: FARM_ICON },
  { href: "/pulse",     label: "Pulse",     icon: PULSE_ICON },
  { href: "/exposure",  label: "Exposure",  icon: EXPOSURE_ICON },
  { href: "/community", label: "Community", icon: COMMUNITY_ICON },
];

const REQUESTS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
  </svg>
);

const EXECUTIVE_TABS: Tab[] = [
  { href: "/dashboard", label: "Overview",  icon: HOME_ICON },
  { href: "/ward",      label: "Sensors",   icon: SENSORS_ICON },
  { href: "/community", label: "Community", icon: COMMUNITY_ICON },
  { href: "/requests",  label: "Requests",  icon: REQUESTS_ICON },
  { href: "/alerts",    label: "Alerts",    icon: ALERTS_ICON },
];

export function BottomNav() {
  const path = usePathname();
  const { role } = useCurrentUser();

  const tabs =
    role === "farmer" ? FARMER_TABS :
    role === "executive" ? EXECUTIVE_TABS :
    INDIVIDUAL_TABS;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 flex"
      style={{
        background: "rgba(8, 15, 10, 0.96)",
        borderTop: "1px solid rgba(61, 139, 94, 0.18)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      {tabs.map(({ href, label, icon }) => {
        const active = path === href || (href !== "/dashboard" && path.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center py-2.5 gap-1 min-h-[56px] transition-colors",
              active ? "text-sage-2" : "text-mist/40 hover:text-mist/70"
            )}
            style={active ? { color: "#4fa870" } : { color: "rgba(200,217,204,0.35)" }}
          >
            <span className="w-[20px] h-[20px]">{icon}</span>
            <span className="text-[9px] tracking-[0.3px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
