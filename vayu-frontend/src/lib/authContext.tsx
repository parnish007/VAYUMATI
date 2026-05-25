"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { AuthUser } from "@/types";
export type { AuthUser } from "@/types";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  token: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logout: () => {},
  token: null,
});

import { getBackendUrl } from "./constants";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("vayu_jwt");
    if (!stored) {
      setIsLoading(false);
      return;
    }
    setToken(stored);
    fetch(`${getBackendUrl()}/api/auth/me`, { headers: { Authorization: `Bearer ${stored}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((u: AuthUser) => setUser(u))
      .catch(() => {
        localStorage.removeItem("vayu_jwt");
        setToken(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Sync logout across tabs — when vayu_jwt is removed in another tab, log out here too
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "vayu_jwt" && !e.newValue) {
        setToken(null);
        setUser(null);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  async function login(username: string, password: string) {
    const r = await fetch(`${getBackendUrl()}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: "Login failed" }));
      throw new Error((err as { error?: string }).error ?? "Login failed");
    }
    const { token: t, user: u } = (await r.json()) as { token: string; user: AuthUser };
    localStorage.setItem("vayu_jwt", t);
    localStorage.setItem("vayu_demo", "false"); // disable demo when real user logs in
    setToken(t);
    setUser(u);
  }

  function logout() {
    localStorage.removeItem("vayu_jwt");
    localStorage.removeItem("vayu_role");
    localStorage.removeItem("vayu_demo");
    setToken(null);
    setUser(null);
    // Hard redirect: clears SWR cache, DemoContext state, and all React state
    // so the next session starts completely fresh. router.push() leaves stale
    // context alive and allows the back button to momentarily re-show the
    // authenticated dashboard.
    window.location.href = "/login";
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
