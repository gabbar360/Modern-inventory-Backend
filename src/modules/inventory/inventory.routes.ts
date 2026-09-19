import { Router } from 'express';
import { inventoryController } from './inventory.controller';
import { authMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);
router.get('/warehouses', inventoryController.getWarehouses);
router.post('/warehouses', inventoryController.createWarehouse);

export default router;
