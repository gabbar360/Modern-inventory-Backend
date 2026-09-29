import express from 'express';
import broadcastController from '../controllers/broadcastController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/broadcasts', broadcastController.getBroadcasts);
router.post('/broadcasts', broadcastController.createBroadcast);
router.post('/broadcast/preview', broadcastController.previewBroadcast);
router.post('/broadcast/send', broadcastController.createBroadcast);

export default router;
