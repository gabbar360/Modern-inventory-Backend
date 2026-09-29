import mongoose from 'mongoose';

export const WarehouseSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  name: { type: String, required: true },
  code: { type: String, required: true },
  address: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  manager_name: { type: String, default: '' },
  is_primary: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

export const Warehouse = mongoose.models.Warehouse || mongoose.model('Warehouse', WarehouseSchema);
export default Warehouse;
