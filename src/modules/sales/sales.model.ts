import mongoose, { Schema, Document } from 'mongoose';

// Customer Model
export interface ICustomer extends Document {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  address?: string;
  gstin?: string;
  status: string;
  org_id: string;
  created_at: string;
}

const CustomerSchema = new Schema<ICustomer>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  company: { type: String },
  address: { type: String },
  gstin: { type: String },
  status: { type: String, default: 'Active' },
  org_id: { type: String, default: 'org_vegnar_01' },
  created_at: { type: String, default: () => new Date().toISOString() }
});

export const CustomerModel = mongoose.model<ICustomer>('Customer', CustomerSchema);

// Invoice Model
export interface IInvoice extends Document {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_id?: string;
  date: string;
  due_date?: string;
  status: string;
  items: any[];
  subtotal: number;
  tax_total: number;
  total_amount: number;
  balance_due: number;
  org_id: string;
  created_at: string;
}

const InvoiceSchema = new Schema<IInvoice>({
  id: { type: String, required: true, unique: true },
  invoice_number: { type: String, required: true },
  customer_name: { type: String, required: true },
  customer_id: { type: String },
  date: { type: String, default: () => new Date().toISOString() },
  due_date: { type: String },
  status: { type: String, default: 'Pending' },
  items: { type: Schema.Types.Mixed, default: [] },
  subtotal: { type: Number, default: 0 },
  tax_total: { type: Number, default: 0 },
  total_amount: { type: Number, default: 0 },
  balance_due: { type: Number, default: 0 },
  org_id: { type: String, default: 'org_vegnar_01' },
  created_at: { type: String, default: () => new Date().toISOString() }
});

export const InvoiceModel = mongoose.model<IInvoice>('Invoice', InvoiceSchema);
