import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  id: string;
  name: string;
  sku: string;
  category?: string;
  brand?: string;
  unit?: string;
  hsn?: string;
  price: number;
  cost_price?: number;
  tax_rate?: number;
  stock_quantity: number;
  reorder_level?: number;
  warehouse_id?: string;
  org_id: string;
  created_at: string;
  updated_at: string;
}

const ProductSchema = new Schema<IProduct>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  sku: { type: String, required: true },
  category: { type: String, default: 'General' },
  brand: { type: String, default: 'Generic' },
  unit: { type: String, default: 'Pcs' },
  hsn: { type: String, default: '8471' },
  price: { type: Number, required: true, default: 0 },
  cost_price: { type: Number, default: 0 },
  tax_rate: { type: Number, default: 18 },
  stock_quantity: { type: Number, default: 0 },
  reorder_level: { type: Number, default: 10 },
  warehouse_id: { type: String, default: 'wh_main' },
  org_id: { type: String, default: 'org_vegnar_01' },
  created_at: { type: String, default: () => new Date().toISOString() },
  updated_at: { type: String, default: () => new Date().toISOString() }
});

export const ProductModel = mongoose.model<IProduct>('Product', ProductSchema);
