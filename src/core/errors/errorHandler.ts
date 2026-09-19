import { Request, Response, NextFunction } from 'express';
import { AppError } from './AppError';

export function globalErrorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      statusCode,
      ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
    }
  });
}
