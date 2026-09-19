import { Request } from 'express';

export interface PaginationResult {
  page: number;
  limit: number;
  skip: number;
}

export function getPaginationParams(req: Request): PaginationResult {
  const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '20', 10)));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}
