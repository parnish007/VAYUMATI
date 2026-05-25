"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import { Shield, Users, Trophy, Medal, Leaf } from "lucide-react";
import { useSSE } from "@/hooks/useSSE";
import { useAir } from "@/hooks/useAir";
import { useAuth } from "@/lib/authContext";
import { useDemo } from "@/lib/demoContext";
import { getMaskWall, postMaskSelfie } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { aqiColor } from "@/lib/aqi";
import { BADGE_META, DEFAULT_WARD_ID, getBackendUrl } from "@/lib/constants";
import {
  DEMO_SELFIES,
  DEMO_PA,
  DEMO_PA_BY_ROLE,
  DEMO_USER_IDENTITY,
  DEMO_MEMBER_RANKING,
  DEMO_ACTIVITY_FEED,
  DEMO_CARBON_LEDGER_BY_ROLE,
  type ActivityEntry,
  type ActivityKind,
} from "@/lib/demoData";
import {
  PROVISIONAL_DISCLOSURE,
  carbonTier,
  diaryTypeToCarbon,
  kindToCo2eKg,
  kindToNpr,
} from "@/lib/carbon";
import type { UserRole } from "@/lib/demoContext";
import type { MaskSelfie, LeaderboardEntry } from "@/types";

const InitiativeMap = dynamic(
  () => import("@/components/community/InitiativeMap"),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          height: 320,
          background: "#0d1f12",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ color: "#4d7a5e", fontSize: 12 }}>Loading map…</span>
      </div>
    ),
  }
);

const LocationPicker = dynamic(
  () => import("@/components/community/LocationPicker"),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: 280, background: "#0d1f12", borderRadius: 12 }} />
    ),
  }
);

const WARD_ID = DEFAULT_WARD_ID;

const GRAD_PALETTES = [
  "linear-gradient(135deg,#3d8b5e,#2d7a9a)",
  "linear-gradient(135deg,#7b2d8b,#c44b2b)",
  "linear-gradient(135deg,#d4a017,#e8600a)",
  "linear-gradient(135deg,#4fa870,#3d8b5e)",
];

const CATEGORIES: Record<string, { icon: string; color: string; label: string }> = {
  waste_cleanup:    { icon: "🧹", color: "#e8600a", label: "Waste Cleanup" },
  tree_planting:    { icon: "🌳", color: "#4fa870", label: "Tree Planting" },
  air_monitoring:   { icon: "📡", color: "#2d7a9a", label: "Air Monitoring" },
  community_garden: { icon: "🌱", color: "#d4a017", label: "Community Garden" },
  awareness_drive:  { icon: "📢", color: "#7b2d8b", label: "Awareness Drive" },
};

interface Initiative {
  id: string;
  title: string;
  description: string;
  category: string;
  lat: number;
  lng: number;
  location_name: string;
  scheduled_at: string;
  created_by: { id: string; name: string; avatar_url?: string | null };
  joined_by: { id: string; name: string; avatar_url?: string | null; joined_at?: string }[];
  status: string;
  ward_id: string;
  pa_points_init: number;
  pa_points_join: number;
}

const DEMO_INITIATIVES: Initiative[] = [
  {
    id: "demo1",
    title: "Bagmati Riverside Cleanup",
    description: "Monthly community cleanup of Bagmati bank near Thimi bridge.",
    category: "waste_cleanup",
    lat: 27.6891,
    lng: 85.3812,
    location_name: "Bagmati Bridge, Ward 11",
    scheduled_at: new Date(Date.now() + 86400000 * 3).toISOString(),
    created_by: { id: "u1", name: "Anisha Tamang", avatar_url: null },
    joined_by: [{ id: "u2", name: "Ram Bahadur" }],
    status: "upcoming",
    ward_id: "11",
    pa_points_init: 30,
    pa_points_join: 10,
  },
  {
    id: "demo2",
    title: "School Tree Planting Drive",
    description: "Plant 50 saplings at Thimi Secondary School campus.",
    category: "tree_planting",
    lat: 27.6934,
    lng: 85.3876,
    location_name: "Thimi Secondary School",
    scheduled_at: new Date(Date.now() + 86400000 * 7).toISOString(),
    created_by: { id: "u3", name: "Ward Executive", avatar_url: null },
    joined_by: [
      { id: "u1", name: "Anisha Tamang" },
      { id: "u2", name: "Ram Bahadur" },
    ],
    status: "upcoming",
    ward_id: "11",
    pa_points_init: 30,
    pa_points_join: 10,
  },
  {
    id: "demo3",
    title: "Air Quality Awareness Walk",
    description: "Guided ward walk with real-time AQI readings and mask distribution.",
    category: "awareness_drive",
    lat: 27.6971,
    lng: 85.3742,
    location_name: "Thimi Chowk, Ward 11",
    scheduled_at: new Date(Date.now() + 86400000 * 14).toISOString(),
    created_by: { id: "u3", name: "Ward Executive" },
    joined_by: [],
    status: "upcoming",
    ward_id: "11",
    pa_points_init: 30,
    pa_points_join: 10,
  },
];

const DEMO_LEADERBOARD_DATA: LeaderboardEntry[] = [
  { rank: 1, ward_id: "8",  name: "Ward 8 — Madhyapur",    score: 94, aqi: 52,  pa_actions: 340, delta:  0 },
  { rank: 2, ward_id: "5",  name: "Ward 5 — Suryabinayak", score: 88, aqi: 96,  pa_actions: 287, delta:  1 },
  { rank: 3, ward_id: "3",  name: "Ward 3 — Balkumari",    score: 81, aqi: 108, pa_actions: 214, delta: -1 },
  { rank: 4, ward_id: "14", name: "Ward 14 — Sallaghari",  score: 73, aqi: 134, pa_actions: 176, delta:  2 },
  { rank: 5, ward_id: "11", name: "Ward 11 — Thimi",       score: 61, aqi: 167, pa_actions: 142, delta: -2 },
];

const ROLE_ICON: Record<string, string> = { individual: "🚶", farmer: "🌾", executive: "🏛️" };

// ─── Rank-change pill ────────────────────────────────────────────────────────
// Shows ↑3 / ↓1 / NEW / – next to a leaderboard rank. Subtle but high-signal
// for a hackathon demo: judges immediately see the leaderboard has momentum.
function RankDelta({ delta }: { delta: number | null | undefined }) {
  if (delta === undefined) return null;
  if (delta === null) {
    return (
      <span className="text-[8px] font-bold px-1 py-0.5 rounded uppercase tracking-wide"
        style={{ background: "rgba(124,196,224,0.14)", color: "#7cc4e0", border: "1px solid rgba(124,196,224,0.30)" }}>
        NEW
      </span>
    );
  }
  if (delta === 0) {
    return <span className="text-[8px] font-bold" style={{ color: "#4d7a5e" }}>—</span>;
  }
  const up = delta > 0;
  return (
    <span className="text-[8px] font-bold tabular-nums"
      style={{ color: up ? "#4fa870" : "#c44b2b" }}>
      {up ? "▲" : "▼"}{Math.abs(delta)}
    </span>
  );
}

// ─── Activity ticker (live community feed) ───────────────────────────────────
// Lightweight horizontal-flow widget at the top of the Wall tab. Updates the
// timestamp every 30s so the feed feels alive even without a real SSE stream.
const ACTIVITY_META: Record<ActivityKind, { icon: string; color: string }> = {
  selfie_approved:      { icon: "😷", color: "#4fa870" },
  alt_route:            { icon: "🛤️", color: "#2d7a9a" },
  report_submitted:     { icon: "📍", color: "#d4a017" },
  initiative_joined:    { icon: "🤝", color: "#4fa870" },
  initiative_completed: { icon: "✅", color: "#7dc99a" },
  badge_unlocked:       { icon: "🏅", color: "#f0bb2a" },
  soil_compliance:      { icon: "🌾", color: "#d4a017" },
};

// ─── Thread-style activity feed ─────────────────────────────────────────────
// Inspired by GitHub / Linear activity logs: no outer box, vertical left rail,
// typed dot nodes, monospace timestamps. Every item stands on its own row.
function ActivityFeed({ items }: { items: ActivityEntry[] }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(id);
  }, []);
  function rel(ts: number) {
    const s = now - ts;
    if (s < 60)    return "just now";
    if (s < 3600)  return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  }

  const visible = items.slice(0, 5);

  return (
    <div className="flex flex-col">
      {/* Header row — LIVE pill + count */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ background: "rgba(79,168,112,0.10)", border: "1px solid rgba(79,168,112,0.25)" }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "#4fa870", animation: "pulse-dot 1.6s infinite" }}
          />
          <span className="text-[9px] font-bold uppercase tracking-[1px]" style={{ color: "#4fa870" }}>
            Live
          </span>
        </div>
        <span className="text-[10px] font-semibold" style={{ color: "#8aad96" }}>
          Ward 11 activity
        </span>
        <span className="text-[9px] ml-auto font-mono" style={{ color: "#2d5040" }}>
          {items.length} actions · 90 min
        </span>
      </div>

      {/* Thread rows */}
      <div className="relative pl-7">
        {/* Vertical rail */}
        <div
          className="absolute left-2.5 top-2 bottom-2 w-px pointer-events-none"
          style={{ background: "linear-gradient(to bottom, rgba(61,139,94,0.35), rgba(61,139,94,0.05))" }}
        />

        {visible.map((a, idx) => {
          const meta = ACTIVITY_META[a.kind];
          const isLast = idx === visible.length - 1;
          return (
            <div key={a.id} className="relative flex items-start gap-3 pb-3">
              {/* Rail node */}
              <div
                className="absolute -left-4 top-1 w-3 h-3 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: `${meta.color}22`,
                  border: `1.5px solid ${meta.color}`,
                  boxShadow: idx === 0 ? `0 0 8px ${meta.color}55` : "none",
                }}
              >
                <span style={{ fontSize: 6, lineHeight: 1 }}>{meta.icon}</span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold" style={{ color: "#d4e8da" }}>
                    {a.actor}
                  </span>
                  <span className="text-[11px]" style={{ color: "#6a9c7a" }}>
                    {a.detail}
                  </span>
                  {a.pa != null && (
                    <span
                      className="shrink-0 px-1.5 py-px rounded text-[9px] font-bold tabular-nums"
                      style={{ background: "rgba(212,160,23,0.13)", color: "#d4a017" }}
                    >
                      +{a.pa}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-mono mt-0.5 block" style={{ color: "#2d5040" }}>
                  {rel(a.ts)} ago
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Category filter for the Initiatives tab ─────────────────────────────────
const FILTER_ALL = "all" as const;
type CategoryFilter = typeof FILTER_ALL | string;

function CategoryFilterPills({
  selected,
  onSelect,
  counts,
}: {
  selected: CategoryFilter;
  onSelect: (v: CategoryFilter) => void;
  counts: Record<string, number>;
}) {
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5"
      style={{ scrollbarWidth: "none" }}>
      <FilterPill
        active={selected === FILTER_ALL}
        onClick={() => onSelect(FILTER_ALL)}
        icon="✦"
        label="All"
        count={total}
        color="#7dc99a"
      />
      {Object.entries(CATEGORIES).map(([k, c]) => (
        <FilterPill
          key={k}
          active={selected === k}
          onClick={() => onSelect(k)}
          icon={c.icon}
          label={c.label}
          count={counts[k] ?? 0}
          color={c.color}
        />
      ))}
    </div>
  );
}

function FilterPill({
  active, onClick, icon, label, count, color,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-all shrink-0"
      style={active
        ? { background: `${color}1c`, border: `1px solid ${color}55`, color }
        : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(61,139,94,0.14)", color: "#4d7a5e" }}
    >
      <span className="text-[11px] leading-none">{icon}</span>
      <span>{label}</span>
      <span className="opacity-70 tabular-nums">· {count}</span>
    </button>
  );
}

// ─── PA / Rewards types + helpers ───────────────────────────────────────────────
interface PAResponse {
  pa_score: number;
  ward_rank?: number;
  badges: string[];
  breakdown?: Record<string, number>;
}
const TIERS = [
  { label: "Grassroot", icon: "🌱", min: 0,   max: 24,  color: "#4d7a5e", bg: "rgba(77,122,94,0.12)"   },
  { label: "Protector", icon: "🛡️", min: 25,  max: 49,  color: "#2d7a9a", bg: "rgba(45,122,154,0.12)"  },
  { label: "Champion",  icon: "⚡",  min: 50,  max: 74,  color: "#d4a017", bg: "rgba(212,160,23,0.12)"  },
  { label: "Guardian",  icon: "🌿", min: 75,  max: 99,  color: "#4fa870", bg: "rgba(79,168,112,0.12)"  },
  { label: "MATI Ally", icon: "🌟", min: 100, max: 100, color: "#f0bb2a", bg: "rgba(240,187,42,0.15)"  },
];
function getTier(score: number) {
  return TIERS.find((t) => score >= t.min && score <= t.max) ?? TIERS[0];
}

// ─── Past initiatives data ───────────────────────────────────────────────────────
interface PastInitiative {
  id: string;
  title: string;
  category: string;
  photo_url: string;
  location_name: string;
  completed_at: string;
  participants_count: number;
  pa_awarded: number;
  outcome: string;
}
const DEMO_PAST_INITIATIVES: PastInitiative[] = [
  {
    id: "p1",
    title: "April Bagmati Riverside Cleanup",
    category: "waste_cleanup",
    photo_url: "https://picsum.photos/seed/bagmati-clean/400/220",
    location_name: "Bagmati Bridge, Ward 11",
    completed_at: new Date(Date.now() - 86400000 * 15).toISOString(),
    participants_count: 47,
    pa_awarded: 1410,
    outcome: "2.3 tonnes cleared, 800m riverbank restored",
  },
  {
    id: "p2",
    title: "Thimi Secondary School Tree Drive",
    category: "tree_planting",
    photo_url: "https://picsum.photos/seed/thimi-trees/400/220",
    location_name: "Thimi Secondary School",
    completed_at: new Date(Date.now() - 86400000 * 28).toISOString(),
    participants_count: 38,
    pa_awarded: 1140,
    outcome: "42 saplings planted, drip irrigation laid",
  },
  {
    id: "p3",
    title: "Ward AQI Awareness March",
    category: "awareness_drive",
    photo_url: "https://picsum.photos/seed/ward11-march/400/220",
    location_name: "Thimi Chowk → Madhyapur Gate",
    completed_at: new Date(Date.now() - 86400000 * 45).toISOString(),
    participants_count: 120,
    pa_awarded: 3600,
    outcome: "200 N95 masks distributed, petition signed",
  },
];

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

// Deterministic avatar color from name string
function stringToColor(s: string): string {
  const PALETTE = [
    "#3d8b5e", "#2d7a9a", "#7b2d8b", "#d4a017",
    "#4fa870", "#c44b2b", "#4d7a9a", "#e8600a",
  ];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }) +
    " · " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
  );
}

// ─── Initiative Card ────────────────────────────────────────────────────────────

function InitiativeCard({
  item,
  onJoin,
  joinedIds,
}: {
  item: Initiative;
  onJoin: (id: string) => void;
  joinedIds: Set<string>;
}) {
  const cat = CATEGORIES[item.category] ?? CATEGORIES.awareness_drive;
  const isJoined = joinedIds.has(item.id);
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "#0d1f12",
        border: `1px solid rgba(61,139,94,0.15)`,
        borderLeft: `3px solid ${cat.color}`,
      }}
    >
      <div className="px-4 pt-4 pb-3 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{cat.icon}</span>
            <div>
              <span
                className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                style={{ background: `${cat.color}20`, color: cat.color }}
              >
                {cat.label}
              </span>
              <h3 className="text-sm font-semibold text-parchment mt-0.5 leading-snug">
                {item.title}
              </h3>
            </div>
          </div>
          <button
            onClick={() => onJoin(item.id)}
            className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={
              isJoined
                ? {
                    background: "rgba(61,139,94,0.15)",
                    border: "1px solid rgba(61,139,94,0.3)",
                    color: "#7dc99a",
                  }
                : { background: "#4fa870", color: "#0a1a0f" }
            }
          >
            {isJoined ? "✓ Going" : "Join"}
          </button>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[11px]" style={{ color: "#8aad96" }}>
            📍 {item.location_name}
          </p>
          <p className="text-[11px]" style={{ color: "#8aad96" }}>
            📅 {formatDate(item.scheduled_at)}
          </p>
        </div>
        {item.joined_by.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1">
            <div className="flex -space-x-1.5">
              {item.joined_by.slice(0, 4).map((j, i) => (
                <div
                  key={i}
                  className="w-5 h-5 rounded-full border border-ink flex items-center justify-center text-[7px] font-bold text-white"
                  style={{
                    background: GRAD_PALETTES[i % GRAD_PALETTES.length],
                    zIndex: 4 - i,
                  }}
                >
                  {initials(j.name)}
                </div>
              ))}
            </div>
            <span className="text-[10px]" style={{ color: "#4d7a5e" }}>
              {item.joined_by.length} attending · +{item.pa_points_join} PA to join
            </span>
          </div>
        )}
        {item.description && (
          <p className="text-[11px] leading-relaxed" style={{ color: "#4d7a5e" }}>
            {item.description}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Create Initiative Modal ────────────────────────────────────────────────────

function CreateInitiativeModal({
  onClose,
  onCreated,
  token,
  isDemo,
}: {
  onClose: () => void;
  onCreated: (newItem?: Initiative) => void;
  token: string | null;
  isDemo: boolean;
}) {
  const [form, setForm] = useState({
    title: "",
    category: "waste_cleanup",
    description: "",
    scheduled_at: "",
  });
  const [pin, setPin] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function update(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const handlePick = useCallback(
    (lat: number, lng: number, name: string) => {
      setPin({ lat, lng, name });
      setShowMap(false);
    },
    []
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin) {
      setError("Please pick a location on the map");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      if (isDemo) {
        // Fake 1 s loading, then add to local list — no backend call needed
        await new Promise<void>((r) => setTimeout(r, 1000));
        const newItem: Initiative = {
          id:            `demo-new-${Date.now()}`,
          title:         form.title,
          category:      form.category,
          description:   form.description,
          lat:           pin.lat,
          lng:           pin.lng,
          location_name: pin.name,
          scheduled_at:  new Date(form.scheduled_at).toISOString(),
          created_by:    { id: "u-me", name: "You" },
          joined_by:     [],
          status:        "upcoming",
          ward_id:       WARD_ID,
          pa_points_init: 30,
          pa_points_join: 10,
        };
        onCreated(newItem);
        onClose();
        return;
      }

      const r = await fetch(`${getBackendUrl()}/api/initiatives`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...form,
          lat: pin.lat,
          lng: pin.lng,
          location_name: pin.name,
          ward_id: WARD_ID,
        }),
      });
      if (!r.ok) {
        const d = (await r.json()) as { error?: string };
        setError(d.error ?? "Failed");
        return;
      }
      onCreated();
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl md:rounded-3xl p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        style={{ background: "#0d1f12", border: "1px solid rgba(61,139,94,0.2)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-parchment">
            Start Initiative
          </h2>
          <button onClick={onClose} className="text-2xl" style={{ color: "#4d7a5e" }}>
            ×
          </button>
        </div>

        {error && (
          <p
            className="text-xs px-3 py-2 rounded-xl"
            style={{
              background: "rgba(196,75,43,0.1)",
              color: "#c44b2b",
              border: "1px solid rgba(196,75,43,0.2)",
            }}
          >
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="Initiative title…"
            required
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(61,139,94,0.2)",
              color: "#c8ddd0",
            }}
          />

          {/* Category picker */}
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(CATEGORIES).map(([k, c]) => (
              <button
                key={k}
                type="button"
                onClick={() => update("category", k)}
                className="py-2 rounded-xl text-[10px] font-semibold flex flex-col items-center gap-1 transition-all"
                style={
                  form.category === k
                    ? {
                        background: `${c.color}20`,
                        border: `1px solid ${c.color}60`,
                        color: c.color,
                      }
                    : {
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(61,139,94,0.15)",
                        color: "#4d7a5e",
                      }
                }
              >
                <span className="text-lg">{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>

          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Brief description (optional)…"
            rows={2}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(61,139,94,0.2)",
              color: "#c8ddd0",
            }}
          />

          <input
            type="datetime-local"
            value={form.scheduled_at}
            onChange={(e) => update("scheduled_at", e.target.value)}
            required
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(61,139,94,0.2)",
              color: "#c8ddd0",
              colorScheme: "dark",
            }}
          />

          {/* Location picker */}
          <button
            type="button"
            onClick={() => setShowMap(true)}
            className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{
              background: "rgba(61,139,94,0.1)",
              border: "1px solid rgba(61,139,94,0.3)",
              color: "#7dc99a",
            }}
          >
            📍 {pin ? pin.name : "Pick Location on Map"}
          </button>

          {showMap && (
            <div className="flex flex-col gap-2">
              <LocationPicker onPick={handlePick} />
              <button
                type="button"
                onClick={() => setShowMap(false)}
                className="text-xs"
                style={{ color: "#4d7a5e" }}
              >
                Cancel
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !form.title || !form.scheduled_at || !pin}
            className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ background: "#4fa870", color: "#0a1a0f" }}
          >
            {submitting ? "Creating…" : "Start Initiative · +30 PA"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Leaderboard rank pill ──────────────────────────────────────────────────────

function LeaderboardRank({
  rank,
  isHighlighted,
}: {
  rank: number;
  isHighlighted: boolean;
}) {
  const colors: Record<number, string> = {
    1: "#d4a017",
    2: "#9ca3af",
    3: "#cd7c2f",
  };
  const c = isHighlighted ? "#f0bb2a" : (colors[rank] ?? "#4d7a5e");
  return (
    <div
      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
      style={{ background: `${c}22`, color: c, border: `1px solid ${c}44` }}
    >
      {rank}
    </div>
  );
}

// ─── Mask Upload ────────────────────────────────────────────────────────────────

function MaskUpload({
  onUploaded,
  isDemo,
  onDemoApproved,
  userId,
  userRole,
}: {
  onUploaded: () => void;
  isDemo?: boolean;
  onDemoApproved?: (selfie: MaskSelfie) => void;
  userId?: string;
  userRole?: string;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    // reset input value so picking the same file again triggers onChange
    e.target.value = "";
  }

  function handleRemove() {
    setSelectedFile(null);
    setPreview(null);
    setResult(null);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setResult(null);

    if (isDemo) {
      // Simulate 2 s vision check, then always approve
      await new Promise<void>((r) => setTimeout(r, 2000));
      const selfie: MaskSelfie = {
        selfie_id:      `demo-new-${Date.now()}`,
        user_id:        "u-me",
        name:           "You",
        ts:             Math.floor(Date.now() / 1000),
        image_url:      preview ?? "",
        mask_detected:  true,
        confidence:     0.96,
        approved:       true,
      };
      onDemoApproved?.(selfie);
      setResult({ ok: true, msg: "Mask verified! +20 PA points." });
      setPreview(null);
      setSelectedFile(null);
      onUploaded();
      setUploading(false);
      return;
    }

    const form = new FormData();
    form.append("selfie", selectedFile);
    form.append("ward_id", WARD_ID);
    if (userId)   form.append("user_id", userId);
    if (userRole) form.append("role", userRole);
    try {
      const s = await postMaskSelfie(form);
      setResult({
        ok: s.approved,
        msg: s.approved
          ? "Mask verified! +20 PA points."
          : "No mask detected — retake with mask visible.",
      });
      if (s.approved) {
        setPreview(null);
        setSelectedFile(null);
        onUploaded();
      }
    } catch {
      setResult({ ok: false, msg: "Upload failed — try again." });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Two-button row: Camera + Gallery */}
      {!preview && (
        <div className="flex gap-2">
          <label
            className="flex-1 flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl cursor-pointer select-none transition-opacity active:opacity-70"
            style={{
              background: "linear-gradient(135deg,rgba(61,139,94,0.18),rgba(61,139,94,0.1))",
              border: "1.5px solid rgba(61,139,94,0.35)",
            }}
          >
            <span className="text-2xl">📷</span>
            <span className="text-xs font-semibold" style={{ color: "#7dc99a" }}>Camera</span>
            <span className="text-[9px]" style={{ color: "#4d7a5e" }}>take selfie</span>
            <input
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          <label
            className="flex-1 flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl cursor-pointer select-none transition-opacity active:opacity-70"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1.5px solid rgba(61,139,94,0.2)",
            }}
          >
            <span className="text-2xl">🖼️</span>
            <span className="text-xs font-semibold" style={{ color: "#8aad96" }}>Gallery</span>
            <span className="text-[9px]" style={{ color: "#4d7a5e" }}>upload photo</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>
      )}

      {/* Preview + share */}
      {preview && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1.5px solid rgba(61,139,94,0.25)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Preview"
            className="w-full object-cover"
            style={{ maxHeight: 220 }}
          />
          <div className="flex gap-2 p-3">
            <button
              onClick={handleRemove}
              className="px-3 py-2.5 rounded-xl text-xs font-semibold"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(61,139,94,0.15)",
                color: "#4d7a5e",
              }}
            >
              ✕ Retake
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#3d8b5e,#4fa870)", color: "#0a1a0f" }}
            >
              {uploading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Verifying…
                </span>
              ) : (
                "😷 Share to Wall · +20 PA"
              )}
            </button>
          </div>
        </div>
      )}

      {result && (
        <p
          className="text-xs rounded-xl px-4 py-3 font-semibold"
          style={
            result.ok
              ? { background: "rgba(61,139,94,0.12)", color: "#7dc99a", border: "1px solid rgba(61,139,94,0.3)" }
              : { background: "rgba(196,75,43,0.1)", color: "#c44b2b", border: "1px solid rgba(196,75,43,0.2)" }
          }
        >
          {result.ok ? "✓ " : "⚠ "}{result.msg}
        </p>
      )}
    </div>
  );
}

// ─── Past initiative card ────────────────────────────────────────────────────────
function PastInitCard({ item }: { item: PastInitiative }) {
  const cat = CATEGORIES[item.category] ?? CATEGORIES.awareness_drive;
  const daysAgo = Math.floor((Date.now() - new Date(item.completed_at).getTime()) / 86400000);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#0d1f12", border: "1px solid rgba(61,139,94,0.15)" }}>
      <div className="relative h-32 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.photo_url} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 30%, rgba(13,31,18,0.97))" }} />
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: `${cat.color}25`, color: cat.color }}>{cat.icon} {cat.label}</span>
            <span className="text-[9px]" style={{ color: "rgba(200,221,208,0.45)" }}>{daysAgo}d ago</span>
          </div>
          <h3 className="text-xs font-semibold text-parchment leading-snug">{item.title}</h3>
          <p className="text-[10px] mt-0.5" style={{ color: "#4d7a5e" }}>📍 {item.location_name}</p>
        </div>
      </div>
      <div className="px-3 py-2.5 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-base">👥</span>
          <div>
            <p className="text-sm font-bold text-parchment font-display leading-none">{item.participants_count}</p>
            <p className="text-[9px]" style={{ color: "#4d7a5e" }}>joined</p>
          </div>
        </div>
        <div className="w-px h-5" style={{ background: "rgba(61,139,94,0.15)" }} />
        <div className="flex items-center gap-1.5">
          <span className="text-base">⚡</span>
          <div>
            <p className="text-sm font-bold font-display leading-none" style={{ color: "#d4a017" }}>+{item.pa_awarded}</p>
            <p className="text-[9px]" style={{ color: "#4d7a5e" }}>PA awarded</p>
          </div>
        </div>
        <p className="flex-1 text-right text-[10px] leading-snug" style={{ color: "#4d7a5e" }}>{item.outcome}</p>
      </div>
    </div>
  );
}

// ─── Community Score tab (mini rewards embedded in Community) ───────────────────
function CommunityScoreTab({ isDemo, paData }: { isDemo: boolean; paData?: PAResponse }) {
  const { token } = useAuth();
  const { data, isLoading } = useSWR<PAResponse>(
    isDemo ? null : `${getBackendUrl()}/api/exposure/score`,
    async (url: string) => {
      const r = await fetch(url, {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return r.ok ? (r.json() as Promise<PAResponse>) : DEMO_PA;
    },
    { refreshInterval: 60_000 }
  );
  // In demo mode, use the live paData passed from parent (updates on join/selfie)
  const d = isDemo ? (paData ?? DEMO_PA) : (data ?? DEMO_PA);
  const score = d.pa_score;
  const badges = d.badges;
  const breakdown = d.breakdown ?? {};
  const tier = getTier(score);
  const SIZE = 114, R = 43, circ = 2 * Math.PI * R;
  const dashOff = circ - (score / 100) * circ;

  return (
    <div className="flex flex-col gap-4">
      {/* Score ring */}
      <Card className="flex flex-col items-center gap-3 py-5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 50% 0%, ${tier.color}18 0%, transparent 70%)` }} />
        <div className="flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold"
          style={{ background: tier.bg, border: `1px solid ${tier.color}55`, color: tier.color }}>
          {tier.icon} <span className="uppercase tracking-[0.8px] ml-1">{tier.label}</span>
        </div>
        {isLoading && !isDemo ? (
          <div className="w-28 h-28 rounded-full animate-pulse" style={{ background: "#1a2e1f" }} />
        ) : (
          <div style={{ width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#1a2e1f" strokeWidth={12} />
              <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none"
                stroke={tier.color} strokeWidth={12} strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={dashOff}
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)" }} />
              <text x={SIZE / 2} y={SIZE / 2 - 6} textAnchor="middle" dominantBaseline="central"
                fontSize="30" fontWeight="900" fill={tier.color} fontFamily="var(--font-fraunces, serif)">{score}</text>
              <text x={SIZE / 2} y={SIZE / 2 + 14} textAnchor="middle" dominantBaseline="central"
                fontSize="8" fill="#4d7a5e" letterSpacing="1">PA SCORE</text>
            </svg>
          </div>
        )}
        <p className="text-[10px]" style={{ color: "#4d7a5e" }}>Max 100 pts/week · resets Monday</p>
        <a href="/rewards"
          className="px-4 py-1.5 rounded-xl text-[11px] font-semibold transition-opacity hover:opacity-80"
          style={{ background: "rgba(61,139,94,0.1)", border: "1px solid rgba(61,139,94,0.25)", color: "#7dc99a" }}>
          Full Rewards &amp; Breakdown ↗
        </a>
      </Card>

      {/* This week's actions */}
      <Card className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-parchment">This Week&apos;s Actions</h2>
        <div className="flex flex-col gap-2.5">
          {([
            { key: "report_submitted", label: "Commute Report",  icon: "📍", max: 20 },
            { key: "mask_worn",        label: "Mask Worn",        icon: "😷", max: 20 },
            { key: "child_indoors",    label: "Child/Elder Safe", icon: "🏠", max: 20 },
            { key: "alt_route",        label: "Alt Route",        icon: "🛤️", max: 20 },
            { key: "soil_compliance",  label: "Soil Compliance",  icon: "🌾", max: 20 },
          ] as const).map(({ key, label, icon, max }) => {
            const val = (breakdown as Record<string, number>)[key] ?? 0;
            const done = val >= max;
            return (
              <div key={key} className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px]">
                  <span style={{ color: done ? "#7dc99a" : "#8aad96" }}>{icon} {label}</span>
                  <span className="tabular-nums font-semibold" style={{ color: done ? "#4fa870" : "#4d7a5e" }}>
                    {val}/{max}{done ? " ✓" : ""}
                  </span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "#1a2f20" }}>
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.round((val / max) * 100)}%`,
                      background: done ? "linear-gradient(90deg,#3d8b5e,#4fa870)" : "linear-gradient(90deg,#2d5040,#3d8b5e)",
                    }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Badges */}
      <Card className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-parchment">Badges</h2>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(BADGE_META) as (keyof typeof BADGE_META)[]).map((key) => {
            const meta = BADGE_META[key];
            const earned = badges.includes(key);
            return (
              <div key={key}
                className="flex flex-col items-center p-2.5 rounded-xl text-center relative"
                style={earned
                  ? { background: "rgba(61,139,94,0.10)", border: "1px solid rgba(61,139,94,0.35)" }
                  : { background: "#0e180f", border: "1px solid rgba(61,139,94,0.07)", opacity: 0.5 }}>
                {earned && <span className="absolute top-1 right-1.5 text-[8px]" style={{ color: "#4fa870" }}>✓</span>}
                {!earned && <span className="absolute top-1 right-1.5 text-[9px] opacity-35">🔒</span>}
                <span className="text-xl mb-1" style={{ filter: earned ? "none" : "grayscale(1)", opacity: earned ? 1 : 0.35 }}>
                  {meta.icon}
                </span>
                <span className="text-[8px] font-semibold leading-tight" style={{ color: earned ? "#7dc99a" : "#2d5040" }}>
                  {meta.label}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ─── Mero Bari ──────────────────────────────────────────────────────────────────

const DIARY_TYPE_META: Record<string, { icon: string; label: string; color: string; carbonKind?: "composted" | "biochar" }> = {
  watered:     { icon: "💧", label: "Watered",      color: "#2d7a9a" },
  fertilized:  { icon: "🌾", label: "Fertilized",   color: "#d4a017" },
  soil_checked:{ icon: "🔬", label: "Checked Soil", color: "#4fa870" },
  harvest:     { icon: "🌿", label: "Harvested",    color: "#7dc99a" },
  // Carbon-bearing types — earn BOTH silver PA AND gold carbon credit
  composted:   { icon: "♻️", label: "Composted",    color: "#f0bb2a", carbonKind: "composted" },
  biochar:     { icon: "🔥", label: "Biochar",      color: "#e8600a", carbonKind: "biochar" },
  problem:     { icon: "⚠️", label: "Problem",      color: "#c44b2b" },
  other:       { icon: "✏️", label: "Other",        color: "#7b2d8b" },
};

interface DiaryEntry {
  id: string;
  user_id: string;
  user_name: string;
  entry_type: string;
  note: string;
  photo_url?: string;
  ward_id: string;
  ts: number;
}

const DEMO_DIARY: DiaryEntry[] = [
  { id: "d1", user_id: "u1", user_name: "Anisha Tamang",   entry_type: "watered",      note: "Tomatoes looking healthier after rain",   photo_url: "https://picsum.photos/seed/tomatoes-thimi/600/340", ward_id: "11", ts: Math.floor(Date.now()/1000) - 7200   },
  { id: "d2", user_id: "u2", user_name: "Ram Shrestha",    entry_type: "soil_checked", note: "pH was 6.1, added lime",                   ward_id: "11", ts: Math.floor(Date.now()/1000) - 18000  },
  { id: "d3", user_id: "u3", user_name: "Sita Gurung",     entry_type: "harvest",      note: "First mustard harvest of the season!",    photo_url: "https://picsum.photos/seed/mustard-harvest/600/340", ward_id: "11", ts: Math.floor(Date.now()/1000) - 43200  },
  { id: "d4", user_id: "u4", user_name: "Hari Maharjan",   entry_type: "problem",      note: "Leaves yellowing near east corner",        ward_id: "11", ts: Math.floor(Date.now()/1000) - 86400  },
  { id: "d5", user_id: "u5", user_name: "Kamala Shrestha", entry_type: "fertilized",   note: "Organic compost only, no chemicals",       ward_id: "11", ts: Math.floor(Date.now()/1000) - 172800 },
];

function diaryTimeAgo(ts: number): string {
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60)   return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function MeroBariTab({
  isDemo,
  wardId,
  userId,
  userRole,
  token,
}: {
  isDemo: boolean;
  wardId: string;
  userId?: string;
  userRole: string;
  token?: string | null;
}) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paToast, setPaToast] = useState<string | null>(null);
  const [localEntries, setLocalEntries] = useState<DiaryEntry[]>([]);

  // Gold-tier carbon ledger for this user (role-keyed in demo mode)
  const roleKey: UserRole = (["individual","farmer","executive"] as UserRole[]).includes(userRole as UserRole)
    ? (userRole as UserRole)
    : "farmer";
  const [carbonLedger, setCarbonLedger] = useState(() => ({
    ...DEMO_CARBON_LEDGER_BY_ROLE[roleKey],
    by_kind: { ...DEMO_CARBON_LEDGER_BY_ROLE[roleKey].by_kind },
  }));
  useEffect(() => {
    setCarbonLedger({
      ...DEMO_CARBON_LEDGER_BY_ROLE[roleKey],
      by_kind: { ...DEMO_CARBON_LEDGER_BY_ROLE[roleKey].by_kind },
    });
  }, [roleKey]);
  const tier = carbonTier(carbonLedger.total_co2e_kg);

  const { data: remoteEntries, mutate: mutateDiary } = useSWR<DiaryEntry[]>(
    isDemo ? null : `${getBackendUrl()}/api/community/diary?ward_id=${wardId}`,
    async (url: string) => {
      const r = await fetch(url);
      return r.ok ? (r.json() as Promise<DiaryEntry[]>) : [];
    },
    { refreshInterval: 30_000 }
  );

  const entries: DiaryEntry[] = isDemo
    ? [...localEntries, ...DEMO_DIARY]
    : [...localEntries, ...(remoteEntries ?? [])];

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  async function handleSubmit() {
    if (!selectedType) return;
    setSubmitting(true);
    try {
      if (isDemo) {
        const newEntry: DiaryEntry = {
          id:         "d_" + Date.now().toString(36),
          user_id:    userId || "demo",
          user_name:  "You",
          entry_type: selectedType,
          note:       note.trim(),
          photo_url:  photoPreview ?? undefined,
          ward_id:    wardId,
          ts:         Math.floor(Date.now() / 1000),
        };
        setLocalEntries((prev) => [newEntry, ...prev]);
        // Award PA + (when applicable) gold carbon credit. Two parallel ladders.
        const carbonKind = diaryTypeToCarbon(selectedType);
        if (carbonKind) {
          const kg = kindToCo2eKg(carbonKind);
          const npr = kindToNpr(carbonKind);
          setCarbonLedger((prev) => ({
            ...prev,
            total_co2e_kg: Math.round((prev.total_co2e_kg + kg) * 10) / 10,
            total_npr:     prev.total_npr + npr,
            by_kind: {
              ...prev.by_kind,
              [carbonKind]: {
                count:   prev.by_kind[carbonKind].count + 1,
                co2e_kg: Math.round((prev.by_kind[carbonKind].co2e_kg + kg) * 10) / 10,
                npr:     prev.by_kind[carbonKind].npr + npr,
              },
            },
          }));
          setPaToast(`+20 silver · +${kg.toFixed(1)} kg gold · रू ${npr}`);
          setTimeout(() => setPaToast(null), 3200);
        } else if (selectedType !== "fertilized") {
          setPaToast("+20 PA · soil compliance");
          setTimeout(() => setPaToast(null), 2500);
        }
      } else {
        const r = await fetch(`${getBackendUrl()}/api/community/diary`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            entry_type: selectedType,
            note:       note.trim(),
            ward_id:    wardId,
            user_id:    userId,
            role:       userRole,
          }),
        });
        if (r.ok) {
          const saved = (await r.json()) as DiaryEntry;
          setLocalEntries((prev) => [saved, ...prev]);
          const carbonKind = diaryTypeToCarbon(selectedType);
          if (carbonKind) {
            const kg = kindToCo2eKg(carbonKind);
            const npr = kindToNpr(carbonKind);
            setPaToast(`+20 silver · +${kg.toFixed(1)} kg gold · रू ${npr}`);
            setTimeout(() => setPaToast(null), 3200);
          } else if (selectedType !== "fertilized") {
            setPaToast("+20 PA · soil compliance");
            setTimeout(() => setPaToast(null), 2500);
          }
          void mutateDiary();
        }
      }
      setSelectedType(null);
      setNote("");
      removePhoto();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Hero header */}
      <div
        className="rounded-2xl px-4 py-4"
        style={{
          background:
            "linear-gradient(135deg,rgba(79,168,112,0.12),rgba(61,139,94,0.06))",
          border: "1px solid rgba(79,168,112,0.22)",
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🌱</span>
          <h2 className="font-display font-semibold text-parchment text-base">
            Mero Bari
          </h2>
          <span
            className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
            style={{ background: "rgba(79,168,112,0.15)", color: "#4fa870", border: "1px solid rgba(79,168,112,0.3)" }}
          >
            MY GARDEN
          </span>
        </div>
        <p className="text-[11px]" style={{ color: "#4d7a5e" }}>
          Log soil & crop activities. Earns silver PA + gold carbon credit.
        </p>
      </div>

      {/* ─── GOLD CARBON TEASER — compact link to Rewards Soil Bond ─── */}
      <div className="rounded-xl px-4 py-3 flex items-center gap-3"
        style={{ background: "rgba(156,115,32,0.08)", border: "1px solid rgba(156,115,32,0.28)" }}>
        <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl"
          style={{ background: tier.bg, border: `1.5px solid ${tier.color}55` }}>
          {tier.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display font-bold tabular-nums text-xl leading-none" style={{ color: "#9c7320" }}>
              {carbonLedger.total_co2e_kg.toFixed(1)}
            </span>
            <span className="text-[11px]" style={{ color: "#8a6a2c" }}>kg CO₂e</span>
            <span className="ml-auto text-[11px] font-semibold tabular-nums" style={{ color: "#9c7320" }}>
              ≈ रू {carbonLedger.total_npr}
            </span>
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: "#8a6a2c" }}>
            {tier.label} · {PROVISIONAL_DISCLOSURE}
          </p>
        </div>
        <a href="/rewards" className="shrink-0 text-[10px] font-semibold"
          style={{ color: "#9c7320", whiteSpace: "nowrap" }}>
          View Bond →
        </a>
      </div>

      {/* Quick-tap log form */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "#0d1f12", border: "1px solid rgba(61,139,94,0.18)" }}
      >
        <div
          className="px-4 py-3"
          style={{ borderBottom: "1px solid rgba(61,139,94,0.10)" }}
        >
          <p className="text-[11px] font-semibold" style={{ color: "#8aad96" }}>
            What did you do today?
          </p>
        </div>

        {/* Type chips */}
        <div className="px-4 py-3 flex flex-wrap gap-2">
          {Object.entries(DIARY_TYPE_META).map(([type, meta]) => (
            <button
              key={type}
              onClick={() => setSelectedType(selectedType === type ? null : type)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all"
              style={
                selectedType === type
                  ? {
                      background: `${meta.color}22`,
                      border: `1.5px solid ${meta.color}88`,
                      color: meta.color,
                    }
                  : {
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(61,139,94,0.15)",
                      color: "#4d7a5e",
                    }
              }
            >
              <span>{meta.icon}</span>
              {meta.label}
            </button>
          ))}
        </div>

        {/* Note + submit */}
        {selectedType && (
          <div
            className="px-4 pb-4 flex flex-col gap-3"
            style={{ borderTop: "1px solid rgba(61,139,94,0.08)" }}
          >
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional, max 200 chars)"
              maxLength={200}
              rows={2}
              className="w-full rounded-xl text-sm resize-none outline-none mt-3"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(61,139,94,0.18)",
                color: "#c8ddd0",
                padding: "10px 12px",
                caretColor: "#4fa870",
              }}
            />

            {/* Photo attach */}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoSelect}
            />
            {photoPreview ? (
              <div className="relative rounded-xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreview}
                  alt="preview"
                  className="w-full object-cover rounded-xl"
                  style={{ maxHeight: 180 }}
                />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: "rgba(0,0,0,0.65)", color: "#f0ede8" }}
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold w-fit"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(61,139,94,0.18)",
                  color: "#4d7a5e",
                }}
              >
                <span>📷</span> Add photo
              </button>
            )}

            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px]" style={{ color: "#2d5040" }}>
                {(() => {
                  const ck = selectedType ? diaryTypeToCarbon(selectedType) : null;
                  if (ck) {
                    const kg = kindToCo2eKg(ck);
                    const npr = kindToNpr(ck);
                    return `+20 silver · +${kg.toFixed(1)} kg gold · रू ${npr}`;
                  }
                  return selectedType !== "fertilized"
                    ? "✓ Earns +20 PA (soil compliance)"
                    : "No PA for fertilizer entries";
                })()}
              </span>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-5 py-2 rounded-full text-xs font-bold transition-opacity"
                style={{
                  background: "#4fa870",
                  color: "#0a1a0f",
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? "Logging…" : "Log it"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PA toast */}
      {paToast && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm font-bold z-50"
          style={{
            background: "#4fa870",
            color: "#0a1a0f",
            boxShadow: "0 4px 20px rgba(79,168,112,0.4)",
            animation: "toast-pop 0.3s ease",
          }}
        >
          {paToast}
        </div>
      )}

      {/* Feed — thread-style, inspired by Instagram/BeReal but with sensor data */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="font-semibold text-parchment text-sm">Ward Garden Feed</h3>
          <span className="text-[10px]" style={{ color: "#4d7a5e" }}>
            {entries.length} logs
          </span>
        </div>

        {entries.length === 0 ? (
          <div
            className="rounded-2xl px-4 py-8 text-center"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(61,139,94,0.10)" }}
          >
            <p className="text-sm" style={{ color: "#2d5040" }}>
              No entries yet — log your first garden activity above!
            </p>
          </div>
        ) : (
          <div className="relative pl-10">
            {/* Vertical thread rail */}
            <div
              className="absolute left-4 top-4 bottom-4 w-px pointer-events-none"
              style={{ background: "linear-gradient(to bottom, rgba(61,139,94,0.30), rgba(61,139,94,0.04))" }}
            />

            {entries.map((e, idx) => {
              const meta = DIARY_TYPE_META[e.entry_type] ?? { icon: "📝", label: e.entry_type, color: "#4d7a5e" };
              const nameInitials = e.user_name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
              const avatarColor = stringToColor(e.user_name);
              const isLast = idx === entries.length - 1;
              return (
                <div key={e.id} className={`relative flex flex-col ${isLast ? "pb-2" : "pb-4"}`}>
                  {/* Avatar on rail */}
                  <div
                    className="absolute -left-6 top-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 z-10"
                    style={{
                      background: `${avatarColor}22`,
                      border: `2px solid ${avatarColor}`,
                      color: avatarColor,
                    }}
                  >
                    {nameInitials}
                  </div>

                  {/* Card body — no outer border, just subtle bg */}
                  <div
                    className="rounded-2xl overflow-hidden"
                    style={{ background: "#0d1f12" }}
                  >
                    {/* Photo — full-width when present */}
                    {e.photo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={e.photo_url}
                        alt="garden photo"
                        className="w-full object-cover"
                        style={{ maxHeight: 220, display: "block" }}
                      />
                    )}

                    {/* Text content */}
                    <div className="px-3.5 py-3">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[11px] font-semibold" style={{ color: "#d4e8da" }}>
                          {e.user_name}
                        </span>
                        <span
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold"
                          style={{
                            background: `${meta.color}18`,
                            border: `1px solid ${meta.color}44`,
                            color: meta.color,
                          }}
                        >
                          {meta.icon} {meta.label}
                        </span>
                        {e.entry_type !== "fertilized" && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{
                              background: "rgba(79,168,112,0.10)",
                              color: "#4fa870",
                              border: "1px solid rgba(79,168,112,0.25)",
                            }}
                          >
                            +20 PA
                          </span>
                        )}
                        {(() => {
                          const ck = diaryTypeToCarbon(e.entry_type);
                          if (!ck) return null;
                          const kg = kindToCo2eKg(ck);
                          return (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{
                                background: "rgba(240,187,42,0.12)",
                                color: "#f0bb2a",
                                border: "1px solid rgba(240,187,42,0.35)",
                              }}
                            >
                              ⚡ {kg.toFixed(1)}kg gold
                            </span>
                          );
                        })()}
                      </div>
                      {e.note && (
                        <p className="text-[12px] leading-relaxed" style={{ color: "#8aad96" }}>
                          {e.note}
                        </p>
                      )}

                      {/* Social action row */}
                      <div className="flex items-center gap-3 mt-2.5 pt-2" style={{ borderTop: "1px solid rgba(61,139,94,0.08)" }}>
                        <button className="flex items-center gap-1 text-[10px] transition-opacity hover:opacity-70" style={{ color: "#4d7a5e" }}>
                          <span>♥</span>
                          <span>Like</span>
                        </button>
                        <button className="flex items-center gap-1 text-[10px] transition-opacity hover:opacity-70" style={{ color: "#4d7a5e" }}>
                          <span>💬</span>
                          <span>Reply</span>
                        </button>
                        <span className="ml-auto text-[9px] font-mono" style={{ color: "#2d5040" }}>
                          {diaryTimeAgo(e.ts)}
                        </span>
                      </div>
                    </div>
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

// ─── Main page ──────────────────────────────────────────────────────────────────

type CommunityTab = "wall" | "initiatives" | "board" | "score" | "bari";

function defaultCommunityTab(role: UserRole): CommunityTab {
  // Executives oversee — they want to see board/rankings first.
  // Farmers + individuals come for the wall / activity feed.
  return role === "executive" ? "board" : "wall";
}

export default function CommunityPage() {
  const { isDemo, role } = useDemo();
  const identity = DEMO_USER_IDENTITY[role];
  const { token, user: authUser } = useAuth();
  const { air } = useAir(WARD_ID);

  const [activeTab, setActiveTab] = useState<CommunityTab>(defaultCommunityTab(role));
  // Track whether the user has manually chosen a tab. Once they do, we stop
  // overriding it on role-switch so we don't yank them away from their view.
  const [tabPinned, setTabPinned] = useState(false);
  useEffect(() => {
    if (!tabPinned) setActiveTab(defaultCommunityTab(role));
  }, [role, tabPinned]);

  const [initView, setInitView] = useState<"list" | "map">("list");
  const [showCreate, setShowCreate] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(FILTER_ALL);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [joinPAToast, setJoinPAToast] = useState<string | null>(null);
  // Holds newly created initiatives in demo mode so they appear instantly on map/list
  const [demoNewInitiatives, setDemoNewInitiatives] = useState<Initiative[]>([]);
  // Live PA state for demo mode — updated on join, selfie approval, etc.
  // Seeded from the role's snapshot so switching role updates the score ring.
  const [demoPA, setDemoPA] = useState<PAResponse>({ ...DEMO_PA_BY_ROLE[role] });
  // Selfies added in demo mode (appear at top of wall)
  const [demoSelfies, setDemoSelfies] = useState<MaskSelfie[]>([]);

  // Re-seed the demo PA whenever the user switches role mid-session.
  useEffect(() => { setDemoPA({ ...DEMO_PA_BY_ROLE[role] }); }, [role]);

  function addDemoPA(points: number) {
    setDemoPA((prev) => ({ ...prev, pa_score: Math.min(100, prev.pa_score + points) }));
  }

  function handleDemoSelfieApproved(selfie: MaskSelfie) {
    setDemoSelfies((prev) => [selfie, ...prev]);
    addDemoPA(20);
  }

  const {
    data: selfiesRaw,
    isLoading: selfiesLoading,
    mutate: mutateSelfies,
  } = useSWR<MaskSelfie[]>(
    isDemo ? null : `${getBackendUrl()}/api/community/selfies?ward_id=${WARD_ID}`,
    async (url: string) => {
      const r = await fetch(url);
      return r.ok ? (r.json() as Promise<MaskSelfie[]>) : [];
    },
    { refreshInterval: 60_000 }
  );

  const {
    data: initiativesRaw,
    isLoading: initLoading,
    mutate: mutateInit,
  } = useSWR<Initiative[]>(
    isDemo ? null : `${getBackendUrl()}/api/initiatives?ward_id=${WARD_ID}`,
    async (url: string) => {
      const r = await fetch(url);
      return r.ok ? (r.json() as Promise<Initiative[]>) : [];
    },
    { refreshInterval: 30_000 }
  );

  const { data: leaderboardRaw, isLoading: lbLoading } = useSWR<LeaderboardEntry[]>(
    isDemo ? null : `${getBackendUrl()}/api/community/leaderboard`,
    async (url: string) => {
      const r = await fetch(url);
      return r.ok ? (r.json() as Promise<LeaderboardEntry[]>) : [];
    },
    { refreshInterval: 60_000 }
  );

  useSSE("selfie_posted", () => {
    if (!isDemo) void mutateSelfies();
  });

  const selfies = isDemo ? [...demoSelfies, ...DEMO_SELFIES] : (selfiesRaw ?? []);
  const initiatives = isDemo
    ? [...demoNewInitiatives, ...DEMO_INITIATIVES]
    : (initiativesRaw ?? []);
  const leaderboard = isDemo ? DEMO_LEADERBOARD_DATA : (leaderboardRaw ?? []);

  const approvedCount = selfies.filter((s) => s.approved).length;
  const compliancePct =
    selfies.length > 0 ? Math.round((approvedCount / selfies.length) * 100) : 34;
  const showShareBtn = true; // always visible — mask compliance is a core feature

  async function handleJoin(id: string) {
    if (isDemo) {
      setJoinedIds((prev) => {
        const n = new Set(prev);
        n.add(id);
        return n;
      });
      addDemoPA(10);
      setJoinPAToast("+10 PA awarded!");
      setTimeout(() => setJoinPAToast(null), 2500);
      return;
    }
    try {
      const r = await fetch(`${getBackendUrl()}/api/initiatives/${id}/join`, {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (r.ok) {
        const d = (await r.json()) as { pa_awarded?: number };
        setJoinedIds((prev) => {
          const n = new Set(prev);
          n.add(id);
          return n;
        });
        if (d.pa_awarded && d.pa_awarded > 0) {
          setJoinPAToast(`+${d.pa_awarded} PA awarded!`);
          setTimeout(() => setJoinPAToast(null), 2500);
        }
        void mutateInit();
      }
    } catch {
      // silently ignore join errors
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto animate-fade-up pb-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl font-bold text-parchment">Community</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {isDemo && (
              <span className="text-xs font-medium" style={{ color: "#8aad96" }}>
                {identity.icon} {identity.name}
              </span>
            )}
            <span className="text-xs" style={{ color: "#4d7a5e" }}>Ward {WARD_ID}</span>
            {air && (
              <>
                <span className="text-xs" style={{ color: "#2d5040" }}>·</span>
                <span className="flex items-center gap-1 text-xs font-bold tabular-nums" style={{ color: aqiColor(air.aqi) }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: aqiColor(air.aqi), animation: "pulse-dot 1.6s infinite" }} />
                  AQI {air.aqi}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div
        className="flex gap-1 p-1 rounded-2xl"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(61,139,94,0.12)",
        }}
      >
        {(
          [
            ["wall",        "Masks",   Shield],
            ["initiatives", "Events",  Users],
            ["board",       "Board",   Trophy],
            ["score",       "Score",   Medal],
            ["bari",        "Garden",  Leaf],
          ] as const
        ).map(([t, label, Icon]) => (
          <button
            key={t}
            onClick={() => { setActiveTab(t); setTabPinned(true); }}
            className="flex-1 py-2.5 rounded-xl font-semibold transition-all inline-flex items-center justify-center gap-1.5"
            style={{
              fontSize: 11,
              ...(activeTab === t
                ? {
                    background: "#1a2f20",
                    color: "#7dc99a",
                    border: "1px solid rgba(61,139,94,0.3)",
                  }
                : { color: "#4d7a5e", border: "1px solid transparent" }),
            }}
          >
            <Icon className="w-3 h-3 shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── WALL TAB ── */}
      {activeTab === "wall" && (
        <div className="flex flex-col gap-4">
          {/* Live activity ticker — gives the page a heartbeat */}
          {isDemo && <ActivityFeed items={DEMO_ACTIVITY_FEED} />}

          {showShareBtn && (
            <MaskUpload
              onUploaded={() => void mutateSelfies()}
              isDemo={isDemo}
              onDemoApproved={handleDemoSelfieApproved}
              userId={isDemo ? undefined : (authUser?.id ?? undefined)}
              userRole={isDemo ? role : (authUser?.role ?? "individual")}
            />
          )}

          {/* Compliance banner */}
          <div
            className="rounded-2xl px-4 py-3 flex items-center gap-4 relative overflow-hidden"
            style={{
              background: compliancePct >= 30
                ? "linear-gradient(135deg, rgba(79,168,112,0.16), rgba(61,139,94,0.07))"
                : "rgba(255,255,255,0.03)",
              border: compliancePct >= 30
                ? "1px solid rgba(79,168,112,0.32)"
                : "1px solid rgba(61,139,94,0.12)",
              boxShadow: compliancePct >= 30 ? "0 0 28px rgba(79,168,112,0.12)" : "none",
            }}
          >
            {compliancePct >= 30 && (
              <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(79,168,112,0.18), transparent 70%)" }} />
            )}
            <div className="flex flex-col items-center shrink-0" style={{ minWidth: 56 }}>
              <span
                className="font-display font-black leading-none tabular-nums"
                style={{ fontSize: 32, color: compliancePct >= 30 ? "#4fa870" : "#7dc99a", letterSpacing: "-1px" }}
              >
                {compliancePct}%
              </span>
              <span className="text-[10px] mt-0.5 font-bold uppercase tracking-[0.8px]" style={{ color: "#7dc99a" }}>
                masked
              </span>
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                {/* Segmented tipping-point bar */}
                <div className="flex-1 flex gap-0.5 h-2 rounded-full overflow-hidden">
                  {Array.from({ length: 10 }, (_, i) => {
                    const seg = (i + 1) * 10;
                    const filled = compliancePct >= seg;
                    const isThreshold = seg === 30;
                    return (
                      <div key={i} className="flex-1 h-full rounded-sm"
                        style={{
                          background: filled
                            ? (compliancePct >= 30 ? `rgba(79,168,112,${0.5 + (i * 0.05)})` : `rgba(61,139,94,0.4)`)
                            : "rgba(0,0,0,0.35)",
                          outline: isThreshold ? "1px solid rgba(79,168,112,0.35)" : "none",
                        }} />
                    );
                  })}
                </div>
                <span className="text-[9px] font-mono shrink-0" style={{ color: "#2d5040" }}>30%</span>
              </div>
              <p className="text-xs font-medium leading-relaxed" style={{ color: compliancePct >= 30 ? "#7dc99a" : "#4d7a5e" }}>
                {compliancePct >= 30
                  ? "Social proof threshold reached — neighbors see neighbors act"
                  : `${30 - compliancePct}% more to reach the social tipping point`}
              </p>
            </div>
          </div>

          {/* Selfie grid */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="font-bold text-parchment text-base">
                Community Mask Wall
              </h2>
              <span className="text-xs font-semibold" style={{ color: "#4fa870" }}>
                {selfies.filter((s) => s.approved).length} verified today
              </span>
            </div>

            {selfiesLoading && !isDemo ? (
              <div className="grid grid-cols-3 gap-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="animate-pulse rounded-2xl bg-ink-3" style={{ aspectRatio: "3/4" }} />
                ))}
              </div>
            ) : selfies.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {selfies.slice(0, 12).map((s, idx) => {
                  const timeAgo = (() => {
                    const secs = Math.floor(Date.now() / 1000) - s.ts;
                    if (secs < 60) return "just now";
                    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
                    return `${Math.floor(secs / 3600)}h ago`;
                  })();
                  return (
                    <div
                      key={s.selfie_id}
                      className="relative rounded-2xl overflow-hidden"
                      style={{
                        aspectRatio: "3/4",
                        border: s.approved
                          ? "1.5px solid rgba(79,168,112,0.55)"
                          : "1.5px solid rgba(255,255,255,0.07)",
                        boxShadow: s.approved
                          ? "0 4px 18px rgba(0,0,0,0.55), 0 0 14px rgba(79,168,112,0.14), inset 0 0 0 1px rgba(255,255,255,0.06)"
                          : "0 4px 14px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.04)",
                      }}
                    >
                      {/* Fallback avatar — always rendered, image sits on top */}
                      <div
                        className="absolute inset-0 flex items-center justify-center font-display font-bold text-white text-2xl"
                        style={{ background: GRAD_PALETTES[idx % GRAD_PALETTES.length], textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}
                      >
                        {initials(s.name)}
                      </div>
                      {/* Real photo — hides itself if file not found */}
                      {s.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.image_url}
                          alt={s.name}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                      )}

                      {/* Bottom overlay */}
                      <div
                        className="absolute inset-x-0 bottom-0 px-2 pb-2 pt-6 flex flex-col"
                        style={{
                          background: "linear-gradient(to top, rgba(5,15,8,0.92) 0%, transparent 100%)",
                        }}
                      >
                        <p className="text-[10px] font-semibold leading-tight text-white truncate">
                          {s.name.split(" ")[0]}
                        </p>
                        <p className="text-[8px] mt-0.5" style={{ color: "rgba(200,221,208,0.5)" }}>
                          {timeAgo}
                        </p>
                      </div>

                      {/* Verified stamp */}
                      {s.approved ? (
                        <div
                          className="absolute top-0 inset-x-0 flex items-center justify-center gap-1 py-1"
                          style={{
                            background: "linear-gradient(to bottom, rgba(79,168,112,0.80), rgba(61,139,94,0.55))",
                            backdropFilter: "blur(2px)",
                          }}
                          title="Mask verified by MATI Vision"
                        >
                          <span className="text-[8px] font-bold uppercase tracking-[1px] text-white">✓ MATI verified</span>
                        </div>
                      ) : (
                        <div
                          className="absolute inset-0 flex items-center justify-center"
                          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(1px)" }}
                        >
                          <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold"
                            style={{ background: "rgba(196,75,43,0.85)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}>
                            No mask
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {selfies.length > 12 && (
                  <div
                    className="rounded-2xl flex flex-col items-center justify-center gap-1 cursor-default"
                    style={{
                      aspectRatio: "3/4",
                      background: "#0d1f12",
                      border: "1px dashed rgba(61,139,94,0.2)",
                    }}
                  >
                    <span className="text-lg" style={{ color: "#4d7a5e" }}>+{selfies.length - 12}</span>
                    <span className="text-[9px]" style={{ color: "#2d5040" }}>more</span>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="rounded-2xl p-8 flex flex-col items-center gap-3 text-center"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(61,139,94,0.15)" }}
              >
                <span className="text-3xl">😷</span>
                <p className="text-sm font-semibold text-parchment">Be the first today</p>
                <p className="text-xs" style={{ color: "#4d7a5e" }}>
                  Share your mask selfie to start the Ward 11 wall
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── INITIATIVES TAB ── */}
      {activeTab === "initiatives" && (
        <div className="flex flex-col gap-4">
          {/* List / Map toggle + Start button */}
          <div className="flex gap-2 items-center justify-between">
            <div
              className="flex gap-1 p-0.5 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              {(["list", "map"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setInitView(v)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all capitalize"
                  style={
                    initView === v
                      ? { background: "#1a2f20", color: "#7dc99a" }
                      : { color: "#4d7a5e" }
                  }
                >
                  {v === "list" ? "📋 List" : "🗺️ Map"}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5"
              style={{ background: "#4fa870", color: "#0a1a0f" }}
            >
              + Start Initiative
            </button>
          </div>

          {/* Category filter pills */}
          <CategoryFilterPills
            selected={categoryFilter}
            onSelect={setCategoryFilter}
            counts={initiatives.reduce((acc, it) => {
              acc[it.category] = (acc[it.category] ?? 0) + 1;
              return acc;
            }, {} as Record<string, number>)}
          />

          {(() => {
            const visibleInitiatives = categoryFilter === FILTER_ALL
              ? initiatives
              : initiatives.filter((it) => it.category === categoryFilter);
            const totalHidden = initiatives.length - visibleInitiatives.length;
            return initView === "map" ? (
              <InitiativeMap
                initiatives={visibleInitiatives}
                joinedIds={joinedIds}
                onJoin={handleJoin}
              />
            ) : (
              <div className="flex flex-col gap-3">
                {totalHidden > 0 && (
                  <p className="text-[10px]" style={{ color: "#4d7a5e" }}>
                    Showing {visibleInitiatives.length} of {initiatives.length} · {totalHidden} hidden by filter
                  </p>
                )}
                {initLoading && !isDemo ? (
                  [...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-32 w-full rounded-2xl" />
                  ))
                ) : visibleInitiatives.length === 0 ? (
                  <Card>
                    <p className="text-mist text-sm text-center py-8">
                      {initiatives.length === 0
                        ? "No initiatives yet — start the first one!"
                        : "No initiatives match this category yet."}
                    </p>
                  </Card>
                ) : (
                  visibleInitiatives.map((item) => (
                    <InitiativeCard
                      key={item.id}
                      item={item}
                      onJoin={handleJoin}
                      joinedIds={joinedIds}
                    />
                  ))
                )}

                {/* Past Initiatives */}
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-px flex-1" style={{ background: "rgba(61,139,94,0.12)" }} />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.8px]" style={{ color: "#4d7a5e" }}>
                    Past Initiatives
                  </span>
                  <div className="h-px flex-1" style={{ background: "rgba(61,139,94,0.12)" }} />
                </div>
                {DEMO_PAST_INITIATIVES
                  .filter((p) => categoryFilter === FILTER_ALL || p.category === categoryFilter)
                  .map((item) => (
                    <PastInitCard key={item.id} item={item} />
                  ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── BOARD TAB ── */}
      {activeTab === "board" && (
        <div className="flex flex-col gap-4">

          {/* Executive-only insight strip */}
          {role === "executive" && (
            <div className="rounded-2xl px-4 py-3 grid grid-cols-3 gap-3"
              style={{
                background: "linear-gradient(135deg, rgba(124,196,224,0.12), rgba(45,122,154,0.06))",
                border: "1px solid rgba(124,196,224,0.30)",
              }}>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-[0.6px]" style={{ color: "#7cc4e0" }}>Ward rank</span>
                <span className="font-display text-xl font-bold text-parchment">#5<span className="text-[10px] ml-1" style={{ color: "#c44b2b" }}>▼2</span></span>
                <span className="text-[10px]" style={{ color: "#8aad96" }}>of 14 wards</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-[0.6px]" style={{ color: "#7cc4e0" }}>PA actions</span>
                <span className="font-display text-xl font-bold text-parchment">142<span className="text-[10px] ml-1" style={{ color: "#4fa870" }}>▲18%</span></span>
                <span className="text-[10px]" style={{ color: "#8aad96" }}>this week</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-[0.6px]" style={{ color: "#7cc4e0" }}>Mask compliance</span>
                <span className="font-display text-xl font-bold text-parchment">{compliancePct}%<span className="text-[10px] ml-1" style={{ color: "#4fa870" }}>▲6%</span></span>
                <span className="text-[10px]" style={{ color: "#8aad96" }}>ward avg</span>
              </div>
            </div>
          )}

          {/* ── Member Rankings (person-wise) ── */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "#0d1f12", border: "1px solid rgba(61,139,94,0.18)" }}
          >
            <div
              className="px-4 py-3 flex items-center gap-2"
              style={{ borderBottom: "1px solid rgba(61,139,94,0.12)" }}
            >
              <span className="text-base">👤</span>
              <h2 className="font-bold text-parchment text-base flex-1">
                Member Rankings · Ward {WARD_ID}
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: "rgba(79,168,112,0.12)", color: "#7dc99a" }}>
                This Week
              </span>
            </div>

            <div className="flex flex-col divide-y" style={{ borderColor: "rgba(61,139,94,0.06)" }}>
              {DEMO_MEMBER_RANKING.map((m) => {
                // The "isMe" highlight follows the current role's identity, so
                // switching role moves the highlight to the right row.
                const isMe = m.name === identity.name;
                return (
                  <div
                    key={m.rank}
                    className="flex items-center gap-3 px-4 py-3"
                    style={isMe ? { background: "rgba(79,168,112,0.07)" } : {}}
                  >
                    {/* Rank */}
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                      style={
                        m.rank === 1
                          ? { background: "rgba(212,160,23,0.2)", color: "#d4a017", border: "1px solid rgba(212,160,23,0.4)" }
                          : m.rank === 2
                          ? { background: "rgba(156,163,175,0.2)", color: "#9ca3af", border: "1px solid rgba(156,163,175,0.4)" }
                          : m.rank === 3
                          ? { background: "rgba(205,124,47,0.2)", color: "#cd7c2f", border: "1px solid rgba(205,124,47,0.4)" }
                          : { background: "rgba(61,139,94,0.08)", color: "#4d7a5e", border: "1px solid rgba(61,139,94,0.15)" }
                      }
                    >
                      {m.rank <= 3 ? ["🥇","🥈","🥉"][m.rank-1] : m.rank}
                    </div>

                    {/* Avatar */}
                    <div
                      className="w-8 h-8 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold"
                      style={{
                        background: GRAD_PALETTES[(m.rank - 1) % GRAD_PALETTES.length],
                        border: isMe ? "2px solid #4fa870" : "1.5px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      {m.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.avatar_url} alt={m.name} className="w-full h-full object-cover" />
                      ) : initials(m.name)}
                    </div>

                    {/* Name + role */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate"
                          style={{ color: isMe ? "#7dc99a" : "#c8ddd0" }}>
                          {m.name}
                          {isMe && <span className="ml-1 text-[9px] font-bold" style={{ color: "#4fa870" }}> YOU</span>}
                        </p>
                        <RankDelta delta={m.delta} />
                      </div>
                      <p className="text-[10px]" style={{ color: "#4d7a5e" }}>
                        {ROLE_ICON[m.role]} {m.actions} actions · {m.badges} badge{m.badges !== 1 ? "s" : ""}
                      </p>
                    </div>

                    {/* PA Score */}
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-sm font-bold font-display"
                        style={{ color: isMe ? "#7dc99a" : "#c8ddd0" }}>
                        {m.pa_score}
                      </span>
                      <span className="text-[9px]" style={{ color: "#4d7a5e" }}>PA pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-2.5 flex items-center gap-2"
              style={{ borderTop: "1px solid rgba(61,139,94,0.08)", background: "rgba(0,0,0,0.15)" }}>
              <span className="text-[10px]" style={{ color: "#2d5040" }}>
                Weekly PA score resets every Monday · Earn points by submitting reports, wearing masks &amp; taking protective actions
              </span>
            </div>
          </div>

          {/* ── Ward Rankings ── */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "#0d1f12", border: "1px solid rgba(61,139,94,0.18)" }}
          >
            <div
              className="px-4 py-3 flex items-center gap-2"
              style={{ borderBottom: "1px solid rgba(61,139,94,0.12)" }}
            >
              <span className="text-base">🏆</span>
              <h2 className="font-bold text-parchment text-base flex-1">Ward Clean Air Board</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: "rgba(61,139,94,0.1)", color: "#4d7a5e" }}>
                Bhaktapur Metro
              </span>
            </div>

            {lbLoading && !isDemo ? (
              <div className="flex flex-col gap-2 p-4">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <div className="flex flex-col">
                {(() => {
                  const maxScore = Math.max(...leaderboard.map((e) => e.score));
                  const maxPa = Math.max(...leaderboard.map((e) => e.pa_actions));
                  const rankBorderColor: Record<number, string> = { 1: "#d4a017", 2: "#9ca3af", 3: "#cd7c2f" };
                  return leaderboard.map((entry, idx) => {
                    const isMyWard = entry.ward_id === WARD_ID;
                    const border = rankBorderColor[entry.rank] ?? "transparent";
                    const isTop = entry.rank === 1;
                    return (
                      <div
                        key={entry.ward_id}
                        className="flex items-center gap-3 px-4 py-3"
                        style={{
                          borderTop: idx > 0 ? "1px solid rgba(61,139,94,0.06)" : undefined,
                          borderLeft: `3px solid ${border}`,
                          background: isTop
                            ? "linear-gradient(90deg, rgba(212,160,23,0.14), transparent 70%)"
                            : isMyWard
                            ? "rgba(212,160,23,0.06)"
                            : undefined,
                        }}
                      >
                        <LeaderboardRank rank={entry.rank} isHighlighted={isMyWard || isTop} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium truncate"
                              style={{ color: isTop ? "#f0bb2a" : isMyWard ? "#f0bb2a" : "#c8ddd0" }}>
                              {entry.name}
                            </p>
                            <RankDelta delta={entry.delta} />
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.3)", maxWidth: 80 }}>
                              <div className="h-full rounded-full"
                                style={{ width: `${Math.round((entry.pa_actions / maxPa) * 100)}%`, background: isTop ? "#d4a017" : "rgba(61,139,94,0.55)" }} />
                            </div>
                            <p className="text-[10px]" style={{ color: "#4d7a5e" }}>
                              {entry.pa_actions} PA
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          <span className="font-display font-bold tabular-nums"
                            style={{ fontSize: 16, color: isTop ? "#f0bb2a" : isMyWard ? "#f0bb2a" : "#7dc99a" }}>
                            {entry.score}
                          </span>
                          <span className="text-[10px]" style={{ color: aqiColor(entry.aqi) }}>
                            AQI {entry.aqi}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
                <div className="px-4 py-2.5"
                  style={{ borderTop: "1px solid rgba(61,139,94,0.08)", background: "rgba(0,0,0,0.15)" }}>
                  <p className="text-[9px]" style={{ color: "#2d5040" }}>
                    Score = (100−AQI/3) × kiln proximity × PA bonus · Higher is better
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SCORE TAB ── */}
      {activeTab === "score" && <CommunityScoreTab isDemo={isDemo} paData={isDemo ? demoPA : undefined} />}

      {/* ── BARI TAB ── */}
      {activeTab === "bari" && (
        <MeroBariTab
          isDemo={isDemo}
          wardId={WARD_ID}
          userId={isDemo ? undefined : (authUser?.id ?? undefined)}
          userRole={isDemo ? role : (authUser?.role ?? "individual")}
          token={token}
        />
      )}

      {/* PA toast */}
      {joinPAToast && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm font-bold z-50 animate-toast-pop"
          style={{
            background: "#4fa870",
            color: "#0a1a0f",
            boxShadow: "0 4px 20px rgba(79,168,112,0.4)",
          }}
        >
          {joinPAToast}
        </div>
      )}

      {/* Create initiative modal */}
      {showCreate && (
        <CreateInitiativeModal
          onClose={() => setShowCreate(false)}
          onCreated={(newItem) => {
            if (newItem) setDemoNewInitiatives((prev) => [newItem, ...prev]);
            void mutateInit();
          }}
          token={token}
          isDemo={isDemo}
        />
      )}
    </div>
  );
}
