import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { analyzeLink, getAnalysisHistory } from '../controllers/analyzeController.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/link', asyncHandler(analyzeLink));
router.get('/:researchWorkId/history', asyncHandler(getAnalysisHistory));

export default router;
