import ResearchWork from "../models/ResearchWork.js";
import Trending from "../models/Trending.js";
import { HTTP_STATUS } from "../utils/constants.js";
import { RESEARCH_FIELDS } from "../utils/constants.js";
import {
  keywordSnapshotFromProfile,
  rankResearchForUser,
  recordUserInteraction,
} from "../services/recommendationService.js";
import { syncTrendingIngestion } from "../services/trendingIngestionService.js";

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const trimSearchTerm = (value) => String(value || "").trim();

const normalizeMomentum = (rawScore, maxScore) => {
  if (!Number.isFinite(rawScore) || rawScore <= 0) return 0;
  if (!Number.isFinite(maxScore) || maxScore <= 0) return 0;
  return rawScore / maxScore;
};

const attachRecommendation = (item, recommendation) => ({
  ...item,
  recommendation,
});

const ensureResearchExists = async (researchWorkId) => {
  const research = await ResearchWork.findById(researchWorkId);
  if (!research) {
    return null;
  }
  return research;
};

const upsertTrendingCounters = async (research, deltas = {}) => {
  const trending =
    (await Trending.findOne({ researchWorkId: research._id })) ||
    new Trending({
      researchWorkId: research._id,
      views: 0,
      shares: 0,
      analyzedCount: 0,
      field: research.field,
      source: "user",
    });

  trending.views += deltas.views || 0;
  trending.shares += deltas.shares || 0;
  trending.analyzedCount += deltas.analyzedCount || 0;
  trending.field = research.field;
  trending.source = "user";
  trending.updatedAt = new Date();
  trending.calculateScore();
  await trending.save();

  return trending;
};

export const getTrendingResearch = async (req, res, next) => {
  try {
    try {
      await syncTrendingIngestion();
    } catch (syncError) {
      console.error(
        "[TrendingIngestion] request sync failed:",
        syncError.message,
      );
    }

    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 20);
    const field = req.query.field;
    const skip = (page - 1) * limit;

    const filter = {};
    if (field) filter.field = field;

    const candidateLimit = Math.max(limit * 8, 80);

    const trendingCandidates = await Trending.find(filter)
      .sort({ score: -1, updatedAt: -1 })
      .limit(candidateLimit)
      .populate(
        "researchWorkId",
        "title description field difficulty tags links createdAt",
      );

    const validCandidates = trendingCandidates.filter(
      (item) => item.researchWorkId,
    );

    const maxScore = validCandidates.reduce(
      (acc, item) => Math.max(acc, Number(item.score) || 0),
      0,
    );

    const ranking = await rankResearchForUser({
      userId: req.userId,
      items: validCandidates,
      getResearch: (item) => item.researchWorkId,
      getGlobalMomentum: (item) =>
        normalizeMomentum(Number(item.score) || 0, maxScore),
    });

    const paged = ranking.ranked
      .slice(skip, skip + limit)
      .map(({ item, recommendation }) => {
        const payload = item.toObject ? item.toObject() : item;
        return attachRecommendation(payload, recommendation);
      });

    const total = await Trending.countDocuments(filter);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: paged,
      personalization: {
        status: ranking.personalizationStatus,
        topInterestKeywords: keywordSnapshotFromProfile(ranking.profile),
      },
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const discoverResearch = async (req, res, next) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 20);
    const { field, difficulty } = req.query;
    const searchTerm = trimSearchTerm(req.query.searchTerm);
    const skip = (page - 1) * limit;

    const filter = {};

    if (field) filter.field = field;
    if (difficulty) filter.difficulty = difficulty;
    if (searchTerm) {
      filter.$or = [
        { title: { $regex: searchTerm, $options: "i" } },
        { description: { $regex: searchTerm, $options: "i" } },
        { tags: { $in: [new RegExp(searchTerm, "i")] } },
      ];
    }

    const candidateLimit = Math.max(limit * 8, 80);

    const researchCandidates = await ResearchWork.find(filter)
      .sort({ createdAt: -1 })
      .limit(candidateLimit);

    const researchIds = researchCandidates.map((item) => item._id);
    const trendingStats = await Trending.find({
      researchWorkId: { $in: researchIds },
    })
      .select("researchWorkId score")
      .lean();

    const trendingScoreMap = new Map(
      trendingStats.map((entry) => [
        String(entry.researchWorkId),
        Number(entry.score) || 0,
      ]),
    );

    const maxTrendingScore = trendingStats.reduce(
      (acc, entry) => Math.max(acc, Number(entry.score) || 0),
      0,
    );

    const ranking = await rankResearchForUser({
      userId: req.userId,
      items: researchCandidates,
      getResearch: (item) => item,
      getGlobalMomentum: (item) => {
        const score = trendingScoreMap.get(String(item._id)) || 0;
        return normalizeMomentum(score, maxTrendingScore);
      },
    });

    const paged = ranking.ranked
      .slice(skip, skip + limit)
      .map(({ item, recommendation }) => {
        const payload = item.toObject ? item.toObject() : item;
        return attachRecommendation(payload, recommendation);
      });

    if (req.userId && searchTerm.length >= 2) {
      const topMatch = ranking.ranked[0]?.item || null;
      await recordUserInteraction({
        userId: req.userId,
        eventType: "search",
        research: topMatch || {
          field: field || null,
          tags: [],
          title: searchTerm,
          description: "",
          links: [],
        },
        searchTerm,
      });
    }

    const total = await ResearchWork.countDocuments(filter);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: paged,
      personalization: {
        status: ranking.personalizationStatus,
        topInterestKeywords: keywordSnapshotFromProfile(ranking.profile),
      },
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getResearchFields = (req, res) => {
  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: RESEARCH_FIELDS,
  });
};

export const getResearchByField = async (req, res, next) => {
  try {
    const { field } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    if (!RESEARCH_FIELDS.includes(field)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Invalid field",
      });
    }

    const research = await ResearchWork.find({ field })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ResearchWork.countDocuments({ field });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      field,
      data: research,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const incrementViews = async (req, res, next) => {
  try {
    const { researchWorkId } = req.params;

    const research = await ensureResearchExists(researchWorkId);
    if (!research) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: "Research work not found",
      });
    }

    await upsertTrendingCounters(research, { views: 1 });
    await recordUserInteraction({
      userId: req.userId,
      eventType: "view",
      research,
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "View counted",
    });
  } catch (error) {
    next(error);
  }
};

export const shareResearch = async (req, res, next) => {
  try {
    const { researchWorkId } = req.params;

    const research = await ensureResearchExists(researchWorkId);
    if (!research) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: "Research work not found",
      });
    }

    await upsertTrendingCounters(research, { shares: 1 });
    await recordUserInteraction({
      userId: req.userId,
      eventType: "share",
      research,
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Share counted",
    });
  } catch (error) {
    next(error);
  }
};

export const registerAnalyzeEvent = async ({ userId, researchWorkId }) => {
  if (!userId || !researchWorkId) return;

  const research = await ensureResearchExists(researchWorkId);
  if (!research) return;

  await upsertTrendingCounters(research, { analyzedCount: 1 });
  await recordUserInteraction({
    userId,
    eventType: "analyze",
    research,
  });
};
