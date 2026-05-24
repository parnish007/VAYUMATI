"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { DemoToggle } from "@/components/ui/DemoToggle";
import { RoleSwitcher } from "@/components/ui/RoleSwitcher";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuth } from "@/lib/authContext";
import type { UserRole } from "@/lib/demoContext";

type NavItem = { href: string; label: string; icon: React.ReactNode };
type NavGroup = { group: string; items: NavItem[] };

function makeIcon(path: string) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  home:      makeIcon("M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"),
  sensors:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  exposure:  makeIcon("M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"),
  rewards:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>,
  community: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  alerts:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>,
  chat:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  members:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  requests:  makeIcon("M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"),
  demo:      makeIcon("M12 2a2 2 0 012 2v4l3 3-3 3v4a2 2 0 01-4 0v-4l-3-3 3-3V4a2 2 0 012-2z M8 12H4m16 0h-4"),
  pulse:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><circle cx="12" cy="12" r="2"/><path d="M6.34 6.34a8 8 0 000 11.32M17.66 6.34a8 8 0 010 11.32"/><path d="M3.52 3.52a13 13 0 000 16.97M20.49 3.52a13 13 0 010 16.97"/></svg>,
};

function getNav(role: UserRole): NavGroup[] {
  if (role === "executive") {
    return [
      { group: "MONITOR", items: [
        { href: "/dashboard", label: "Overview",  icon: ICONS.home },
        { href: "/ward",     label: "Sensors",   icon: ICONS.sensors },
        { href: "/members",  label: "Members",   icon: ICONS.members },
      ]},
      { group: "ENGAGE", items: [
        { href: "/community",label: "Community", icon: ICONS.community },
        { href: "/requests", label: "Requests",  icon: ICONS.requests },
        { href: "/alerts",   label: "Alerts",    icon: ICONS.alerts },
        { href: "/chat",     label: "Ask MATI",  icon: ICONS.chat },
      ]},
      { group: "DEMO", items: [
        { href: "/demo",     label: "Tweaker",   icon: ICONS.demo },
      ]},
    ];
  }
  if (role === "farmer") {
    return [
      { group: "MONITOR", items: [
        { href: "/dashboard", label: "Overview",    icon: ICONS.home },
        { href: "/ward",      label: "Soil/Air",    icon: ICONS.sensors },
        { href: "/pulse",     label: "Ward Pulse",  icon: ICONS.pulse },
        { href: "/exposure",  label: "Exposure",    icon: ICONS.exposure },
      ]},
      { group: "ENGAGE", items: [
        { href: "/community", label: "Community",  icon: ICONS.community },
        { href: "/alerts",    label: "Alerts",     icon: ICONS.alerts },
        { href: "/chat",      label: "Ask MATI",   icon: ICONS.chat },
      ]},
    ];
  }
  // individual (default)
  return [
    { group: "MONITOR", items: [
      { href: "/dashboard", label: "Overview",   icon: ICONS.home },
      { href: "/pulse",     label: "Ward Pulse", icon: ICONS.pulse },
      { href: "/exposure",  label: "Exposure",   icon: ICONS.exposure },
    ]},
    { group: "ENGAGE", items: [
      { href: "/rewards",   label: "Rewards",   icon: ICONS.rewards },
      { href: "/community", label: "Community", icon: ICONS.community },
      { href: "/alerts",    label: "Alerts",    icon: ICONS.alerts },
      { href: "/chat",      label: "Ask MATI",  icon: ICONS.chat },
    ]},
  ];
}

export function Sidebar() {
  const path = usePathname();
  const { role, isDemo, name } = useCurrentUser();
  const { logout } = useAuth();
  const nav = getNav(role);

  return (
    <nav
      className="hidden md:flex flex-col w-44 shrink-0"
      style={{ background: "#080f0a", borderRight: "1px solid rgba(30,64,40,0.5)" }}
    >
      <div className="px-4 py-4 mb-1" style={{ borderBottom: "1px solid rgba(30,64,40,0.35)" }}>
        <p className="font-display text-base font-bold text-parchment tracking-tight leading-none">
          Vāyu<em className="not-italic" style={{ color: "#f0bb2a" }}>Mitti</em>
        </p>
        <p className="text-[8px] mt-1 opacity-40" style={{ color: "#2d5040" }}>ECOTHON PRAKRITI 2026</p>
      </div>

      <div className="flex flex-col flex-1 gap-0 mt-2">
        {nav.map(({ group, items }) => (
          <div key={group}>
            <p className="px-4 pt-3 pb-1 text-[8px] tracking-[1.2px] font-medium" style={{ color: "#2d5040" }}>
              {group}
            </p>
            {items.map(({ href, label, icon }) => {
              const active = path === href || (href !== "/dashboard" && path.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn("flex items-center gap-2 pl-4 pr-2 py-1.5 text-[11px] transition-all relative", active ? "font-medium" : "hover:bg-sage/5")}
                  style={active ? { background: "rgba(61,139,94,0.09)", borderRight: "2px solid #4fa870", color: "#7dc99a" } : { color: "#4d7a5e" }}
                >
                  {icon}
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 px-3 pb-3">
        {/* Demo-only controls */}
        {isDemo && <RoleSwitcher variant="full" />}
        {isDemo && <DemoToggle />}

        {/* Live mode: user identity + logout */}
        {!isDemo && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 px-2 py-2 rounded-xl"
              style={{ background: "rgba(45,122,154,0.08)", border: "1px solid rgba(45,122,154,0.2)" }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{ background: "rgba(45,122,154,0.2)", color: "#7cc4e0" }}>
                {name ? name.slice(0, 1).toUpperCase() : "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold truncate" style={{ color: "#c8d9cc" }}>{name}</p>
                <p className="text-[8px] uppercase tracking-wide" style={{ color: "#4d7a5e" }}>{role}</p>
              </div>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#4fa870", animation: "pulse-dot 2s infinite" }} />
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-2 py-1.5 rounded-xl text-[10px] font-medium w-full text-left transition-opacity hover:opacity-80"
              style={{ background: "rgba(196,75,43,0.08)", border: "1px solid rgba(196,75,43,0.18)", color: "#c44b2b" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 shrink-0">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
              Log out
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 px-1 text-[9px]" style={{ color: "#2d5040" }}>
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#4fa870", animation: "pulse-dot 2s infinite" }} />
          Ward 11 · ECOTHON 2026
        </div>
      </div>
    </nav>
  );
}
