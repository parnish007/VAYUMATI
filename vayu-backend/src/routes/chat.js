const express = require("express");
const { streamChatResponse } = require("../agent/geminiChat");

const router = express.Router();

const INJECTION_RE = /(ignore previous|system prompt|developer mode|reveal.*prompt|jailbreak|override.*instruction|forget.*rules|hidden instruction|bypass safety)/i;

// POST /api/chat/message — streams Claude response via SSE
router.post("/message", async (req, res) => {
  const { message, session_id, ward_id, role } = req.body;

  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: "Message required" });
  }
  if (INJECTION_RE.test(message)) {
    return res.status(400).json({ error: "I can only help with environmental and agricultural topics." });
  }

  // Use provided session_id or fall back to IP-based session (good enough for demo)
  const sessionId = session_id || req.ip || "default";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  await streamChatResponse({
    message:   message.trim(),
    sessionId,
    context: { ward_id: ward_id || "11", role: role || "individual" },
    onChunk: (text) => {
      res.write(`event: chunk\ndata: ${JSON.stringify({ text })}\n\n`);
    },
    onDone: () => {
      res.write(`event: done\ndata: {}\n\n`);
      res.end();
    },
  });
});

module.exports = router;
