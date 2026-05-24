interface WHOBarProps {
  /** Pre-computed % of WHO weekly limit. Preferred — comes from backend's 7d InfluxDB integration. */
  pct?: number;
  /** Legacy: instantaneous dose (μg). Used only if `pct` is not provided. */
  doseUg?: number;
  /** Legacy max for doseUg path. */
  maxUg?: number;
  /** Mean PM2.5 over the window (μg/m³). Optional — shown if provided. */
  meanPm25?: number;
}

export function WHOBar({ pct, doseUg = 0, maxUg = 168_000, meanPm25 }: WHOBarProps) {
  // Prefer caller-provided pct (real 7d dose from backend). Otherwise fall back to local math.
  const computedPct = pct != null ? pct : (doseUg / maxUg) * 100;
  const clamped = Math.min(Math.max(computedPct, 0), 100);
  const overLimit = computedPct > 100;
  const daysLeft = Math.max(0, Math.round(((100 - Math.min(computedPct, 100)) / 100) * 7));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-[10px]" style={{ color: "#8aad96" }}>
        <span>
          WHO weekly dose
          {meanPm25 != null && (
            <span className="ml-1.5" style={{ color: "#4d7a5e" }}>
              · PM2.5 7d avg {meanPm25.toFixed(1)} μg/m³
            </span>
          )}
        </span>
        <span>
          <strong style={{ color: overLimit ? "#e05a38" : "#e8efe2" }}>
            {computedPct.toFixed(0)}%
          </strong>{" "}
          {overLimit ? "over limit" : `consumed · ${daysLeft}d left`}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.3)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${clamped}%`,
            background: overLimit
              ? "linear-gradient(90deg, #c44b2b, #7b0000)"
              : "linear-gradient(90deg, #4fa870, #d4a017, #c44b2b)",
            transition: "width 0.8s ease",
          }}
        />
      </div>
    </div>
  );
}
