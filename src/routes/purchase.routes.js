import express from 'express';
import purchaseController from '../controllers/purchaseController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Vendors
router.get('/vendors', purchaseController.getVendors);
router.post('/vendors', purchaseController.createVendor);
router.put('/vendors/:id', purchaseController.updateVendor);
router.patch('/vendors/:id', purchaseController.updateVendor);
router.delete('/vendors/:id', purchaseController.deleteVendor);

// Purchase Orders
router.get('/purchase-orders', purchaseController.getPurchaseOrders);
router.post('/purchase-orders', purchaseController.createPurchaseOrder);

// Vendor Bills
router.get('/vendor-bills', purchaseController.getVendorBills);
router.post('/vendor-bills', purchaseController.createVendorBill);

export default router;
