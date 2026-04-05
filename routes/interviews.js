import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  generateInterview,
  getInterview,
  getUserInterviews,
  getCompanyInterviewHistory,
  submitAnswer,
  completeInterview,
} from "../controllers/interviewController.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/generate", asyncHandler(generateInterview));
router.get("/", asyncHandler(getUserInterviews));
router.get("/history/company", asyncHandler(getCompanyInterviewHistory));
router.get("/:id", asyncHandler(getInterview));
router.post("/:interviewId/answer", asyncHandler(submitAnswer));
router.post("/:id/complete", asyncHandler(completeInterview));

export default router;
