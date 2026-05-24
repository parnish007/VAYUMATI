"use client";

import { useState, useCallback } from "react";
import {
  getDemoMembers,
  addDemoMember,
  removeDemoMember,
  injectAirReading,
  injectSoilReading,
  fireAdvisory,
  type DemoMember,
  type AdvisoryFireResult,
} from "@/lib/api";
import { DEFAULT_WARD_ID } from "@/lib/constants";
import { aqiColor, aqiLabel } from "@/lib/aqi";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import useSWR from "swr";

const WARD_ID = DEFAULT_WARD_ID;

// ─── Slider helper ─────────────────────────────────────────────────────────────

function Slider({
  label, value, min, max, step = 1, unit = "",
  color, onChange,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; unit?: string; color?: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span style={{ color: color || "#a3a3a3" }} className="font-mono font-semibold">
          {value}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-700"
        style={{ accentColor: color || "#4fa870" }}
      />
      <div className="flex justify-between text-[10px] text-zinc-600">
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );
}

// ─── Pill badge ────────────────────────────────────────────────────────────────

function Pill({ children, color = "#4fa870" }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ background: color + "22", color }}>
      {children}
    </span>
  );
}

// ─── Section card ──────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4">
      <h2 className="text-sm font-semibold text-zinc-300 tracking-wide uppercase">{title}</h2>
      {children}
    </div>
  );
}

// ─── Action button ─────────────────────────────────────────────────────────────

function ActionBtn({
  onClick, loading, children, variant = "primary",
}: {
  onClick: () => void; loading: boolean; children: React.ReactNode;
  variant?: "primary" | "danger" | "ghost";
}) {
  const styles = {
    primary: "bg-emerald-700 hover:bg-emerald-600 text-white",
    danger:  "bg-rose-800 hover:bg-rose-700 text-white",
    ghost:   "bg-zinc-800 hover:bg-zinc-700 text-zinc-300",
  };
  return (
    <button
      disabled={loading}
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]}`}
    >
      {loading ? "…" : children}
    </button>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DemoPage() {
  const { role } = useCurrentUser();

  // Guard — only ward executives may use this page
  if (role !== "executive") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="text-4xl">🔒</div>
        <h2 className="font-display text-lg font-semibold text-parchment">Executive Access Only</h2>
        <p className="text-sm text-center max-w-xs" style={{ color: "#4d7a5e" }}>
          The Demo Tweaker is only available to Ward Executives. Switch your role or log in as exec.
        </p>
      </div>
    );
  }

  // ── Air params ────────────────────────────────────────────────────────────
  const [airNodeId, setAirNodeId] = useState("demo-air");
  const [aqi,      setAqi]      = useState(155);
  const [pm25,     setPm25]     = useState(55);
  const [pm10,     setPm10]     = useState(80);
  const [no2,      setNo2]      = useState(0.15);
  const [co2,      setCo2]      = useState(600);
  const [airTemp,  setAirTemp]  = useState(28);
  const [humidity, setHumidity] = useState(65);

  // ── Soil params ───────────────────────────────────────────────────────────
  const [soilNodeId, setSoilNodeId] = useState("demo-soil");
  const [fieldId,    setFieldId]    = useState("A1");
  const [ph,         setPh]         = useState(5.2);
  const [moisture,   setMoisture]   = useState(42);
  const [ec,         setEc]         = useState(0.8);
  const [soilTemp,   setSoilTemp]   = useState(22);
  const [mlClass,    setMlClass]    = useState(0);

  // ── Member form ───────────────────────────────────────────────────────────
  const [newName,  setNewName]  = useState("");
  const [newPhone, setNewPhone] = useState("");

  // ── Result state ──────────────────────────────────────────────────────────
  const [airResult,  setAirResult]  = useState<string | null>(null);
  const [soilResult, setSoilResult] = useState<string | null>(null);
  const [advResult,  setAdvResult]  = useState<AdvisoryFireResult | null>(null);

  // ── Loading guards ────────────────────────────────────────────────────────
  const [loadingAir,  setLoadingAir]  = useState(false);
  const [loadingSoil, setLoadingSoil] = useState(false);
  const [loadingAdv,  setLoadingAdv]  = useState(false);
  const [loadingAdd,  setLoadingAdd]  = useState(false);

  // ── SWR for member list ───────────────────────────────────────────────────
  const { data: membersData, mutate: mutateMembers } = useSWR(
    `demo-members-${WARD_ID}`,
    () => getDemoMembers(WARD_ID),
    { refreshInterval: 0 }
  );
  const members: DemoMember[] = membersData?.members ?? [];

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleInjectAir = useCallback(async () => {
    setLoadingAir(true); setAirResult(null);
    try {
      const r = await injectAirReading({
        ward_id: WARD_ID, node_id: airNodeId,
        aqi, pm25, pm10, co2, no2, temp: airTemp, humidity,
      });
      setAirResult(r.ok ? `Injected — AQI ${aqi} (${aqiLabel(aqi)}) via node ${airNodeId}` : "Inject failed");
    } catch (e: unknown) {
      setAirResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setLoadingAir(false); }
  }, [airNodeId, aqi, pm25, pm10, co2, no2, airTemp, humidity]);

  const handleInjectSoil = useCallback(async () => {
    setLoadingSoil(true); setSoilResult(null);
    try {
      const r = await injectSoilReading({
        ward_id: WARD_ID, field_id: fieldId, node_id: soilNodeId,
        ph, moisture, ec, soil_temp: soilTemp, ml_class: mlClass,
      });
      setSoilResult(r.ok ? `Injected — pH ${ph}, moisture ${moisture}% via node ${soilNodeId}` : "Inject failed");
    } catch (e: unknown) {
      setSoilResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setLoadingSoil(false); }
  }, [soilNodeId, fieldId, ph, moisture, ec, soilTemp, mlClass]);

  const handleFireAdvisory = useCallback(async () => {
    setLoadingAdv(true); setAdvResult(null);
    try {
      const r = await fireAdvisory({
        ward_id: WARD_ID, aqi, pm25, no2, ph, moisture,
        reason: `manual_demo_trigger (AQI=${aqi}, pH=${ph})`,
      });
      setAdvResult(r);
    } catch (e: unknown) {
      setAdvResult({ advisory: { headline_en: `Error: ${e instanceof Error ? e.message : String(e)}` } as never, whatsapp: null });
    } finally { setLoadingAdv(false); }
  }, [aqi, pm25, no2, ph, moisture]);

  const handleAddMember = useCallback(async () => {
    if (!newPhone) return;
    setLoadingAdd(true);
    try {
      // Normalise Nepal 10-digit → E.164
      const digits = newPhone.replace(/\D/g, "");
      const e164 = digits.startsWith("977") ? "+" + digits
        : digits.length === 10 ? "+977" + digits
        : newPhone.startsWith("+") ? newPhone : "+" + newPhone;
      await addDemoMember({ name: newName || "Demo Member", phone: e164, ward_id: WARD_ID });
      setNewName(""); setNewPhone("");
      await mutateMembers();
    } finally { setLoadingAdd(false); }
  }, [newName, newPhone, mutateMembers]);

  const handleRemoveMember = useCallback(async (id: string) => {
    await removeDemoMember(id);
    await mutateMembers();
  }, [mutateMembers]);

  // ── AQI colour for slider track ───────────────────────────────────────────
  const aqiClr = aqiColor(aqi);

  // ── pH colour ─────────────────────────────────────────────────────────────
  function phColor(v: number) {
    if (v < 5.5) return "#e8600a";
    if (v < 6.0) return "#d4a017";
    if (v <= 7.5) return "#4fa870";
    if (v <= 8.0) return "#d4a017";
    return "#e8600a";
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-2">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100 font-display">Demo Tweaker</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Manually inject sensor readings through the full pipeline — InfluxDB write,
          anomaly check, MATI advisory, WhatsApp to registered members.
        </p>
      </div>

      {/* ── Air params ──────────────────────────────────────────────────── */}
      <Section title="Air Quality — Node A">
        <div className="grid grid-cols-2 gap-3 text-xs text-zinc-500">
          <div className="space-y-1">
            <label className="text-zinc-400">Node ID</label>
            <input value={airNodeId} onChange={(e) => setAirNodeId(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-sm text-zinc-200 font-mono" />
          </div>
        </div>

        <Slider label="AQI" value={aqi} min={0} max={500} color={aqiClr}
          unit="" onChange={setAqi} />
        <div className="text-xs" style={{ color: aqiClr }}>
          {aqiLabel(aqi)} {aqi >= 150 ? "— advisory will fire automatically" : "— below anomaly threshold (150)"}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Slider label="PM2.5" value={pm25} min={0} max={300} unit=" μg/m³" color="#a78bfa" onChange={setPm25} />
          <Slider label="PM10"  value={pm10} min={0} max={400} unit=" μg/m³" color="#818cf8" onChange={setPm10} />
          <Slider label="NO₂"   value={no2}  min={0} max={1}   step={0.01} unit=" ppm" color="#f59e0b" onChange={setNo2} />
          <Slider label="CO₂"   value={co2}  min={400} max={2000} unit=" ppm" color="#6ee7b7" onChange={setCo2} />
          <Slider label="Temp"  value={airTemp} min={5} max={45} unit="°C" onChange={setAirTemp} />
          <Slider label="Humidity" value={humidity} min={10} max={100} unit="%" onChange={setHumidity} />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <ActionBtn onClick={handleInjectAir} loading={loadingAir}>
            Inject Air Reading
          </ActionBtn>
          {airResult && (
            <span className={`text-xs ${airResult.startsWith("Error") ? "text-rose-400" : "text-emerald-400"}`}>
              {airResult}
            </span>
          )}
        </div>
      </Section>

      {/* ── Soil params ─────────────────────────────────────────────────── */}
      <Section title="Soil Health — Node B">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Node ID</label>
            <input value={soilNodeId} onChange={(e) => setSoilNodeId(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-sm text-zinc-200 font-mono" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Field ID</label>
            <input value={fieldId} onChange={(e) => setFieldId(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-sm text-zinc-200 font-mono" />
          </div>
        </div>

        <Slider label="pH" value={ph} min={4} max={9} step={0.1} color={phColor(ph)} onChange={setPh} />
        <div className="text-xs" style={{ color: phColor(ph) }}>
          {ph < 5.5 ? "Acidic — advisory will fire (acid deposition risk)"
            : ph > 8.0 ? "Alkaline — advisory will fire"
            : "Normal pH range"}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Slider label="Moisture" value={moisture} min={0}   max={100} unit="%" onChange={setMoisture} />
          <Slider label="EC"       value={ec}       min={0}   max={5}   step={0.1} unit=" dS/m" color="#60a5fa" onChange={setEc} />
          <Slider label="Soil Temp" value={soilTemp} min={5} max={40} unit="°C" onChange={setSoilTemp} />
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-zinc-400">
              <span>ML Class</span>
              <span className="font-mono font-semibold text-zinc-200">{mlClass}</span>
            </div>
            <div className="flex gap-2">
              {[0, 1, 2].map((c) => (
                <button key={c} onClick={() => setMlClass(c)}
                  className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                    mlClass === c
                      ? c === 2 ? "bg-rose-700 text-white" : "bg-emerald-700 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}>
                  {c === 0 ? "Normal" : c === 1 ? "Caution" : "Critical"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <ActionBtn onClick={handleInjectSoil} loading={loadingSoil}>
            Inject Soil Reading
          </ActionBtn>
          {soilResult && (
            <span className={`text-xs ${soilResult.startsWith("Error") ? "text-rose-400" : "text-emerald-400"}`}>
              {soilResult}
            </span>
          )}
        </div>
      </Section>

      {/* ── Force advisory ───────────────────────────────────────────────── */}
      <Section title="Force Advisory + WhatsApp">
        <p className="text-xs text-zinc-500">
          Bypasses anomaly thresholds and cooldown — fires MATI immediately with current slider
          values. WhatsApp sent to all registered members if severity ≥ 3.
        </p>
        <ActionBtn onClick={handleFireAdvisory} loading={loadingAdv} variant="danger">
          Fire Advisory Now
        </ActionBtn>

        {advResult && (
          <div className="mt-3 space-y-3">
            {advResult.advisory?.headline_en && (
              <div className="rounded-lg bg-zinc-800 p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-zinc-100">
                    {advResult.advisory.headline_en}
                  </span>
                  {advResult.advisory.severity != null && (
                    <Pill color={advResult.advisory.severity >= 3 ? "#e8600a" : "#d4a017"}>
                      Severity {advResult.advisory.severity}
                    </Pill>
                  )}
                  {advResult.advisory.confidence != null && (
                    <Pill color="#818cf8">
                      {Math.round((advResult.advisory.confidence as number) * 100)}% confidence
                    </Pill>
                  )}
                </div>
                <p className="text-xs text-zinc-400">{advResult.advisory.body_en}</p>
                {advResult.advisory.body_ne && (
                  <p className="text-xs text-zinc-300 font-medium border-t border-zinc-700 pt-2">
                    {advResult.advisory.body_ne}
                  </p>
                )}
              </div>
            )}

            {advResult.whatsapp && (
              <div className={`rounded-lg p-3 text-xs space-y-1 ${
                advResult.whatsapp.sent > 0 ? "bg-emerald-950/50 border border-emerald-800" : "bg-zinc-800"
              }`}>
                <div className="font-semibold text-zinc-200">
                  WhatsApp: {advResult.whatsapp.sent > 0
                    ? `Sent to ${advResult.whatsapp.sent} recipient${advResult.whatsapp.sent > 1 ? "s" : ""}`
                    : advResult.whatsapp.note || "Not sent (severity < 3)"}
                </div>
                {advResult.whatsapp.phones && advResult.whatsapp.phones.length > 0 && (
                  <div className="text-zinc-400 font-mono">
                    {advResult.whatsapp.phones.join(", ")}
                  </div>
                )}
                {advResult.whatsapp.statuses && (
                  <div className="flex gap-1 flex-wrap">
                    {advResult.whatsapp.statuses.map((s, i) => (
                      <Pill key={i} color={s === "sent" ? "#4fa870" : "#f59e0b"}>{s}</Pill>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ── Member management ────────────────────────────────────────────── */}
      <Section title="Registered Members">
        <p className="text-xs text-zinc-500">
          Phone numbers that receive WhatsApp advisories when severity ≥ 3.
          Numbers are saved to <span className="font-mono text-zinc-400">data/demo_members.json</span>.
        </p>

        {/* Add member form */}
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-zinc-400">Name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Anisha Tamang"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600"
            />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs text-zinc-400">🇳🇵 Mobile (10 digits)</label>
            <div className="flex items-center rounded-lg overflow-hidden border border-zinc-700 bg-zinc-800">
              <span className="px-2 text-xs font-mono text-emerald-400 shrink-0 border-r border-zinc-700 py-1.5">
                +977
              </span>
              <input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="9841234567"
                maxLength={10}
                className="flex-1 px-2 py-1.5 text-sm text-zinc-200 font-mono bg-transparent outline-none placeholder:text-zinc-600"
              />
            </div>
          </div>
          <ActionBtn onClick={handleAddMember} loading={loadingAdd} variant="ghost">
            Add
          </ActionBtn>
        </div>

        {/* Member list */}
        {members.length === 0 ? (
          <p className="text-xs text-zinc-600 italic">
            No members yet. Add at least one phone number to receive demo WhatsApp messages.
          </p>
        ) : (
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.id}
                className="flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2">
                <div>
                  <span className="text-sm text-zinc-200 font-medium">{m.name}</span>
                  <span className="ml-2 text-xs text-zinc-400 font-mono">{m.phone}</span>
                </div>
                <button
                  onClick={() => handleRemoveMember(m.id)}
                  className="text-zinc-600 hover:text-rose-400 text-xs transition-colors"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="text-xs bg-zinc-800/50 rounded-lg p-3 space-y-1.5 border border-zinc-700/50">
          <div className="font-semibold text-zinc-300">WhatsApp checklist before demo:</div>
          <div className="text-zinc-500">1. Twilio Console → Messaging → Try WhatsApp → note <span className="font-mono text-zinc-300">join &lt;keyword&gt;</span></div>
          <div className="text-zinc-500">2. Each phone must WhatsApp <span className="font-mono text-zinc-300">"join &lt;keyword&gt;"</span> to <span className="font-mono text-zinc-300">+14155238886</span> from their phone</div>
          <div className="text-zinc-500">3. Update placeholder numbers in <span className="font-mono text-zinc-300">data/users.json</span> with real 10-digit Nepal numbers</div>
          <div className="text-zinc-500">4. Set <span className="font-mono text-zinc-300">TWILIO_ACCOUNT_SID</span>, <span className="font-mono text-zinc-300">TWILIO_AUTH_TOKEN</span>, <span className="font-mono text-zinc-300">TWILIO_WA_FROM=whatsapp:+14155238886</span> in backend .env</div>
        </div>
      </Section>
    </div>
  );
}
