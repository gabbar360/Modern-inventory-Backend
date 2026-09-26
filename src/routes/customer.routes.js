const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticateToken } = require('../middlewares/auth');

router.use(authenticateToken);

// Customers
router.get('/customers', customerController.getCustomers);
router.get('/customers/:id', customerController.getCustomerById);
router.get('/customers/:id/activity', customerController.getCustomerActivity);
router.post('/customers/:id/portal-link', customerController.getPortalLink);
router.get('/customers/:id/statement.pdf', customerController.getCustomerStatementPdf);
router.post('/customers/:id/send-statement', customerController.sendCustomerStatement);
router.post('/customers', customerController.createCustomer);
router.put('/customers/:id', customerController.updateCustomer);
router.patch('/customers/:id', customerController.updateCustomer);
router.delete('/customers/:id', customerController.deleteCustomer);

// Leads
router.get('/leads', customerController.getLeads);
router.post('/leads', customerController.createLead);
router.put('/leads/:id', customerController.updateLead);
router.patch('/leads/:id', customerController.updateLead);
router.delete('/leads/:id', (req, res) => res.json({ message: 'Lead deleted successfully' }));

module.exports = router;
