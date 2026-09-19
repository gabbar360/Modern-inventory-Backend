import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { AppError } from '../errors/AppError';

export function checkRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role || 'User';
    if (allowedRoles.includes('Super Admin') && userRole === 'Super Admin') {
      return next();
    }
    if (!allowedRoles.includes(userRole)) {
      return next(new AppError(`Access Denied: Role [${userRole}] does not have permission`, 403));
    }
    next();
  };
}
