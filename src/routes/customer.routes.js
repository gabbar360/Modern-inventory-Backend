import express from 'express';
import customerController from '../controllers/customerController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/customers', customerController.getCustomers);
router.get('/customers/:id', customerController.getCustomerById);
router.get('/customers/:id/activity', customerController.getCustomerActivity);
router.post('/customers/:id/portal-link', customerController.getPortalLink);
router.get('/customers/:id/statement.pdf', customerController.getCustomerStatementPdf);
router.post('/customers/:id/send-statement', customerController.sendCustomerStatement);
router.post('/customers', customerController.createCustomer);
router.put('/customers/:id', customerController.updateCustomer);
router.patch('/customers/:id', customerController.updateCustomer);
router.delete('/customers/:id', customerController.deleteCustomer);

export default router;
