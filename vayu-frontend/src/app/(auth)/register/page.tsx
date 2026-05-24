"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBackendUrl } from "@/lib/constants";

interface RegisterForm {
  name:     string;
  username: string;
  password: string;
  phone:    string;
  role:     string;
  ward_id:  string;
}

const WARDS = [
  { id: "11", name: "Ward 11 · Madhyapur Thimi" },
  { id: "8",  name: "Ward 8 · Balkumari" },
  { id: "4",  name: "Ward 4 · Kamalbinayak" },
  { id: "15", name: "Ward 15 · Bode" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<RegisterForm>({
    name: "", username: "", password: "",
    phone: "", role: "individual", ward_id: "11",
  });
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof RegisterForm>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // Accept 10-digit Nepal number → normalise to E.164
  function normalisePhone(raw: string): string | null {
    const digits = raw.replace(/[\s\-\(\)]/g, "");
    // Already E.164
    if (digits.startsWith("+977") && digits.length === 14) return digits;
    // 10-digit Nepal number: 97X/98X/96X
    if (/^(97|98|96)\d{8}$/.test(digits)) return "+977" + digits;
    // Someone typed +977 prefix manually
    if (digits.startsWith("+") && digits.length >= 12) return digits;
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const phone = normalisePhone(form.phone.trim());
    if (!phone) {
      setError("Enter your 10-digit Nepal mobile number, e.g. 9841234567");
      return;
    }

    setLoading(true);
    try {
      const r = await fetch(`${getBackendUrl()}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, phone }),
      });
      const data = (await r.json()) as { error?: string };
      if (!r.ok) { setError(data.error ?? "Registration failed"); return; }
      setSuccess(true);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  const selectedWard = WARDS.find((w) => w.id === form.ward_id);
  const canSubmit = form.name && form.username && form.password && form.phone;

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-ink px-4 gap-6">
        <div className="text-center max-w-sm flex flex-col items-center gap-4">
          <div className="text-5xl">✅</div>
          <h2 className="font-display text-xl font-bold text-parchment">Request Submitted</h2>
          <p className="text-sm" style={{ color: "#8aad96" }}>
            Your registration for <strong>{selectedWard?.name ?? `Ward ${form.ward_id}`}</strong> is
            pending approval by the Ward Executive. Once approved you can log in and will receive
            WhatsApp environmental advisories.
          </p>
          <button onClick={() => router.push("/login")}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "#1a2f20", border: "1px solid rgba(61,139,94,0.3)", color: "#7dc99a" }}>
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-ink px-4 py-10 gap-6">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold text-parchment">
          Join {selectedWard?.name ?? `Ward ${form.ward_id}`}
        </h1>
        <p className="text-sm mt-1" style={{ color: "#4d7a5e" }}>
          Request access to VayuMitti
        </p>
      </div>

      <form onSubmit={handleSubmit}
        className="w-full max-w-sm flex flex-col gap-4 rounded-2xl p-6"
        style={{ background: "#0d1f12", border: "1px solid rgba(61,139,94,0.2)" }}>

        {error && (
          <p className="text-xs rounded-xl px-3 py-2"
            style={{ background: "rgba(196,75,43,0.1)", color: "#c44b2b", border: "1px solid rgba(196,75,43,0.2)" }}>
            {error}
          </p>
        )}

        {/* Ward — choose first so the header updates live */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-medium" style={{ color: "#7dc99a" }}>
            Select Your Ward
          </label>
          <div className="grid grid-cols-2 gap-2">
            {WARDS.map((w) => (
              <button key={w.id} type="button" onClick={() => update("ward_id", w.id)}
                className="py-2 px-3 rounded-xl text-left transition-all"
                style={form.ward_id === w.id
                  ? { background: "#1a2f20", border: "1px solid rgba(61,139,94,0.4)", color: "#7dc99a" }
                  : { background: "transparent", border: "1px solid rgba(61,139,94,0.15)", color: "#4d7a5e" }}>
                <div className="text-[11px] font-semibold">Ward {w.id}</div>
                <div className="text-[9px] mt-0.5 opacity-70">{w.name.split("·")[1]?.trim()}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Full Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium" style={{ color: "#7dc99a" }}>Full Name</label>
          <input type="text" value={form.name} onChange={(e) => update("name", e.target.value)}
            placeholder="Anisha Tamang" required autoComplete="name"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(61,139,94,0.2)", color: "#c8ddd0" }} />
        </div>

        {/* Username */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium" style={{ color: "#7dc99a" }}>Username</label>
          <input type="text" value={form.username} onChange={(e) => update("username", e.target.value.toLowerCase().replace(/\s/g, ""))}
            placeholder="anisha2026" required autoComplete="username"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none font-mono"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(61,139,94,0.2)", color: "#c8ddd0" }} />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium" style={{ color: "#7dc99a" }}>Password</label>
          <input type="password" value={form.password} onChange={(e) => update("password", e.target.value)}
            placeholder="••••••••" required autoComplete="new-password"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(61,139,94,0.2)", color: "#c8ddd0" }} />
        </div>

        {/* Mobile — Nepal 10-digit */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium flex items-center gap-1.5" style={{ color: "#7dc99a" }}>
            Mobile Number
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
              style={{ background: "rgba(79,168,112,0.12)", color: "#4fa870" }}>
              WhatsApp alerts
            </span>
          </label>
          <div className="flex items-center gap-2 rounded-xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(61,139,94,0.2)" }}>
            {/* Static Nepal prefix */}
            <div className="pl-4 pr-2 py-3 text-sm font-mono shrink-0 border-r"
              style={{ color: "#4fa870", borderColor: "rgba(61,139,94,0.2)" }}>
              🇳🇵 +977
            </div>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="9841234567"
              maxLength={10}
              required
              className="flex-1 pr-4 py-3 text-sm outline-none bg-transparent font-mono"
              style={{ color: "#c8ddd0" }}
            />
          </div>
          <p className="text-[10px]" style={{ color: "#4d7a5e" }}>
            Enter 10-digit mobile number starting with 97, 98, or 96
          </p>
        </div>

        {/* Role */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium" style={{ color: "#7dc99a" }}>I am a…</label>
          <div className="flex gap-2">
            {[{ v: "individual", label: "🚶 Individual" }, { v: "farmer", label: "🌾 Farmer" }].map(({ v, label }) => (
              <button key={v} type="button" onClick={() => update("role", v)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
                style={form.role === v
                  ? { background: "#1a2f20", border: "1px solid rgba(61,139,94,0.4)", color: "#7dc99a" }
                  : { background: "transparent", border: "1px solid rgba(61,139,94,0.15)", color: "#4d7a5e" }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <button type="submit" disabled={loading || !canSubmit}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: "#3d8b5e", color: "#0a1a0f" }}>
          {loading ? "Submitting…" : "Request Access"}
        </button>

        <a href="/login" className="text-center text-xs" style={{ color: "#4d7a5e" }}>
          ← Back to login
        </a>
      </form>
    </div>
  );
}
