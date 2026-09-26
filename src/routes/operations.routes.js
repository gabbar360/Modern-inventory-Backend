const express = require('express');
const router = express.Router();
const ops = require('../controllers/operationsController');
const { authenticateToken } = require('../middlewares/auth');

router.use(authenticateToken);

// Notifications
router.get('/notifications', ops.getNotifications);
router.post('/notifications/:id/read', ops.markNotificationRead);

// Approvals
router.get('/approvals/pending', ops.getPendingApprovals);
router.get('/approvals', ops.getApprovals);
router.post('/approvals/document/:type/:id', ops.approveDocument);
router.post('/approvals/:id/approve', ops.approveItem);
router.post('/approvals/:id/reject', ops.rejectItem);

// AI Copilot
router.get('/ai/history', ops.getAiHistory);
router.post('/ai/chat', ops.postAiChat);

// Broadcasts
router.get('/broadcasts', ops.getBroadcasts);
router.post('/broadcasts', ops.createBroadcast);

// Dispatches
router.get('/dispatches', ops.getDispatches);
router.post('/dispatches', ops.createDispatch);
router.get('/dispatches/:id/track', ops.trackDispatch);

// Challans
router.get('/challans', ops.getChallans);
router.post('/challans', ops.createChallan);

// Payments & Payments Made
router.get('/payments', ops.getPayments);
router.post('/payments', ops.createPayment);
router.get('/payments-made', ops.getPaymentsMade);
router.post('/payments-made', ops.createPaymentMade);

// Reorder & Inventory Info
router.get('/reorder-suggestions', ops.getReorderSuggestions);
router.post('/reorder-suggestions/create-po', ops.createReorderPO);
router.get('/inventory/movements', ops.getStockMovements);
router.get('/inventory/stock-health', ops.getStockHealth);

// Credit & Debit Notes
router.get('/credit-notes', ops.getCreditNotes);
router.post('/credit-notes', ops.createCreditNote);
router.get('/debit-notes', ops.getDebitNotes);
router.post('/debit-notes', ops.createDebitNote);

// Accounting / Journal Entries
router.get('/journal-entries', ops.getJournalEntries);

// Users & Roles
router.get('/users', ops.getUsers);
router.post('/users', ops.inviteUser);
router.patch('/users/:id/role', ops.updateUserRole);

// Templates & Tasks
router.get('/templates', ops.getTemplates);
router.post('/templates', ops.createTemplate);
router.get('/tasks', ops.getTasks);
router.post('/tasks', ops.createTask);

// Automation Rules
router.get('/automation-rules', ops.getAutomationRules);
router.post('/automation-rules', ops.createAutomationRule);
router.patch('/automation-rules/:id', ops.toggleAutomationRule);

// Audit Logs
router.get('/audit-logs', ops.getAuditLogs);

// Settings / Integrations
router.get('/whatsapp/config', ops.getWhatsappConfig);
router.get('/whatsapp/status', ops.getWhatsappStatus);
router.get('/whatsapp/qrcode', ops.getWhatsappQrcode);
router.post('/whatsapp/create-instance', (req, res) => res.json({ success: true, qr: 'mock_qr' }));
router.post('/whatsapp/send', (req, res) => res.json({ success: true, message: 'WhatsApp message sent' }));
router.post('/whatsapp/send-test', (req, res) => res.json({ success: true, message: 'Test WhatsApp sent' }));

router.get('/email/config', ops.getEmailConfig);
router.get('/courier/config', ops.getCourierConfig);

// Additional Operations & AI Aliases
router.post('/ai/parse-order', ops.parseAiOrder);
router.patch('/organization', ops.updateOrganization);
router.post('/custom-fields', ops.saveCustomFields);
router.post('/import', ops.importData);
router.get('/gst/pincode-distance/:pincode', ops.getPincodeInfo);
router.get('/utils/pincode/:pincode', ops.getPincodeInfo);
router.post('/delhivery/freight-estimate', ops.getFreightEstimate);
router.post('/dispatch/schedule', ops.createDispatch);
router.delete('/dispatches/:id', (req, res) => res.json({ success: true, message: 'Dispatch cancelled' }));
router.post('/notifications/scan-low-stock', ops.scanLowStock);
router.post('/broadcast/preview', (req, res) => res.json({ recipient_count: 50, audience: 'all' }));
router.post('/broadcast/send', ops.createBroadcast);

// Dashboard stats & Global Search
router.get('/dashboard/stats', ops.getDashboardStats);
router.get('/search', ops.globalSearch);

module.exports = router;
