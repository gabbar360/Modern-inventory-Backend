import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import productsRoutes from '../modules/products/products.routes';
import salesRoutes from '../modules/sales/sales.routes';
import inventoryRoutes from '../modules/inventory/inventory.routes';

const router = Router();

// Health Check
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'Vegnar ERP Enterprise API v1'
  });
});

// Module API v1 Routes
router.use('/auth', authRoutes);
router.use('/products', productsRoutes);
router.use('/sales', salesRoutes);
router.use('/inventory', inventoryRoutes);

export default router;
