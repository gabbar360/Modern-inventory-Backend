import express from 'express';
import dashboardController from '../controllers/dashboardController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/dashboard/stats', dashboardController.getDashboardStats);
router.get('/search', dashboardController.globalSearch);
router.get('/notifications', dashboardController.getNotifications);
router.post('/notifications/:id/read', dashboardController.markNotificationRead);
router.post('/notifications/scan-low-stock', dashboardController.scanLowStock);

router.get('/whatsapp/config', dashboardController.getWhatsappConfig);
router.get('/whatsapp/status', dashboardController.getWhatsappStatus);
router.get('/whatsapp/qrcode', dashboardController.getWhatsappQrcode);
router.post('/whatsapp/create-instance', (req, res) => res.json({ success: true, qr: 'mock_qr' }));
router.post('/whatsapp/send', (req, res) => res.json({ success: true, message: 'WhatsApp message sent' }));
router.post('/whatsapp/send-test', (req, res) => res.json({ success: true, message: 'Test WhatsApp sent' }));
router.get('/email/config', dashboardController.getEmailConfig);

export default router;
