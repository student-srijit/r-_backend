import axios from "axios";
import { parseStringPromise } from "xml2js";
import { config } from "../config/env.js";
import User from "../models/User.js";
import ResearchWork from "../models/ResearchWork.js";
import Trending from "../models/Trending.js";
import { RESEARCH_FIELDS } from "../utils/constants.js";

const ARXIV_QUERY =
  "cat:cs.AI OR cat:cs.LG OR cat:cs.CL OR cat:cs.CV OR cat:cs.CR OR cat:cs.RO";

let ingestionState = {
  running: false,
  lastSyncAt: null,
  timer: null,
};

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function inferField(title, summary, categories = []) {
  const corpus = tokenize(`${title} ${summary} ${categories.join(" ")}`);
  const corpusSet = new Set(corpus);

  let best = "Other";
  let bestScore = 0;

  for (const field of RESEARCH_FIELDS) {
    if (field === "Other") continue;
    const tokens = tokenize(field);
    const score = tokens.reduce(
      (acc, token) => acc + (corpusSet.has(token) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      best = field;
      bestScore = score;
    }
  }

  return best;
}

function inferDifficulty(summary) {
  const tokenCount = tokenize(summary).length;
  if (tokenCount >= 180) return "advanced";
  if (tokenCount >= 90) return "intermediate";
  return "beginner";
}

function buildTags(title, categories = []) {
  const titleTokens = tokenize(title).slice(0, 6);
  const categoryTokens = categories
    .map((value) => normalizeText(value).toLowerCase())
    .flatMap((value) => value.split("."))
    .filter((value) => value && value.length >= 2);

  return [...new Set([...categoryTokens, ...titleTokens])].slice(0, 10);
}

function rankingSignals(index, total, publishedAt) {
  const publishedTime = publishedAt
    ? new Date(publishedAt).getTime()
    : Date.now();
  const ageHours = Math.max(1, (Date.now() - publishedTime) / (1000 * 60 * 60));
  const freshness = Math.exp(-ageHours / 96);
  const rankBoost = Math.max(1, total - index);

  const views = Math.max(1, Math.round(25 * freshness + rankBoost));
  const shares = Math.max(0, Math.round(6 * freshness));
  const analyzedCount = Math.max(1, Math.round(8 * freshness));

  return {
    views,
    shares,
    analyzedCount,
  };
}

async function ensureSystemUser() {
  const email = config.trendingIngestion.systemUserEmail.toLowerCase();
  let user = await User.findOne({ email });
  if (user) return user;

  user = new User({
    email,
    passwordHash: config.trendingIngestion.systemUserPassword,
    firstName: "Trending",
    lastName: "Bot",
  });

  await user.save();
  return user;
}

async function fetchArxivEntries() {
  const params = {
    search_query: ARXIV_QUERY,
    sortBy: "submittedDate",
    sortOrder: "descending",
    start: 0,
    max_results: config.trendingIngestion.maxResultsPerSync,
  };

  const response = await axios.get(config.arxiv.baseUrl, {
    params,
    timeout: 15000,
    headers: {
      Accept: "application/atom+xml",
    },
  });

  const parsed = await parseStringPromise(response.data, {
    explicitArray: true,
  });
  const entries = parsed?.feed?.entry || [];

  return entries.map((entry) => {
    const links = entry.link || [];
    const paperLink =
      links.find((l) => l?.$?.type === "text/html")?.$?.href ||
      normalizeText(entry.id?.[0]);

    return {
      title: normalizeText(entry.title?.[0]),
      summary: normalizeText(entry.summary?.[0]),
      url: paperLink,
      publishedAt: entry.published?.[0] || null,
      categories: (entry.category || [])
        .map((cat) => normalizeText(cat?.$?.term))
        .filter(Boolean),
    };
  });
}

async function upsertPaperAsResearch({ userId, paper, index, total }) {
  const field = inferField(paper.title, paper.summary, paper.categories);
  const tags = buildTags(paper.title, paper.categories);
  const difficulty = inferDifficulty(paper.summary);

  let research = await ResearchWork.findOne({ "links.url": paper.url });

  if (!research) {
    research = new ResearchWork({
      userId,
      title: paper.title,
      description: paper.summary,
      field,
      difficulty,
      tags,
      notes: "Imported by automated trending ingestion.",
      links: [
        {
          url: paper.url,
          type: "paper",
          addedAt: paper.publishedAt ? new Date(paper.publishedAt) : new Date(),
          analysis: {
            summary: paper.summary,
            keyPoints: [],
            importantConcepts: [],
            practicalApplications: [],
            discussionQuestions: [],
            analyzedAt: paper.publishedAt
              ? new Date(paper.publishedAt)
              : new Date(),
            modelUsed: "arxiv-ingestion",
          },
        },
      ],
      createdAt: paper.publishedAt ? new Date(paper.publishedAt) : new Date(),
      updatedAt: new Date(),
    });

    await research.save();
  } else {
    research.title = paper.title;
    research.description = paper.summary;
    research.field = field;
    research.difficulty = difficulty;
    research.tags = tags;
    research.updatedAt = new Date();
    await research.save();
  }

  const trend =
    (await Trending.findOne({ researchWorkId: research._id })) ||
    new Trending({
      researchWorkId: research._id,
    });

  const signals = rankingSignals(index, total, paper.publishedAt);

  trend.views = Math.max(trend.views || 0, signals.views);
  trend.shares = Math.max(trend.shares || 0, signals.shares);
  trend.analyzedCount = Math.max(
    trend.analyzedCount || 0,
    signals.analyzedCount,
  );
  trend.field = field;
  trend.source = "ingested";
  trend.updatedAt = new Date();
  trend.calculateScore();

  await trend.save();

  return { researchId: research._id };
}

export async function syncTrendingIngestion({ force = false } = {}) {
  if (!config.trendingIngestion.enabled) {
    return { status: "disabled", imported: 0, updated: 0 };
  }

  if (ingestionState.running) {
    return { status: "busy", imported: 0, updated: 0 };
  }

  const now = Date.now();
  const intervalMs = Math.max(
    120000,
    config.trendingIngestion.intervalMs || 1800000,
  );
  if (
    !force &&
    ingestionState.lastSyncAt &&
    now - ingestionState.lastSyncAt < intervalMs
  ) {
    return { status: "skipped_recently_synced", imported: 0, updated: 0 };
  }

  ingestionState.running = true;

  try {
    const botUser = await ensureSystemUser();
    const papers = await fetchArxivEntries();

    let imported = 0;
    let updated = 0;

    for (let index = 0; index < papers.length; index += 1) {
      const paper = papers[index];
      if (!paper.url || !paper.title) continue;

      const existing = await ResearchWork.findOne({
        "links.url": paper.url,
      }).select("_id");
      if (existing) updated += 1;
      else imported += 1;

      await upsertPaperAsResearch({
        userId: botUser._id,
        paper,
        index,
        total: papers.length,
      });
    }

    ingestionState.lastSyncAt = Date.now();
    return {
      status: "synced",
      imported,
      updated,
      totalFetched: papers.length,
    };
  } finally {
    ingestionState.running = false;
  }
}

export function startTrendingAutoSync() {
  if (!config.trendingIngestion.enabled || ingestionState.timer) {
    return;
  }

  const intervalMs = Math.max(
    120000,
    config.trendingIngestion.intervalMs || 1800000,
  );

  ingestionState.timer = setInterval(async () => {
    try {
      await syncTrendingIngestion();
    } catch (error) {
      console.error(
        "[TrendingIngestion] background sync failed:",
        error.message,
      );
    }
  }, intervalMs);

  syncTrendingIngestion().catch((error) => {
    console.error("[TrendingIngestion] initial sync failed:", error.message);
  });
}
