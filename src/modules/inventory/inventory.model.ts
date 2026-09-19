import mongoose, { Schema, Document } from 'mongoose';

export interface IWarehouse extends Document {
  id: string;
  name: string;
  code: string;
  location?: string;
  capacity?: number;
  org_id: string;
  created_at: string;
}

const WarehouseSchema = new Schema<IWarehouse>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  code: { type: String, required: true },
  location: { type: String },
  capacity: { type: Number, default: 10000 },
  org_id: { type: String, default: 'org_vegnar_01' },
  created_at: { type: String, default: () => new Date().toISOString() }
});

export const WarehouseModel = mongoose.model<IWarehouse>('Warehouse', WarehouseSchema);
