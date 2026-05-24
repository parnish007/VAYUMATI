"use client";

import { useState } from "react";
import { Radio, AlertCircle, Wind, FileText } from "lucide-react";
import { useNodes } from "@/hooks/useNodes";
import { useAir } from "@/hooks/useAir";
import { useSoil } from "@/hooks/useSoil";
import { useAdvisory } from "@/hooks/useAdvisory";
import { AQIGauge } from "@/components/sensors/AQIGauge";
import { SoilMeter } from "@/components/sensors/SoilMeter";
import { NodeStatusDot } from "@/components/sensors/NodeStatusDot";
import { AdvisoryCard } from "@/components/advisory/AdvisoryCard";
import { ReasoningTrace } from "@/components/advisory/ReasoningTrace";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { aqiColor } from "@/lib/aqi";
import { triggerAdvisory } from "@/lib/api";
import { DEFAULT_WARD_ID } from "@/lib/constants";
import { useDemo } from "@/lib/demoContext";
import { DEMO_ADVISORY } from "@/lib/demoData";
import type { NodeInfo } from "@/types";

const WARD_ID = DEFAULT_WARD_ID;
const FIELD_ID = "A1";

export default function WardPage() {
  const { nodes, isLoading: nodesLoading } = useNodes();
  const { air, isLoading: airLoading } = useAir(WARD_ID);
  const { soil, isLoading: soilLoading } = useSoil(FIELD_ID);
  const { advisory, isLoading: advLoading, mutate: mutateAdv } = useAdvisory(WARD_ID, FIELD_ID);
  const { isDemo } = useDemo();
  const [triggering, setTriggering] = useState(false);

  if (airLoading || soilLoading || nodesLoading) {
    return (
      <div className="p-6 space-y-3">
        <div className="h-10 rounded-2xl bg-ink-3 animate-pulse" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-ink-3 animate-pulse" />)}
        </div>
        <div className="h-48 rounded-2xl bg-ink-3 animate-pulse" />
      </div>
    );
  }

  const airNode  = nodes.find((n) => n.type === "air"  && n.ward_id === WARD_ID);
  const soilNode = nodes.find((n) => n.type === "soil" && n.ward_id === WARD_ID);
  const fallbackNodes = nodes.filter((n) => n.status !== "LIVE");
  const offlineNodes  = nodes.filter((n) => n.status === "OFFLINE");

  async function handleTrigger() {
    setTriggering(true);
    try {
      // Always hit the real backend so the demo shows the actual MATI agent
      // reasoning trace. Only fall back to the canned DEMO_ADVISORY if the
      // backend is unreachable AND we're in demo mode (so the UI never goes
      // empty during a presentation).
      const adv = await triggerAdvisory({ ward_id: WARD_ID, field_id: FIELD_ID, reason: "manual_trigger" });
      mutateAdv(adv, false);
    } catch (e) {
      console.error("[ADVISORY] trigger failed:", e);
      if (isDemo) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mutateAdv(DEMO_ADVISORY as any, false);
      }
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto">

      {/* Offline / fallback banner */}
      {fallbackNodes.length > 0 && (
        <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
          style={{ background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.22)" }}>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
              style={{ background: "rgba(212,160,23,0.12)", color: "#d4a017" }}>⚠</div>
            <div>
              <p className="text-xs font-semibold text-parchment">
                {offlineNodes.length > 0 ? "Node offline" : "Fallback active"}
              </p>
              <p className="text-[10px]" style={{ color: "#8aad96" }}>
                {fallbackNodes.map((n) => n.node_id).join(", ")} · {fallbackNodes[0].fallback_source ?? "Open-Meteo API"}
              </p>
            </div>
          </div>
          <span className="text-[10px] px-2.5 py-1.5 rounded-lg cursor-pointer"
            style={{ color: "#d4a017", border: "1px solid rgba(212,160,23,0.22)", background: "rgba(212,160,23,0.05)" }}>
            Check Node
          </span>
        </div>
      )}

      {/* Header + trigger */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-parchment">Ward {WARD_ID} · Sensor Grid</h1>
        <button onClick={handleTrigger} disabled={triggering}
          className="bg-sage text-ink font-semibold text-sm px-4 py-2 rounded-xl transition-opacity hover:opacity-90 disabled:opacity-50">
          {triggering ? "Generating…" : "Run MATI Advisory"}
        </button>
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { Icon: Radio,       label: "Nodes online",     value: `${nodes.filter((n) => n.status === "LIVE").length}/${nodes.length}`, color: "#4fa870" },
          { Icon: AlertCircle, label: "Fallback active",  value: `${fallbackNodes.length}`,                                            color: fallbackNodes.length > 0 ? "#d4a017" : "#4fa870" },
          { Icon: Wind,        label: "Ward AQI",         value: String(air?.aqi ?? "—"),                                              color: aqiColor(air?.aqi ?? 0) },
          { Icon: FileText,    label: "Advisories today", value: "3",                                                                  color: "#8aad96" },
        ].map(({ Icon, label, value, color }) => (
          <div key={label} className="rounded-2xl p-3 flex flex-col gap-2"
            style={{ background: "#112217", border: "1px solid rgba(61,139,94,0.18)" }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: `${color}18`, color }}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <p className="text-[10px] uppercase tracking-[0.5px]" style={{ color: "#4d7a5e" }}>{label}</p>
            <p className="font-display text-xl font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Node sensor cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EnhancedNodeCard label="Node A — Air Quality" node={airNode}>
          {air ? (
            <div className="flex items-center gap-4">
              <AQIGauge aqi={air.aqi} size={110} />
              <div className="flex flex-col gap-2 flex-1">
                <SensorRow label="PM2.5" value={`${(air.pm25 ?? 0).toFixed(1)} μg/m³`} />
                <SensorRow label="PM10"  value={`${(air.pm10 ?? 0).toFixed(1)} μg/m³`} />
                <SensorRow label="NO₂"   value={`${(air.no2 ?? 0).toFixed(3)} ppm`} />
                <SensorRow label="Temp"  value={`${(air.temperature ?? 0).toFixed(1)}°C  ${(air.humidity ?? 0).toFixed(0)}% RH`} />
              </div>
            </div>
          ) : <p className="text-mist text-sm">No air data</p>}
        </EnhancedNodeCard>

        <EnhancedNodeCard label="Node B — Soil Health" node={soilNode}>
          {soil ? (
            <SoilMeter ph={soil.ph ?? 6.5} ec={soil.ec ?? null} moisture={soil.moisture ?? 0} soilTemp={soil.soil_temp ?? 25} />
          ) : <p className="text-mist text-sm">No soil data</p>}
          {(soil?.ml_class ?? null) != null && (
            <div className="mt-3 flex items-center gap-2 text-xs text-mist">
              <span className="px-2 py-0.5 rounded-full bg-ink-3 font-mono">TinyML class {soil?.ml_class}</span>
              {(soil?.ml_class ?? 0) >= 2 && <span className="text-rust">⚠ Critical soil detected</span>}
            </div>
          )}
        </EnhancedNodeCard>
      </div>

      {/* Kiln proximity */}
      <Card className="flex flex-col gap-2">
        <h2 className="font-semibold text-parchment text-sm">Nearby Brick Kilns</h2>
        <p className="text-xs text-mist leading-relaxed">
          3 kilns within 5 km. Kiln season (Oct–Apr) raises PM2.5 and NO₂. 1.15× difficulty multiplier within 2 km.
        </p>
        <div className="flex gap-3 mt-1">
          {[["K1","2.8 km"],["K2","3.4 km"],["K3","4.1 km"]].map(([id, dist]) => (
            <div key={id} className="flex flex-col items-center gap-0.5 rounded-xl px-4 py-2"
              style={{ background: "#1a2f20" }}>
              <span className="text-xs text-amber-2 font-semibold">{id}</span>
              <span className="text-xs text-mist">{dist}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* 3-tier resilience */}
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold text-parchment text-sm">Data Resilience Tiers</h2>
        <div className="flex flex-col gap-2">
          {[
            { tier: "Tier 1", label: "Live sensor",  desc: "ESP32 → HiveMQ → InfluxDB → SSE push",   color: "#4fa870", active: airNode?.status === "LIVE" },
            { tier: "Tier 2", label: "Fallback API", desc: "Open-Meteo AQ / SoilGrids ISRIC REST",   color: "#d4a017", active: airNode?.status === "FALLBACK" },
            { tier: "Tier 3", label: "Last known",   desc: "InfluxDB cache with staleness timestamp", color: "#c44b2b", active: airNode?.status === "OFFLINE" },
          ].map(({ tier, label, desc, color, active }) => (
            <div key={tier} className="flex items-start gap-3 rounded-xl p-3"
              style={{ background: active ? `${color}0d` : "#0e180f", border: `1px solid ${active ? color + "30" : "rgba(61,139,94,0.08)"}` }}>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: `${color}18`, color }}>{tier}</span>
              <div>
                <p className="text-xs font-semibold text-parchment">{label}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "#8aad96" }}>{desc}</p>
              </div>
              {active && <span className="ml-auto text-[9px]" style={{ color }}>● active</span>}
            </div>
          ))}
        </div>
      </Card>

      {/* Advisory */}
      <div className="flex flex-col gap-3">
        <h2 className="font-semibold text-parchment">MATI Advisory</h2>
        {advLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : advisory ? (
          <div className="flex flex-col gap-3">
            <AdvisoryCard advisory={advisory} />
            <ReasoningTrace toolCallLog={advisory.tool_call_log ?? []} />
          </div>
        ) : (
          <Card><p className="text-mist text-sm">No advisory yet. Press &ldquo;Run MATI Advisory&rdquo; above.</p></Card>
        )}
      </div>
    </div>
  );
}

function EnhancedNodeCard({ label, node, children }: { label: string; node?: NodeInfo; children: React.ReactNode }) {
  const statusColor = !node ? "#4d7a5e" : node.status === "LIVE" ? "#4fa870" : node.status === "FALLBACK" ? "#d4a017" : "#c44b2b";
  const battPct = node?.battery ?? 0;
  const battColor = battPct > 50 ? "#4fa870" : battPct > 20 ? "#d4a017" : "#c44b2b";

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-4 relative overflow-hidden"
      style={{ background: "#112217", border: "1px solid rgba(61,139,94,0.12)" }}>
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: statusColor }} />
      <div className="pl-2 flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-sm text-parchment">{label}</h2>
          {node && <p className="text-[9px] mt-0.5" style={{ color: "#4d7a5e" }}>Node {node.node_id}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          {node ? (
            <NodeStatusDot status={node.status} lastSeen={node.last_seen} fallbackSource={node.fallback_source} />
          ) : (
            <span className="text-xs text-mist">Not registered</span>
          )}
          {node?.battery != null && (
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-10 h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.4)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${battPct}%`, background: battColor }} />
              </div>
              <span className="text-[9px] tabular-nums" style={{ color: "#4d7a5e" }}>{battPct}%</span>
            </div>
          )}
          {node?.rssi != null && (
            <span className="text-[9px] tabular-nums" style={{ color: "#4d7a5e" }}>RSSI {node.rssi} dBm</span>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function SensorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-mist">{label}</span>
      <span className="text-parchment font-medium tabular-nums">{value}</span>
    </div>
  );
}
