interface SoilMeterProps {
  ph: number;
  ec: number | null;
  moisture: number;
  soilTemp: number;
}

function phColor(ph: number): string {
  if (ph < 5.5) return "#c44b2b";
  if (ph > 8.0) return "#7b2d8b";
  return "#3d8b5e";
}

function moistureColor(m: number): string {
  if (m < 20) return "#c44b2b";
  if (m > 85) return "#d4a017";
  return "#3d8b5e";
}

interface BarProps {
  value: number;
  max: number;
  color: string;
}

function Bar({ value, max, color }: BarProps) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-1.5 w-full rounded-full bg-ink-3 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function SoilMeter({ ph, ec, moisture, soilTemp }: SoilMeterProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* pH */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs text-mist">
          <span>pH</span>
          <span style={{ color: phColor(ph) }} className="font-semibold tabular-nums">
            {ph.toFixed(1)}
          </span>
        </div>
        <Bar value={ph} max={14} color={phColor(ph)} />
      </div>

      {/* EC */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs text-mist">
          <span>EC (mS/cm)</span>
          <span className="font-semibold tabular-nums text-sage-3">
            {ec !== null ? ec.toFixed(2) : "—"}
          </span>
        </div>
        <Bar value={ec ?? 0} max={5} color={ec !== null ? "#3d8b5e" : "#1a2f20"} />
      </div>

      {/* Moisture */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs text-mist">
          <span>Moisture</span>
          <span style={{ color: moistureColor(moisture) }} className="font-semibold tabular-nums">
            {moisture.toFixed(0)}%
          </span>
        </div>
        <Bar value={moisture} max={100} color={moistureColor(moisture)} />
      </div>

      {/* Soil temp */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs text-mist">
          <span>Soil Temp</span>
          <span className="font-semibold tabular-nums text-sage-3">
            {soilTemp.toFixed(1)}°C
          </span>
        </div>
        <Bar value={soilTemp} max={50} color="#4fa870" />
      </div>
    </div>
  );
}
