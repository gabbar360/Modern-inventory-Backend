import mongoose from 'mongoose';

const VendorSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  name: { type: String, required: true },
  company_name: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  gstin: { type: String, default: '' },
  address: {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' },
    country: { type: String, default: 'India' }
  },
  current_balance: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

const PurchaseOrderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  po_number: { type: String, required: true },
  vendor_id: { type: String, required: true },
  vendor_name: { type: String, required: true },
  items: [{
    product_id: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit_price: { type: Number, required: true },
    total_amount: { type: Number, required: true }
  }],
  total: { type: Number, required: true, default: 0 },
  status: { type: String, enum: ['Draft', 'Sent', 'Received', 'Cancelled'], default: 'Draft' },
  order_date: { type: Date, default: Date.now },
  expected_date: { type: Date },
  notes: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
});

const VendorBillSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  bill_number: { type: String, required: true },
  vendor_id: { type: String, required: true },
  vendor_name: { type: String, required: true },
  total: { type: Number, required: true, default: 0 },
  paid_amount: { type: Number, default: 0 },
  balance_due: { type: Number, default: 0 },
  status: { type: String, enum: ['Draft', 'Unpaid', 'Partially Paid', 'Paid'], default: 'Unpaid' },
  bill_date: { type: Date, default: Date.now },
  due_date: { type: Date },
  created_at: { type: Date, default: Date.now }
});

export const Vendor = mongoose.models.Vendor || mongoose.model('Vendor', VendorSchema);
export const PurchaseOrder = mongoose.models.PurchaseOrder || mongoose.model('PurchaseOrder', PurchaseOrderSchema);
export const VendorBill = mongoose.models.VendorBill || mongoose.model('VendorBill', VendorBillSchema);

export default {
  Vendor,
  PurchaseOrder,
  VendorBill
};
