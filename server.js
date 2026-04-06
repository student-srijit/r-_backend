import express from "express";
import cors from "cors";
import helmet from "helmet";
import { connectDB } from "./config/db.js";
import { config } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { generalLimiter, aiLimiter } from "./middleware/rateLimiter.js";
import authRoutes from "./routes/auth.js";
import researchRoutes from "./routes/research.js";
import analyzeRoutes from "./routes/analyze.js";
import interviewRoutes from "./routes/interviews.js";
import voiceRoutes from "./routes/voice.js";
import discoverRoutes from "./routes/discover.js";
import { startTrendingAutoSync } from "./services/trendingIngestionService.js";

const app = express();
const isVercel = process.env.VERCEL === "1";

function normalizeOrigin(value) {
  if (!value) return "";

  try {
    return new URL(value).origin;
  } catch {
    return String(value).trim().replace(/\/+$/, "");
  }
}

const allowedFrontendOrigins = new Set(
  `${config.server.frontendUrl || ""},${process.env.FRONTEND_URLS || ""}`
    .split(",")
    .map((value) => normalizeOrigin(value))
    .filter(Boolean),
);

const dbReadyPromise = connectDB();
if (!isVercel) {
  startTrendingAutoSync();
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: (origin, callback) => {
      const requestOrigin = normalizeOrigin(origin);

      // Allow requests with no origin (mobile apps, curl) and chrome extensions
      if (
        !origin ||
        origin.startsWith("chrome-extension://") ||
        allowedFrontendOrigins.has(requestOrigin)
      ) {
        callback(null, true);
      } else {
        const corsError = new Error("Not allowed by CORS");
        corsError.status = 403;
        callback(corsError);
      }
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(generalLimiter);
app.use(async (req, res, next) => {
  try {
    await dbReadyPromise;
    next();
  } catch (error) {
    next(error);
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/research", researchRoutes);
app.use("/api/analyze", aiLimiter, analyzeRoutes);
app.use("/api/interviews", aiLimiter, interviewRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/discover", discoverRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok", env: config.server.nodeEnv, time: new Date() });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(errorHandler);

const PORT = config.server.port;
if (!isVercel) {
  app.listen(PORT, () => {
    console.log(
      `[Research Plus] Server running on port ${PORT} in ${config.server.nodeEnv} mode`,
    );
  });
}

export default app;
