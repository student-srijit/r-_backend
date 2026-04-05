import express from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.js";
import {
  getTrendingResearch,
  discoverResearch,
  getResearchFields,
  getResearchByField,
  incrementViews,
  shareResearch,
} from "../controllers/discoverController.js";

const router = express.Router();

// Public routes
router.get(
  "/trending",
  optionalAuthMiddleware,
  asyncHandler(getTrendingResearch),
);
router.get("/discover", optionalAuthMiddleware, asyncHandler(discoverResearch));
router.get("/fields", getResearchFields);
router.get("/field/:field", asyncHandler(getResearchByField));

// Protected routes
router.post(
  "/:researchWorkId/view",
  authMiddleware,
  asyncHandler(incrementViews),
);
router.post(
  "/:researchWorkId/share",
  authMiddleware,
  asyncHandler(shareResearch),
);

export default router;
