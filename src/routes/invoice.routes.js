import express from 'express';
import invoiceController from '../controllers/invoiceController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/invoices', invoiceController.getInvoices);
router.get('/invoices/:id', invoiceController.getInvoiceById);
router.get('/invoices/:id/pdf', invoiceController.getInvoicePdf);
router.post('/invoices/:id/send-email', invoiceController.sendInvoiceEmail);
router.post('/invoices/:id/send-reminder', invoiceController.sendInvoiceReminder);
router.post('/invoices/:id/eway-bill/generate', invoiceController.ewayBillGenerate);
router.post('/invoices/:id/eway-bill/update-vehicle', invoiceController.ewayBillUpdateVehicle);
router.post('/invoices/:id/eway-bill/cancel', invoiceController.ewayBillCancel);
router.get('/invoices/:id/eway-bill/slip', invoiceController.getEwayBillSlip);
router.post('/invoices', invoiceController.createInvoice);
router.put('/invoices/:id', invoiceController.updateInvoice);

export default router;
