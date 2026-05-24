"use client";

import useSWR from "swr";
import { useSSE } from "./useSSE";
import { getSoilReading } from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { DEMO_SOIL } from "@/lib/demoData";
import type { SoilReading } from "@/types";

export function useSoil(fieldId: string) {
  const { isDemo } = useCurrentUser();
  const key = (!isDemo && fieldId) ? `/api/soil/${fieldId}` : null;

  const { data, error, mutate, isLoading } = useSWR<SoilReading | null>(
    key,
    () => getSoilReading(fieldId),
    { refreshInterval: 30_000 }
  );

  useSSE("soil_update", (payload) => {
    if (isDemo) return;
    const p = payload as SoilReading;
    if (p.field_id === fieldId) mutate(p, false);
  });

  if (isDemo) return { soil: DEMO_SOIL, isLoading: false, error: undefined, mutate };
  return { soil: data ?? null, isLoading, error: error as Error | undefined, mutate };
}
