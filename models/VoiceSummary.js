import mongoose from 'mongoose';

const voiceSummarySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    researchWorkId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ResearchWork',
      required: true,
    },
    script: {
      type: String,
      required: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      index: { expireAfterSeconds: 0 }, // TTL index
    },
  },
  { timestamps: true }
);

voiceSummarySchema.index({ userId: 1, researchWorkId: 1 });

export default mongoose.model('VoiceSummary', voiceSummarySchema);
