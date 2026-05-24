"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import useSWR from "swr";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuth } from "@/lib/authContext";
import { getBackendUrl } from "@/lib/constants";

// ─── Types ───────────────────────────────────────────────────────────────────

type InitStatus = "upcoming" | "fulfilled" | "not_fulfilled" | "cancelled";
type ApprovalStatus = "pending" | "approved" | "rejected";
type ApprovalType = "selfie" | "member" | "report";

interface RequestInitiative {
  id: string; title: string; category: string; location_name: string;
  scheduled_at: string; created_by: string; participants: number; target: number;
  status: InitStatus; pa_awarded: number; outcome?: string;
}

interface ApprovalRequest {
  id: string; type: ApprovalType; name: string; description: string;
  ts: number; status: ApprovalStatus; meta?: string;
}

// Real user shape from the backend
interface PendingUser {
  id: string; name: string; username: string; role: string;
  ward_id: string; phone: string | null; created_at: string; status: string;
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const INIT_DEMO: RequestInitiative[] = [
  { id: "i1", title: "Bagmati Riverside Cleanup", category: "waste_cleanup", location_name: "Bagmati Bridge, Ward 11", scheduled_at: new Date(Date.now() - 86400000 * 15).toISOString(), created_by: "Anisha Tamang", participants: 47, target: 30, status: "fulfilled", pa_awarded: 1410, outcome: "2.3 tonnes cleared, 800 m riverbank restored" },
  { id: "i2", title: "School Tree Planting Drive", category: "tree_planting", location_name: "Thimi Secondary School", scheduled_at: new Date(Date.now() - 86400000 * 28).toISOString(), created_by: "Ward Executive", participants: 38, target: 50, status: "fulfilled", pa_awarded: 1140, outcome: "42 saplings planted, drip irrigation laid" },
  { id: "i3", title: "Air Quality Awareness Walk", category: "awareness_drive", location_name: "Thimi Chowk", scheduled_at: new Date(Date.now() - 86400000 * 5).toISOString(), created_by: "Ram Bahadur", participants: 9, target: 40, status: "not_fulfilled", pa_awarded: 0, outcome: "Cancelled due to heavy rain" },
  { id: "i4", title: "Community Garden Setup", category: "community_garden", location_name: "Madhyapur Park, Ward 11", scheduled_at: new Date(Date.now() + 86400000 * 3).toISOString(), created_by: "Maya Shrestha", participants: 14, target: 25, status: "upcoming", pa_awarded: 0 },
  { id: "i5", title: "Air Sensor Node Deployment", category: "air_monitoring", location_name: "Balkumari Junction", scheduled_at: new Date(Date.now() + 86400000 * 7).toISOString(), created_by: "Ward Executive", participants: 6, target: 10, status: "upcoming", pa_awarded: 0 },
];

const APPROVAL_DEMO: ApprovalRequest[] = [
  { id: "a1", type: "selfie", name: "Priya Sharma", description: "Mask selfie — high confidence (0.97)", ts: Math.floor(Date.now() / 1000) - 300, status: "pending", meta: "AQI 167 · PM2.5 68.4" },
  { id: "a3", type: "report", name: "Hari Bahadur", description: "Commute report — alt route taken, AQI diff +52", ts: Math.floor(Date.now() / 1000) - 3600, status: "approved", meta: "+20 PA awarded" },
  { id: "a4", type: "selfie", name: "Bikash Pun", description: "Mask selfie — high confidence (0.95)", ts: Math.floor(Date.now() / 1000) - 5400, status: "approved", meta: "+20 PA awarded" },
  { id: "a5", type: "selfie", name: "Kamala Devi", description: "Mask selfie — no mask detected (0.22)", ts: Math.floor(Date.now() / 1000) - 7200, status: "rejected", meta: "No mask visible" },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const CAT_META: Record<string, { icon: string; color: string; label: string }> = {
  waste_cleanup:    { icon: "🧹", color: "#e8600a", label: "Waste Cleanup" },
  tree_planting:    { icon: "🌳", color: "#4fa870", label: "Tree Planting" },
  air_monitoring:   { icon: "📡", color: "#2d7a9a", label: "Air Monitoring" },
  community_garden: { icon: "🌱", color: "#d4a017", label: "Community Garden" },
  awareness_drive:  { icon: "📢", color: "#7b2d8b", label: "Awareness Drive" },
};

const STATUS_META: Record<InitStatus, { label: string; color: string; bg: string; icon: string }> = {
  upcoming:      { label: "Upcoming",      color: "#2d7a9a", bg: "rgba(45,122,154,0.12)",  icon: "🕐" },
  fulfilled:     { label: "Fulfilled",     color: "#4fa870", bg: "rgba(79,168,112,0.12)",  icon: "✅" },
  not_fulfilled: { label: "Not Fulfilled", color: "#c44b2b", bg: "rgba(196,75,43,0.12)",   icon: "❌" },
  cancelled:     { label: "Cancelled",     color: "#4d7a5e", bg: "rgba(77,122,94,0.08)",   icon: "⊘" },
};

const APPROVAL_TYPE_META: Record<ApprovalType, { icon: string; color: string; label: string }> = {
  selfie: { icon: "😷", color: "#4fa870", label: "Selfie" },
  member: { icon: "👤", color: "#2d7a9a", label: "Member" },
  report: { icon: "📍", color: "#d4a017", label: "Report" },
};

const APPROVAL_STATUS_META: Record<ApprovalStatus, { color: string; bg: string; label: string }> = {
  pending:  { color: "#d4a017", bg: "rgba(212,160,23,0.12)",  label: "Pending" },
  approved: { color: "#4fa870", bg: "rgba(79,168,112,0.12)",  label: "Approved" },
  rejected: { color: "#c44b2b", bg: "rgba(196,75,43,0.12)",   label: "Rejected" },
};

const ROLE_COLOR: Record<string, string> = {
  individual: "#4fa870",
  farmer:     "#d4a017",
  executive:  "#2d7a9a",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(ts: number) {
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 flex-1 py-3 rounded-xl"
      style={{ background: `${color}10`, border: `1px solid ${color}25` }}>
      <span className="font-display text-2xl font-bold" style={{ color }}>{value}</span>
      <span className="text-[9px] uppercase tracking-[0.6px]" style={{ color: "#4d7a5e" }}>{label}</span>
    </div>
  );
}

// ─── Initiative row ───────────────────────────────────────────────────────────

function InitiativeRow({
  item, onMarkFulfilled, onMarkNotFulfilled,
}: { item: RequestInitiative; onMarkFulfilled: (id: string) => void; onMarkNotFulfilled: (id: string) => void }) {
  const cat = CAT_META[item.category] ?? CAT_META.awareness_drive;
  const st  = STATUS_META[item.status];
  const pct = Math.min(100, Math.round((item.participants / item.target) * 100));

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "#0d1f12", border: "1px solid rgba(61,139,94,0.14)", borderLeft: `3px solid ${cat.color}` }}>
      <div className="px-4 pt-3 pb-3 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{cat.icon}</span>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: `${cat.color}20`, color: cat.color }}>{cat.label}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                  style={{ background: st.bg, color: st.color }}>{st.icon} {st.label}</span>
              </div>
              <h3 className="text-sm font-semibold text-parchment leading-snug">{item.title}</h3>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5">
          <span className="text-[11px]" style={{ color: "#8aad96" }}>📍 {item.location_name}</span>
          <span className="text-[11px]" style={{ color: "#8aad96" }}>📅 {fmtDate(item.scheduled_at)}</span>
          <span className="text-[11px]" style={{ color: "#8aad96" }}>👤 by {item.created_by}</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[10px]">
            <span style={{ color: "#4d7a5e" }}>Participants</span>
            <span className="tabular-nums font-semibold" style={{ color: pct >= 100 ? "#4fa870" : "#8aad96" }}>
              {item.participants} / {item.target} ({pct}%)
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1a2f20" }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: pct >= 100 ? "linear-gradient(90deg,#3d8b5e,#4fa870)" : "linear-gradient(90deg,#2d5040,#3d8b5e)" }} />
          </div>
        </div>
        {item.outcome && (
          <p className="text-[11px] leading-relaxed" style={{ color: "#4d7a5e" }}>{item.outcome}</p>
        )}
        {item.pa_awarded > 0 && (
          <span className="text-[10px] font-semibold" style={{ color: "#d4a017" }}>
            ⚡ {item.pa_awarded} PA awarded to participants
          </span>
        )}
        {item.status === "upcoming" && (
          <div className="flex gap-2 pt-1">
            <button onClick={() => onMarkFulfilled(item.id)}
              className="flex-1 py-1.5 rounded-xl text-[11px] font-semibold transition-opacity hover:opacity-80"
              style={{ background: "rgba(79,168,112,0.12)", border: "1px solid rgba(79,168,112,0.3)", color: "#4fa870" }}>
              ✅ Mark Fulfilled
            </button>
            <button onClick={() => onMarkNotFulfilled(item.id)}
              className="flex-1 py-1.5 rounded-xl text-[11px] font-semibold transition-opacity hover:opacity-80"
              style={{ background: "rgba(196,75,43,0.08)", border: "1px solid rgba(196,75,43,0.2)", color: "#c44b2b" }}>
              ❌ Mark Not Fulfilled
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Demo approval row (selfie / report) ─────────────────────────────────────

function ApprovalRow({
  item, onApprove, onReject,
}: { item: ApprovalRequest; onApprove: (id: string) => void; onReject: (id: string) => void }) {
  const type = APPROVAL_TYPE_META[item.type];
  const st   = APPROVAL_STATUS_META[item.status];

  return (
    <div className="rounded-2xl px-4 py-3 flex flex-col gap-2"
      style={{ background: "#0d1f12", border: "1px solid rgba(61,139,94,0.12)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xl"
            style={{ background: `${type.color}15`, border: `1px solid ${type.color}30` }}>
            {type.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-parchment">{item.name}</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: `${type.color}18`, color: type.color }}>{type.label}</span>
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: st.bg, color: st.color }}>{st.label}</span>
            </div>
            <p className="text-[11px] mt-0.5 leading-snug truncate" style={{ color: "#8aad96" }}>{item.description}</p>
            {item.meta && <p className="text-[10px] mt-0.5" style={{ color: "#4d7a5e" }}>{item.meta}</p>}
          </div>
        </div>
        <span className="text-[9px] shrink-0" style={{ color: "#2d5040" }}>{timeAgo(item.ts)}</span>
      </div>
      {item.status === "pending" && (
        <div className="flex gap-2 pt-1">
          <button onClick={() => onApprove(item.id)}
            className="flex-1 py-1.5 rounded-xl text-[11px] font-semibold transition-opacity hover:opacity-80"
            style={{ background: "rgba(79,168,112,0.12)", border: "1px solid rgba(79,168,112,0.3)", color: "#4fa870" }}>
            ✓ Approve
          </button>
          <button onClick={() => onReject(item.id)}
            className="flex-1 py-1.5 rounded-xl text-[11px] font-semibold transition-opacity hover:opacity-80"
            style={{ background: "rgba(196,75,43,0.08)", border: "1px solid rgba(196,75,43,0.2)", color: "#c44b2b" }}>
            ✕ Reject
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Live member registration card ───────────────────────────────────────────

function MemberPendingRow({
  user, token, onAction,
}: { user: PendingUser; token: string; onAction: () => void }) {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [loading, setLoading] = useState(false);
  const roleColor = ROLE_COLOR[user.role] || "#4fa870";

  async function act(action: "approve" | "reject") {
    setLoading(true);
    try {
      await fetch(`${getBackendUrl()}/api/auth/${action}/${user.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setStatus(action === "approve" ? "approved" : "rejected");
      onAction(); // refetch pending list
    } finally {
      setLoading(false);
    }
  }

  const regTs = Math.floor(new Date(user.created_at).getTime() / 1000);
  const st = APPROVAL_STATUS_META[status];

  return (
    <div className="rounded-2xl px-4 py-3 flex flex-col gap-2"
      style={{
        background: status === "pending" ? "rgba(45,122,154,0.06)" : "#0d1f12",
        border: status === "pending" ? "1px solid rgba(45,122,154,0.3)" : "1px solid rgba(61,139,94,0.12)",
      }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xl"
            style={{ background: `${roleColor}15`, border: `1px solid ${roleColor}30` }}>
            👤
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-parchment">{user.name}</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: `${roleColor}18`, color: roleColor }}>
                {user.role}
              </span>
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: st.bg, color: st.color }}>{st.label}</span>
              {status === "pending" && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded animate-pulse"
                  style={{ background: "rgba(45,122,154,0.15)", color: "#2d7a9a" }}>
                  LIVE
                </span>
              )}
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: "#8aad96" }}>
              @{user.username} · Ward {user.ward_id}
            </p>
            <p className="text-[10px] font-mono mt-0.5" style={{ color: "#4d7a5e" }}>
              {user.phone ?? "No phone provided"}
              {!user.phone && (
                <span className="ml-1 text-[9px]" style={{ color: "#c44b2b" }}>
                  ⚠ Phone missing — won't receive WhatsApp
                </span>
              )}
            </p>
          </div>
        </div>
        <span className="text-[9px] shrink-0" style={{ color: "#2d5040" }}>{timeAgo(regTs)}</span>
      </div>

      {status === "pending" && (
        <div className="flex gap-2 pt-1">
          <button disabled={loading} onClick={() => act("approve")}
            className="flex-1 py-2 rounded-xl text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-50"
            style={{ background: "rgba(79,168,112,0.15)", border: "1px solid rgba(79,168,112,0.4)", color: "#4fa870" }}>
            {loading ? "…" : "✓ Approve → Add to Ward"}
          </button>
          <button disabled={loading} onClick={() => act("reject")}
            className="flex-1 py-2 rounded-xl text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-50"
            style={{ background: "rgba(196,75,43,0.08)", border: "1px solid rgba(196,75,43,0.2)", color: "#c44b2b" }}>
            {loading ? "…" : "✕ Reject"}
          </button>
        </div>
      )}

      {status === "approved" && (
        <div className="text-xs text-emerald-400 font-medium">
          ✓ Approved — can now log in · phone included in future WhatsApp advisories
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RequestsPage() {
  const [activeTab, setActiveTab] = useState<"initiatives" | "approvals">("initiatives");
  const [initiatives, setInitiatives] = useState<RequestInitiative[]>(INIT_DEMO);
  const [approvals,   setApprovals]   = useState<ApprovalRequest[]>(APPROVAL_DEMO);
  const [toast, setToast] = useState<string | null>(null);

  const { isDemo } = useCurrentUser();
  const { token } = useAuth();
  const isLiveExec = !isDemo && !!token;

  // Fetch real pending users when logged in as executive
  const { data: pendingUsers, mutate: refetchPending } = useSWR<PendingUser[]>(
    isLiveExec ? "pending-users" : null,
    async () => {
      const r = await fetch(`${getBackendUrl()}/api/auth/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return [];
      return r.json() as Promise<PendingUser[]>;
    },
    { refreshInterval: 10000 } // poll every 10 seconds so new registrations appear
  );

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function markFulfilled(id: string) {
    setInitiatives((prev) =>
      prev.map((i) => i.id === id ? { ...i, status: "fulfilled" as InitStatus, pa_awarded: Math.round(i.participants * 30), outcome: "Marked fulfilled by ward executive" } : i)
    );
    showToast("Initiative marked as fulfilled · PA awarded");
  }

  function markNotFulfilled(id: string) {
    setInitiatives((prev) =>
      prev.map((i) => i.id === id ? { ...i, status: "not_fulfilled" as InitStatus, outcome: "Marked not fulfilled by ward executive" } : i)
    );
    showToast("Initiative marked as not fulfilled");
  }

  function approve(id: string) {
    setApprovals((prev) => prev.map((a) => a.id === id ? { ...a, status: "approved" as ApprovalStatus, meta: "+20 PA awarded" } : a));
    showToast("Request approved · PA awarded");
  }

  function reject(id: string) {
    setApprovals((prev) => prev.map((a) => a.id === id ? { ...a, status: "rejected" as ApprovalStatus } : a));
    showToast("Request rejected");
  }

  const fulfilled    = initiatives.filter((i) => i.status === "fulfilled").length;
  const notFulfilled = initiatives.filter((i) => i.status === "not_fulfilled").length;
  const upcoming     = initiatives.filter((i) => i.status === "upcoming").length;
  const totalPA      = initiatives.reduce((s, i) => s + i.pa_awarded, 0);

  const pendingApprovals = approvals.filter((a) => a.status === "pending").length;
  const livePending      = pendingUsers?.filter((u) => u.status === "pending") ?? [];
  const totalPendingBadge = isLiveExec ? livePending.length : pendingApprovals;

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto">

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl text-xs font-semibold shadow-lg"
          style={{ background: "rgba(61,139,94,0.92)", color: "#0a1a0f", backdropFilter: "blur(12px)" }}>
          {toast}
        </div>
      )}

      <h1 className="font-display text-2xl font-semibold text-parchment">Requests</h1>

      <div className="flex gap-1 p-1 rounded-2xl"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(61,139,94,0.12)" }}>
        {([
          ["initiatives", "🤝 Initiatives"],
          ["approvals", `📋 Approvals${totalPendingBadge > 0 ? ` · ${totalPendingBadge}` : ""}`],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
            style={activeTab === t
              ? { background: "#1a2f20", color: "#7dc99a", border: "1px solid rgba(61,139,94,0.3)" }
              : { color: "#4d7a5e" }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── INITIATIVES TAB ── */}
      {activeTab === "initiatives" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-4 gap-2">
            <StatPill label="Upcoming"      value={upcoming}     color="#2d7a9a" />
            <StatPill label="Fulfilled"     value={fulfilled}    color="#4fa870" />
            <StatPill label="Not Fulfilled" value={notFulfilled} color="#c44b2b" />
            <StatPill label="PA Awarded"    value={totalPA}      color="#d4a017" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(["all", "upcoming", "fulfilled", "not_fulfilled"] as const).map((f) => {
              const count = f === "all" ? initiatives.length : initiatives.filter((i) => i.status === f).length;
              const st = f === "all" ? null : STATUS_META[f];
              return (
                <span key={f} className="px-2.5 py-1 rounded-full text-[10px] font-semibold cursor-default"
                  style={st
                    ? { background: st.bg, color: st.color, border: `1px solid ${st.color}40` }
                    : { background: "rgba(61,139,94,0.08)", color: "#7dc99a", border: "1px solid rgba(61,139,94,0.25)" }}>
                  {f === "all" ? "All" : STATUS_META[f].label} · {count}
                </span>
              );
            })}
          </div>
          <div className="flex flex-col gap-3">
            {initiatives.map((item) => (
              <InitiativeRow key={item.id} item={item} onMarkFulfilled={markFulfilled} onMarkNotFulfilled={markNotFulfilled} />
            ))}
          </div>
        </div>
      )}

      {/* ── APPROVALS TAB ── */}
      {activeTab === "approvals" && (
        <div className="flex flex-col gap-4">

          {/* ── LIVE MODE: real registrations from backend ── */}
          {isLiveExec && (
            <>
              <div className="rounded-xl px-4 py-3 flex items-center gap-2"
                style={{ background: "rgba(45,122,154,0.08)", border: "1px solid rgba(45,122,154,0.25)" }}>
                <span className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: "#4fa870", animation: "pulse-dot 1.6s infinite" }} />
                <span className="text-xs font-semibold" style={{ color: "#4fa870" }}>
                  Live Mode — showing real registrations from backend
                </span>
                <span className="text-xs ml-auto" style={{ color: "#4d7a5e" }}>
                  Auto-refreshes every 10s
                </span>
              </div>

              {livePending.length === 0 ? (
                <div className="rounded-xl px-4 py-6 text-center"
                  style={{ background: "#0d1f12", border: "1px solid rgba(61,139,94,0.12)" }}>
                  <div className="text-2xl mb-2">📭</div>
                  <p className="text-sm font-medium" style={{ color: "#4d7a5e" }}>No pending registrations</p>
                  <p className="text-xs mt-1" style={{ color: "#2d5040" }}>
                    Share the registration link: <span className="font-mono">/register</span>
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1" style={{ background: "rgba(212,160,23,0.2)" }} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.8px]" style={{ color: "#d4a017" }}>
                      Awaiting Approval · {livePending.length}
                    </span>
                    <div className="h-px flex-1" style={{ background: "rgba(212,160,23,0.2)" }} />
                  </div>
                  <div className="flex flex-col gap-2">
                    {livePending.map((u) => (
                      <MemberPendingRow
                        key={u.id}
                        user={u}
                        token={token!}
                        onAction={() => {
                          void refetchPending();
                          showToast("User approved — they can now log in and will receive WhatsApp alerts");
                        }}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Show already-reviewed users from this session */}
              {(pendingUsers?.filter((u) => u.status !== "pending") ?? []).length > 0 && (
                <>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-px flex-1" style={{ background: "rgba(61,139,94,0.12)" }} />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.8px]" style={{ color: "#4d7a5e" }}>
                      Approved Members
                    </span>
                    <div className="h-px flex-1" style={{ background: "rgba(61,139,94,0.12)" }} />
                  </div>
                  <div className="flex flex-col gap-2">
                    {pendingUsers?.filter((u) => u.status !== "pending").map((u) => (
                      <div key={u.id} className="rounded-xl px-4 py-2.5 flex items-center gap-3"
                        style={{ background: "#0d1f12", border: "1px solid rgba(61,139,94,0.1)" }}>
                        <span className="text-xs text-parchment font-medium">{u.name}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                          style={{ background: `${ROLE_COLOR[u.role] || "#4fa870"}18`, color: ROLE_COLOR[u.role] || "#4fa870" }}>
                          {u.role}
                        </span>
                        <span className="text-[10px] font-mono ml-auto" style={{ color: "#4d7a5e" }}>
                          {u.phone ?? "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── DEMO MODE: hardcoded data ── */}
          {!isLiveExec && (
            <>
              <div className="rounded-xl px-4 py-2 text-xs"
                style={{ background: "rgba(212,160,23,0.06)", border: "1px solid rgba(212,160,23,0.2)", color: "#d4a017" }}>
                Demo mode — showing sample data. Log in as <span className="font-mono font-bold">exec</span> (Live Login) to see real registrations.
              </div>

              <div className="grid grid-cols-3 gap-2">
                <StatPill label="Pending"  value={pendingApprovals}  color="#d4a017" />
                <StatPill label="Approved" value={approvals.filter((a) => a.status === "approved").length} color="#4fa870" />
                <StatPill label="Rejected" value={approvals.filter((a) => a.status === "rejected").length} color="#c44b2b" />
              </div>

              {pendingApprovals > 0 && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1" style={{ background: "rgba(212,160,23,0.2)" }} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.8px]" style={{ color: "#d4a017" }}>
                      Pending · {pendingApprovals}
                    </span>
                    <div className="h-px flex-1" style={{ background: "rgba(212,160,23,0.2)" }} />
                  </div>
                  <div className="flex flex-col gap-2">
                    {approvals.filter((a) => a.status === "pending").map((item) => (
                      <ApprovalRow key={item.id} item={item} onApprove={approve} onReject={reject} />
                    ))}
                  </div>
                </>
              )}
              <div className="flex items-center gap-2 mt-1">
                <div className="h-px flex-1" style={{ background: "rgba(61,139,94,0.12)" }} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.8px]" style={{ color: "#4d7a5e" }}>Reviewed</span>
                <div className="h-px flex-1" style={{ background: "rgba(61,139,94,0.12)" }} />
              </div>
              <div className="flex flex-col gap-2">
                {approvals.filter((a) => a.status !== "pending").map((item) => (
                  <ApprovalRow key={item.id} item={item} onApprove={approve} onReject={reject} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
