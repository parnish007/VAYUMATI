"use client";

import useSWR from "swr";
import { useSSE } from "./useSSE";
import { getAirReading } from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { DEMO_AIR } from "@/lib/demoData";
import type { AirReading } from "@/types";

export function useAir(wardId: string) {
  const { isDemo } = useCurrentUser();
  const key = (!isDemo && wardId) ? `/api/air/${wardId}` : null;

  const { data, error, mutate, isLoading } = useSWR<AirReading | null>(
    key,
    () => getAirReading(wardId),
    { refreshInterval: 30_000 }
  );

  useSSE("air_update", (payload) => {
    if (isDemo) return;
    const p = payload as AirReading;
    if (p.ward_id === wardId) mutate(p, false);
  });

  if (isDemo) return { air: DEMO_AIR, isLoading: false, error: undefined, mutate };
  return { air: data ?? null, isLoading, error: error as Error | undefined, mutate };
}
