import express from 'express';
import auditLogController from '../controllers/auditLogController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/audit-logs', auditLogController.getAuditLogs);

export default router;
