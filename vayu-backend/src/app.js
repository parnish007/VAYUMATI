const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow all in development; allow no-origin requests (curl, Postman, SSE)
      if (process.env.NODE_ENV !== "production" || !origin) return callback(null, true);
      const allowed = [
        process.env.FRONTEND_URL,
        process.env.FRONTEND_URL_ALT, // optional second origin (e.g. renamed vercel project)
        "http://localhost:3000",
        "http://localhost:3001",
      ].filter(Boolean);
      // Also allow any *.vercel.app origin (covers preview deploys and project renames)
      if (allowed.includes(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: ${origin} not allowed`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/api/air",       require("./routes/air"));
app.use("/api/soil",      require("./routes/soil"));
app.use("/api/nodes",     require("./routes/nodes"));
app.use("/api/advisory",  require("./routes/advisory"));
app.use("/api/ward",      require("./routes/ward"));
app.use("/api/exposure",  require("./routes/exposure"));
app.use("/api/community",   require("./routes/community"));
app.use("/api/initiatives", require("./routes/initiatives"));
app.use("/api/profile",     require("./routes/profile"));
app.use("/api/data",        require("./routes/data"));
app.use("/api/auth",        require("./routes/auth"));
app.use("/api/chat",        require("./routes/chat"));
app.use("/api/demo",        require("./routes/demo"));

app.get("/api/live", require("./routes/sse"));

app.get("/health", (req, res) => res.json({ status: "ok", ts: Date.now() }));

module.exports = app;
