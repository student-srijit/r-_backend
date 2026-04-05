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

connectDB();
if (!isVercel) {
  startTrendingAutoSync();
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl) and chrome extensions
      if (
        !origin ||
        origin.startsWith("chrome-extension://") ||
        origin === config.server.frontendUrl
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(generalLimiter);

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
