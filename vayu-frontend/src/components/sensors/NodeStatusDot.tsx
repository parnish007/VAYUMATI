"use client";

import { useState, useEffect } from "react";
import { timeAgo } from "@/lib/aqi";
import type { NodeStatus } from "@/types";

interface NodeStatusDotProps {
  status: NodeStatus;
  lastSeen: number; // Unix seconds
  fallbackSource?: string;
}

const DOT_COLOR: Record<NodeStatus, string> = {
  LIVE:     "bg-sage",
  FALLBACK: "bg-amber",
  OFFLINE:  "bg-rust",
};

export function NodeStatusDot({ status, lastSeen, fallbackSource }: NodeStatusDotProps) {
  const [ago, setAgo] = useState("");

  useEffect(() => {
    const update = () => setAgo(timeAgo(lastSeen));
    update();
    const id = setInterval(update, 10_000);
    return () => clearInterval(id);
  }, [lastSeen]);

  const source = fallbackSource ? ` · ${fallbackSource}` : "";
  const label =
    status === "LIVE"     ? `Live · ${ago}`
    : status === "FALLBACK" ? `Fallback${source}`
    : `Offline · last seen ${ago}`;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-mist">
      <span
        className={`w-2 h-2 rounded-full ${DOT_COLOR[status]} ${
          status === "LIVE" ? "animate-pulse" : ""
        }`}
      />
      {ago ? label : status}
    </span>
  );
}
