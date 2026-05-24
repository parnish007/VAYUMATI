"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDemo, type UserRole } from "@/lib/demoContext";
import { useAuth } from "@/lib/authContext";

const ROLES: {
  id: UserRole;
  icon: string;
  title: string;
  subtitle: string;
  bullets: string[];
  color: string;
  bg: string;
  border: string;
}[] = [
  {
    id: "individual",
    icon: "🚶",
    title: "Individual",
    subtitle: "Ward Member",
    bullets: ["Track personal exposure", "Earn PA rewards", "Community mask wall", "MATI alerts"],
    color: "#4fa870",
    bg: "rgba(79,168,112,0.08)",
    border: "rgba(79,168,112,0.30)",
  },
  {
    id: "farmer",
    icon: "🌾",
    title: "Farmer",
    subtitle: "Agricultural Member",
    bullets: [
      "Soil pH & moisture alerts",
      "Fertilisation advisories",
      "Acid deposition warnings",
      "Crop protection tips",
    ],
    color: "#d4a017",
    bg: "rgba(212,160,23,0.08)",
    border: "rgba(212,160,23,0.30)",
  },
  {
    id: "executive",
    icon: "🏛️",
    title: "Ward Executive",
    subtitle: "Governance Role",
    bullets: ["Live sensor grid", "Ward analytics", "Member management", "All features"],
    color: "#2d7a9a",
    bg: "rgba(45,122,154,0.08)",
    border: "rgba(45,122,154,0.30)",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { setRole, roleReady } = useDemo();
  const { login, isAuthenticated } = useAuth();
  const [tab, setTab] = useState<"demo" | "live">("demo");
  const [selected, setSelected] = useState<UserRole | null>(null);
  const [entering, setEntering] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    if (!roleReady) return;
    const savedRole = localStorage.getItem("vayu_role") as UserRole | null;
    if (savedRole && localStorage.getItem("vayu_demo") !== "false") {
      router.replace("/dashboard");
    }
    if (isAuthenticated) router.replace("/dashboard");
  }, [roleReady, isAuthenticated, router]);

  function enterDemo(r: UserRole) {
    setSelected(r);
    setEntering(true);
    setRole(r);
    localStorage.setItem("vayu_demo", "true");
    router.replace("/dashboard");
  }

  async function handleLiveLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLogging(true);
    try {
      await login(username, password);
      localStorage.setItem("vayu_demo", "false");
      router.replace("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLogging(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-ink px-4 py-10 gap-6">
      {/* Brand */}
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold text-parchment tracking-tight">
          Vāyu<em className="not-italic" style={{ color: "#f0bb2a" }}>Mitti</em>
        </h1>
        <p className="text-mist text-sm mt-2">Ward Environmental Intelligence · Kathmandu Valley</p>
        <div className="flex items-center justify-center gap-2 mt-3">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "#4fa870", animation: "pulse-dot 1.6s infinite" }}
          />
          <span className="text-[10px] uppercase tracking-[1px]" style={{ color: "#4fa870" }}>
            ECOTHON PRAKRITI 2026
          </span>
        </div>
      </div>

      {/* Tab switcher */}
      <div
        className="flex gap-1 p-1 rounded-2xl"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(61,139,94,0.15)",
        }}
      >
        {(["demo", "live"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-5 py-2 rounded-xl text-xs font-semibold transition-all"
            style={
              tab === t
                ? { background: "#1a2f20", color: "#7dc99a", border: "1px solid rgba(61,139,94,0.3)" }
                : { color: "#4d7a5e" }
            }
          >
            {t === "demo" ? "🎮 Demo" : "🔐 Live Login"}
          </button>
        ))}
      </div>

      {tab === "demo" ? (
        <div className="w-full max-w-3xl">
          <p className="text-center text-xs text-mist mb-5 uppercase tracking-[0.8px]">
            Select your role to continue
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ROLES.map((r) => {
              const isSel = selected === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => enterDemo(r.id)}
                  disabled={entering}
                  className="flex flex-col items-center text-center gap-3 rounded-2xl p-6 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
                  style={{
                    background: isSel ? r.bg : "rgba(17,34,23,0.9)",
                    border: `1.5px solid ${isSel ? r.border : "rgba(61,139,94,0.15)"}`,
                    boxShadow: isSel ? `0 0 24px ${r.color}22` : "none",
                    cursor: "pointer",
                  }}
                >
                  <span className="text-5xl">{r.icon}</span>
                  <div>
                    <p className="font-display text-lg font-bold text-parchment">{r.title}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: r.color }}>
                      {r.subtitle}
                    </p>
                  </div>
                  <ul className="flex flex-col gap-1.5 text-left w-full mt-1">
                    {r.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-xs" style={{ color: "#8aad96" }}>
                        <span style={{ color: r.color, marginTop: 1 }}>✓</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                  <div
                    className="w-full mt-2 py-2 rounded-xl text-xs font-semibold"
                    style={{
                      background: isSel ? r.color : `${r.color}22`,
                      color: isSel ? "#0a1a0f" : r.color,
                    }}
                  >
                    {isSel ? "Entering…" : `Continue as ${r.title}`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="w-full max-w-sm">
          <form
            onSubmit={handleLiveLogin}
            className="flex flex-col gap-4 rounded-2xl p-6"
            style={{ background: "#0d1f12", border: "1px solid rgba(61,139,94,0.2)" }}
          >
            <h2 className="font-display text-lg font-semibold text-parchment">Sign In</h2>
            {error && (
              <p
                className="text-xs rounded-xl px-3 py-2"
                style={{
                  background: "rgba(196,75,43,0.1)",
                  color: "#c44b2b",
                  border: "1px solid rgba(196,75,43,0.2)",
                }}
              >
                {error}
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium" style={{ color: "#7dc99a" }}>
                Username
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="anisha, ram, exec…"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(61,139,94,0.2)",
                  color: "#c8ddd0",
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium" style={{ color: "#7dc99a" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(61,139,94,0.2)",
                  color: "#c8ddd0",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={logging || !username || !password}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "#3d8b5e", color: "#0a1a0f" }}
            >
              {logging ? "Signing in…" : "Sign In"}
            </button>
            <a href="/register" className="text-center text-xs" style={{ color: "#4d7a5e" }}>
              New? Register for ward access →
            </a>
          </form>
          <p className="text-center text-[10px] mt-4" style={{ color: "#2d5040" }}>
            Demo credentials: anisha / ram / exec · password: Ward11#2026
          </p>
        </div>
      )}
    </div>
  );
}
