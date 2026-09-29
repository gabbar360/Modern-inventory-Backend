import mongoose from 'mongoose';

export const PaymentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true, index: true },
  payment_type: { type: String, enum: ['received', 'made'], required: true, index: true },
  number: { type: String, required: true },
  customer_name: { type: String, default: '' },
  vendor_name: { type: String, default: '' },
  amount: { type: Number, required: true },
  mode: { type: String, default: 'Bank Transfer' },
  payment_date: { type: String, default: '' },
  reference: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
});

export const Payment = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);
export default Payment;
