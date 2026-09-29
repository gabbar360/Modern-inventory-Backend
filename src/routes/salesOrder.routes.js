import express from 'express';
import salesOrderController from '../controllers/salesOrderController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/sales-orders', salesOrderController.getSalesOrders);
router.get('/sales-orders/:id', salesOrderController.getSalesOrderById);
router.post('/sales-orders/:id/status', salesOrderController.updateSalesOrderStatus);
router.post('/sales-orders', salesOrderController.createSalesOrder);

export default router;
