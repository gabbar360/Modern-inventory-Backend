import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  name: { type: String, required: true },
  sku: { type: String, required: true },
  category: { type: String, default: 'General' },
  brand: { type: String, default: '' },
  description: { type: String, default: '' },
  selling_price: { type: Number, required: true, default: 0 },
  purchase_price: { type: Number, required: true, default: 0 },
  mrp: { type: Number, default: 0 },
  gst_rate: { type: Number, default: 18 },
  hsn_code: { type: String, default: '' },
  unit: { type: String, default: 'PCS' },
  stock: { type: Number, default: 0 },
  min_stock_alert: { type: Number, default: 5 },
  warehouse_id: { type: String, default: 'default' },
  images: [{ type: String }],
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

const BrandSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
});

export const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);
export const Brand = mongoose.models.Brand || mongoose.model('Brand', BrandSchema);

export default { Product, Brand };
