import express from 'express';
import inventoryController from '../controllers/inventoryController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Warehouses
router.get('/warehouses', inventoryController.getWarehouses);
router.post('/warehouses', inventoryController.createWarehouse);

// Stock Adjustments
router.get('/stock-ledger', inventoryController.getStockLedger);
router.post('/stock-adjust', inventoryController.adjustStock);
router.post('/inventory/adjust', inventoryController.adjustStock);
router.post('/inventory/clearance-offer', (req, res) => res.json({ success: true, message: 'Clearance offer scheduled' }));
router.get('/reorder-alerts', inventoryController.getReorderAlerts);
router.patch('/tasks/:id', (req, res) => res.json({ success: true, message: 'Task updated successfully' }));

export default router;
