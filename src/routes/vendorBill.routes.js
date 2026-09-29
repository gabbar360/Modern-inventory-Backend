import express from 'express';
import vendorBillController from '../controllers/vendorBillController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/vendor-bills', vendorBillController.getVendorBills);
router.post('/vendor-bills', vendorBillController.createVendorBill);

export default router;
