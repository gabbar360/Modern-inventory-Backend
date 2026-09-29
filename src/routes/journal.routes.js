import express from 'express';
import journalController from '../controllers/journalController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/journal-entries', journalController.getJournalEntries);

export default router;
