import dotenv from "dotenv";

dotenv.config();

const required = ["MONGODB_URI", "JWT_SECRET"];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const config = {
  mongodb: {
    uri: process.env.MONGODB_URI,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiry: process.env.JWT_EXPIRY || "7d",
  },
  server: {
    port: process.env.PORT || 5000,
    nodeEnv: process.env.NODE_ENV || "development",
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  },
  arxiv: {
    baseUrl: process.env.ARXIV_API_BASE || "https://export.arxiv.org/api/query",
  },
  trendingIngestion: {
    enabled: process.env.TRENDING_INGESTION_ENABLED !== "false",
    intervalMs: Number.parseInt(
      process.env.TRENDING_INGESTION_INTERVAL_MS || "1800000",
      10,
    ),
    maxResultsPerSync: Number.parseInt(
      process.env.TRENDING_INGESTION_MAX_RESULTS || "40",
      10,
    ),
    systemUserEmail:
      process.env.TRENDING_SYSTEM_USER_EMAIL ||
      "trending-bot@research-plus.com",
    systemUserPassword:
      process.env.TRENDING_SYSTEM_USER_PASSWORD ||
      "trending-bot-secure-password",
  },
  voice: {
    elevenLabsKey: process.env.ELEVENLABS_API_KEY || null,
    elevenLabsVoiceId:
      process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL",
    elevenLabsModelId: process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5",
  },
};
