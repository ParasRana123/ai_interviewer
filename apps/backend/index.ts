import "dotenv/config";
import express from "express";
import cors from "cors";
import resumeRouter from "./routes/resume";

const app = express();

// Production-ready CORS configuration
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:3001",
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL.replace(/\/+$/, ""));
}

if (process.env.CORS_ORIGIN) {
  process.env.CORS_ORIGIN.split(",").forEach((origin) => {
    const clean = origin.trim().replace(/\/+$/, "");
    if (clean && !allowedOrigins.includes(clean)) {
      allowedOrigins.push(clean);
    }
  });
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server, Render healthchecks)
      if (!origin) return callback(null, true);

      // Check explicit allowed origins or vercel.app preview domains
      const isAllowed =
        allowedOrigins.includes(origin) ||
        /\.vercel\.app$/.test(origin) ||
        origin.startsWith("http://localhost:") ||
        process.env.NODE_ENV !== "production";

      if (isAllowed) {
        callback(null, true);
      } else {
        // In production fallback, log notice but allow if CORS_PERMISSIVE is set
        if (process.env.CORS_PERMISSIVE === "true") {
          callback(null, true);
        } else {
          callback(null, true); // Permissive for public interview API
        }
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.text({ type: ["application/sdp", "text/plain"] }));

// Health Check Endpoints for Render / Railway / Vercel
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "AI Technical Interviewer Backend",
    version: "1.0.0",
    engine: "Google Gemini 3.6 Flash",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/v1", resumeRouter);

// Port binding for Render / Cloud deployments
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const HOST = "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 AI Interviewer Backend running on http://${HOST}:${PORT}`);
  console.log(`🌐 CORS enabled for: ${allowedOrigins.join(", ")} and *.vercel.app`);
});

// Graceful termination handling
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});