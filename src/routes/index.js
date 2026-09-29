import express from 'express';
import authRoutes from './auth.routes.js';
import organizationRoutes from './organization.routes.js';
import customerRoutes from './customer.routes.js';
import leadRoutes from './lead.routes.js';
import productRoutes from './product.routes.js';
import brandRoutes from './brand.routes.js';
import invoiceRoutes from './invoice.routes.js';
import quotationRoutes from './quotation.routes.js';
import salesOrderRoutes from './salesOrder.routes.js';
import vendorRoutes from './vendor.routes.js';
import purchaseOrderRoutes from './purchaseOrder.routes.js';
import vendorBillRoutes from './vendorBill.routes.js';
import warehouseRoutes from './warehouse.routes.js';
import stockLedgerRoutes from './stockLedger.routes.js';
import taskRoutes from './task.routes.js';
import auditLogRoutes from './auditLog.routes.js';
import journalRoutes from './journal.routes.js';
import automationRoutes from './automation.routes.js';
import templateRoutes from './template.routes.js';
import broadcastRoutes from './broadcast.routes.js';
import dispatchRoutes from './dispatch.routes.js';
import challanRoutes from './challan.routes.js';
import paymentRoutes from './payment.routes.js';
import approvalRoutes from './approval.routes.js';
import aiRoutes from './ai.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import expenseRoutes from './expense.routes.js';
import reportRoutes from './report.routes.js';

const router = express.Router();

// Health Check
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'Vegnar ERP & CRM Node.js/MongoDB Modular API v2 (Fully Separated MVC)'
  });
});

// Mounted Routes
router.use('/auth', authRoutes);
router.use('/', organizationRoutes);
router.use('/', customerRoutes);
router.use('/', leadRoutes);
router.use('/', productRoutes);
router.use('/', brandRoutes);
router.use('/', invoiceRoutes);
router.use('/', quotationRoutes);
router.use('/', salesOrderRoutes);
router.use('/', vendorRoutes);
router.use('/', purchaseOrderRoutes);
router.use('/', vendorBillRoutes);
router.use('/', warehouseRoutes);
router.use('/', stockLedgerRoutes);
router.use('/', taskRoutes);
router.use('/', auditLogRoutes);
router.use('/', journalRoutes);
router.use('/', automationRoutes);
router.use('/', templateRoutes);
router.use('/', broadcastRoutes);
router.use('/', dispatchRoutes);
router.use('/', challanRoutes);
router.use('/', paymentRoutes);
router.use('/', approvalRoutes);
router.use('/', aiRoutes);
router.use('/', dashboardRoutes);
router.use('/expenses', expenseRoutes);
router.use('/reports', reportRoutes);

export default router;
