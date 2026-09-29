import mongoose from 'mongoose';

export const ApprovalSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true, index: true },
  title: { type: String, required: true },
  document_type: { type: String, enum: ['quotation', 'purchase_order', 'discount'], required: true },
  number: { type: String, default: '' },
  customer_name: { type: String, default: '' },
  vendor_name: { type: String, default: '' },
  grand_total: { type: Number, default: 0 },
  requester: { type: String, default: 'Sales Manager' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  created_at: { type: Date, default: Date.now }
});

export const Approval = mongoose.models.Approval || mongoose.model('Approval', ApprovalSchema);
export default Approval;
