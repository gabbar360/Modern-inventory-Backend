import mongoose from 'mongoose';

export const OrganizationSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  gstin: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  pincode: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  logo_url: { type: String, default: '' },
  bank_details: {
    account_number: { type: String, default: '' },
    ifsc: { type: String, default: '' },
    bank_name: { type: String, default: '' },
    branch: { type: String, default: '' },
  },
  created_at: { type: Date, default: Date.now }
});

export const Organization = mongoose.models.Organization || mongoose.model('Organization', OrganizationSchema);
export default Organization;
