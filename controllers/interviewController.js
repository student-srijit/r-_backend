import Interview from "../models/Interview.js";
import ResearchWork from "../models/ResearchWork.js";
import { HTTP_STATUS } from "../utils/constants.js";
import { COMPANY_DIFFICULTY, COMPANY_CONTEXT } from "../utils/constants.js";
import { createLLMService } from "../services/llmService.js";
import { validateCompanyName } from "../utils/validators.js";

const VALID_INTERVIEW_MODES = new Set(["practice", "test", "video"]);

const clampNumber = (value, min, max) => {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < min || parsed > max) return null;
  return parsed;
};

const completionRatio = (interview) => {
  const total = Array.isArray(interview.questions)
    ? interview.questions.length
    : 0;
  if (total === 0) return 0;
  return Math.min(1, (interview.userAnswers?.length || 0) / total);
};

const deriveRecommendedDifficulty = (interviews = [], company) => {
  if (!interviews.length) {
    return COMPANY_DIFFICULTY[company] || "medium";
  }

  const avgCompletion =
    interviews.map(completionRatio).reduce((acc, value) => acc + value, 0) /
    interviews.length;

  if (avgCompletion >= 0.8) return "hard";
  if (avgCompletion >= 0.55) return "medium";
  return "easy";
};

const buildHistoryContext = (interviews = []) => {
  if (!interviews.length) {
    return "No prior interview history for this company.";
  }

  const difficultyDist = { easy: 0, medium: 0, hard: 0 };
  const topicFreq = new Map();

  for (const interview of interviews) {
    difficultyDist[interview.difficulty] =
      (difficultyDist[interview.difficulty] || 0) + 1;
    for (const question of interview.questions || []) {
      if (!question.topic) continue;
      topicFreq.set(question.topic, (topicFreq.get(question.topic) || 0) + 1);
    }
  }

  const topTopics = [...topicFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([topic]) => topic);

  return `Interview history summary:
- Attempts: ${interviews.length}
- Difficulty distribution: easy=${difficultyDist.easy}, medium=${difficultyDist.medium}, hard=${difficultyDist.hard}
- Most common past topics: ${topTopics.join(", ") || "None yet"}
Use this to avoid repeating identical questions and progressively raise depth.`;
};

export const generateInterview = async (req, res, next) => {
  try {
    const {
      researchWorkId,
      company,
      customDifficulty,
      apiKey,
      provider,
      model,
      baseUrl,
      mode = "practice",
      testDurationMinutes,
    } = req.body;

    // Validate input
    if (!researchWorkId || !company || !apiKey || !provider || !model) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message:
          "Research work ID, company name, API key, provider, and model are required",
      });
    }

    if (!validateCompanyName(company)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Valid company name is required",
      });
    }

    if (!VALID_INTERVIEW_MODES.has(mode)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Mode must be one of: practice, test, video",
      });
    }

    const normalizedTestDuration =
      mode === "test" ? clampNumber(testDurationMinutes, 5, 180) : null;

    if (mode === "test" && normalizedTestDuration === null) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Test duration must be between 5 and 180 minutes",
      });
    }

    // Get research work
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

    const recentCompanyInterviews = await Interview.find({
      userId: req.userId,
      company,
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .select(
        "difficulty questions userAnswers status researchWorkId createdAt",
      );

    const recommendedDifficulty = deriveRecommendedDifficulty(
      recentCompanyInterviews,
      company,
    );

    // Determine difficulty
    const difficulty = customDifficulty || recommendedDifficulty;

    // Gather research content
    const historyContext = buildHistoryContext(recentCompanyInterviews);

    const researchContent = [
      research.title,
      research.description,
      historyContext,
    ]
      .concat(
        research.links
          .filter((l) => l.analysis && l.analysis.summary)
          .map((l) => `${l.url}: ${l.analysis.summary}`),
      )
      .join("\n");

    // Look up company-specific interview context for prompt enrichment
    const companyContext = COMPANY_CONTEXT[company] || null;

    // Generate questions using LLM with user's API key
    const llmService = createLLMService(apiKey, provider, model, baseUrl);
    const questionsResponse = await llmService.generateInterviewQuestions(
      researchContent,
      company,
      difficulty,
      companyContext,
    );

    // Parse questions
    let questions = [];
    if (Array.isArray(questionsResponse)) {
      questions = questionsResponse.map((q, idx) => ({
        id: `q${idx + 1}`,
        question: q.question,
        topic: q.topic || "General",
        difficulty: q.difficulty || "medium",
        hints: q.hints || [],
        generatedAt: new Date(),
      }));
    } else {
      // If response is text, try to parse it
      const lines = questionsResponse.split("\n").filter((l) => l.trim());
      questions = lines.map((line, idx) => ({
        id: `q${idx + 1}`,
        question: line.replace(/^\d+\.\s*/, ""),
        topic: "Interview",
        difficulty: "medium",
        hints: [],
        generatedAt: new Date(),
      }));
    }

    // Create interview record
    const startedAt = mode === "test" ? new Date() : null;
    const endsAt =
      mode === "test"
        ? new Date(startedAt.getTime() + normalizedTestDuration * 60 * 1000)
        : null;

    const interview = new Interview({
      userId: req.userId,
      researchWorkId,
      company,
      mode,
      difficulty,
      questions,
      userAnswers: [],
      testConfig: {
        durationMinutes: normalizedTestDuration,
        startedAt,
        endsAt,
      },
      status: "in_progress",
    });

    await interview.save();

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: "Interview generated successfully",
      data: {
        interviewId: interview._id,
        company: interview.company,
        mode: interview.mode,
        difficulty: interview.difficulty,
        recommendedDifficulty,
        questions: interview.questions,
        testConfig: interview.testConfig,
      },
    });
  } catch (error) {
    const message = error.message.includes("API key")
      ? "Invalid API key or provider"
      : error.message;

    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message,
    });
  }
};

export const getInterview = async (req, res, next) => {
  try {
    const { id } = req.params;

    const interview = await Interview.findById(id);
    if (!interview) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: "Interview not found",
      });
    }

    if (interview.userId.toString() !== req.userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: "Not authorized",
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: interview,
    });
  } catch (error) {
    next(error);
  }
};

export const getUserInterviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, company, mode } = req.query;
    const skip = (page - 1) * limit;

    const filter = { userId: req.userId };
    if (status) filter.status = status;
    if (company) filter.company = company;
    if (mode && VALID_INTERVIEW_MODES.has(mode)) filter.mode = mode;

    const interviews = await Interview.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Interview.countDocuments(filter);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: interviews,
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

export const submitAnswer = async (req, res, next) => {
  try {
    const { interviewId } = req.params;
    const {
      questionId,
      answer,
      apiKey,
      provider,
      model,
      baseUrl,
      answerType,
      videoDurationSec,
      transcriptSource,
    } = req.body;

    if (!questionId || !answer || !apiKey || !provider || !model) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message:
          "Question ID, answer, API key, provider, and model are required",
      });
    }

    const interview = await Interview.findById(interviewId);
    if (!interview) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: "Interview not found",
      });
    }

    if (interview.userId.toString() !== req.userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: "Not authorized",
      });
    }

    // Find the question
    const question = interview.questions.find((q) => q.id === questionId);
    if (!question) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: "Question not found",
      });
    }

    // Generate feedback using user's API key
    const llmService = createLLMService(apiKey, provider, model, baseUrl);
    const feedback = await llmService.generateFeedback(
      question.question,
      answer,
    );

    const submittedAnswer = {
      questionId,
      answer,
      feedback,
      answerType: answerType === "video" ? "video" : "text",
      videoDurationSec: Number.isFinite(Number(videoDurationSec))
        ? Number(videoDurationSec)
        : null,
      transcriptSource:
        transcriptSource === "manual" ||
        transcriptSource === "speech_recognition"
          ? transcriptSource
          : "unknown",
      submittedAt: new Date(),
    };

    // Upsert answer per question
    const existingIdx = interview.userAnswers.findIndex(
      (item) => item.questionId === questionId,
    );
    if (existingIdx >= 0) {
      interview.userAnswers[existingIdx] = submittedAnswer;
    } else {
      interview.userAnswers.push(submittedAnswer);
    }

    // Check if all questions answered
    if (interview.userAnswers.length === interview.questions.length) {
      interview.status = "completed";
      interview.completedAt = new Date();
    }

    await interview.save();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Answer submitted successfully",
      data: {
        questionId,
        feedback,
        completionPercentage: Math.round(
          (interview.userAnswers.length / interview.questions.length) * 100,
        ),
      },
    });
  } catch (error) {
    const message = error.message.includes("API key")
      ? "Invalid API key or provider"
      : error.message;

    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message,
    });
  }
};

export const completeInterview = async (req, res, next) => {
  try {
    const { id } = req.params;

    const interview = await Interview.findById(id);
    if (!interview) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: "Interview not found",
      });
    }

    if (interview.userId.toString() !== req.userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: "Not authorized",
      });
    }

    interview.status = "completed";
    interview.completedAt = new Date();
    await interview.save();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Interview marked as completed",
      data: interview,
    });
  } catch (error) {
    next(error);
  }
};

export const getCompanyInterviewHistory = async (req, res, next) => {
  try {
    const { company, researchWorkId, limit = 20 } = req.query;

    if (!company || !validateCompanyName(company)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Valid company query param is required",
      });
    }

    const safeLimit = Math.max(
      1,
      Math.min(50, Number.parseInt(String(limit), 10) || 20),
    );

    const filter = {
      userId: req.userId,
      company,
    };

    if (researchWorkId) {
      filter.researchWorkId = researchWorkId;
    }

    const interviews = await Interview.find(filter)
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .populate("researchWorkId", "title field");

    const difficultyDistribution = { easy: 0, medium: 0, hard: 0 };
    const modeDistribution = { practice: 0, test: 0, video: 0 };

    for (const interview of interviews) {
      difficultyDistribution[interview.difficulty] =
        (difficultyDistribution[interview.difficulty] || 0) + 1;
      modeDistribution[interview.mode] =
        (modeDistribution[interview.mode] || 0) + 1;
    }

    const recentQuestions = interviews
      .flatMap((interview) =>
        (interview.questions || []).map((question) => ({
          interviewId: interview._id,
          researchWorkId: interview.researchWorkId?._id || null,
          researchTitle: interview.researchWorkId?.title || null,
          questionId: question.id,
          question: question.question,
          topic: question.topic || "General",
          difficulty: question.difficulty || interview.difficulty,
          createdAt: interview.createdAt,
        })),
      )
      .slice(0, 30);

    const completed = interviews.filter(
      (interview) => interview.status === "completed",
    ).length;
    const recommendedDifficulty = deriveRecommendedDifficulty(
      interviews,
      company,
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        company,
        attempts: interviews.length,
        completedAttempts: completed,
        completionRate:
          interviews.length > 0 ? completed / interviews.length : 0,
        recommendedDifficulty,
        difficultyDistribution,
        modeDistribution,
        recentQuestions,
      },
    });
  } catch (error) {
    next(error);
  }
};
