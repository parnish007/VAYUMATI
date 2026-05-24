"use client";

import { useEffect, useRef } from "react";
import type { SSEEventType } from "@/types";

import { getBackendUrl } from "@/lib/constants";

// Shared EventSource instance across hook calls
let sharedES: EventSource | null = null;
const listeners = new Map<string, Set<(data: unknown) => void>>();

function getSharedEventSource(): EventSource {
  if (sharedES && sharedES.readyState !== EventSource.CLOSED) return sharedES;

  sharedES = new EventSource(`${getBackendUrl()}/api/live`);

  sharedES.onmessage = (e) => {
    try {
      const { event, data } = JSON.parse(e.data) as {
        event: string;
        data: unknown;
      };
      listeners.get(event)?.forEach((cb) => cb(data));
    } catch {
      // Ignore malformed events
    }
  };

  // Named events forwarded by the server (event: <name>\ndata: ...\n\n)
  const EVENT_NAMES: SSEEventType[] = [
    "air_update",
    "soil_update",
    "advisory",
    "node_offline",
    "node_fallback",
    "node_online",
    "selfie_posted",
    "score_update",
    "badge_unlocked",
  ];

  for (const name of EVENT_NAMES) {
    sharedES.addEventListener(name, (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as unknown;
        listeners.get(name)?.forEach((cb) => cb(data));
      } catch {
        // Ignore
      }
    });
  }

  sharedES.onerror = () => {
    // Close explicitly to prevent ghost reconnects before we reset the reference
    sharedES?.close();
    sharedES = null;
  };

  return sharedES;
}

export function useSSE<T = unknown>(
  event: SSEEventType,
  callback: (data: T) => void
): void {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const es = getSharedEventSource();

    const handler = (data: unknown) => cbRef.current(data as T);

    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(handler);

    return () => {
      listeners.get(event)?.delete(handler);
      // If no listeners remain for any event, close the shared connection
      const totalListeners = [...listeners.values()].reduce((n, s) => n + s.size, 0);
      if (totalListeners === 0 && sharedES === es) {
        sharedES?.close();
        sharedES = null;
      }
    };
  }, [event]);
}
