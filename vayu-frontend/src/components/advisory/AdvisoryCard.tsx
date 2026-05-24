import type { Advisory } from "@/types";
import { timeAgo } from "@/lib/aqi";

interface AdvisoryCardProps {
  advisory: Advisory;
  lang?: "en" | "ne";
}

const SEVERITY_BORDER: Record<number, string> = {
  1: "border-sage/40",
  2: "border-amber/40",
  3: "border-orange/40",
  4: "border-rust/40",
};

const SEVERITY_LABEL: Record<number, string> = {
  1: "Low",
  2: "Moderate",
  3: "High",
  4: "Critical",
};

export function AdvisoryCard({ advisory, lang = "en" }: AdvisoryCardProps) {
  const isLive = advisory.source === "mati_agent";
  const headline = lang === "ne" ? advisory.headline_ne : advisory.headline_en;
  const body     = lang === "ne" ? advisory.body_ne     : advisory.body_en;

  const sourcePill = isLive ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sage/20 text-sage-3 border border-sage/30">
      <span className="w-1.5 h-1.5 rounded-full bg-sage-3 animate-pulse" />
      Live · MATI
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber/20 text-amber-2 border border-amber/30">
      Cached · {advisory._template_id ?? "template"}
    </span>
  );

  const sevColor = advisory.severity >= 3 ? "#c44b2b" : advisory.severity === 2 ? "#d4a017" : "#3d8b5e";

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{
        background: `linear-gradient(135deg, ${sevColor}10, ${sevColor}06)`,
        border: `1px solid ${sevColor}30`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-parchment leading-snug">
          {headline}
        </h3>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {sourcePill}
          <span className="text-xs text-mist">Sev {SEVERITY_LABEL[advisory.severity]}</span>
        </div>
      </div>

      <p className="text-sm text-mist leading-relaxed">{body}</p>

      {advisory.actions.length > 0 && (
        <ul className="flex flex-col gap-1">
          {advisory.actions.map((a, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-sage-4">
              <span className="mt-0.5 shrink-0 text-sage">›</span>
              {a}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between text-xs text-mist/60">
        <span>{timeAgo(advisory.ts)}</span>
        <span>Confidence {Math.round(advisory.confidence * 100)}%</span>
      </div>
    </div>
  );
}
