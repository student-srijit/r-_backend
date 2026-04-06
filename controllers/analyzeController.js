import ResearchWork from "../models/ResearchWork.js";
import { HTTP_STATUS } from "../utils/constants.js";
import { createLLMService } from "../services/llmService.js";
import { createContentParser } from "../services/contentParser.js";
import { validateURL } from "../utils/validators.js";
import { registerAnalyzeEvent } from "./discoverController.js";

export const analyzeLink = async (req, res, next) => {
  try {
    const {
      researchWorkId,
      linkUrl,
      apiKey,
      provider,
      model,
      baseUrl,
      evidenceMode = false,
    } = req.body;

    // Validate input
    if (!researchWorkId || !linkUrl || !apiKey || !provider || !model) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message:
          "Research work ID, link URL, API key, provider, and model are required",
      });
    }

    if (!validateURL(linkUrl)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Invalid URL",
      });
    }

    // Check authorization
    const research = await ResearchWork.findById(researchWorkId);
    if (!research) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: "Research work not found",
      });
    }

    if (research.userId.toString() !== req.userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: "Not authorized",
      });
    }

    // Parse content from URL
    const parser = createContentParser();
    const contentType = await parser.detectContentType(linkUrl);
    const parsedContent = await parser.extractFromURL(linkUrl);

    // Analyze with LLM using user's API key
    const llmService = createLLMService(apiKey, provider, model, baseUrl);
    const analysisResponse = await llmService.analyzeContent(
      parsedContent.content,
      contentType === "paper" ? "research_paper" : "general",
      { evidenceMode: Boolean(evidenceMode) },
    );

    const cleanText = (value = "") =>
      String(value).replace(/\r/g, "").replace(/\*\*/g, "").trim();

    const normalizeList = (value, max = 10) => {
      if (!Array.isArray(value)) return [];
      return value
        .map((item) => cleanText(item).replace(/^[\d.\-*•]+\s*/, ""))
        .filter(Boolean)
        .slice(0, max);
    };

    const normalizedSourceText = cleanText(parsedContent.content)
      .toLowerCase()
      .replace(/\s+/g, " ");

    const sourceSentences = cleanText(parsedContent.content)
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => cleanText(sentence))
      .filter((sentence) => sentence.length >= 60)
      .slice(0, 200);

    const normalizeConfidence = (value) => {
      const parsed = String(value || "medium").toLowerCase().trim();
      if (["high", "medium", "low"].includes(parsed)) return parsed;
      return "medium";
    };

    const verifyQuote = (quote) => {
      const cleanQuote = cleanText(quote)
        .replace(/["'`]/g, "")
        .replace(/\s+/g, " ");
      if (!cleanQuote || cleanQuote.length < 18) return null;

      const normalizedQuote = cleanQuote.toLowerCase();
      if (normalizedSourceText.includes(normalizedQuote)) {
        return cleanQuote;
      }

      const shortened = cleanQuote.slice(0, 180).trim();
      if (shortened.length >= 18 && normalizedSourceText.includes(shortened.toLowerCase())) {
        return shortened;
      }

      return null;
    };

    const scoreSentenceMatch = (sentence, claim) => {
      const claimTokens = cleanText(claim)
        .toLowerCase()
        .split(/\s+/)
        .filter((token) => token.length >= 4);

      if (!claimTokens.length) return 0;

      const sentenceText = sentence.toLowerCase();
      return claimTokens.reduce(
        (score, token) => score + (sentenceText.includes(token) ? 1 : 0),
        0,
      );
    };

    const normalizeEvidenceItems = (value, max = 6) => {
      if (!Array.isArray(value)) return [];

      return value
        .map((item) => {
          const claim = cleanText(
            item?.claim || item?.statement || item?.point || item?.keyPoint,
          );
          const quote = verifyQuote(
            item?.quote || item?.evidenceQuote || item?.sourceQuote,
          );

          if (!claim || !quote) return null;

          return {
            claim,
            quote,
            sourceUrl: linkUrl,
            confidence: normalizeConfidence(item?.confidence),
          };
        })
        .filter(Boolean)
        .slice(0, max);
    };

    const buildFallbackEvidence = (claims, max = 4) => {
      if (!Array.isArray(claims) || !claims.length || !sourceSentences.length) {
        return [];
      }

      return claims
        .slice(0, max)
        .map((claim) => {
          const bestMatch = sourceSentences
            .map((sentence) => ({
              sentence,
              score: scoreSentenceMatch(sentence, claim),
            }))
            .sort((a, b) => b.score - a.score)[0];

          if (!bestMatch || bestMatch.score < 2) return null;

          return {
            claim: cleanText(claim),
            quote: bestMatch.sentence,
            sourceUrl: linkUrl,
            confidence: "medium",
          };
        })
        .filter(Boolean);
    };

    let summary = "";
    let keyPoints = [];
    let evidence = [];
    let importantConcepts = [];
    let practicalApplications = [];
    let discussionQuestions = [];

    if (
      analysisResponse &&
      typeof analysisResponse === "object" &&
      !Array.isArray(analysisResponse)
    ) {
      summary = cleanText(
        analysisResponse.summary ||
          analysisResponse.detailedSummary ||
          analysisResponse.overview,
      );
      keyPoints = normalizeList(
        analysisResponse.keyPoints || analysisResponse.mainTakeaways,
        10,
      );
      evidence = normalizeEvidenceItems(
        analysisResponse.evidence || analysisResponse.citations,
        6,
      );
      importantConcepts = normalizeList(
        analysisResponse.importantConcepts ||
          analysisResponse.concepts ||
          analysisResponse.definitions,
        8,
      );
      practicalApplications = normalizeList(
        analysisResponse.practicalApplications ||
          analysisResponse.applications ||
          analysisResponse.useCases,
        8,
      );
      discussionQuestions = normalizeList(
        analysisResponse.discussionQuestions || analysisResponse.questions,
        8,
      );
    } else {
      const analysisText = cleanText(analysisResponse);
      const lines = analysisText
        .split("\n")
        .map((line) => cleanText(line))
        .filter(Boolean);

      summary = lines
        .filter(
          (line) =>
            !/^key\s*points?/i.test(line) &&
            !/^important\s*concepts?/i.test(line) &&
            !/^applications?/i.test(line) &&
            !/^discussion\s*questions?/i.test(line),
        )
        .slice(0, 6)
        .join(" ")
        .trim();

      keyPoints = lines
        .map((line) => line.replace(/^[\d.\-*•]+\s*/, ""))
        .filter((line) => line.length > 20)
        .slice(0, 8);
    }

    if (Boolean(evidenceMode) && evidence.length === 0) {
      evidence = buildFallbackEvidence(keyPoints, 5);
    }

    if (!summary) {
      throw new Error(
        "Model returned an incomplete analysis. Please try again.",
      );
    }

    if (keyPoints.length === 0) {
      throw new Error(
        "Model did not return actionable key points. Please retry analysis.",
      );
    }

    if (Boolean(evidenceMode) && evidence.length === 0) {
      throw new Error(
        "Evidence lock could not verify source-backed quotes. Please retry with a richer source.",
      );
    }

    // Find the link in the research work and update it
    const linkIndex = research.links.findIndex((l) => l.url === linkUrl);

    if (linkIndex !== -1) {
      research.links[linkIndex].analysis = {
        summary,
        keyPoints,
        evidence,
        importantConcepts,
        practicalApplications,
        discussionQuestions,
        analyzedAt: new Date(),
        modelUsed: `${provider}/${model}`,
      };
    } else {
      // If link doesn't exist, add it with analysis
      research.links.push({
        url: linkUrl,
        type: contentType,
        addedAt: new Date(),
        analysis: {
          summary,
          keyPoints,
          evidence,
          importantConcepts,
          practicalApplications,
          discussionQuestions,
          analyzedAt: new Date(),
          modelUsed: `${provider}/${model}`,
        },
      });
    }

    research.updatedAt = new Date();
    await research.save();

    await registerAnalyzeEvent({
      userId: req.userId,
      researchWorkId,
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Link analyzed successfully",
      data: {
        url: linkUrl,
        contentType,
        analysis: {
          summary,
          keyPoints,
          evidence,
          importantConcepts,
          practicalApplications,
          discussionQuestions,
          evidenceMode: Boolean(evidenceMode),
        },
      },
    });
  } catch (error) {
    // Don't expose API key in error messages
    const message = error.message.includes("API key")
      ? "Invalid API key or provider"
      : error.message;

    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message,
    });
  }
};

export const getAnalysisHistory = async (req, res, next) => {
  try {
    const { researchWorkId } = req.params;

    const research = await ResearchWork.findById(researchWorkId);
    if (!research) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: "Research work not found",
      });
    }

    if (research.userId.toString() !== req.userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: "Not authorized",
      });
    }

    const analyzed = research.links.filter(
      (link) => link.analysis && link.analysis.summary,
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: analyzed,
    });
  } catch (error) {
    next(error);
  }
};
