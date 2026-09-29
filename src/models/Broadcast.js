import mongoose from 'mongoose';

export const BroadcastSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true, index: true },
  subject: { type: String, required: true },
  channel: { type: String, default: 'Email' },
  recipient_count: { type: Number, default: 0 },
  audience: { type: String, default: 'all' },
  filter_state: { type: String, default: '' },
  status: { type: String, default: 'sent' },
  sent_at: { type: Date, default: Date.now },
  created_at: { type: Date, default: Date.now }
});

export const Broadcast = mongoose.models.Broadcast || mongoose.model('Broadcast', BroadcastSchema);
export default Broadcast;
