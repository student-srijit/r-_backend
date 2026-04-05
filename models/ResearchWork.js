import mongoose from "mongoose";

const researchWorkSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: 5,
    },
    description: {
      type: String,
      default: "",
    },
    links: [
      {
        _id: false,
        url: {
          type: String,
          required: true,
        },
        type: {
          type: String,
          enum: ["blog", "paper", "vlog", "other"],
          default: "other",
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
        analysis: {
          summary: {
            type: String,
            default: null,
          },
          keyPoints: [String],
          importantConcepts: [String],
          practicalApplications: [String],
          discussionQuestions: [String],
          analyzedAt: {
            type: Date,
            default: null,
          },
          modelUsed: {
            type: String,
            default: null,
          },
        },
      },
    ],
    tags: [String],
    field: {
      type: String,
      enum: [
        "AI",
        "Machine Learning",
        "Deep Learning",
        "Natural Language Processing",
        "Computer Vision",
        "Blockchain",
        "Web Development",
        "Cloud Computing",
        "DevOps",
        "Cybersecurity",
        "Data Science",
        "Other",
      ],
      default: "Other",
    },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "intermediate",
    },
    notes: {
      type: String,
      default: "",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

// Index for faster queries
researchWorkSchema.index({ userId: 1, createdAt: -1 });
researchWorkSchema.index({ userId: 1, field: 1 });

export default mongoose.model("ResearchWork", researchWorkSchema);
