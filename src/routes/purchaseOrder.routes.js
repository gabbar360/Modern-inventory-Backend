import express from 'express';
import purchaseOrderController from '../controllers/purchaseOrderController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/purchase-orders', purchaseOrderController.getPurchaseOrders);
router.post('/purchase-orders', purchaseOrderController.createPurchaseOrder);

export default router;
