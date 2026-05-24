import { aqiColor } from "@/lib/aqi";

interface WeeklyChartProps {
  days: { day: string; aqi: number }[];
}

export function WeeklyChart({ days }: WeeklyChartProps) {
  const maxAqi = Math.max(...days.map((d) => d.aqi), 1);
  return (
    <div className="flex items-end gap-1.5 h-20">
      {days.map(({ day, aqi }) => {
        const barH = Math.max(6, Math.round((aqi / maxAqi) * 72));
        const color = aqiColor(aqi);
        return (
          <div key={day} className="flex flex-col items-center gap-1 flex-1">
            <span className="text-[8px] font-semibold tabular-nums" style={{ color }}>{aqi}</span>
            <div className="w-full rounded-t-sm" style={{ height: barH, background: color, opacity: 0.8 }} />
            <span className="text-[8px]" style={{ color: "#4d7a5e" }}>{day}</span>
          </div>
        );
      })}
    </div>
  );
}
