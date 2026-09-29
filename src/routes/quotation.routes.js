import express from 'express';
import quotationController from '../controllers/quotationController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/quotations', quotationController.getQuotations);
router.get('/quotations/:id', quotationController.getQuotationById);
router.get('/quotations/:id/pdf', quotationController.getQuotationPdf);
router.post('/quotations/:id/status', quotationController.updateQuotationStatus);
router.post('/quotations/:id/convert', quotationController.convertQuotationToSO);
router.post('/quotations/:id/send-email', quotationController.sendQuotationEmail);
router.post('/quotations', quotationController.createQuotation);

export default router;
