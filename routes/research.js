import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  createResearchWork,
  getResearchWorks,
  getResearchWork,
  updateResearchWork,
  deleteResearchWork,
  addLink,
  generateFlashcards,
} from '../controllers/researchController.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.post('/', asyncHandler(createResearchWork));
router.get('/', asyncHandler(getResearchWorks));
router.get('/:id', asyncHandler(getResearchWork));
router.put('/:id', asyncHandler(updateResearchWork));
router.delete('/:id', asyncHandler(deleteResearchWork));
router.post('/:id/links', asyncHandler(addLink));
router.post('/:id/flashcards', asyncHandler(generateFlashcards));

export default router;
