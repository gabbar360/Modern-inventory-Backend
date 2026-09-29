import express from 'express';
import challanController from '../controllers/challanController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/challans', challanController.getChallans);
router.post('/challans', challanController.createChallan);

export default router;
