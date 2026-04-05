import UserInterestProfile from "../models/UserInterestProfile.js";

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "about",
  "your",
  "have",
  "has",
  "had",
  "were",
  "was",
  "will",
  "would",
  "could",
  "should",
  "their",
  "there",
  "what",
  "when",
  "where",
  "which",
  "while",
  "than",
  "then",
  "them",
  "they",
  "you",
  "our",
  "can",
  "are",
  "but",
  "not",
  "all",
  "any",
  "each",
  "also",
  "more",
  "most",
  "over",
  "under",
  "new",
  "use",
  "used",
  "using",
  "through",
  "across",
  "between",
]);

const MAX_KEYWORDS_PER_ITEM = 24;
const MAX_RECENT_EVENTS = 150;

const EVENT_STRENGTH = {
  view: 1,
  share: 2.25,
  analyze: 3.5,
  search: 1.5,
};

function normalizeToken(token) {
  return String(token || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
}

function tokenize(text) {
  return normalizeToken(text)
    .split(/\s+/)
    .map((value) => value.trim())
    .filter((value) => value.length >= 3 && !STOP_WORDS.has(value));
}

function buildKeywordFrequency(textBlocks = []) {
  const freq = new Map();

  for (const block of textBlocks) {
    for (const token of tokenize(block)) {
      freq.set(token, (freq.get(token) || 0) + 1);
    }
  }

  return new Map(
    [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_KEYWORDS_PER_ITEM),
  );
}

function mapToPairs(weightMap) {
  if (!weightMap) return [];
  if (weightMap instanceof Map) return [...weightMap.entries()];
  return Object.entries(weightMap);
}

function addWeight(weightMap, key, delta) {
  if (!key || !Number.isFinite(delta)) return;
  const current = Number(weightMap.get(key) || 0);
  const next = Math.max(0, current + delta);
  if (next === 0) {
    weightMap.delete(key);
    return;
  }
  weightMap.set(key, next);
}

function applyDecayToMap(weightMap, decay) {
  for (const [key, value] of weightMap.entries()) {
    const next = value * decay;
    if (next < 0.02) {
      weightMap.delete(key);
      continue;
    }
    weightMap.set(key, next);
  }
}

function getProfileMaxWeights(profile) {
  const maxFromMap = (m) => {
    if (!m || m.size === 0) return 1;
    return Math.max(...[...m.values(), 1]);
  };

  return {
    field: maxFromMap(profile.fieldWeights),
    tag: maxFromMap(profile.tagWeights),
    keyword: maxFromMap(profile.keywordWeights),
  };
}

function buildResearchFeatures(research, explicitSearchTerm) {
  const title = research?.title || "";
  const description = research?.description || "";
  const tags = Array.isArray(research?.tags)
    ? research.tags.filter(Boolean)
    : [];

  const analysisSummaries = Array.isArray(research?.links)
    ? research.links.map((link) => link?.analysis?.summary).filter(Boolean)
    : [];

  const keywordBlocks = [title, description, ...tags, ...analysisSummaries];
  if (explicitSearchTerm) keywordBlocks.push(explicitSearchTerm);

  return {
    field: research?.field || null,
    tags,
    keywords: buildKeywordFrequency(keywordBlocks),
  };
}

function interactionDecay(lastInteractionAt) {
  if (!lastInteractionAt) return 1;
  const elapsedMs = Date.now() - new Date(lastInteractionAt).getTime();
  const elapsedDays = Math.max(0, elapsedMs / (1000 * 60 * 60 * 24));
  return Math.exp(-0.03 * elapsedDays);
}

function normalizeSearchTerm(searchTerm) {
  const clean = normalizeToken(searchTerm).replace(/\s+/g, " ").trim();
  return clean.length >= 2 ? clean : null;
}

export async function recordUserInteraction({
  userId,
  eventType,
  research,
  searchTerm,
}) {
  if (!userId || !EVENT_STRENGTH[eventType]) {
    return null;
  }

  const profile =
    (await UserInterestProfile.findOne({ userId })) ||
    new UserInterestProfile({ userId });
  const decay = interactionDecay(profile.lastInteractionAt);

  if (profile.fieldWeights instanceof Map)
    applyDecayToMap(profile.fieldWeights, decay);
  if (profile.tagWeights instanceof Map)
    applyDecayToMap(profile.tagWeights, decay);
  if (profile.keywordWeights instanceof Map)
    applyDecayToMap(profile.keywordWeights, decay);

  const strength = EVENT_STRENGTH[eventType];
  const normalizedSearch = normalizeSearchTerm(searchTerm);
  const features = buildResearchFeatures(research, normalizedSearch);

  if (features.field) {
    addWeight(profile.fieldWeights, features.field, strength * 1.8);
  }

  const tagBoost =
    features.tags.length > 0 ? (strength * 1.6) / features.tags.length : 0;
  for (const tag of features.tags) {
    addWeight(profile.tagWeights, String(tag).toLowerCase(), tagBoost);
  }

  for (const [keyword, freq] of features.keywords.entries()) {
    addWeight(
      profile.keywordWeights,
      keyword,
      strength * Math.min(1.5, 0.35 + freq * 0.25),
    );
  }

  profile.eventCounts[eventType] = (profile.eventCounts[eventType] || 0) + 1;
  profile.lastInteractionAt = new Date();

  profile.recentEvents.push({
    type: eventType,
    researchWorkId: research?._id || null,
    searchTerm: normalizedSearch,
    at: new Date(),
  });

  if (profile.recentEvents.length > MAX_RECENT_EVENTS) {
    profile.recentEvents = profile.recentEvents.slice(-MAX_RECENT_EVENTS);
  }

  await profile.save();
  return profile;
}

function signalCount(profile) {
  if (!profile?.eventCounts) return 0;
  return (
    (profile.eventCounts.view || 0) +
    (profile.eventCounts.share || 0) +
    (profile.eventCounts.analyze || 0) +
    (profile.eventCounts.search || 0)
  );
}

function freshnessScore(createdAt) {
  if (!createdAt) return 0.4;
  const ageDays = Math.max(
    0,
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.exp(-ageDays / 30);
}

function computeAffinity(profile, research, maxWeights) {
  const features = buildResearchFeatures(research);
  let fieldMatch = 0;
  let tagMatch = 0;
  let keywordMatch = 0;

  if (features.field) {
    const fieldWeight = Number(profile.fieldWeights.get(features.field) || 0);
    fieldMatch = fieldWeight / maxWeights.field;
  }

  if (features.tags.length > 0) {
    const matches = features.tags.map((tag) =>
      Number(profile.tagWeights.get(String(tag).toLowerCase()) || 0),
    );
    const sum = matches.reduce((acc, value) => acc + value, 0);
    tagMatch = sum / features.tags.length / maxWeights.tag;
  }

  const keywords = [...features.keywords.keys()];
  if (keywords.length > 0) {
    const matches = keywords.map((keyword) =>
      Number(profile.keywordWeights.get(keyword) || 0),
    );
    const sum = matches.reduce((acc, value) => acc + value, 0);
    keywordMatch = sum / keywords.length / maxWeights.keyword;
  }

  const affinity = Math.max(
    0,
    fieldMatch * 0.45 + tagMatch * 0.3 + keywordMatch * 0.25,
  );
  return {
    affinity,
    fieldMatch,
    tagMatch,
    keywordMatch,
    topMatchedTags: features.tags
      .filter(
        (tag) =>
          Number(profile.tagWeights.get(String(tag).toLowerCase()) || 0) > 0,
      )
      .slice(0, 4),
    topMatchedKeywords: keywords
      .filter((keyword) => Number(profile.keywordWeights.get(keyword) || 0) > 0)
      .slice(0, 5),
  };
}

export async function rankResearchForUser({
  userId,
  items,
  getResearch,
  getGlobalMomentum,
}) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      ranked: [],
      profile: null,
      personalizationStatus: "no_candidates",
    };
  }

  if (!userId) {
    const ranked = items
      .map((item) => {
        const research = getResearch(item);
        const momentum = getGlobalMomentum(item);
        const fresh = freshnessScore(research?.createdAt);
        const score = momentum * 0.72 + fresh * 0.28;

        return {
          item,
          recommendation: {
            finalScore: score,
            affinityScore: 0,
            globalMomentum: momentum,
            freshness: fresh,
            matchedTags: [],
            matchedKeywords: [],
          },
        };
      })
      .sort(
        (a, b) => b.recommendation.finalScore - a.recommendation.finalScore,
      );

    return {
      ranked,
      profile: null,
      personalizationStatus: "anonymous",
    };
  }

  const profile = await UserInterestProfile.findOne({ userId });
  const interactions = signalCount(profile);

  if (!profile || interactions < 4) {
    const ranked = items
      .map((item) => {
        const research = getResearch(item);
        const momentum = getGlobalMomentum(item);
        const fresh = freshnessScore(research?.createdAt);
        const score = momentum * 0.72 + fresh * 0.28;

        return {
          item,
          recommendation: {
            finalScore: score,
            affinityScore: 0,
            globalMomentum: momentum,
            freshness: fresh,
            matchedTags: [],
            matchedKeywords: [],
          },
        };
      })
      .sort(
        (a, b) => b.recommendation.finalScore - a.recommendation.finalScore,
      );

    return {
      ranked,
      profile: profile || null,
      personalizationStatus: "insufficient_signals",
    };
  }

  const maxWeights = getProfileMaxWeights(profile);

  const ranked = items
    .map((item) => {
      const research = getResearch(item);
      const momentum = getGlobalMomentum(item);
      const fresh = freshnessScore(research?.createdAt);

      const affinityData = computeAffinity(profile, research, maxWeights);
      const finalScore =
        affinityData.affinity * 0.58 + momentum * 0.27 + fresh * 0.15;

      return {
        item,
        recommendation: {
          finalScore,
          affinityScore: affinityData.affinity,
          globalMomentum: momentum,
          freshness: fresh,
          matchedField:
            affinityData.fieldMatch > 0 ? research?.field || null : null,
          matchedTags: affinityData.topMatchedTags,
          matchedKeywords: affinityData.topMatchedKeywords,
        },
      };
    })
    .sort((a, b) => b.recommendation.finalScore - a.recommendation.finalScore);

  return {
    ranked,
    profile,
    personalizationStatus: "personalized",
  };
}

export function keywordSnapshotFromProfile(profile, limit = 8) {
  if (!profile?.keywordWeights) return [];
  return mapToPairs(profile.keywordWeights)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, limit)
    .map(([keyword]) => keyword);
}
