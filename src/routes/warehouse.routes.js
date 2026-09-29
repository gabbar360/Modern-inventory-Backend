import express from 'express';
import warehouseController from '../controllers/warehouseController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/warehouses', warehouseController.getWarehouses);
router.post('/warehouses', warehouseController.createWarehouse);

export default router;
