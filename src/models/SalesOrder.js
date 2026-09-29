import mongoose from 'mongoose';

export const DocumentItemSchema = new mongoose.Schema({
  product_id: { type: String, default: 'prd_custom' },
  name: { type: String, default: 'Line Item' },
  sku: { type: String, default: '' },
  hsn_code: { type: String, default: '' },
  quantity: { type: Number, default: 1 },
  unit_price: { type: Number, default: 0 },
  rate: { type: Number, default: 0 },
  gst_rate: { type: Number, default: 18 },
  discount: { type: Number, default: 0 },
  discount_pct: { type: Number, default: 0 },
  taxable_amount: { type: Number, default: 0 },
  gst_amount: { type: Number, default: 0 },
  total_amount: { type: Number, default: 0 }
});


export const SalesOrderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  order_number: { type: String, required: true },
  number: { type: String },
  customer_id: { type: String, required: true },
  customer_name: { type: String, default: 'Valued Customer' },
  items: [DocumentItemSchema],
  subtotal: { type: Number, default: 0 },
  total_tax: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  grand_total: { type: Number, default: 0 },
  status: { type: String, default: 'Draft' },
  expected_delivery: { type: Date },
  order_date: { type: Date, default: Date.now },
  notes: { type: String, default: '' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

export const SalesOrder = mongoose.models.SalesOrder || mongoose.model('SalesOrder', SalesOrderSchema);
export default SalesOrder;
