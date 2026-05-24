"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, MapPin, Activity, Bell, MessageSquare, Users,
  Wifi, Leaf, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type Tab = { href: string; label: string; icon: ReactNode };

const INDIVIDUAL_TABS: Tab[] = [
  { href: "/dashboard", label: "Home",      icon: <Home         size={20} strokeWidth={1.8} /> },
  { href: "/exposure",  label: "Exposure",  icon: <MapPin       size={20} strokeWidth={1.8} /> },
  { href: "/pulse",     label: "Pulse",     icon: <Activity     size={20} strokeWidth={1.8} /> },
  { href: "/alerts",    label: "Alerts",    icon: <Bell         size={20} strokeWidth={1.8} /> },
  { href: "/chat",      label: "MATI",      icon: <MessageSquare size={20} strokeWidth={1.8} /> },
  { href: "/community", label: "Community", icon: <Users        size={20} strokeWidth={1.8} /> },
];

const FARMER_TABS: Tab[] = [
  { href: "/dashboard", label: "Home",      icon: <Home          size={20} strokeWidth={1.8} /> },
  { href: "/ward",      label: "Soil/Air",  icon: <Leaf          size={20} strokeWidth={1.8} /> },
  { href: "/chat",      label: "MATI",      icon: <MessageSquare size={20} strokeWidth={1.8} /> },
  { href: "/exposure",  label: "Exposure",  icon: <MapPin        size={20} strokeWidth={1.8} /> },
  { href: "/community", label: "Community", icon: <Users         size={20} strokeWidth={1.8} /> },
];

const EXECUTIVE_TABS: Tab[] = [
  { href: "/dashboard", label: "Overview",  icon: <Home          size={20} strokeWidth={1.8} /> },
  { href: "/ward",      label: "Sensors",   icon: <Wifi          size={20} strokeWidth={1.8} /> },
  { href: "/community", label: "Community", icon: <Users         size={20} strokeWidth={1.8} /> },
  { href: "/requests",  label: "Requests",  icon: <ClipboardList size={20} strokeWidth={1.8} /> },
  { href: "/alerts",    label: "Alerts",    icon: <Bell          size={20} strokeWidth={1.8} /> },
];

export function BottomNav() {
  const path = usePathname();
  const { role } = useCurrentUser();

  const tabs =
    role === "farmer"    ? FARMER_TABS :
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
            <span className="w-[20px] h-[20px] flex items-center justify-center">{icon}</span>
            <span className="text-[9px] tracking-[0.3px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
