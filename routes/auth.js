import express from 'express';
import { register, login, logout } from '../controllers/authController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.post('/logout', logout);

export default router;
