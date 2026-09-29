import express from 'express';
import automationController from '../controllers/automationController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/automation-rules', automationController.getAutomationRules);
router.post('/automation-rules', automationController.createAutomationRule);
router.patch('/automation-rules/:id', automationController.toggleAutomationRule);

export default router;
