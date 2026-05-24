"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useSSE } from "@/hooks/useSSE";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { aqiColor } from "@/lib/aqi";
import { DEFAULT_WARD_ID, getBackendUrl } from "@/lib/constants";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { DEMO_ALERTS } from "@/lib/demoData";
import type { Advisory } from "@/types";

const WARD_ID = DEFAULT_WARD_ID;

// Each role sees the alerts targeted at them + the ward-wide ones. Order is
// preserved; nothing is dropped silently — out-of-role alerts just collapse
// into a "Other audiences" tail at the bottom.
const ROLE_AUDIENCE: Record<string, string[]> = {
  individual: ["individual", "ward"],
  farmer:     ["farmer", "ward"],
  executive:  ["executive", "ward"],
};

function timeLabel(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const SEV_COLOR: Record<number, string> = {
  1: "#4fa870", 2: "#d4a017", 3: "#e8600a", 4: "#c44b2b", 5: "#7b2d8b",
};
const SEV_LABEL: Record<number, string> = {
  1: "Info", 2: "Caution", 3: "Warning", 4: "Alert", 5: "Critical",
};

export default function AlertsPage() {
  const { isDemo, role } = useCurrentUser();
  const [showNe, setShowNe] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const { data: advisoryRaw, isLoading, mutate } = useSWR<Advisory[]>(
    isDemo ? null : `/api/advisory/history?ward_id=${WARD_ID}&limit=20`,
    async () => {
      const r = await fetch(`${getBackendUrl()}/api/advisory/history?ward_id=${WARD_ID}&limit=20`);
      return r.ok ? r.json() : [];
    },
    { refreshInterval: 60_000 }
  );

  useSSE("advisory", () => { if (!isDemo) mutate(); });

  // Split alerts into "for me" and "other audiences" based on role, so the
  // farmer sees their advisory at the top and the executive sees their ops
  // alert at the top — same alert pool, role-aware ordering.
  const { primary, secondary } = useMemo(() => {
    const base = isDemo ? DEMO_ALERTS : ((advisoryRaw ?? []).map((a) => ({ ...a, channel: "app" as const, read: true })));
    const myAudiences = ROLE_AUDIENCE[role] ?? ["individual", "ward"];
    return {
      primary:   base.filter((a) => myAudiences.includes(a.audience)),
      secondary: base.filter((a) => !myAudiences.includes(a.audience)),
    };
  }, [isDemo, advisoryRaw, role]);

  const alerts = [...primary, ...secondary];
  const unread = alerts.filter((a) => !a.read).length;

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-parchment">Alerts</h1>
          {unread > 0 && (
            <p className="text-xs mt-0.5" style={{ color: "#c44b2b" }}>{unread} unread message{unread > 1 ? "s" : ""}</p>
          )}
        </div>
        <button
          onClick={() => setShowNe((v) => !v)}
          className="px-3 py-1.5 rounded-xl text-[10px] font-semibold"
          style={{ background: "rgba(61,139,94,0.1)", border: "1px solid rgba(61,139,94,0.2)", color: "#7dc99a" }}
        >
          {showNe ? "EN" : "नेपाली"}
        </button>
      </div>

      {/* WhatsApp received status */}
      <div className="rounded-2xl p-3 flex items-center gap-3"
        style={{ background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.18)" }}>
        <span className="text-2xl">💬</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold" style={{ color: "#25d366" }}>WhatsApp Notifications Active</p>
          <p className="text-[10px] mt-0.5" style={{ color: "#8aad96" }}>
            Messages sent to +977-98XX-XXXXX · Ward 11 advisory group
          </p>
        </div>
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#25d366", animation: "pulse-dot 2s infinite" }} />
      </div>

      {isLoading && !isDemo ? (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : alerts.length === 0 ? (
        <Card>
          <p className="text-mist text-sm text-center py-8">No alerts yet.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {primary.map((a, i) => <AlertCard key={`p${i}`} a={a} showNe={showNe} />)}

          {secondary.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <div className="h-px flex-1" style={{ background: "rgba(61,139,94,0.12)" }} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.8px]" style={{ color: "#4d7a5e" }}>
                Other audiences
              </span>
              <div className="h-px flex-1" style={{ background: "rgba(61,139,94,0.12)" }} />
            </div>
          )}

          {secondary.map((a, i) => <AlertCard key={`s${i}`} a={a} showNe={showNe} />)}
        </div>
      )}

      {/* Trigger manual advisory */}
      <Card className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-parchment">Trigger MATI Advisory</p>
        <p className="text-xs text-mist">Request an immediate analysis from the MATI agent for Ward {WARD_ID}.</p>
        <button
          disabled={triggering}
          onClick={async () => {
            if (triggering) return;
            setTriggering(true);
            try {
              await fetch(`${getBackendUrl()}/api/advisory/trigger`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ward_id: WARD_ID, field_id: "A1", reason: "manual_trigger" }),
              });
              mutate();
            } finally {
              setTriggering(false);
            }
          }}
          className="py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "#1a2f20", border: "1px solid rgba(61,139,94,0.3)", color: "#7dc99a" }}
        >
          {triggering ? "Running MATI…" : "Run MATI Now"}
        </button>
      </Card>
    </div>
  );
}

function AlertCard({ a, showNe }: { a: (Advisory & { channel: string; read: boolean }); showNe: boolean }) {
  const sevColor = SEV_COLOR[a.severity] ?? "#4fa870";
  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: a.read ? "#112217" : `${sevColor}10`,
        border: `1px solid ${a.read ? "rgba(61,139,94,0.12)" : `${sevColor}40`}`,
      }}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-base"
            style={{ background: `${sevColor}20`, border: `1.5px solid ${sevColor}50` }}>
            {a.channel === "whatsapp" ? "💬" : "🔔"}
          </div>
          {!a.read && <span className="w-1.5 h-1.5 rounded-full" style={{ background: sevColor }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
              style={{ background: `${sevColor}22`, color: sevColor }}>
              {SEV_LABEL[a.severity] ?? "Alert"}
            </span>
            <span className="text-[9px]" style={{ color: "#4d7a5e" }}>
              {a.channel === "whatsapp" ? "WhatsApp" : "In-App"} · {a.audience}
            </span>
            <span className="text-[9px] ml-auto" style={{ color: "#4d7a5e" }}>{timeLabel(a.ts)}</span>
          </div>
          <p className="text-sm font-semibold text-parchment leading-snug">
            {showNe ? a.headline_ne : a.headline_en}
          </p>
          <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "#8aad96" }}>
            {showNe ? a.body_ne : a.body_en}
          </p>
        </div>
      </div>

      {a.actions && a.actions.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {a.actions.map((act) => (
            <span key={act} className="text-[10px] rounded-lg px-2 py-1"
              style={{ background: "rgba(61,139,94,0.08)", color: "#7dc99a", border: "1px solid rgba(61,139,94,0.18)" }}>
              {act}
            </span>
          ))}
        </div>
      )}

      <div className="px-4 pb-3 flex items-center gap-2">
        <span className="text-[9px]" style={{ color: "#2d5040" }}>
          🤖 {a.source_note}
        </span>
        <span className="text-[9px] ml-auto font-display" style={{ color: "#2d5040" }}>
          confidence {Math.round((a.confidence ?? 0.9) * 100)}%
        </span>
      </div>
    </div>
  );
}
