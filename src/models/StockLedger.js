import mongoose from 'mongoose';

export const StockLedgerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  product_id: { type: String, required: true },
  product_name: { type: String, default: '' },
  warehouse_id: { type: String, default: 'default' },
  type: { type: String, enum: ['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER'], required: true },
  quantity: { type: Number, required: true },
  reference_type: { type: String, default: '' },
  reference_id: { type: String, default: '' },
  notes: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
});

export const StockLedger = mongoose.models.StockLedger || mongoose.model('StockLedger', StockLedgerSchema);
export default StockLedger;
