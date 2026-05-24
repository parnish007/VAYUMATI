import { useDemo } from "@/lib/demoContext";
import { useAuth } from "@/lib/authContext";
import type { UserRole } from "@/lib/demoContext";
import type { AuthUser } from "@/lib/authContext";

export interface CurrentUser {
  user: AuthUser | null;
  role: UserRole;
  isDemo: boolean;
  name: string;
  isAuthenticated: boolean;
}

export function useCurrentUser(): CurrentUser {
  const demo = useDemo();
  const auth = useAuth();

  // Real login always wins — never block an authenticated user with demo state
  if (auth.isAuthenticated && auth.user) {
    return {
      user: auth.user,
      role: (auth.user.role ?? "individual") as UserRole,
      isDemo: false,
      name: auth.user.name ?? "",
      isAuthenticated: true,
    };
  }

  if (demo.isDemo) {
    return {
      user: null,
      role: demo.role,
      isDemo: true,
      name:
        demo.role === "executive"
          ? "Ward Executive"
          : demo.role === "farmer"
            ? "Ram Bahadur"
            : "Anisha",
      isAuthenticated: true,
    };
  }

  return {
    user: auth.user,
    role: (auth.user?.role ?? "individual") as UserRole,
    isDemo: false,
    name: auth.user?.name ?? "",
    isAuthenticated: auth.isAuthenticated,
  };
}
