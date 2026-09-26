const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { authenticateToken } = require('../middlewares/auth');

router.use(authenticateToken);

// Invoices
router.get('/invoices', salesController.getInvoices);
router.get('/invoices/:id', salesController.getInvoiceById);
router.get('/invoices/:id/pdf', salesController.getInvoicePdf);
router.post('/invoices/:id/send-email', salesController.sendInvoiceEmail);
router.post('/invoices/:id/send-reminder', salesController.sendInvoiceReminder);
router.post('/invoices/:id/eway-bill/generate', salesController.ewayBillGenerate);
router.post('/invoices/:id/eway-bill/update-vehicle', salesController.ewayBillUpdateVehicle);
router.post('/invoices/:id/eway-bill/cancel', salesController.ewayBillCancel);
router.get('/invoices/:id/eway-bill/slip', salesController.getEwayBillSlip);
router.post('/invoices', salesController.createInvoice);
router.put('/invoices/:id', salesController.updateInvoice);

// Quotations
router.get('/quotations', salesController.getQuotations);
router.get('/quotations/:id', salesController.getQuotationById);
router.get('/quotations/:id/pdf', salesController.getQuotationPdf);
router.post('/quotations/:id/status', salesController.updateQuotationStatus);
router.post('/quotations/:id/convert', salesController.convertQuotationToSO);
router.post('/quotations/:id/send-email', salesController.sendQuotationEmail);
router.post('/quotations', salesController.createQuotation);

// Sales Orders
router.get('/sales-orders', salesController.getSalesOrders);
router.get('/sales-orders/:id', salesController.getSalesOrderById);
router.post('/sales-orders/:id/status', salesController.updateSalesOrderStatus);
router.post('/sales-orders', salesController.createSalesOrder);

module.exports = router;
