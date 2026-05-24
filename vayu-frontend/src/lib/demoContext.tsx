"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type UserRole = "individual" | "farmer" | "executive";

interface DemoContextValue {
  isDemo: boolean;
  toggleDemo: () => void;
  role: UserRole;
  setRole: (r: UserRole) => void;
  roleReady: boolean;
}

export const DemoContext = createContext<DemoContextValue>({
  isDemo: true,
  toggleDemo: () => {},
  role: "individual",
  setRole: () => {},
  roleReady: false,
});

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemo, setIsDemo] = useState(true);
  const [role, setRoleState] = useState<UserRole>("individual");
  const [roleReady, setRoleReady] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem("vayu_role") as UserRole | null;
    const savedDemo = localStorage.getItem("vayu_demo");
    if (savedRole) setRoleState(savedRole);
    if (savedDemo !== null) setIsDemo(savedDemo === "true");
    setRoleReady(true);
  }, []);

  function toggleDemo() {
    setIsDemo((v) => {
      const next = !v;
      localStorage.setItem("vayu_demo", String(next));
      return next;
    });
  }

  function setRole(r: UserRole) {
    setRoleState(r);
    localStorage.setItem("vayu_role", r);
    // setRole is only called from demo mode entry — always activate demo
    setIsDemo(true);
    localStorage.setItem("vayu_demo", "true");
  }

  return (
    <DemoContext.Provider value={{ isDemo, toggleDemo, role, setRole, roleReady }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  return useContext(DemoContext);
}
