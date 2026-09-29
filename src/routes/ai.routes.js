import express from 'express';
import aiController from '../controllers/aiController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/ai/history', aiController.getAiHistory);
router.post('/ai/chat', aiController.postAiChat);
router.post('/ai/parse-order', aiController.parseAiOrder);

export default router;
