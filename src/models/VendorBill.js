import mongoose from 'mongoose';

export const VendorBillSchema = new mongoose.Schema({
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

export const VendorBill = mongoose.models.VendorBill || mongoose.model('VendorBill', VendorBillSchema);
export default VendorBill;
