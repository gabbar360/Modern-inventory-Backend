import mongoose from 'mongoose';

export const ChallanSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true, index: true },
  number: { type: String, required: true },
  customer_name: { type: String, required: true },
  challan_date: { type: String, default: '' },
  status: { type: String, default: 'issued' },
  total_amount: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
});

export const Challan = mongoose.models.Challan || mongoose.model('Challan', ChallanSchema);
export default Challan;
