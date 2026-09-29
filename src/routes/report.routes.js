import express from 'express';
import reportController from '../controllers/reportController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/metrics', reportController.getDashboardMetrics);
router.get('/pnl', reportController.getPnLAnalytics);
router.get('/pl', reportController.getPnLAnalytics);
router.get('/pnl-invoices', reportController.getPnLInvoices);
router.get('/pnl-products', reportController.getPnLProducts);
router.get('/detailed-monthly-pl', reportController.getDetailedMonthlyPl);
router.get('/expenses', reportController.getExpenses);
router.get('/gst-summary', reportController.getGstSummary);
router.get('/receivables-aging', reportController.getReceivablesAging);

export default router;
