"use client";

import useSWR from "swr";
import { useSSE } from "./useSSE";
import { getLatestAdvisory } from "@/lib/api";
import { useDemo } from "@/lib/demoContext";
import { DEMO_ADVISORY } from "@/lib/demoData";
import type { Advisory } from "@/types";

export function useAdvisory(wardId: string, fieldId?: string) {
  const { isDemo } = useDemo();
  const key = (!isDemo && wardId)
    ? `/api/advisory/latest?ward_id=${wardId}${fieldId ? `&field_id=${fieldId}` : ""}`
    : null;

  const { data, error, mutate, isLoading } = useSWR<Advisory | null>(
    key,
    () => getLatestAdvisory(wardId, fieldId),
    { refreshInterval: 60_000 }
  );

  useSSE("advisory", (payload) => {
    if (isDemo) return;
    const p = payload as Advisory;
    if (p.ward_id === wardId) mutate(p, false);
  });

  if (isDemo) return { advisory: DEMO_ADVISORY, isLoading: false, error: undefined, mutate };
  return { advisory: data ?? null, isLoading, error: error as Error | undefined, mutate };
}
