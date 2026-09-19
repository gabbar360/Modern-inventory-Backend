import { Response, NextFunction } from 'express';
import { inventoryService } from './inventory.service';
import { sendResponse } from '../../core/response/apiResponse';
import { AuthenticatedRequest } from '../../core/middleware/auth.middleware';

export class InventoryController {
  async getWarehouses(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const orgId = req.user?.orgId || 'org_vegnar_01';
      const warehouses = await inventoryService.getWarehouses(orgId);
      sendResponse(res, 200, 'Warehouses retrieved', warehouses);
    } catch (err) {
      next(err);
    }
  }

  async createWarehouse(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const orgId = req.user?.orgId || 'org_vegnar_01';
      const wh = await inventoryService.createWarehouse(req.body, orgId);
      sendResponse(res, 201, 'Warehouse created', wh);
    } catch (err) {
      next(err);
    }
  }
}

export const inventoryController = new InventoryController();
