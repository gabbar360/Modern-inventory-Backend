import express from 'express';
import stockLedgerController from '../controllers/stockLedgerController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/stock-ledger', stockLedgerController.getStockLedger);
router.post('/stock-adjust', stockLedgerController.adjustStock);
router.post('/inventory/adjust', stockLedgerController.adjustStock);
router.post('/inventory/clearance-offer', (req, res) => res.json({ success: true, message: 'Clearance offer scheduled' }));
router.get('/reorder-alerts', stockLedgerController.getReorderAlerts);
router.get('/reorder-suggestions', stockLedgerController.getReorderSuggestions);
router.post('/reorder-suggestions/create-po', stockLedgerController.createReorderPO);
router.get('/inventory/movements', stockLedgerController.getStockMovements);
router.get('/inventory/stock-health', stockLedgerController.getStockHealth);

export default router;
