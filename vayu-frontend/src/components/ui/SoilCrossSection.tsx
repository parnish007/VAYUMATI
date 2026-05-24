interface SoilCrossSectionProps {
  ph: number;
}

function phColor(ph: number): string {
  if (ph < 5.0) return "#c44b2b";
  if (ph < 5.5) return "#e8600a";
  if (ph < 6.0) return "#d4a017";
  if (ph < 7.0) return "#3d8b5e";
  if (ph < 7.5) return "#4fa870";
  if (ph < 8.0) return "#d4a017";
  return "#c44b2b";
}

export function SoilCrossSection({ ph }: SoilCrossSectionProps) {
  const color = phColor(ph);
  const label =
    ph < 5.5 ? "Strongly Acidic" :
    ph < 6.5 ? "Slightly Acidic" :
    ph < 7.5 ? "Neutral" :
    ph < 8.5 ? "Slightly Alkaline" : "Strongly Alkaline";

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative rounded-xl overflow-hidden"
        style={{ height: 80 }}
      >
        {/* Sky */}
        <div className="absolute inset-x-0 top-0" style={{ height: "30%", background: "rgba(10,26,15,0.6)" }} />
        {/* Topsoil layer */}
        <div
          className="absolute inset-x-0"
          style={{
            top: "30%",
            height: "35%",
            background: `linear-gradient(180deg, ${color}55 0%, ${color}88 100%)`,
            transition: "background 0.8s ease",
          }}
        />
        {/* Subsoil */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: "35%",
            background: `linear-gradient(180deg, ${color}44 0%, ${color}22 100%)`,
          }}
        />
        {/* pH label overlay */}
        <div className="absolute inset-0 flex items-center justify-between px-3">
          <div>
            <p className="text-[8px] uppercase tracking-[0.5px]" style={{ color: `${color}99` }}>Soil pH</p>
            <p className="font-display font-bold text-xl leading-none" style={{ color }}>
              {ph.toFixed(2)}
            </p>
          </div>
          <p className="text-[9px] font-medium" style={{ color: `${color}cc` }}>{label}</p>
        </div>
      </div>
    </div>
  );
}
