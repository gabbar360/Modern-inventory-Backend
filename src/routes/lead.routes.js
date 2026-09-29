import express from 'express';
import leadController from '../controllers/leadController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/leads', leadController.getLeads);
router.post('/leads', leadController.createLead);
router.put('/leads/:id', leadController.updateLead);
router.patch('/leads/:id', leadController.updateLead);
router.delete('/leads/:id', leadController.deleteLead);

export default router;
