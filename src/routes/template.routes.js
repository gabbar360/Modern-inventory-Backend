import express from 'express';
import templateController from '../controllers/templateController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/templates', templateController.getTemplates);
router.post('/templates', templateController.createTemplate);

export default router;
