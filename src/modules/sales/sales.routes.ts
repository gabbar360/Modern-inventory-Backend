import { Router } from 'express';
import { salesController } from './sales.controller';
import { authMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);
router.get('/customers', salesController.getCustomers);
router.post('/customers', salesController.createCustomer);
router.get('/invoices', salesController.getInvoices);
router.get('/invoices/:id', salesController.getInvoiceById);
router.post('/invoices', salesController.createInvoice);

export default router;
