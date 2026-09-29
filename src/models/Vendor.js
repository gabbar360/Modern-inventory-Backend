import mongoose from 'mongoose';

export const VendorSchema = new mongoose.Schema({
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

export const Vendor = mongoose.models.Vendor || mongoose.model('Vendor', VendorSchema);
export { PurchaseOrder } from './PurchaseOrder.js';
export { VendorBill } from './VendorBill.js';
export default Vendor;
