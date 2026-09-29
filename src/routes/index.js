import express from 'express';
import authRoutes from './auth.routes.js';
import customerRoutes from './customer.routes.js';
import productRoutes from './product.routes.js';
import salesRoutes from './sales.routes.js';
import purchaseRoutes from './purchase.routes.js';
import inventoryRoutes from './inventory.routes.js';
import reportRoutes from './report.routes.js';
import expenseRoutes from './expense.routes.js';
import operationsRoutes from './operations.routes.js';

const router = express.Router();

// Health Check
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'Vegnar ERP & CRM Node.js/MongoDB Modular API v2'
  });
});

// Modular Routes Setup
router.use('/auth', authRoutes);
router.use('/', customerRoutes);
router.use('/', productRoutes);
router.use('/', salesRoutes);
router.use('/', purchaseRoutes);
router.use('/', inventoryRoutes);
router.use('/expenses', expenseRoutes);
router.use('/reports', reportRoutes);
router.use('/', operationsRoutes);

export default router;
