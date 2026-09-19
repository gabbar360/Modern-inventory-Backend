import { Response, NextFunction } from 'express';
import { salesService } from './sales.service';
import { sendResponse } from '../../core/response/apiResponse';
import { AuthenticatedRequest } from '../../core/middleware/auth.middleware';

export class SalesController {
  async getCustomers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const orgId = req.user?.orgId || 'org_vegnar_01';
      const customers = await salesService.getCustomers(orgId);
      sendResponse(res, 200, 'Customers retrieved', customers);
    } catch (err) {
      next(err);
    }
  }

  async createCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const orgId = req.user?.orgId || 'org_vegnar_01';
      const customer = await salesService.createCustomer(req.body, orgId);
      sendResponse(res, 201, 'Customer created', customer);
    } catch (err) {
      next(err);
    }
  }

  async getInvoices(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const orgId = req.user?.orgId || 'org_vegnar_01';
      const invoices = await salesService.getInvoices(orgId);
      sendResponse(res, 200, 'Invoices retrieved', invoices);
    } catch (err) {
      next(err);
    }
  }

  async getInvoiceById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const orgId = req.user?.orgId || 'org_vegnar_01';
      const invoice = await salesService.getInvoiceById(req.params.id, orgId);
      sendResponse(res, 200, 'Invoice retrieved', invoice);
    } catch (err) {
      next(err);
    }
  }

  async createInvoice(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const orgId = req.user?.orgId || 'org_vegnar_01';
      const invoice = await salesService.createInvoice(req.body, orgId);
      sendResponse(res, 201, 'Invoice created', invoice);
    } catch (err) {
      next(err);
    }
  }
}

export const salesController = new SalesController();
