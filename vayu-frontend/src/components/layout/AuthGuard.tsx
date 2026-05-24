"use client";

import { type ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDemo } from "@/lib/demoContext";
import { useAuth } from "@/lib/authContext";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isDemo, roleReady } = useDemo();
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Read localStorage directly to avoid race condition: setRole() writes localStorage
  // synchronously before React commits the state update, so the router.replace() that
  // fires immediately after setRole() may reach AuthGuard before isDemo === true in context.
  const lsDemo = typeof window !== "undefined" ? localStorage.getItem("vayu_demo") : null;
  const lsRole = typeof window !== "undefined" ? localStorage.getItem("vayu_role") : null;
  const inDemoMode = isDemo || (lsDemo !== "false" && !!lsRole);

  useEffect(() => {
    if (!roleReady) return;
    if (inDemoMode) return;
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [inDemoMode, roleReady, isAuthenticated, isLoading, router]);

  if (!roleReady || (!inDemoMode && isLoading)) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: "rgba(61,139,94,0.3)", borderTopColor: "#4fa870" }}
          />
          <p className="text-xs" style={{ color: "#4d7a5e" }}>Loading…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
