import mongoose from 'mongoose';

export const LeadSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  name: { type: String, required: true },
  company_name: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  source: { type: String, default: 'Website' },
  status: { type: String, enum: ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'], default: 'New' },
  estimated_value: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  assigned_to: { type: String, default: '' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

export const Lead = mongoose.models.Lead || mongoose.model('Lead', LeadSchema);
export default Lead;
