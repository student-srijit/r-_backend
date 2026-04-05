import mongoose from "mongoose";

const interviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    researchWorkId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ResearchWork",
      required: true,
    },
    company: {
      type: String,
      required: true,
      trim: true,
    },
    mode: {
      type: String,
      enum: ["practice", "test", "video"],
      default: "practice",
      index: true,
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    questions: [
      {
        id: String,
        question: {
          type: String,
          required: true,
        },
        topic: String,
        difficulty: {
          type: String,
          enum: ["easy", "medium", "hard"],
        },
        hints: [String],
        generatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    userAnswers: [
      {
        questionId: String,
        answer: String,
        feedback: String,
        answerType: {
          type: String,
          enum: ["text", "video"],
          default: "text",
        },
        videoDurationSec: {
          type: Number,
          default: null,
        },
        transcriptSource: {
          type: String,
          enum: ["manual", "speech_recognition", "unknown"],
          default: "unknown",
        },
        submittedAt: Date,
      },
    ],
    testConfig: {
      durationMinutes: {
        type: Number,
        default: null,
      },
      startedAt: {
        type: Date,
        default: null,
      },
      endsAt: {
        type: Date,
        default: null,
      },
    },
    status: {
      type: String,
      enum: ["in_progress", "completed"],
      default: "in_progress",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

interviewSchema.index({ userId: 1, createdAt: -1 });
interviewSchema.index({ userId: 1, company: 1, createdAt: -1 });

export default mongoose.model("Interview", interviewSchema);
