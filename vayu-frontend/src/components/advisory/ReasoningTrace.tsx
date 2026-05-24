"use client";

import { useState } from "react";
import type { ToolCall } from "@/types";

interface ReasoningTraceProps {
  toolCallLog: ToolCall[];
}

export function ReasoningTrace({ toolCallLog }: ReasoningTraceProps) {
  const [open, setOpen] = useState(false);

  if (toolCallLog.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-ink-3 text-mist border border-ink-3">
        cached advisory
      </span>
    );
  }

  return (
    <div className="text-xs">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-mist hover:text-sage-3 transition-colors flex items-center gap-1"
        aria-expanded={open}
      >
        <span>{open ? "▾" : "▸"}</span>
        Reasoning trace ({toolCallLog.length} tool call{toolCallLog.length !== 1 ? "s" : ""})
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-2">
          {toolCallLog.map((tc, i) => (
            <div key={i} className="rounded-lg bg-ink-3 p-3 font-mono">
              <div className="text-sage-3 font-semibold mb-1">
                {i + 1}. {tc.tool}
              </div>
              <div className="text-mist/70">
                <div className="text-mist/50 mb-0.5">Input:</div>
                <pre className="whitespace-pre-wrap break-all">
                  {JSON.stringify(tc.input, null, 2)}
                </pre>
                <div className="text-mist/50 mt-1 mb-0.5">Output:</div>
                <pre className="whitespace-pre-wrap break-all">
                  {JSON.stringify(tc.output, null, 2)}
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
