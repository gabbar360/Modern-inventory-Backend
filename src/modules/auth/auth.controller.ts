import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { AuthenticatedRequest } from '../../core/middleware/auth.middleware';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        ...result
      });
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);
      res.status(200).json({
        success: true,
        message: 'Login successful',
        ...result
      });
    } catch (err) {
      next(err);
    }
  }

  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id || 'usr_chauhan_admin';
      const result = await authService.getProfile(userId);
      res.status(200).json({
        success: true,
        message: 'Profile retrieved',
        ...result
      });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
