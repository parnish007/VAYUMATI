import { aqiColor } from "@/lib/aqi";

interface HourlyTimelineProps {
  hours: { hour: string; aqi: number }[];
}

export function HourlyTimeline({ hours }: HourlyTimelineProps) {
  const currentHour = new Date().getHours().toString().padStart(2, "0");
  const maxAqi = Math.max(...hours.map((h) => h.aqi), 1);

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div className="flex gap-1.5 w-max pb-1">
        {hours.map(({ hour, aqi }) => {
          const color = aqiColor(aqi);
          const heightPct = Math.max((aqi / maxAqi) * 48, 6);
          const isCurrent = hour === currentHour;

          return (
            <div key={hour} className="flex flex-col items-center gap-1" style={{ width: 32 }}>
              <div className="flex items-end" style={{ height: 52 }}>
                <div
                  className="w-5 rounded-t-sm"
                  style={{
                    height: heightPct,
                    background: isCurrent ? color : `${color}66`,
                    boxShadow: isCurrent ? `0 0 8px ${color}44` : undefined,
                    transition: "height 0.6s ease",
                  }}
                />
              </div>
              <span
                className="text-[8px] tabular-nums leading-none"
                style={{ color: isCurrent ? color : "#4d7a5e" }}
              >
                {hour}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
