import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  generateVoiceSummary,
  getVoiceSummary,
  deleteVoiceSummary,
  synthesizeVoiceSummary,
} from "../controllers/voiceController.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/:researchWorkId/generate", asyncHandler(generateVoiceSummary));
router.post(
  "/:researchWorkId/synthesize",
  asyncHandler(synthesizeVoiceSummary),
);
router.get("/:researchWorkId", asyncHandler(getVoiceSummary));
router.delete("/:id", asyncHandler(deleteVoiceSummary));

export default router;
