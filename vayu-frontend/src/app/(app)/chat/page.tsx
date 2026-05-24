"use client";

import { useState, useRef, useEffect } from "react";
import { Sprout, Send, Loader2, Mic, MicOff } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAir } from "@/hooks/useAir";
import { useChat } from "@/hooks/useChat";
import { useDemo } from "@/lib/demoContext";
import { DEFAULT_WARD_ID } from "@/lib/constants";

const WARD_ID = DEFAULT_WARD_ID;

const SUGGESTED_INDIVIDUAL = [
  "What AQI is safe for my child?",
  "Should I wear a mask today?",
  "What does PM2.5 mean?",
  "How long can I exercise outside?",
];

const SUGGESTED_FARMER = [
  "आज मल हाल्ने हो?",
  "मेरो माटो कस्तो छ?",
  "I grow potatoes — is my soil safe?",
  "Acid deposition warning — what do I do?",
  "Best time to irrigate today?",
];

function TypingCursor() {
  return (
    <span
      className="inline-block w-0.5 h-3.5 ml-0.5 align-middle animate-pulse"
      style={{ background: "#4fa870" }}
    />
  );
}

// Web Speech API — vendor-prefixed on some browsers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;
function getSpeechRecognition(): AnySpeechRecognition | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function ChatPage() {
  const { role } = useCurrentUser();
  const { isDemo } = useDemo();
  const { air } = useAir(WARD_ID);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Voice state ───────────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setVoiceSupported(getSpeechRecognition() !== null);
  }, []);

  function toggleVoice() {
    const SR = getSpeechRecognition();
    if (!SR) return;

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const rec = new SR();
    // Nepali for farmers, English otherwise
    rec.lang = role === "farmer" ? "ne-NP" : "en-US";
    rec.continuous = false;
    rec.interimResults = true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transcript = Array.from(e.results as any[])
        .map((r: any) => r[0].transcript)
        .join("");
      setInput(transcript);
      // Auto-resize textarea
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
        inputRef.current.style.height =
          Math.min(inputRef.current.scrollHeight, 128) + "px";
      }
    };

    rec.onend = () => setIsRecording(false);
    rec.onerror = () => setIsRecording(false);

    rec.start();
    recognitionRef.current = rec;
    setIsRecording(true);
  }

  // Stop recording on unmount
  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  const { messages, isStreaming, sendMessage, clearChat } = useChat({
    role,
    ward_id: WARD_ID,
    aqi: air?.aqi ?? null,
    ph: null,
    isDemo,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const suggestions =
    role === "farmer" ? SUGGESTED_FARMER : SUGGESTED_INDIVIDUAL;

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    await sendMessage(text);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div
      className="flex flex-col -mx-4 -my-4 md:mx-0 md:my-0 md:rounded-2xl md:overflow-hidden"
      style={{ height: "calc(100dvh - 56px - 56px)", minHeight: 0 }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{
          borderBottom: "1px solid rgba(61,139,94,0.15)",
          background: "rgba(8,15,10,0.98)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: "rgba(61,139,94,0.15)",
              border: "1px solid rgba(61,139,94,0.3)",
            }}
          >
            <Sprout className="w-4 h-4" style={{ color: "#7dc99a" }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-parchment leading-tight">
              MATI Assistant
            </p>
            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "#4fa870", animation: "pulse-dot 1.6s infinite" }}
              />
              <p className="text-[10px]" style={{ color: "#4fa870" }}>
                {air ? `AQI ${air.aqi} · Ward ${WARD_ID}` : `Ward ${WARD_ID} · Online`}
              </p>
            </div>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-[10px] px-2.5 py-1 rounded-lg transition-opacity hover:opacity-80"
            style={{ color: "#4d7a5e", border: "1px solid rgba(61,139,94,0.15)" }}
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Messages ────────────────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3"
        style={{ background: "#080f0a" }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 gap-5 py-8 min-h-0">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(61,139,94,0.20), rgba(79,168,112,0.10))",
                border: "1px solid rgba(79,168,112,0.35)",
                boxShadow: "0 8px 32px rgba(61,139,94,0.18)",
              }}
            >
              <Sprout className="w-7 h-7" style={{ color: "#7dc99a" }} />
            </div>
            <div className="text-center">
              <p className="font-display text-lg font-semibold text-parchment">
                Ask MATI
              </p>
              <p className="text-sm mt-1" style={{ color: "#4d7a5e" }}>
                {role === "farmer"
                  ? "Your AI companion for soil health, crop advice, and air quality"
                  : "Your AI guide for air quality, health decisions, and ward environment"}
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => void sendMessage(s)}
                  disabled={isStreaming}
                  className="w-full text-left px-4 py-3 rounded-2xl text-sm transition-all hover:opacity-90 disabled:opacity-40"
                  style={{
                    background: "rgba(61,139,94,0.07)",
                    border: "1px solid rgba(61,139,94,0.18)",
                    color: "#8aad96",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2 animate-fade-up`}
          >
            {msg.role === "mati" && (
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1"
                style={{ background: "rgba(61,139,94,0.15)", border: "1px solid rgba(61,139,94,0.3)" }}
              >
                <Sprout className="w-3 h-3" style={{ color: "#7dc99a" }} />
              </div>
            )}
            <div
              className="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
              style={
                msg.role === "user"
                  ? { background: "rgba(61,139,94,0.15)", border: "1px solid rgba(61,139,94,0.3)", color: "#c8ddd0", borderBottomRightRadius: 4 }
                  : { background: "#112217", border: "1px solid rgba(61,139,94,0.1)", color: "#c8ddd0", borderBottomLeftRadius: 4 }
              }
            >
              {msg.text || (msg.streaming ? "" : "…")}
              {msg.streaming && <TypingCursor />}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ───────────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-4 py-3"
        style={{
          borderTop: "1px solid rgba(61,139,94,0.15)",
          background: "rgba(8,15,10,0.98)",
        }}
      >
        <div className="flex gap-2 items-end">
          {/* Voice button — shown only if browser supports Web Speech API */}
          {voiceSupported && (
            <button
              onClick={toggleVoice}
              aria-label={isRecording ? "Stop recording" : "Speak your message"}
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all"
              style={
                isRecording
                  ? {
                      background: "rgba(196,75,43,0.18)",
                      border: "1px solid rgba(196,75,43,0.50)",
                      color: "#e05a38",
                      boxShadow: "0 0 14px rgba(196,75,43,0.30)",
                      animation: "mic-pulse 1.4s ease-in-out infinite",
                    }
                  : {
                      background: "rgba(61,139,94,0.08)",
                      border: "1px solid rgba(61,139,94,0.20)",
                      color: "#4d7a5e",
                    }
              }
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isRecording
                ? (role === "farmer" ? "सुनिरहेको छु…" : "Listening…")
                : (role === "farmer"
                    ? "माटो वा हावाको बारे सोध्नुस्…"
                    : "Ask about air quality, health, or the environment…")
            }
            rows={1}
            className="flex-1 resize-none rounded-2xl px-4 py-3 text-sm outline-none max-h-32 transition-all"
            style={{
              background: isRecording
                ? "rgba(196,75,43,0.06)"
                : "rgba(255,255,255,0.04)",
              border: isRecording
                ? "1px solid rgba(196,75,43,0.30)"
                : "1px solid rgba(61,139,94,0.2)",
              color: "#c8ddd0",
              lineHeight: 1.5,
            }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 128) + "px";
            }}
          />

          <button
            onClick={() => void handleSend()}
            disabled={!input.trim() || isStreaming}
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all disabled:opacity-40"
            style={{ background: "#4fa870", color: "#0a1a0f" }}
            aria-label="Send message"
          >
            {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>

        {/* Recording indicator */}
        {isRecording && (
          <div className="flex items-center gap-2 mt-2">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#e05a38", animation: "pulse-dot 0.9s infinite" }}
            />
            <p className="text-[10px]" style={{ color: "#e05a38" }}>
              {role === "farmer" ? "रेकर्डिङ — रोक्न थिच्नुस्" : "Recording — tap mic to stop"}
            </p>
          </div>
        )}

        <p className="text-[9px] mt-2 text-center" style={{ color: "#2d5040" }}>
          MATI uses live Ward {WARD_ID} sensor data · Powered by Claude
        </p>
      </div>

      {/* Mic pulse animation */}
      <style>{`
        @keyframes mic-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(196,75,43,0.40); }
          50%       { box-shadow: 0 0 0 8px rgba(196,75,43,0); }
        }
      `}</style>
    </div>
  );
}
