import mongoose from "mongoose";

const boundedMapNumber = {
  type: Map,
  of: Number,
  default: {},
};

const userInterestProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    fieldWeights: boundedMapNumber,
    tagWeights: boundedMapNumber,
    keywordWeights: boundedMapNumber,
    eventCounts: {
      view: { type: Number, default: 0 },
      share: { type: Number, default: 0 },
      analyze: { type: Number, default: 0 },
      search: { type: Number, default: 0 },
    },
    recentEvents: [
      {
        _id: false,
        type: {
          type: String,
          enum: ["view", "share", "analyze", "search"],
          required: true,
        },
        researchWorkId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ResearchWork",
          default: null,
        },
        searchTerm: {
          type: String,
          default: null,
        },
        at: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    lastInteractionAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

userInterestProfileSchema.methods.getSignalCount = function () {
  const counts = this.eventCounts || {};
  return (
    (counts.view || 0) +
    (counts.share || 0) +
    (counts.analyze || 0) +
    (counts.search || 0)
  );
};

export default mongoose.model("UserInterestProfile", userInterestProfileSchema);
