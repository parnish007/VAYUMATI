"use client";

import useSWR from "swr";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getBackendUrl } from "@/lib/constants";

export interface WeeklyDose {
  ward_id: string;
  mean_pm25_7d_ug_m3: number;
  daily_dose_ug: number;
  weekly_dose_ug: number;
  who_weekly_limit_ug: number;
  pct_of_who_limit: number;
  breath_m3_per_day: number;
  who_pm25_24h_ug_m3: number;
}

// Demo fallback so the bar still animates in demo mode.
const DEMO_WEEKLY_DOSE: WeeklyDose = {
  ward_id: "11",
  mean_pm25_7d_ug_m3: 47.3,
  daily_dose_ug: 681.1,
  weekly_dose_ug: 4767.8,
  who_weekly_limit_ug: 1512,
  pct_of_who_limit: 315.3,
  breath_m3_per_day: 14.4,
  who_pm25_24h_ug_m3: 15,
};

async function fetcher(url: string): Promise<WeeklyDose> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`weekly-dose HTTP ${r.status}`);
  return r.json();
}

export function useWeeklyDose(wardId: string) {
  const { isDemo } = useCurrentUser();
  const key = (!isDemo && wardId)
    ? `${getBackendUrl()}/api/exposure/weekly-dose?ward_id=${wardId}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<WeeklyDose>(
    key,
    fetcher,
    { refreshInterval: 60_000 } // refresh every minute; backend recomputes from InfluxDB
  );

  if (isDemo) return { dose: DEMO_WEEKLY_DOSE, isLoading: false, error: undefined, mutate };
  return { dose: data ?? null, isLoading, error: error as Error | undefined, mutate };
}
