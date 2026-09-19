import { Router } from 'express';
import { authController } from './auth.controller';
import { authMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authMiddleware, authController.getProfile);

export default router;
