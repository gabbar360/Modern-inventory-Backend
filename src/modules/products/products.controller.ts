import { Response, NextFunction } from 'express';
import { productsService } from './products.service';
import { sendResponse } from '../../core/response/apiResponse';
import { AuthenticatedRequest } from '../../core/middleware/auth.middleware';

export class ProductsController {
  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const orgId = req.user?.orgId || 'org_vegnar_01';
      const search = req.query.search as string;
      const products = await productsService.getAll(orgId, search);
      sendResponse(res, 200, 'Products retrieved successfully', products);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const orgId = req.user?.orgId || 'org_vegnar_01';
      const product = await productsService.getById(req.params.id, orgId);
      sendResponse(res, 200, 'Product retrieved', product);
    } catch (err) {
      next(err);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const orgId = req.user?.orgId || 'org_vegnar_01';
      const product = await productsService.create(req.body, orgId);
      sendResponse(res, 201, 'Product created successfully', product);
    } catch (err) {
      next(err);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const orgId = req.user?.orgId || 'org_vegnar_01';
      const product = await productsService.update(req.params.id, req.body, orgId);
      sendResponse(res, 200, 'Product updated successfully', product);
    } catch (err) {
      next(err);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const orgId = req.user?.orgId || 'org_vegnar_01';
      await productsService.delete(req.params.id, orgId);
      sendResponse(res, 200, 'Product deleted successfully');
    } catch (err) {
      next(err);
    }
  }
}

export const productsController = new ProductsController();
