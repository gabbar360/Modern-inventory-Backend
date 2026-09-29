import mongoose from 'mongoose';

export const PurchaseOrderSchema = new mongoose.Schema({
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

export const PurchaseOrder = mongoose.models.PurchaseOrder || mongoose.model('PurchaseOrder', PurchaseOrderSchema);
export default PurchaseOrder;
