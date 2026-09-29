import mongoose from 'mongoose';

const OrganizationSchema = new mongoose.Schema({
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

const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'manager', 'sales', 'inventory', 'accountant'], default: 'admin' },
  organization_id: { type: String, required: true },
  organization: OrganizationSchema,
  phone: { type: String, default: '' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

export const Organization = mongoose.models.Organization || mongoose.model('Organization', OrganizationSchema);
export const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default { Organization, User };
