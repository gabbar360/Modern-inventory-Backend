const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken } = require('../middlewares/auth');

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

module.exports = router;
