"use client";

import useSWR from "swr";
import { useSSE } from "./useSSE";
import { getNodes } from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { DEMO_NODES } from "@/lib/demoData";
import type { NodeInfo } from "@/types";

const KEY = "/api/nodes";

export function useNodes() {
  const { isDemo } = useCurrentUser();

  const { data, error, mutate, isLoading } = useSWR<NodeInfo[]>(
    isDemo ? null : KEY,
    () => getNodes(),
    { refreshInterval: 30_000 }
  );

  useSSE("node_online",   () => { if (!isDemo) mutate(); });
  useSSE("node_offline",  () => { if (!isDemo) mutate(); });
  useSSE("node_fallback", () => { if (!isDemo) mutate(); });

  if (isDemo) return { nodes: DEMO_NODES, isLoading: false, error: undefined, mutate };
  return { nodes: data ?? [], isLoading, error: error as Error | undefined, mutate };
}
