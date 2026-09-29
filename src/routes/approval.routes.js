import express from 'express';
import approvalController from '../controllers/approvalController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/approvals/pending', approvalController.getPendingApprovals);
router.get('/approvals', approvalController.getApprovals);
router.post('/approvals/document/:type/:id', approvalController.approveDocument);
router.post('/approvals/:id/approve', approvalController.approveItem);
router.post('/approvals/:id/reject', approvalController.rejectItem);

export default router;
