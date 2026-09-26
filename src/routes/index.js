const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const customerRoutes = require('./customer.routes');
const productRoutes = require('./product.routes');
const salesRoutes = require('./sales.routes');
const purchaseRoutes = require('./purchase.routes');
const inventoryRoutes = require('./inventory.routes');
const reportRoutes = require('./report.routes');
const expenseRoutes = require('./expense.routes');
const operationsRoutes = require('./operations.routes');

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

module.exports = router;
