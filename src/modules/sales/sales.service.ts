import { CustomerModel, InvoiceModel } from './sales.model';
import { newUuid } from '../../core/utils/hash.utils';
import { AppError } from '../../core/errors/AppError';

export class SalesService {
  // Customers
  async getCustomers(orgId: string) {
    return await CustomerModel.find({ org_id: orgId }).sort({ created_at: -1 });
  }

  async createCustomer(data: any, orgId: string) {
    const customer = new CustomerModel({
      ...data,
      id: data.id || newUuid(),
      org_id: orgId
    });
    return await customer.save();
  }

  // Invoices
  async getInvoices(orgId: string) {
    return await InvoiceModel.find({ org_id: orgId }).sort({ created_at: -1 });
  }

  async getInvoiceById(id: string, orgId: string) {
    const inv = await InvoiceModel.findOne({ id, org_id: orgId });
    if (!inv) throw new AppError('Invoice not found', 404);
    return inv;
  }

  async createInvoice(data: any, orgId: string) {
    const inv = new InvoiceModel({
      ...data,
      id: data.id || newUuid(),
      invoice_number: data.invoice_number || `INV-${Date.now().toString().slice(-6)}`,
      org_id: orgId
    });
    return await inv.save();
  }
}

export const salesService = new SalesService();
