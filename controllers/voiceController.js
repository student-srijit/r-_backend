import VoiceSummary from "../models/VoiceSummary.js";
import ResearchWork from "../models/ResearchWork.js";
import { HTTP_STATUS } from "../utils/constants.js";
import { createLLMService } from "../services/llmService.js";
import axios from "axios";
import { config } from "../config/env.js";

export const generateVoiceSummary = async (req, res, next) => {
  try {
    const { researchWorkId } = req.params;
    const { apiKey, provider, model, baseUrl } = req.body;

    if (!apiKey || !provider || !model) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "API key, provider, and model are required",
      });
    }

    // Check if research work exists and is authorized
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

    // Check if summary already exists — regenerate if requested
    const existing = await VoiceSummary.findOne({
      userId: req.userId,
      researchWorkId,
    });

    if (existing) {
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Voice summary already exists",
        data: existing,
      });
    }

    // Gather analysis summaries from links
    const analysisSummaries = research.links
      .filter((l) => l.analysis && l.analysis.summary)
      .map((l) => `- ${l.analysis.summary}`);

    // Generate a natural-language voice script via LLM
    const llmService = createLLMService(apiKey, provider, model, baseUrl);
    const script = await llmService.generateVoiceScript(
      research.title,
      research.field,
      research.description,
      research.notes,
      analysisSummaries,
    );

    // Save script to database
    const summary = new VoiceSummary({
      userId: req.userId,
      researchWorkId,
      script,
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    await summary.save();

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: "Voice summary generated successfully",
      data: summary,
    });
  } catch (error) {
    const message = error.message.includes("API key")
      ? "Invalid API key or provider"
      : error.message;
    res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message });
  }
};

export const getVoiceSummary = async (req, res, next) => {
  try {
    const { researchWorkId } = req.params;

    const summary = await VoiceSummary.findOne({
      userId: req.userId,
      researchWorkId,
    });

    if (!summary) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: "Voice summary not found",
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteVoiceSummary = async (req, res, next) => {
  try {
    const { id } = req.params;

    const summary = await VoiceSummary.findById(id);
    if (!summary) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: "Voice summary not found",
      });
    }

    if (summary.userId.toString() !== req.userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: "Not authorized",
      });
    }

    await VoiceSummary.findByIdAndDelete(id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Voice summary deleted",
    });
  } catch (error) {
    next(error);
  }
};

export const synthesizeVoiceSummary = async (req, res, next) => {
  try {
    const { researchWorkId } = req.params;
    const { voiceId, modelId } = req.body || {};

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

    const summary = await VoiceSummary.findOne({
      userId: req.userId,
      researchWorkId,
    });

    if (!summary?.script) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message:
          "Voice summary script not found. Generate voice summary first.",
      });
    }

    if (!config.voice.elevenLabsKey) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Human voice engine is not configured on server",
      });
    }

    const chosenVoiceId = voiceId || config.voice.elevenLabsVoiceId;
    const chosenModelId = modelId || config.voice.elevenLabsModelId;

    const ttsResponse = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${chosenVoiceId}`,
      {
        text: summary.script,
        model_id: chosenModelId,
        voice_settings: {
          stability: 0.35,
          similarity_boost: 0.8,
          style: 0.28,
          use_speaker_boost: true,
        },
      },
      {
        responseType: "arraybuffer",
        timeout: 30000,
        headers: {
          "xi-api-key": config.voice.elevenLabsKey,
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
        },
      },
    );

    const audioBase64 = Buffer.from(ttsResponse.data).toString("base64");

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        engine: "elevenlabs",
        mimeType: "audio/mpeg",
        audioBase64,
        voiceId: chosenVoiceId,
        modelId: chosenModelId,
      },
    });
  } catch (error) {
    const providerMessage =
      error.response?.data?.detail?.message ||
      error.response?.data?.message ||
      error.message;

    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: `Voice synthesis failed: ${providerMessage}`,
    });
  }
};
