"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuth } from "@/lib/authContext";
import { DEFAULT_WARD_ID, getBackendUrl } from "@/lib/constants";


interface Member {
  id: string;
  username: string;
  name: string;
  role: string;
  ward_id: string;
  phone?: string | null;
  avatar_url?: string | null;
  status: string;
  created_at?: string;
}

const DEMO_PENDING: Member[] = [
  {
    id: "p1",
    username: "sita123",
    name: "Sita Rai",
    role: "individual",
    ward_id: "11",
    phone: "+977-9800000011",
    status: "pending",
    avatar_url: "https://i.pravatar.cc/150?img=47",
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "p2",
    username: "krishna_f",
    name: "Krishna Tamang",
    role: "farmer",
    ward_id: "11",
    phone: "+977-9800000012",
    status: "pending",
    avatar_url: "https://i.pravatar.cc/150?img=11",
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
];

const DEMO_APPROVED: Member[] = [
  {
    id: "u1",
    username: "anisha",
    name: "Anisha Tamang",
    role: "individual",
    ward_id: "11",
    phone: "+977-9800000001",
    status: "approved",
    avatar_url: "https://i.pravatar.cc/150?img=5",
    created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
  },
  {
    id: "u2",
    username: "ram",
    name: "Ram Bahadur Shrestha",
    role: "farmer",
    ward_id: "11",
    phone: "+977-9800000002",
    status: "approved",
    avatar_url: "https://i.pravatar.cc/150?img=14",
    created_at: new Date(Date.now() - 86400000 * 25).toISOString(),
  },
  {
    id: "u3",
    username: "exec",
    name: "Ward 11 Executive",
    role: "executive",
    ward_id: "11",
    phone: "+977-9800000003",
    status: "approved",
    avatar_url: "https://i.pravatar.cc/150?img=33",
    created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
  },
  {
    id: "u4",
    username: "maya_s",
    name: "Maya Shrestha",
    role: "individual",
    ward_id: "11",
    phone: "+977-9800000004",
    status: "approved",
    avatar_url: "https://i.pravatar.cc/150?img=9",
    created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
  },
  {
    id: "u5",
    username: "hari_kc",
    name: "Hari KC",
    role: "individual",
    ward_id: "11",
    phone: "+977-9800000005",
    status: "approved",
    avatar_url: "https://i.pravatar.cc/150?img=7",
    created_at: new Date(Date.now() - 86400000 * 18).toISOString(),
  },
  {
    id: "u6",
    username: "bikash_p",
    name: "Bikash Pun",
    role: "individual",
    ward_id: "11",
    phone: "+977-9800000006",
    status: "approved",
    avatar_url: "https://i.pravatar.cc/150?img=19",
    created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
  },
];

const ROLE_COLORS: Record<string, string> = {
  individual: "#4fa870",
  farmer: "#d4a017",
  executive: "#2d7a9a",
};
const ROLE_ICONS: Record<string, string> = {
  individual: "🚶",
  farmer: "🌾",
  executive: "🏛️",
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function Avatar({ member }: { member: Member }) {
  const initials = member.name.slice(0, 2).toUpperCase();
  const color = ROLE_COLORS[member.role] ?? "#4fa870";
  if (member.avatar_url) {
    return (
      <img
        src={member.avatar_url}
        alt={member.name}
        className="w-9 h-9 rounded-full object-cover"
      />
    );
  }
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
      style={{ background: `${color}20`, color, border: `1.5px solid ${color}40` }}
    >
      {initials}
    </div>
  );
}

export default function MembersPage() {
  const { role, isDemo } = useCurrentUser();
  const { token } = useAuth();
  const [roleFilter, setRoleFilter] = useState<
    "all" | "individual" | "farmer" | "executive"
  >("all");
  const [approving, setApproving] = useState<Set<string>>(new Set());

  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  // Always call hooks unconditionally — gate data via SWR key nulling
  const isExec = role === "executive";

  const { data: pendingRaw, isLoading: pendingLoading, mutate: mutatePending } =
    useSWR<Member[]>(
      !isExec || isDemo
        ? null
        : `${getBackendUrl()}/api/auth/pending`,
      async (url: string) => {
        const r = await fetch(url, { headers: authHeaders });
        return r.ok ? r.json() : [];
      },
      { refreshInterval: 30_000 }
    );

  const { data: membersRaw, isLoading: membersLoading, mutate: mutateMembers } =
    useSWR<Member[]>(
      !isExec || isDemo
        ? null
        : `${getBackendUrl()}/api/auth/members?ward_id=${DEFAULT_WARD_ID}`,
      async (url: string) => {
        const r = await fetch(url, { headers: authHeaders });
        return r.ok ? r.json() : [];
      },
      { refreshInterval: 60_000 }
    );

  // Access guard — rendered after hooks to satisfy rules-of-hooks
  if (!isExec) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="text-center py-12 px-8 max-w-sm">
          <p className="text-4xl mb-4">🔒</p>
          <p className="font-display text-lg text-parchment mb-2">Executive Access Only</p>
          <p className="text-sm text-mist">This page is restricted to Ward Executives.</p>
        </Card>
      </div>
    );
  }

  const pending = isDemo ? DEMO_PENDING : (pendingRaw ?? []);
  const members = isDemo ? DEMO_APPROVED : (membersRaw ?? []);
  const filtered =
    roleFilter === "all" ? members : members.filter((m) => m.role === roleFilter);

  async function handleApprove(id: string) {
    setApproving((prev) => {
      const n = new Set(prev);
      n.add(id);
      return n;
    });
    try {
      if (!isDemo) {
        await fetch(`${getBackendUrl()}/api/auth/approve/${id}`, {
          method: "POST",
          headers: authHeaders,
        });
      }
      mutatePending((prev) => prev?.filter((m) => m.id !== id) ?? []);
      mutateMembers();
    } finally {
      setApproving((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  }

  async function handleReject(id: string) {
    setApproving((prev) => {
      const n = new Set(prev);
      n.add(id);
      return n;
    });
    try {
      if (!isDemo) {
        await fetch(`${getBackendUrl()}/api/auth/reject/${id}`, {
          method: "POST",
          headers: authHeaders,
        });
      }
      mutatePending((prev) => prev?.filter((m) => m.id !== id) ?? []);
    } finally {
      setApproving((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  }

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-parchment">Members</h1>
          <p className="text-xs mt-0.5" style={{ color: "#4d7a5e" }}>
            Ward {DEFAULT_WARD_ID} · {members.length} registered
          </p>
        </div>
        {pending.length > 0 && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{
              background: "rgba(196,75,43,0.1)",
              border: "1px solid rgba(196,75,43,0.3)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#c44b2b", animation: "pulse-dot 1.6s infinite" }}
            />
            <span className="text-[11px] font-bold" style={{ color: "#c44b2b" }}>
              {pending.length} pending
            </span>
          </div>
        )}
      </div>

      {/* Pending Approvals */}
      {(pending.length > 0 || pendingLoading) && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-parchment flex items-center gap-2">
            Pending Approvals
            <span
              className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
              style={{ background: "rgba(196,75,43,0.2)", color: "#c44b2b" }}
            >
              {pending.length}
            </span>
          </h2>
          {pendingLoading && !isDemo ? (
            [...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))
          ) : (
            pending.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 p-4 rounded-2xl"
                style={{
                  background: "rgba(196,75,43,0.06)",
                  border: "1px solid rgba(196,75,43,0.2)",
                }}
              >
                <Avatar member={m} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-parchment">{m.name}</p>
                  <p className="text-[11px]" style={{ color: "#8aad96" }}>
                    @{m.username} · {ROLE_ICONS[m.role] ?? "👤"} {m.role}
                  </p>
                  {m.phone && (
                    <p className="text-[10px]" style={{ color: "#4d7a5e" }}>
                      {m.phone}
                    </p>
                  )}
                  {m.created_at && (
                    <p className="text-[10px]" style={{ color: "#4d7a5e" }}>
                      Requested {timeAgo(m.created_at)}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleApprove(m.id)}
                    disabled={approving.has(m.id)}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-bold disabled:opacity-50"
                    style={{
                      background: "rgba(79,168,112,0.15)",
                      border: "1px solid rgba(79,168,112,0.4)",
                      color: "#7dc99a",
                    }}
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => handleReject(m.id)}
                    disabled={approving.has(m.id)}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-bold disabled:opacity-50"
                    style={{
                      background: "rgba(196,75,43,0.08)",
                      border: "1px solid rgba(196,75,43,0.25)",
                      color: "#c44b2b",
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Member Directory */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-parchment">Member Directory</h2>
          <div className="flex gap-1">
            {(
              ["all", "individual", "farmer", "executive"] as const
            ).map((f) => (
              <button
                key={f}
                onClick={() => setRoleFilter(f)}
                className="px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wide transition-all capitalize"
                style={
                  roleFilter === f
                    ? {
                        background: "#1a2f20",
                        color: "#7dc99a",
                        border: "1px solid rgba(61,139,94,0.3)",
                      }
                    : { color: "#4d7a5e" }
                }
              >
                {f === "all" ? "All" : (ROLE_ICONS[f] ?? f)}
              </button>
            ))}
          </div>
        </div>

        {membersLoading && !isDemo ? (
          [...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-2xl" />
          ))
        ) : filtered.length === 0 ? (
          <Card>
            <p className="text-mist text-sm text-center py-6">No members found.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((m) => {
              const roleColor = ROLE_COLORS[m.role] ?? "#4fa870";
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                  style={{
                    background: "#0d1f12",
                    border: "1px solid rgba(61,139,94,0.1)",
                  }}
                >
                  <Avatar member={m} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-parchment">{m.name}</p>
                    <p className="text-[10px]" style={{ color: "#4d7a5e" }}>
                      @{m.username}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
                      style={{ background: `${roleColor}15`, color: roleColor }}
                    >
                      {ROLE_ICONS[m.role] ?? "👤"} {m.role}
                    </span>
                    {m.created_at && (
                      <span className="text-[9px]" style={{ color: "#2d5040" }}>
                        joined {timeAgo(m.created_at)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
