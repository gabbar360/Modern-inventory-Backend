import mongoose from 'mongoose';

export const DispatchSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true, index: true },
  order_id: { type: String, required: true },
  courier: { type: String, default: 'Delhivery B2B' },
  tracking_number: { type: String, required: true },
  status: { type: String, default: 'scheduled' },
  estimated_delivery: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
});

export const Dispatch = mongoose.models.Dispatch || mongoose.model('Dispatch', DispatchSchema);
export default Dispatch;
