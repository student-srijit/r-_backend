import mongoose from "mongoose";

const trendingSchema = new mongoose.Schema(
  {
    researchWorkId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ResearchWork",
      required: true,
      unique: true,
    },
    views: {
      type: Number,
      default: 0,
    },
    shares: {
      type: Number,
      default: 0,
    },
    analyzedCount: {
      type: Number,
      default: 0,
    },
    field: String,
    score: {
      type: Number,
      default: 0,
    },
    source: {
      type: String,
      enum: ["user", "ingested"],
      default: "user",
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

// Calculate trending score
trendingSchema.methods.calculateScore = function () {
  const now = new Date();
  const createdAt = this.createdAt || now;
  const daysSinceCreation = (now - createdAt) / (1000 * 60 * 60 * 24);

  // Score = (views * 0.4 + shares * 0.3 + analyzed * 0.3) / (1 + days^1.2)
  this.score =
    (this.views * 0.4 + this.shares * 0.3 + this.analyzedCount * 0.3) /
    (1 + Math.pow(daysSinceCreation, 1.2));

  return this.score;
};

trendingSchema.index({ score: -1, updatedAt: -1 });
trendingSchema.index({ field: 1, score: -1 });

export default mongoose.model("Trending", trendingSchema);
