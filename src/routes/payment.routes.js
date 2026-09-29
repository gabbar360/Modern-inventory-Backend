import express from 'express';
import paymentController from '../controllers/paymentController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/payments', paymentController.getPayments);
router.post('/payments', paymentController.createPayment);
router.get('/payments-made', paymentController.getPaymentsMade);
router.post('/payments-made', paymentController.createPaymentMade);
router.get('/credit-notes', paymentController.getCreditNotes);
router.post('/credit-notes', paymentController.createCreditNote);
router.get('/debit-notes', paymentController.getDebitNotes);
router.post('/debit-notes', paymentController.createDebitNote);

export default router;
