import express from 'express';
import authController from '../controllers/authController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticateToken, authController.getMe);
router.get('/users', authenticateToken, authController.getUsers);
router.post('/logout', authController.logout);

export default router;
