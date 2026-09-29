import mongoose from 'mongoose';

export const BrandSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
});

export const Brand = mongoose.models.Brand || mongoose.model('Brand', BrandSchema);
export default Brand;
